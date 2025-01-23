export class LockTimeoutError extends Error {
  constructor(key: string) {
    super(`Timeout waiting for lock on key ${key}`);
  }
}

export class InvalidLockTypeError extends Error {
  constructor(lock: any) {
    super(`Invalid Lock Type "${lock}"`);
  }
}