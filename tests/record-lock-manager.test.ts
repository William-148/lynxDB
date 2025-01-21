import { RecordLockManager } from "../src/core/record-lock-manager";
import { LockType } from '../src/types/lock.type';
import { LockTimeoutError } from '../src/core/errors/record-lock-manager.error';

describe('RecordLockManager', () => {
  let lockManager: RecordLockManager;

  beforeEach(() => {
      lockManager = new RecordLockManager();
  });

  test('should return 0 lock count for a key with no locks', () => {
      expect(lockManager.getLockCount('key1')).toBe(0);
  });

  test('should return correct lock count for shared locks', () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Shared);
      lockManager.acquireLock('txn2', 'key1', LockType.Shared);
      lockManager.acquireLock('txn3', 'key1', LockType.Shared);
      expect(lockManager.getLockCount('key1')).toBe(3);
  });

  test('should return correct lock count for exclusive locks', () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
      expect(lockManager.getLockCount('key1')).toBe(1);
  });

  test('should return 0 waiting queue length for a key with no queue', () => {
      expect(lockManager.getWaitingQueueLength('key1')).toBe(0);
  });

  test('should determine if a key can be read', () => {
      expect(lockManager.canItBeRead('key1')).toBe(true);
      lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
      expect(lockManager.canItBeRead('key1')).toBe(false);
  });

  test('should determine if a key can be written', () => {
      expect(lockManager.canItBeWritten('key1')).toBe(true);
      lockManager.acquireLock('txn1', 'key1', LockType.Shared);
      expect(lockManager.canItBeWritten('key1')).toBe(false);
  });

  test('should acquire shared locks', () => {
      expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
      expect(lockManager.acquireLock('txn2', 'key1', LockType.Shared)).toBe(true);
  });

  test('should acquire shared locks and release it', async () => {
    const LoopSize = 5;
    for (let i = 1; i <= LoopSize; i++) {
      expect(lockManager.acquireLock(`txn${i}`, 'key1', LockType.Shared)).toBe(true);
    }
    expect(lockManager.getLockCount('key1')).toBe(LoopSize);

    for (let i = 1; i <= LoopSize; i++) {
      await lockManager.releaseLock(`txn${i}`, 'key1');
      expect(lockManager.getLockCount('key1')).toBe(LoopSize - i);
    }
  });

  test('should acquire and release shared locks by the same transaction', async () => {
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
    expect(lockManager.getLockCount('key1')).toBe(1);
    await expect(lockManager.releaseLock('txn1', 'key1')).resolves.not.toThrow();
    expect(lockManager.getLockCount('key1')).toBe(0);
  });

  test('should acquire and release exclusive locks by the same transaction', async () => {
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.getLockCount('key1')).toBe(1);
    await expect(lockManager.releaseLock('txn1', 'key1')).resolves.not.toThrow();
    expect(lockManager.getLockCount('key1')).toBe(0);
  });

  test('should aquire and check locks for transactions', () => {
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key2', LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock('txn2', 'key2', LockType.Shared)).toBe(true);

    expect(lockManager.isLocked('txn1', 'key1')).toBe(true);
    expect(lockManager.isLocked('txn1', 'key1', LockType.Shared)).toBe(false);
    expect(lockManager.isLocked('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.isLocked('txn1', 'key2')).toBe(true);
    expect(lockManager.isLocked('txn1', 'key2', LockType.Shared)).toBe(true);
    expect(lockManager.isLocked('txn1', 'key2', LockType.Exclusive)).toBe(false);

    expect(lockManager.isLocked('txn2', 'key1')).toBe(false);
    expect(lockManager.isLocked('txn2', 'key1', LockType.Shared)).toBe(false);
    expect(lockManager.isLocked('txn2', 'key1', LockType.Exclusive)).toBe(false);
    expect(lockManager.isLocked('txn2', 'key2')).toBe(true);
    expect(lockManager.isLocked('txn2', 'key2', LockType.Shared)).toBe(true);
    expect(lockManager.isLocked('txn2', 'key2', LockType.Exclusive)).toBe(false);

  });

  test('should fail to acquire exclusive lock if shared locks exist', () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Shared);
      expect(lockManager.acquireLock('txn2', 'key1', LockType.Exclusive)).toBe(false);
  });

  test('should fail to acquire shared lock if exclusive lock exists', () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
      expect(lockManager.acquireLock('txn2', 'key1', LockType.Shared)).toBe(false);
  });

  test('should release shared locks and clear lock if no shared locks remain', async () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Shared);
      await lockManager.releaseLock('txn1', 'key1');
      expect(lockManager.getLockCount('key1')).toBe(0);
  });

  test('should release exclusive lock and clear lock', async () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
      await lockManager.releaseLock('txn1', 'key1');
      expect(lockManager.getLockCount('key1')).toBe(0);
  });

  test('should handle waiting queues for read locks', async () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
      const promise = lockManager.waitUnlockToRead('key1', 1000);

      await lockManager.releaseLock('txn1', 'key1');
      await expect(promise).resolves.not.toThrow();
  });

  test('should handle waiting queues for write locks', async () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Shared);
      const promise = lockManager.waitUnlockToWrite('key1', 1000);

      await lockManager.releaseLock('txn1', 'key1');
      await expect(promise).resolves.not.toThrow();
  });

  test('should throw LockTimeoutError if lock not released within timeout', async () => {
      lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
      await expect(lockManager.waitUnlockToRead('key1', 100)).rejects.toThrow(LockTimeoutError);
  });
});
