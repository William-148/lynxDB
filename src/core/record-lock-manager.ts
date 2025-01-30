import { LockDetail, LockRequest, LockRequestType, LockType } from "../types/lock.type";
import { Config } from "./config";
import { InvalidLockTypeError, LockTimeoutError } from "./errors/record-lock-manager.error";

/**
 * Manages locks for records, supporting shared and exclusive lock types.
 */
export class RecordLockManager {
  private locks: Map<string, LockDetail>;
  private waitingQueues: Map<string, LockRequest[]>;
  private _config: Config;

  /**
   * @param config - The configuration object for the lock manager.
   */
  constructor(config?: Config) {
    this.locks = new Map();
    this.waitingQueues = new Map();
    this._config = config || new Config();
  }

  get config(): Config { return this._config; }

  /**
   * Returns the count of active locks for a given key.
   * 
   * @param key - The key to check.
   * @returns The number of locks associated with the key.
   */
  public getLockCount(key: string): number {
    const existingLock = this.locks.get(key);
    if (!existingLock) return 0;
    return existingLock.lockType === LockType.Shared 
      ? existingLock.sharedLocks.size
      : 1;
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
   * Checks if a transaction is holding a lock on a given record.
   *
   * @param {LockDetail} lock - The lock detail object containing lock information.
   * @param {string} transactionId - The ID of the transaction to check.
   * @returns {boolean} - Returns true if the transaction is holding the lock, false otherwise.
   */
  private isTransactionHoldingLock(lock: LockDetail, transactionId: string): boolean {
    switch (lock.lockType) {
      case LockType.Shared:
        return lock.sharedLocks.has(transactionId);

      case LockType.Exclusive:
        return lock.exclusiveLock === transactionId;
    }
  }

  /**
   * Checks if a transaction holds a lock on a given key.
   *
   * @param {string} transactionId - The ID of the transaction to check.
   * @param {string} key - The key to check for a lock.
   * @param {LockType} [lockType] - The type of lock to check (optional).
   * @returns {boolean} - Returns true if the transaction holds the lock, false otherwise.
   */
  public isLocked(transactionId: string, key: string, lockType?: LockType): boolean {
    const lock = this.locks.get(key);
    if (!lock) return false;
    if (lockType === undefined || lock.lockType === lockType) {
      return this.isTransactionHoldingLock(lock, transactionId);
    }
    return false;
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
   * Acquires a lock on a given key for a specific transaction.
   *
   * @param {string} transactionId - The ID of the transaction requesting the lock.
   * @param {string} key - The key to lock.
   * @param {LockType} lockType - The type of lock to acquire (Shared or Exclusive).
   * @returns {boolean} - Returns true if the lock was successfully acquired, false otherwise.
   * @throws {InvalidLockTypeError} if the lock type is invalid.
   */
  public acquireLock(transactionId: string, key: string, lockType: LockType): boolean {
    const existingLock = this.locks.get(key);

    if (existingLock === undefined) {
      let lockDetail: LockDetail;
      switch (lockType) {
        case LockType.Shared: 
          lockDetail = { lockType, sharedLocks: new Set([transactionId]) };
          break;
        case LockType.Exclusive:
          lockDetail = { lockType, exclusiveLock: transactionId };
          break;
        default: throw new InvalidLockTypeError(lockType);
      }

      this.locks.set(key, lockDetail);
      return true;
    }

    if (existingLock.lockType === LockType.Shared && lockType === LockType.Shared) {
      existingLock.sharedLocks.add(transactionId);
      return true;
    }

    if (existingLock.lockType === LockType.Exclusive && lockType === LockType.Exclusive) {
      return existingLock.exclusiveLock === transactionId;
    }

    return false; // Lock conflict
  }

  /**
   * Attempts to acquire a lock on a given key for a specific transaction within a specified timeout.
   *
   * @param {string} transactionId - The ID of the transaction requesting the lock.
   * @param {string} key - The key to lock.
   * @param {LockType} lockType - The type of lock to acquire (Shared or Exclusive).
   * @param {number} timeoutMs - The maximum time to wait for the lock in milliseconds.
   * @throws {LockTimeoutError} if the key cannot be unlocked within the timeout.
   */
  public async acquireLockWithTimeout(transactionId: string, key: string, lockType: LockType, timeoutMs?: number): Promise<void> {
    if (this.acquireLock(transactionId, key, lockType)) return;
    return this.enqueueLockRequest(
      transactionId,
      key,
      LockRequestType.Acquire,
      lockType,
      timeoutMs ?? this._config.get('lockTimeout')
    );
  }

  /**
   * Waits for the key to be unlocked for reading within a specified timeout.
   * 
   * @param key - The key to check.
   * @param timeoutMs - The maximum time to wait for the key to be unlocked in milliseconds.
   * @throws {LockTimeoutError} if the key cannot be unlocked within the timeout.
   */
  public async waitUnlockToRead(key: string, timeoutMs?: number): Promise<void> {
    if (this.canItBeRead(key)) return;
    return this.enqueueLockRequest(
      '', // In this case, the transaction ID is not important
      key, 
      LockRequestType.WaitToRead, 
      LockType.Shared, // In this case, the lock type is not important 
      timeoutMs ?? this._config.get('lockTimeout')
    );
  }

  /**
   * Waits for the key to be unlocked for writing within a specified timeout.
   * 
   * @param key - The key to check.
   * @param timeoutMs - The maximum time to wait for the key to be unlocked in milliseconds.
   * @throws {LockTimeoutError} if the key cannot be unlocked within the timeout.
   */
  public async waitUnlockToWrite(key: string, timeoutMs?: number): Promise<void> {
    if (this.canItBeWritten(key)) return;
    return this.enqueueLockRequest(
      '', // In this case, the transaction ID is not important
      key, 
      LockRequestType.WaitToWrite, 
      LockType.Shared, // In this case, the lock type is not important 
      timeoutMs ?? this._config.get('lockTimeout')
    );
  }

  /**
   * Enqueues a lock request for a given key and transaction, with a specified timeout.
   *
   * @param {string} transactionId - The ID of the transaction requesting the lock.
   * @param {string} key - The key to lock.
   * @param {LockRequestType} type - The type of lock request (Acquire, WaitToRead, WaitToWrite).
   * @param {LockType} lockType - The type of lock to acquire (Shared or Exclusive).
   * @param {number} timeoutMs - The maximum time to wait for the lock in milliseconds.
   */
  private async enqueueLockRequest(transactionId: string, key: string, type: LockRequestType, lockType: LockType, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let queue = this.waitingQueues.get(key);
      if (!queue) {
        queue = [];
        this.waitingQueues.set(key, queue);
      }

      const lockRequest: LockRequest = {
        hasExpired: false,
        transactionId,
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
   * Releases a lock on a given key for a specific transaction.
   *
   * @param {string} transactionId - The ID of the transaction releasing the lock.
   * @param {string} key - The key to unlock.
   */
  public async releaseLock(transactionId: string, key: string): Promise<void> {
    const existingLock = this.locks.get(key);
    if (!existingLock) return;

    if (existingLock.lockType === LockType.Shared && existingLock.sharedLocks.has(transactionId)) {
      existingLock.sharedLocks.delete(transactionId);

      if (existingLock.sharedLocks.size === 0) {
        this.locks.delete(key);
      }
      this.proccessWaitingQueue(key);
    }

    if (existingLock.lockType === LockType.Exclusive && existingLock.exclusiveLock === transactionId) {
      this.locks.delete(key);
      this.proccessWaitingQueue(key);
    }
  }

  /**
   * Processes the waiting queue for a given key.
   *
   * @param {string} key - The key to process the waiting queue for.
   */
  private proccessWaitingQueue(key: string): void {
    const queue = this.waitingQueues.get(key);
    if (!queue) return;

    const remainingRequests: LockRequest[] = [];
    for (const currentRequest of queue) {
      if (currentRequest.hasExpired) continue;

      switch (currentRequest.type) {
        case LockRequestType.WaitToRead:
          if (this.canItBeRead(key)) {
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
          if (this.acquireLock(currentRequest.transactionId, key, currentRequest.lockType)) {
            currentRequest.resolve();
          } else {
            remainingRequests.push(currentRequest);
          }
          break;
      }
    }

    if (remainingRequests.length > 0) {
      this.waitingQueues.set(key, remainingRequests);
    } else {
      this.waitingQueues.delete(key);
    }
  }
}