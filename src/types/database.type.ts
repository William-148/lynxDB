import { ConfigOptions } from "./config.type";
import { TableSchema } from "./table.type";
import { TransactionHandler } from "./transaction.type";

export interface TableProvider<Tables extends Record<string, any>> {
  /**
   * Retrieves a table for the specified table name.
   * 
   * @param tableName - Name of the table to retrieve (type-safe key from Tables)
   * @returns {TableSchema<Tables[K]>} The table schema for the specified table name
   * @throws {TableNotFoundError} If the table doesn't exist
   */
  get<K extends keyof Tables>(tableName: K): TableSchema<Tables[K]>;
}

export interface Database<Tables extends Record<string, any>> extends TableProvider<Tables> {
  /**
   * Resets the database by clearing all tables.
   * If a transaction is in progress, it will rollback the transaction.
   */
  reset(): void;

  /**
   * Creates a new transaction in the database.
   * 
   * @param {ConfigOptions} [options] - Optional configuration options for the transaction.
   * @returns {TransactionHandler<Tables>} The newly created transaction.
   */
  createTransaction(options?: ConfigOptions): TransactionHandler<Tables>;

  /**
   * Executes a callback function within a database transaction.
   * 
   * Possible scenarios:
   * - If the transaction completes successfully, the changes are committed.
   * - If an error occurs during the transaction, the changes are rolled back.
   * 
   * @param {function} callback - The callback function to execute within the transaction. 
   * The callback receives a `Transaction<Tables>` object as its argument and returns a promise.
   * 
   * @param {ConfigOptions} [options] - Optional configuration options for the transaction.
   * @returns {Promise<T>} A promise that resolves to the result of the callback function.
   * @throws {Error} If an error occurs during the execution of the callback, 
   * the transaction is rolled back and the error is rethrown.
   */
  transaction<T>(
    callback: (transaction: TransactionHandler<Tables>) => Promise<T>,
    options?: ConfigOptions
  ): Promise<T>;
}