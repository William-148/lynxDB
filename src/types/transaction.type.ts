import { TableSchema } from "./table.type";
import { TransactionCompletedError, TransactionConflictError } from "../core/errors/transaction.error";

export enum IsolationLevel {
  RepeatableRead = 'REPEATABLE_READ',
  Serializable = 'SERIALIZABLE',
}

export interface TransactionHandler<T> {
  /**
   * Retrieves a table for the specified table name.
   * 
   * @param name - Name of the table to retrieve (type-safe key from Tables)
   * @returns {TableSchema<T[K]>} Transaction table manager instance for the specified table
   * @throws {TransactionCompletedError} If the transaction has already been committed or rolled back
   * @throws {TableNotFoundError} If the table doesn't exist in the main tables collection (via createTransactionTable)
   */
  get<K extends keyof T>(name: K): TableSchema<T[K]>;

  /**
   * Commits the transaction, saving all changes to the database.
   * 
   * This method coordinates the commit process across all transaction tables:
   * 1. Verifies transaction is still active
   * 2. Prepares all transaction tables for commit
   * 3. Applies commit operations across all transaction tables
   * 4. Ensures transaction cleanup in all cases (success or failure)
   * 
   * If any error occurs during the commit process, the transaction is rolled back.
   * 
   * @throws {TransactionCompletedError} - If the transaction is already completed
   * @throws {TransactionConflictError} - If a conflict occurs during the commit process
   * @throws {Error} - Potential errors from individual table commits
   */
  commit(): Promise<void>;

  /**
   * Rolls back the transaction, discarding all changes.
   * 
   * @throws {TransactionCompletedError} - If the transaction is already completed
   * @throws {Error} - Potential errors from individual table commits
   */
  rollback(): Promise<void>;
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
