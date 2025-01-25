import { Table } from "./table";
import { TransactionTable } from "./transaction-table";
import { TableNotFoundError } from "./errors/data-base.error";
import { TableManager } from "./table-manager";
import { ITable } from "../types/table.type";
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

  public get<T>(name: string): ITable<T> {
    if (!this.isActive) throw new TransactionCompletedError();

    const found = this.transactionTables.get(name);
    if (found) return found as TransactionTable<T>;

    return this.createTransactionTable(name);    
  }

  private finishTransaction(): void {
    this.isActive = false;
    this.tableManagers.clear();
    this.transactionTables.clear();
  }

  public async commit(): Promise<void> {
    if (!this.isActive) throw new TransactionCompletedError();
    try {
      const promises: Promise<void>[] = [];
      this.transactionTables.forEach((transactionTable) => {
        promises.push(transactionTable.commit());
      });
      
      await Promise.all(promises);
    }
    finally {
      this.finishTransaction();
    }
  }

  public async rollback(): Promise<void> {
    if (!this.isActive) throw new TransactionCompletedError();
    try {
      const promises: Promise<void>[] = [];
      this.transactionTables.forEach((transactionTable) => {
        promises.push(transactionTable.rollback());
      });
      
      await Promise.all(promises);
    }
    finally {
      this.finishTransaction();
    }
  }

}
