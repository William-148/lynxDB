import { RecordLockManager } from "../src/core/record-lock-manager";
import { LockType } from '../src/types/lock.type';
import { InvalidLockTypeError, LockTimeoutError } from '../src/core/errors/record-lock-manager.error';
import { delay } from "../src/utils/delay";
import { IsolationLevel } from "../src/types/transaction.type";
import { Config } from "../src/core/config";

describe('RecordLockManager', () => {
  it("create a read lock manager correctly", async () => {
    const recordLockManager = new RecordLockManager();
    expect(recordLockManager).toBeInstanceOf(RecordLockManager);
  });

  it("create a read lock manager with custom config correctly", async () => {
    const customConfigA: Config = new Config({
      isolationLevel: IsolationLevel.StrictLocking,
      lockTimeout: 8767
    });

    const customConfigB: Config = new Config({
      isolationLevel: IsolationLevel.ReadLatest,
      lockTimeout: 9887
    });

    const customConfigC: Config = new Config({
      lockTimeout: 43
    });
    const recordLockManagerA = new RecordLockManager(customConfigA);
    const recordLockManagerB = new RecordLockManager(customConfigB);
    const recordLockManagerC = new RecordLockManager(customConfigC);

    expect(recordLockManagerA.config).toEqual(customConfigA);
    expect(recordLockManagerB.config).toEqual(customConfigB);
    expect(recordLockManagerC.config).toEqual(customConfigC);
  });

});

