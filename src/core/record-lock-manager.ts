import { EventEmitter } from "events";
import { LockType } from "../types/lock.enum";
import { LockNotFoundOnReleaseError, LockTimeoutError } from "./errors/record-lock-manager.error";

export class RecordLockManager {
  private eventEmitter: EventEmitter;
  private locks: Map<string, { lockType: LockType, count: number }>;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.locks = new Map();
  }


  public getLockCount(key: string): number {
    const existingLock = this.locks.get(key);
    return existingLock === undefined ? 0 : existingLock.count
  }

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
   * @throws LockTimeoutError if the lock cannot be acquired within the timeout
   */
  public async acquireLockWithTimeout(key: string, lockType: LockType, timeoutMs: number): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      if (this.acquireLock(key, lockType)) return;
      await this.waitForUnlock(key, timeoutMs);
    }
    console.warn(`Timeout acquiring lock for key: ${key}`);
    throw new LockTimeoutError(key);
  }


  public isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  public canItBeRead(key: string): boolean {
    const existingLock = this.locks.get(key);
    return existingLock === undefined || existingLock.lockType === LockType.Shared;
  }

  public canItBeWritten(key: string): boolean {
    const existingLock = this.locks.get(key);
    return existingLock === undefined;
  }

  /**
   * @throws LockTimeoutError if the lock cannot be acquired within the timeout
   */
  private async waitForUnlock(key: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onUnlock = () => {
        clearTimeout(timeout);
        resolve();
      };

      const timeout = setTimeout(() => {
        this.eventEmitter.off(key, onUnlock);
        reject(new LockTimeoutError(key));
      }, timeoutMs);

      this.eventEmitter.once(key, onUnlock);
    });
  }

  public releaseLock(key: string): void {
    const existingLock = this.locks.get(key);

    if (!existingLock) throw new LockNotFoundOnReleaseError(key);

    switch (existingLock.lockType) {
      case LockType.Shared:
        existingLock.count--;
        if (existingLock.count === 0) {
          this.locks.delete(key);
          this.eventEmitter.emit(key);
        }
        break;

      case LockType.Exclusive:
        this.locks.delete(key);
        this.eventEmitter.emit(key);
        break;
    }
  }

  public async ensureUnlocked(key: string, timeoutMs: number = 500): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (!this.isLocked(key)) return;
      await this.waitForUnlock(key, timeoutMs);
    }
    throw new LockTimeoutError(key);
  }

  public async ensureUnlockedOnRead(key: string, timeoutMs: number = 500): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.canItBeRead(key)) return;
      await this.waitForUnlock(key, timeoutMs)
    }
    throw new LockTimeoutError(key);
  }

  public async ensureUnlockedOnWrite(key: string, timeoutMs: number = 500): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (this.canItBeWritten(key)) return;
      await this.waitForUnlock(key, timeoutMs);
    }
    throw new LockTimeoutError(key);
  }
}
