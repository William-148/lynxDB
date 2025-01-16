import { RecordLockManager } from "../src/core/record-lock-manager";
import { LockType } from "../src/types/lock.enum";


describe("RecordLockManager should...", () => {
  let lockManager: RecordLockManager;

  beforeEach(() => {
    lockManager = new RecordLockManager();
  });

  it("acquire a shared lock if no lock exists", () => {
    expect(lockManager.acquireLock("key1", LockType.Shared)).toBe(true);
    expect(lockManager.isLocked("key1")).toBe(true);
  });

  it("acquire an exclusive lock if no lock exists", () => {
    expect(lockManager.acquireLock("key1", LockType.Exclusive)).toBe(true);
    expect(lockManager.isLocked("key1")).toBe(true);
  });

  it("not acquire an exclusive lock if a shared lock exists", () => {
    lockManager.acquireLock("key1", LockType.Shared);
    expect(lockManager.acquireLock("key1", LockType.Exclusive)).toBe(false);
  });

  it("acquire a shared lock if a shared lock exists", () => {
    lockManager.acquireLock("key1", LockType.Shared);
    expect(lockManager.acquireLock("key1", LockType.Shared)).toBe(true);
  });

  it("not acquire a shared lock if an exclusive lock exists", () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    expect(lockManager.acquireLock("key1", LockType.Shared)).toBe(false);
  });

  it("release a lock and emit an event", (done) => {
    lockManager.acquireLock("key1", LockType.Exclusive);

    async function release () {
      expect(lockManager.isLocked("key1")).toBe(true);
      await lockManager.ensureUnlocked("key1");
      expect(lockManager.isLocked("key1")).toBe(false);
      done();
    }
    
    release();

    lockManager.releaseLock("key1");
  });

  it("wait until a lock is released", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);

    const waitPromise = lockManager.ensureUnlocked("key1");

    setTimeout(() => {
      lockManager.releaseLock("key1");
    }, 100);

    await expect(waitPromise).resolves.not.toThrow();
  });

  it("timeout if lock is not released within the given time", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);

    await Promise.all([
      expect(lockManager.ensureUnlocked("key1", 50))
        .rejects
        .toThrow("Timeout waiting for lock on key1"),
      
      expect(lockManager.ensureUnlockedOnRead("key1", 50))
        .rejects
        .toThrow("Timeout waiting for lock on key1"),
      
      expect(lockManager.ensureUnlockedOnWrite("key1", 50))
        .rejects
        .toThrow("Timeout waiting for lock on key1")
    ]);
  });

  it("ensureUnlockedOnRead should wait if lock exists", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);

    const waitPromise = lockManager.ensureUnlockedOnRead("key1");

    setTimeout(() => {
      lockManager.releaseLock("key1");
    }, 100);

    await expect(waitPromise).resolves.not.toThrow();
  });

  it("ensureUnlockedOnWrite should wait if lock exists", async () => {
    lockManager.acquireLock("key1", LockType.Exclusive);

    const waitPromise = lockManager.ensureUnlockedOnWrite("key1");

    setTimeout(() => {
      lockManager.releaseLock("key1");
    }, 100);

    await expect(waitPromise).resolves.not.toThrow();
  });

  it("canItBeRead should return true if no lock or shared lock exists", () => {
    expect(lockManager.canItBeRead("key1")).toBe(true);
    lockManager.acquireLock("key1", LockType.Shared);
    expect(lockManager.canItBeRead("key1")).toBe(true);
  });

  it("canItBeRead should return false if an exclusive lock exists", () => {
    lockManager.acquireLock("key1", LockType.Exclusive);
    expect(lockManager.canItBeRead("key1")).toBe(false);
  });

  it("canItBeWritten should return true if no lock exists", () => {
    expect(lockManager.canItBeWritten("key1")).toBe(true);
  });

  it("canItBeWritten should return false if any lock exists", () => {
    lockManager.acquireLock("key1", LockType.Shared);
    expect(lockManager.canItBeWritten("key1")).toBe(false);

    lockManager.releaseLock("key1");
    lockManager.acquireLock("key1", LockType.Exclusive);
    expect(lockManager.canItBeWritten("key1")).toBe(false);
  });
});