describe('RecordLockManager operations', () => {
  let lockManager: RecordLockManager;

  beforeEach(() => {
    lockManager = new RecordLockManager();
  });

  it('should return 0 lock count for a key with no locks', () => {
    expect(lockManager.getLockCount('key1')).toBe(0);
  });

  it('should return correct lock count for shared locks', () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Shared);
    lockManager.acquireLock('txn2', 'key1', LockType.Shared);
    lockManager.acquireLock('txn3', 'key1', LockType.Shared);
    expect(lockManager.getLockCount('key1')).toBe(3);
  });

  it('should return correct lock count for exclusive locks', () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
    expect(lockManager.getLockCount('key1')).toBe(1);
  });

  it('should return 0 waiting queue length for a key with no queue', () => {
    expect(lockManager.getWaitingQueueLength('key1')).toBe(0);
  });

  it('should determine if a key can be read', () => {
    expect(lockManager.canItBeRead('key1')).toBe(true);
    lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
    expect(lockManager.canItBeRead('key1')).toBe(false);
  });

  it('should determine if a key can be written', () => {
    expect(lockManager.canItBeWritten('key1')).toBe(true);
    lockManager.acquireLock('txn1', 'key1', LockType.Shared);
    expect(lockManager.canItBeWritten('key1')).toBe(false);
  });

  it('should acquire shared locks', () => {
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock('txn2', 'key1', LockType.Shared)).toBe(true);
  });

  it('should release an unexisting lock', async () => {
    await expect(lockManager.releaseLock('txn1', 'key1')).resolves.not.toThrow();
  });

  it('should acquire shared locks and release it', async () => {
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

  it('should acquire and release shared locks by the same transaction', async () => {
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Shared)).toBe(true);
    expect(lockManager.getLockCount('key1')).toBe(1);
    await expect(lockManager.releaseLock('txn1', 'key1')).resolves.not.toThrow();
    expect(lockManager.getLockCount('key1')).toBe(0);
  });

  it('should acquire and release exclusive locks by the same transaction', async () => {
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.acquireLock('txn1', 'key1', LockType.Exclusive)).toBe(true);
    expect(lockManager.getLockCount('key1')).toBe(1);
    await expect(lockManager.releaseLock('txn1', 'key1')).resolves.not.toThrow();
    expect(lockManager.getLockCount('key1')).toBe(0);
  });

  it('should aquire and check locks for transactions', () => {
    expect(lockManager.isLocked('txn1', 'key1')).toBe(false);
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

  it('should throw an InvalidLockTypeError', () => {
    expect(() => lockManager.acquireLock('txn1', 'key1', 1000 as any)).toThrow(InvalidLockTypeError);
    expect(() => lockManager.acquireLock('txn1', 'key1', 'exclusive' as any)).toThrow(InvalidLockTypeError);
    expect(() => lockManager.acquireLock('txn1', 'key1', [] as any)).toThrow(InvalidLockTypeError);
    expect(() => lockManager.acquireLock('txn1', 'key1', {} as any)).toThrow(InvalidLockTypeError);
    expect(() => lockManager.acquireLock('txn1', 'key1', false as any)).toThrow(InvalidLockTypeError);
  });

  it('should fail to acquire exclusive lock if shared locks exist', () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Shared);
    expect(lockManager.acquireLock('txn2', 'key1', LockType.Exclusive)).toBe(false);
  });

  it('should fail to acquire shared lock if exclusive lock exists', () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
    expect(lockManager.acquireLock('txn2', 'key1', LockType.Shared)).toBe(false);
  });

  it('should release shared locks and clear lock if no shared locks remain', async () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Shared);
    await lockManager.releaseLock('txn1', 'key1');
    expect(lockManager.getLockCount('key1')).toBe(0);
  });

  it('should release exclusive lock and clear lock', async () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
    await lockManager.releaseLock('txn1', 'key1');
    expect(lockManager.getLockCount('key1')).toBe(0);
  });

  it('should handle waiting queues for read locks', async () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
    const promise = lockManager.waitUnlockToRead('key1', 1000);

    await lockManager.releaseLock('txn1', 'key1');
    await expect(promise).resolves.not.toThrow();
  });

  it('should handle waiting queues for write locks', async () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Shared);
    const promise = lockManager.waitUnlockToWrite('key1', 1000);

    await lockManager.releaseLock('txn1', 'key1');
    await expect(promise).resolves.not.toThrow();
  });

  it('should acquire exclusive locks and wait for acquire other locks ', async () => {
    expect(lockManager.acquireLock('txnA', 'key1', LockType.Exclusive)).toBe(true);

    const aquireLockAndRelease = async (transactionId: string, key: string, lockType: LockType, timeout?: number) => {
      await lockManager.acquireLockWithTimeout(transactionId, key, lockType, timeout);
      lockManager.releaseLock(transactionId, key);
    }

    const promises = Promise.all([
      aquireLockAndRelease('txnB', 'key1', LockType.Shared),
      aquireLockAndRelease('txnC', 'key1', LockType.Exclusive),
      aquireLockAndRelease('txnD', 'key1', LockType.Shared),
    ]);

    await delay(20);
    expect(lockManager.getWaitingQueueLength('key1')).toBe(3);
    lockManager.releaseLock('txnA', 'key1');

    await promises;
    expect(lockManager.getWaitingQueueLength('key1')).toBe(0);
  });

  it('Should acquire locks and release with handle timeout', async () => {
    expect(lockManager.acquireLock('txnA', 'key1', LockType.Exclusive)).toBe(true);
    lockManager.acquireLockWithTimeout('txnB', 'key1', LockType.Exclusive, 1000);

    const aquireLockAndRelease = async (transactionId: string, key: string, lockType: LockType, timeout: number) => {
      await lockManager.acquireLockWithTimeout(transactionId, key, lockType, timeout);
      lockManager.releaseLock(transactionId, key);
    }

    const promises = Promise.all([
      lockManager.waitUnlockToRead('key1'), // Default timeout
      lockManager.waitUnlockToWrite('key1'),
    ]);
    const promiseExpired = aquireLockAndRelease('txnC', 'key1', LockType.Exclusive, 30);

    await delay(20);
    expect(lockManager.getWaitingQueueLength('key1')).toBe(4);

    // Manage the expired request lock
    await expect(promiseExpired).rejects.toThrow(LockTimeoutError);
    // At this point, the waiting queue should have 4 locks requests
    // but the last one has expired
    expect(lockManager.getWaitingQueueLength('key1')).toBe(4);

    // Release the first lock and the second lock should be acquired
    await lockManager.releaseLock('txnA', 'key1');
    // At this point, the first request(should acquire a lock) and the last 
    // request(expired) should be removed and the waiting queue should have 
    // 2 locks requests
    expect(lockManager.getWaitingQueueLength('key1')).toBe(2);

    // Release the second lock
    lockManager.releaseLock('txnB', 'key1');

    await promises;
    expect(lockManager.getWaitingQueueLength('key1')).toBe(0);

  });

  it('should throw LockTimeoutError if lock not released within timeout', async () => {
    lockManager.acquireLock('txn1', 'key1', LockType.Exclusive);
    await expect(lockManager.waitUnlockToRead('key1', 10)).rejects.toThrow(LockTimeoutError);
  });
});
