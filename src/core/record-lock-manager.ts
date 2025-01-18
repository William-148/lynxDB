import { LockRequest, LockRequestType, LockType } from "../types/lock.type";
import { LockNotFoundOnReleaseError, LockTimeoutError } from "./errors/record-lock-manager.error";

/**
 * Manages locks for records, supporting shared and exclusive lock types.
 */
export class RecordLockManager {
  private locks: Map<string, { lockType: LockType, count: number }>;
  private waitingQueues: Map<string, LockRequest[]>;

  constructor() {
    this.locks = new Map();
    this.waitingQueues = new Map();
  }

  /**
   * Returns the count of active locks for a given key.
   * 
   * @param key - The key to check.
   * @returns The number of locks associated with the key.
   */
  public getLockCount(key: string): number {
    const existingLock = this.locks.get(key);
    return !existingLock ? 0 : existingLock.count
  }

  /**
   * Returns the length of the waiting queue for a given key.
   * 
   * @param key - The key to check.
   * @returns The number of requests in the waiting queue for the key.
   */
  public getWaitingQueueLength(key: string): number {
    const queue = this.waitingQueues.get(key);
    return !queue ? 0 : queue.length;
  }

  /**
   * Checks if the given key is locked.
   * 
   * @param pk - The key to check.
   * @returns True if the key is locked, otherwise false.
   */
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  /**
   * Determines if the key can be read without conflict.
   * 
   * @param key - The key to check.
   * @returns True if the key can be read, otherwise false.
   */
  public canItBeRead(key: string): boolean {
    const existingLock = this.locks.get(key);
    return existingLock === undefined || existingLock.lockType === LockType.Shared;
  }

  /**
   * Determines if the key can be written without conflict.
   * 
   * @param key - The key to check.
   * @returns True if the key can be written, otherwise false.
   */
  public canItBeWritten(key: string): boolean {
    const existingLock = this.locks.get(key);
    return existingLock === undefined;
  }

  /**
   * Attempts to acquire a lock for a given key and lock type.
   * 
   * @param key - The key to lock.
   * @param lockType - The type of lock to acquire (shared or exclusive).
   * @returns True if the lock is successfully acquired, otherwise false.
   */
  public acquireLock(key: string, lockType: LockType): boolean {
    const existingLock = this.locks.get(key);

    if (existingLock === undefined) {
      this.locks.set(key, { lockType, count: 1 });
      return true;
    }

    if (existingLock.lockType === LockType.Shared && lockType === LockType.Shared) {
      existingLock.count++;
      return true;
    }

    return false; // Lock conflict
  }

  /**
   * Attempts to acquire a lock with a timeout.
   * 
   * @param key - The key to lock.
   * @param lockType - The type of lock to acquire (shared or exclusive).
   * @param timeoutMs - The maximum time to wait for the lock in milliseconds.
   * @throws LockTimeoutError if the lock cannot be acquired within the timeout.
   */
  public async acquireLockWithTimeout(key: string, lockType: LockType, timeoutMs: number): Promise<void> {
      if (this.acquireLock(key, lockType)) return;
      return this.enqueueLockRequest(
        key, 
        LockRequestType.Acquire, 
        lockType, 
        timeoutMs
      );
  }

  /**
   * Waits for the key to be unlocked for reading within a specified timeout.
   * 
   * @param key - The key to check.
   * @param timeoutMs - The maximum time to wait for the key to be unlocked in milliseconds.
   * @throws LockTimeoutError if the key cannot be unlocked within the timeout.
   */
  public async waitUnlockToRead(key: string, timeoutMs: number = 500): Promise<void> {
    if (this.canItBeRead(key)) return;
    await this.enqueueLockRequest(
      key, 
      LockRequestType.WaitToRead, 
      LockType.Shared, // In this case doesn't matter the lock type
      timeoutMs
    );
  }

  /**
   * Waits for the key to be unlocked for writing within a specified timeout.
   * 
   * @param key - The key to check.
   * @param timeoutMs - The maximum time to wait for the key to be unlocked in milliseconds.
   * @throws LockTimeoutError if the key cannot be unlocked within the timeout.
   */
  public async waitUnlockToWrite(key: string, timeoutMs: number = 500): Promise<void> {
      if (this.canItBeWritten(key)) return;
      await this.enqueueLockRequest(
        key, 
        LockRequestType.WaitToWrite, 
        LockType.Shared, // In this case doesn't matter the lock type
        timeoutMs
      );
  }

  /**
   * Adds a lock request to the waiting queue and manages its resolution or expiration.
   * 
   * @param key - The key for the lock request.
   * @param type - The type of lock request (acquire, wait to read, or wait to write).
   * @param lockType - The type of lock to acquire (shared or exclusive).
   * @param timeoutMs - The maximum time to wait for the request to be resolved in milliseconds.
   * @throws LockTimeoutError if the request cannot be resolved within the timeout.
   */
  private async enqueueLockRequest(key: string, type: LockRequestType, lockType: LockType, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {

      let queue = this.waitingQueues.get(key);
      if (!queue) {
        queue = [];
        this.waitingQueues.set(key, queue);
      }

      const lockRequest: LockRequest = {
        hasExpired: false,
        type,
        lockType,
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        }
      }

      queue.push(lockRequest);

      const timeout = setTimeout(() => {
        lockRequest.hasExpired = true;
        reject(new LockTimeoutError(key));
      }, timeoutMs);
      
    });
  }

  /**
   * Releases a lock for a given key.
   * 
   * @param key - The key to unlock.
   * @throws LockNotFoundOnReleaseError if no lock exists for the key.
   */
  public async releaseLock(key: string): Promise<void> {
    const existingLock = this.locks.get(key);
    if (!existingLock) throw new LockNotFoundOnReleaseError(key);

    existingLock.count--;
    if (existingLock.count === 0) {
      this.locks.delete(key);
    }

    this.proccessWaitingQueue(key);
  }

  /**
   * Processes the waiting queue for a given key, resolving or rejecting requests as appropriate.
   * 
   * @param key - The key whose waiting queue should be processed.
   */
  private proccessWaitingQueue(key: string): void {
    const queue = this.waitingQueues.get(key);
    if (!queue) return;
    if (queue.length === 0){
      this.waitingQueues.delete(key);
      return;
    }

    const remainingRequests: LockRequest[] = [];
    for (const currentRequest of queue) {
      if (currentRequest.hasExpired) continue;

      switch(currentRequest.type) {
        case LockRequestType.WaitToRead:
          if(this.canItBeRead(key)) {
            currentRequest.resolve();
          } else {
            remainingRequests.push(currentRequest);
          }
          break;
        
        case LockRequestType.WaitToWrite:
          if (this.canItBeWritten(key)) {
            currentRequest.resolve();
          } else {
            remainingRequests.push(currentRequest);
          }
          break;

        case LockRequestType.Acquire:
          if (this.acquireLock(key, currentRequest.lockType)) {
            currentRequest.resolve();
          } else {
            remainingRequests.push(currentRequest);
          }
          break;
      }
    }

    if (remainingRequests.length > 0) {
      this.waitingQueues.set(key, remainingRequests);
    }else {
      this.waitingQueues.delete(key);
    }
  }
}