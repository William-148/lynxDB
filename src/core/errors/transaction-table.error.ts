export class ExternalModificationError extends Error {
  constructor(pk: string) {
    super(`The record with primary key ${pk} has been externally modified.`);
  }
}
