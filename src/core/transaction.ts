import { Table } from "./table";
import { TransactionTable } from "./transaction-table";
import { TableNotFoundError } from "./errors/data-base.error";
import { TableManager } from "./table-manager";
import { ITable } from "../types/table.type";
import { TransactionCompletedError, TransactionConflictError } from "./errors/transaction.error";
import { generateId } from "../utils/generate-id";
import { Config } from "./config";
import { TwoPhaseCommitParticipant } from "../types/transaction.type";
import { LockTimeoutError } from "./errors/record-lock-manager.error";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";

export class Transaction <Tables extends Record<string, any>>  {
  private transactionId: string;
  private transactionTables: Map<string, TransactionTable<any>>;
  private tableManagers: Map<string, TableManager<any>>;
  private isActive: boolean;
  private transactionConfig: Config;

  /**
   * @param tables Map of tables in the database
   * @param transactionConfig Configuration for the transaction
   */
  constructor(private tables: Map<string, Table<any>>, transactionConfig?: Config) {
    this.transactionId = generateId();
    this.transactionTables = new Map();
    this.tableManagers = new Map();
    this.isActive = true;
    this.transactionConfig = transactionConfig ?? new Config();
  }

  /**
   * Creates a transaction-enabled table wrapper for database operations.
   * 
   * This method creates a TransactionTable instance linked to the current transaction,
   * associates it with a TableManager, and registers both in transaction-scoped collections.
   * 
   * @template T - Type parameter representing the table's entity structure
   * @param {string} name - Name of the table to create transaction wrapper for
   * @returns {ITable<T>} Transaction-enabled table manager instance
   * @throws {TableNotFoundError} When the requested table doesn't exist in the tables collection
   */
  private createTransactionTable<T>(name: string): ITable<T> {
    const table: Table<T> | undefined = this.tables.get(name);
    if (!table) throw new TableNotFoundError(name);
    
    const transactionTable = new TransactionTable<T>(
      this.transactionId, 
      table,
      this.transactionConfig
    );
    const tableManager = new TableManager(transactionTable);

    this.transactionTables.set(name, transactionTable);
    this.tableManagers.set(name, tableManager);
    return tableManager;
  }

  /**
  * Retrieves a transaction table manager for the specified table name.
  * 
  * Checks if the transaction is active, then either returns an existing transaction table
  * or creates a new one if it doesn't exist in the transaction scope.
  * 
  * @template K - Union type of keys from the Tables interface/type
  * @param {K} name - Name of the table to retrieve (type-safe key from Tables)
  * @returns {ITable<Tables[K]>} Transaction table manager instance for the specified table
  * @throws {TransactionCompletedError} If the transaction has already been committed or rolled back.
  * @throws {TableNotFoundError} If the table doesn't exist in the main tables collection.
  */
  public get<K extends keyof Tables>(name: K): ITable<Tables[K]> {
    if (!this.isActive) throw new TransactionCompletedError();

    const found = this.tableManagers.get(String(name));
    return found 
      ? found
      : this.createTransactionTable(String(name)); 
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
   * @throws {TransactionCompletedError} If the transaction is already completed
   * @throws {TransactionConflictError} If a conflict occurs during the commit process
   * @throws {Error} Potential errors from individual table commits
   */
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

  /**
   * Rolls back the transaction, discarding all changes.
   * 
   * @throws {TransactionCompletedError} If the transaction is already completed
   * @throws {Error} Potential errors from individual table commits
   */
  public async rollback(): Promise<void> {
    if (!this.isActive) throw new TransactionCompletedError();
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