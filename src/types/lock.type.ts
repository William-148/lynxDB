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

export interface LockRequest {
  hasExpired: boolean;
  type: LockRequestType,
  lockType: LockType;
  resolve: () => void;
}