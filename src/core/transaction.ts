import { Table } from "./table";
import { TransactionTable } from "./transaction-table";
import { TableNotFoundError } from "./errors/data-base.error";
import { TableManager } from "./table-manager";
import { TableSchema } from "../types/table.type";
import { generateId } from "../utils/generate-id";
import { Config } from "./config";
import { TransactionHandler, TwoPhaseCommitParticipant } from "../types/transaction.type";
import { TransactionCompletedError, TransactionConflictError } from "./errors/transaction.error";
import { LockTimeoutError } from "./errors/record-lock-manager.error";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";

/**
 * Represents a transaction in the database.
 * 
 * @template Tables An object where keys are table names and values are the types 
 * of objects stored in the tables.
 * 
 * Example:
 * ```typescript
 * type Person { id: number; name: string; }
 * type MyTables = { persons: Person; ... }
 * const tx = new Transaction<MyTables>(...);
 * ```
 */
export class Transaction <Tables extends Record<string, any>> implements TransactionHandler<Tables> {
  private transactionId: string;
  private transactionTables: Map<string, TransactionTable<Tables[any]>>;
  private tableManagers: Map<string, TableManager<Tables[any]>>;
  private isActive: boolean;
  private transactionConfig: Config;

  /**
   * @param tables - Map of tables in the database
   * @param transactionConfig - Configuration for the transaction
   */
  constructor(private tables: Map<string, Table<Tables[keyof Tables]>>, transactionConfig?: Config) {
    this.transactionId = generateId();
    this.transactionTables = new Map();
    this.tableManagers = new Map();
    this.isActive = true;
    this.transactionConfig = transactionConfig ?? new Config();
  }

  /**
   * Cleans up the transaction state and resources.
   */
  private finishTransaction(): void {
    this.isActive = false;
    this.tableManagers.clear();
    this.transactionTables.clear();
  }

  /**
   * Creates a transaction-enabled table wrapper for database operations.
   * 
   * This method creates a TransactionTable instance linked to the current transaction,
   * associates it with a TableManager, and registers both in transaction-scoped collections.
   * 
   * @param tableName - Name of the table to create transaction wrapper for
   * @returns {TableSchema<T>} - Transaction-enabled table manager instance
   * @throws {TableNotFoundError} - When the requested table doesn't exist in the tables collection
   */
  private createTransactionTable(tableName: string): TableSchema<Tables[any]> {
    const table = this.tables.get(tableName);
    if (!table) throw new TableNotFoundError(tableName);
    
    const transactionTable = new TransactionTable(
      this.transactionId, 
      table,
      this.transactionConfig
    );
    this.transactionTables.set(tableName, transactionTable);
    
    const tableManager = new TableManager(transactionTable);
    this.tableManagers.set(tableName, tableManager);
    return tableManager;
  }

  public get<K extends keyof Tables>(tableName: K): TableSchema<Tables[K]> {
    if (!this.isActive) throw new TransactionCompletedError();

    const found = this.tableManagers.get(String(tableName));
    return found 
      ? found
      : this.createTransactionTable(String(tableName));
  }

  public async commit(): Promise<void> {
    if (!this.isActive) throw new TransactionCompletedError();
    try {
      const tTables: TwoPhaseCommitParticipant[] = Array.from(this.transactionTables.values());
      // Phase 1: Prepare
      await Promise.all(tTables.map((tTable) => tTable.prepare()));
      // Phase 2: Commit
      await Promise.all(tTables.map((tTable) => tTable.apply()));

      this.finishTransaction();
    }
    catch(error){
      await this.rollback();
      throw error;
    }
  }

  public async rollback(): Promise<void> {
    if (!this.isActive) return;
    try {
      await Promise.all(Array.from(this.transactionTables.values()).map(
        (tTable) => tTable.rollback()
      ));
    }
    finally {
      this.finishTransaction();
    }
  }
}