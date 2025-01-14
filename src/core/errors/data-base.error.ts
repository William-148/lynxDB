export class TableNotFoundError extends Error {
  constructor(name: string) {
    super(`Table "${name}" does not exist`);
  }
}

export class TableAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Table "${name}" already exists`);
  }
}