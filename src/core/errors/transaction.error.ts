export class TransactionCompletedError extends Error {
  constructor() {
    super("Transaction already completed");
  }
}

export class TransactionConflictError extends Error {
  constructor(transactionId: string, message: string) {
    super(`Transaction "${transactionId}": ${ message }`);
  }
}