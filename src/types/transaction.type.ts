import { TransactionCompletedError } from "../core/errors/transaction.error";

export enum IsolationLevel {
  RepeatableRead = 'REPEATABLE_READ',
  Serializable = 'SERIALIZABLE',
}

export type TransactionOptions = {
  /** The isolation level for the transaction. */
  isolationLevel?: IsolationLevel;
}

/**
 * Interface for a participant in a Two-Phase Commit (2PC) protocol.
 */
export interface TwoPhaseCommitParticipant {
  /**
   * Prepares the participant for commit.
   * 
   * This method is called during the prepare phase of the 2PC protocol.
   * 
   * It should validate changes and lock resources.
   * 
   * @returns {Promise<void>} A promise that resolves when the participant is prepared.
   * @throws {TransactionCompletedError} If the participant has already completed.
   * @throws {TransactionConflictError} If the participant cannot prepare due to a conflict.
   */
  prepare(): Promise<void>;

  /**
   * Applies the changes.
   * 
   * This method is called during the commit phase of the 2PC protocol.
   * 
   * It should apply the changes permanently.
   * 
   * @returns {Promise<void>} A promise that resolves when the changes are applied.
   * @throws {TransactionCompletedError} If the participant has already completed.
   * @throws {TransactionConflictError} If the participant cannot prepare due to a conflict.
   */
  apply(): Promise<void>;

  /**
   * Rolls back the changes.
   * 
   * This method is called if the prepare phase fails or if any participant cannot apply.
   * 
   * It should discard the changes and release any locked resources.
   * 
   * @returns {Promise<void>} A promise that resolves when the changes are rolled back.
   */
  rollback(): Promise<void>;
}
