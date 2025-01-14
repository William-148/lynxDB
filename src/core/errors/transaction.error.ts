export class TransactionCompletedError extends Error {
  constructor() {
    super("Transaction already completed");
  }
}