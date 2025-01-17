import { RecordLockManager } from "../src/core/record-lock-manager";
import { LockType } from "../src/types/lock.enum";
import { LockNotFoundOnReleaseError, LockTimeoutError } from "../src/core/errors/record-lock-manager.error";

describe("RecordLockManager", () => {
  let lockManager: RecordLockManager;

  beforeEach(() => {
    lockManager = new RecordLockManager();
  });

  test("should acquire a lock when no other lock exists", () => {
    const result = lockManager.acquireLock("key1", LockType.Shared);
    expect(result).toBe(true);
    expect(lockManager.isLocked("key1")).toBe(true);
  });

  test("should not acquire a conflicting lock", () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    const result = lockManager.acquireLock("key1", LockType.Shared);
    expect(result).toBe(false);
  });

  test("should allow multiple shared locks on the same key", () => {
    expect(lockManager.acquireLock("key1", LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock("key1", LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock("key1", LockType.Shared)).toBe(true);
    expect(lockManager.acquireLock("key1", LockType.Shared)).toBe(true);
    expect(lockManager.getLockCount("key1")).toBe(4);
  });

  test("should release a shared lock properly", () => {
    lockManager.acquireLock("key1", LockType.Shared);
    lockManager.acquireLock("key1", LockType.Shared);
    expect(lockManager.getLockCount("key1")).toBe(2);
    lockManager.releaseLock("key1");
    expect(lockManager.isLocked("key1")).toBe(true);
    expect(lockManager.getLockCount("key1")).toBe(1);
    lockManager.releaseLock("key1");
    expect(lockManager.isLocked("key1")).toBe(false);
    expect(lockManager.getLockCount("key1")).toBe(0);
  });

  test("should release an exclusive lock properly", () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    expect(lockManager.getLockCount("key1")).toBe(1);
    lockManager.releaseLock("key1");
    expect(lockManager.isLocked("key1")).toBe(false);
    expect(lockManager.getLockCount("key1")).toBe(0);
  });

  test("should throw error when releasing a non-existent lock", () => {
    expect(() => lockManager.releaseLock("key1")).toThrow(LockNotFoundOnReleaseError);
  });

  test("should acquire a lock with timeout", async () => {
    const promise = lockManager.acquireLockWithTimeout("key1", LockType.Shared, 1000);
    await expect(promise).resolves.not.toThrow();
    expect(lockManager.isLocked("key1")).toBe(true);
  });

  test("should throw timeout error when lock cannot be acquired", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    await expect(lockManager.acquireLockWithTimeout("key1", LockType.Shared, 500))
      .rejects.toThrow(LockTimeoutError);
  });

  test("should correctly check if a key can be read", () => {
    expect(lockManager.canItBeRead("key1")).toBe(true);
    lockManager.acquireLock("key1", LockType.Shared);
    expect(lockManager.canItBeRead("key1")).toBe(true);

    lockManager.acquireLock("key2", LockType.Exclusive);
    expect(lockManager.canItBeRead("key2")).toBe(false);
  });

  test("should correctly check if a key can be written", () => {
    expect(lockManager.canItBeWritten("key1")).toBe(true);
    lockManager.acquireLock("key1", LockType.Shared);
    expect(lockManager.canItBeWritten("key1")).toBe(false);
  });

  test("should ensure unlocked within a timeout", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    setTimeout(() => lockManager.releaseLock("key1"), 200);
    await expect(lockManager.ensureUnlocked("key1", 500)).resolves.not.toThrow();
  });

  test("should throw timeout error when ensureUnlocked exceeds timeout", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    await expect(lockManager.ensureUnlocked("key1", 500)).rejects.toThrow(LockTimeoutError);
  });

  test("should ensure unlocked on read", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    setTimeout(() => lockManager.releaseLock("key1"), 200);
    await expect(lockManager.ensureUnlockedOnRead("key1", 500)).resolves.not.toThrow();
  });

  test("should ensure unlocked on write", async () => {
    lockManager.acquireLock("key1", LockType.Shared);
    setTimeout(() => lockManager.releaseLock("key1"), 200);
    await expect(lockManager.ensureUnlockedOnWrite("key1", 500)).resolves.not.toThrow();
  });
});
