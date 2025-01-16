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

    if (!existingLock || (existingLock === LockType.Shared && lockType === LockType.Shared)) {
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
    return !existingLock || existingLock === LockType.Shared;
  }

  public canItBeWritten(key: string): boolean {
    const existingLock = this.locks.get(key);
    return !existingLock;
  }

  public async waitUntilUnlocked(key: string, timeoutMs: number = 500): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off(key, resolve);
        reject(new Error(`Timeout waiting for lock on ${key}`));
      }, timeoutMs);

      this.once(key, () => {
          clearTimeout(timeout);
          resolve();
      });
    });
  }

  public releaseLock(key: string): void {
    this.locks.delete(key);
    this.emit(key);
  }

  public async ensureUnlockedOnRead(key: string): Promise<void> {
    if (this.canItBeRead(key)) return;
    await this.waitUntilUnlocked(key)
  }

  public async ensureUnlockedOnWrite(key: string): Promise<void> {
    if (this.canItBeWritten(key)) return;
    await this.waitUntilUnlocked(key)
  }
}
