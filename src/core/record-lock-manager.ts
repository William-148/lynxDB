import { EventEmitter } from "events";
import { LockType } from "../types/lock.enum";

export class RecordLockManager extends EventEmitter {
  private locks: Map<string, LockType>;

  constructor() {
    super();
    this.locks = new Map();
  }

  public acquireLock(key: string, lockType: LockType): boolean {
    const existingLock = this.locks.get(key);

    if (existingLock === undefined || (existingLock === LockType.Shared && lockType === LockType.Shared)) {
      this.locks.set(key, lockType);
      return true;
    }

    return false; // Lock conflict
  }

  public isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  public canItBeRead(key: string): boolean {
    const existingLock = this.locks.get(key);
    return existingLock === undefined || existingLock === LockType.Shared;
  }

  public canItBeWritten(key: string): boolean {
    const existingLock = this.locks.get(key);
    return existingLock === undefined;
  }

  private async waitForUnlock(key: string, timeoutMs: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onUnlock = () => {
        clearTimeout(timeout);
        resolve();
      };

      const timeout = setTimeout(() => {
        this.off(key, onUnlock);
        reject(new Error(`Timeout waiting for lock on ${key}`));
      }, timeoutMs);

      this.once(key, onUnlock);
    });
  }

  public releaseLock(key: string): void {
    this.locks.delete(key);
    this.emit(key);
  }

  public async ensureUnlocked(key: string, timeoutMs: number = 500): Promise<void> {
    if (!this.isLocked(key)) return;
    await this.waitForUnlock(key, timeoutMs);
  }

  public async ensureUnlockedOnRead(key: string, timeoutMs: number = 500): Promise<void> {
    if (this.canItBeRead(key)) return;
    await this.waitForUnlock(key, timeoutMs)
  }

  public async ensureUnlockedOnWrite(key: string, timeoutMs: number = 500): Promise<void> {
    if (this.canItBeWritten(key)) return;
    await this.waitForUnlock(key, timeoutMs)
  }
}
