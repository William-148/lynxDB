import { Table } from "./table";
import { TransactionTable } from "./transaction-table";
import { TableNotFoundError } from "./errors/data-base.error";
import { TableManager } from "./table-manager";
import { LocalTable } from "../types/table.type";
import { TransactionCompletedError } from "./errors/transaction.error";
import { generateId } from "../utils/generate-id";
import { Config } from "./config";

export class Transaction  {
  private transactionId: string;
  private transactionTables: Map<string, TransactionTable<any>>;
  private tableManagers: Map<string, TableManager<any>>;
  private isActive: boolean;
  private transactionConfig: Config;

  constructor(private tables: Map<string, Table<any>>, transactionConfig?: Config) {
    this.transactionId = generateId();
    this.transactionTables = new Map();
    this.tableManagers = new Map();
    this.isActive = true;
    this.transactionConfig = transactionConfig ?? new Config();
  }

  private createTransactionTable<T>(name: string): LocalTable<T> {
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

  public getTable<T>(name: string): LocalTable<T> {
    if (!this.isActive) throw new TransactionCompletedError();

    const found = this.transactionTables.get(name);
    if (found) return found as TransactionTable<T>;

    return this.createTransactionTable(name);    
  }

  private clearTransactionTables(): void {
    for (const transactionTable of this.transactionTables.values()) {
      transactionTable.clearTemporaryRecords();
    }
    this.transactionTables.clear();
  }

  private onFinishTransaction(): void {
    this.clearTransactionTables();
    this.tableManagers.clear();
    this.isActive = false;
  }

  public async commit(): Promise<void> {
    if (!this.isActive) throw new TransactionCompletedError();

    const promises: Promise<void>[] = [];
    for (const transactionTable of this.transactionTables.values()) {
      transactionTable.commit();
    }
    await Promise.all(promises);

    this.onFinishTransaction();
  }

  public rollback(): void {
    if (!this.isActive) throw new TransactionCompletedError();

    // Manage the rollback process

    this.onFinishTransaction();
  }

}
