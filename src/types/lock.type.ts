export enum LockType {
  /** Allow multiple processes to read the table but prevent modifications. */
  Shared = 1,
  /** Prevent other processes from reading or modifying the table while it is locked. */
  Exclusive = 2
}

export enum LockRequestType {
  WaitToRead = 1,
  WaitToWrite = 2,
  Acquire = 3
}

export type SharedLockDetail = {
  lockType: LockType.Shared,
  /** Transaction IDs of the process that acquired the shared lock. */
  sharedLocks: Set<string>
}

export type ExclusiveLockDetail = {
  lockType: LockType.Exclusive,
  /** Transaction ID of the process that acquired the exclusive lock. */
  exclusiveLock: string
}

export type LockDetail = SharedLockDetail | ExclusiveLockDetail;

export type LockBaseRequest = {
  hasExpired: boolean;
  resolve: () => void;
}

export type WaitToReadRequest = LockBaseRequest & {
  type: LockRequestType.WaitToRead;
}

export type WaitToWriteRequest = LockBaseRequest & {
  type: LockRequestType.WaitToWrite;
}

export type AcquireRequest = LockBaseRequest & {
  transactionId: string;
  type: LockRequestType.Acquire;
  lockType: LockType;
}

export type LockRequest = WaitToReadRequest | WaitToWriteRequest | AcquireRequest;
