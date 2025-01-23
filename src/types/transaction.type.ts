export enum IsolationLevel {
  ReadLatest = 'READ_LATEST',
  StrictLocking = 'STRICT_LOCKING',
}

export type TransactionOptions = {
  /** The isolation level for the transaction. */
  isolationLevel?: IsolationLevel;
}