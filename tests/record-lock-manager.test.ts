import { RecordLockManager } from "../src/core/record-lock-manager";
import { LockType } from '../src/types/lock.type';
import { LockNotFoundOnReleaseError, LockTimeoutError } from '../src/core/errors/record-lock-manager.error';

describe('RecordLockManager', () => {
  let lockManager: RecordLockManager;

  beforeEach(() => {
    lockManager = new RecordLockManager();
  });

  test('initial state should have no locks or waiting queues', () => {
    expect(lockManager.getLockCount('key1')).toBe(0);
    expect(lockManager.getWaitingQueueLength('key1')).toBe(0);
    expect(lockManager.isLocked('key1')).toBe(false);
  });

  test('acquireLock should add a new lock', () => {
    const result = lockManager.acquireLock('key1', LockType.Shared);
    expect(result).toBe(true);
    expect(lockManager.getLockCount('key1')).toBe(1);
    expect(lockManager.isLocked('key1')).toBe(true);
  });

  test('acquireLock should increment count for shared locks', () => {
    lockManager.acquireLock('key1', LockType.Shared);
    const result = lockManager.acquireLock('key1', LockType.Shared);
    expect(result).toBe(true);
    expect(lockManager.getLockCount('key1')).toBe(2);
  });

  test('acquireLock should return false for conflicting lock types', () => {
    lockManager.acquireLock('key1', LockType.Exclusive);
    const result = lockManager.acquireLock('key1', LockType.Shared);
    expect(result).toBe(false);
    expect(lockManager.getLockCount('key1')).toBe(1);
  });

  test('releaseLock should remove locks correctly', async () => {
    lockManager.acquireLock('key1', LockType.Shared);
    expect(lockManager.getLockCount('key1')).toBe(1);
    
    await lockManager.releaseLock('key1');
    expect(lockManager.getLockCount('key1')).toBe(0);
    expect(lockManager.isLocked('key1')).toBe(false);
  });

  test('releaseLock should throw error if no lock exists', async () => {
    await expect(lockManager.releaseLock('key1')).rejects.toThrow(LockNotFoundOnReleaseError);
  });

  test('acquireLockWithTimeout should acquire lock if available', async () => {
    await lockManager.acquireLockWithTimeout('key1', LockType.Shared, 500);
    expect(lockManager.getLockCount('key1')).toBe(1);
  });

  test('acquireLockWithTimeout should throw error if timeout expires', async () => {
    lockManager.acquireLock('key1', LockType.Exclusive);
    await expect(
      lockManager.acquireLockWithTimeout('key1', LockType.Shared, 100)
    ).rejects.toThrow(LockTimeoutError);
  });

  test('ensureUnlockedOnRead should resolve if lock is readable', async () => {
    await lockManager.waitUnlockToRead('key1');
    expect(lockManager.getWaitingQueueLength('key1')).toBe(0);
  });

  test('ensureUnlockedOnWrite should resolve if lock is writable', async () => {
    await lockManager.waitUnlockToWrite('key1');
    expect(lockManager.getWaitingQueueLength('key1')).toBe(0);
  });

  test("should ensure unlocked on read", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    setTimeout(() => lockManager.releaseLock("key1"), 200);
    await expect(lockManager.waitUnlockToRead("key1", 500)).resolves.not.toThrow();
  });

  test("should ensure unlocked on write", async () => {
    lockManager.acquireLock("key1", LockType.Shared);
    setTimeout(() => lockManager.releaseLock("key1"), 200);
    await expect(lockManager.waitUnlockToWrite("key1", 500)).resolves.not.toThrow();
  });

  test('proccessWaitingQueue should resolve waiting requests correctly', async () => {
    lockManager.acquireLock('key1', LockType.Exclusive);

    const promise1 = lockManager.acquireLockWithTimeout('key1', LockType.Shared, 500);
    const promise2 = lockManager.acquireLockWithTimeout('key1', LockType.Shared, 500);

    await lockManager.releaseLock('key1');

    await expect(promise1).resolves.not.toThrow();
    await expect(promise2).resolves.not.toThrow();
    expect(lockManager.getLockCount('key1')).toBe(2);
  });
});

