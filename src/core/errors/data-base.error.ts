export class TableNotFoundError extends Error {
  constructor(name: string) {
    super(`Table "${name}" does not exist`);
  }
}