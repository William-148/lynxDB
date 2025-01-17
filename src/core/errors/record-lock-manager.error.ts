export class LockNotFoundOnReleaseError extends Error {
  constructor(key: string) {
    super(`Lock not found for key ${key}`);
  }
}

export class LockTimeoutError extends Error {
  constructor(key: string) {
    super(`Timeout waiting for lock on key ${key}`);
  }
}