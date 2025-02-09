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

export class Transaction <Tables extends Record<string, Tables[any]>> implements TransactionHandler<Tables> {
  private transactionId: string;
  private transactionTables: Map<string, TransactionTable<Tables[any]>>;
  private tableManagers: Map<string, TableManager<Tables[any]>>;
  private isActive: boolean;
  private transactionConfig: Config;

  /**
   * @param tables - Map of tables in the database
   * @param transactionConfig - Configuration for the transaction
   */
  constructor(private tables: Map<string, Table<Tables[any]>>, transactionConfig?: Config) {
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
   * @param name - Name of the table to create transaction wrapper for
   * @returns {TableSchema<T>} - Transaction-enabled table manager instance
   * @throws {TableNotFoundError} - When the requested table doesn't exist in the tables collection
   */
  private createTransactionTable(name: string): TableSchema<Tables[any]> {
    const table = this.tables.get(name);
    if (!table) throw new TableNotFoundError(name);
    
    const transactionTable = new TransactionTable(
      this.transactionId, 
      table,
      this.transactionConfig
    );
    this.transactionTables.set(name, transactionTable);
    
    const tableManager = new TableManager(transactionTable);
    this.tableManagers.set(name, tableManager);
    return tableManager;
  }

  public get<K extends keyof Tables>(name: K): TableSchema<Tables[K]> {
    if (!this.isActive) throw new TransactionCompletedError();

    const found = this.tableManagers.get(String(name));
    return found 
      ? found
      : this.createTransactionTable(String(name)); 
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