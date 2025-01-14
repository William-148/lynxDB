import { TableAlreadyExistsError, TableNotFoundError } from "./errors/data-base.error";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { LocalTable } from "../types/database-table.type";
import { TableManager } from "./table-manager";

export class LocalDatabase {
  private tablesMap: Map<string, Table<any>>;
  private tableManagersMap: Map<string, TableManager<any>>;

  constructor() {
    this.tablesMap = new Map();
    this.tableManagersMap = new Map();
  }

  public createTable<T>(name: string, pkDefinition: (keyof T)[]): void {
    if (this.tablesMap.has(name)) throw new TableAlreadyExistsError(name);
    const table = new Table<T>(name, pkDefinition);
    this.tablesMap.set(name, table);
    this.tableManagersMap.set(name, new TableManager(table));
  }
  
  public getTable<T>(name: string): LocalTable<T> {
    const tableManager = this.tableManagersMap.get(name);
    if (!tableManager) throw new TableNotFoundError(name);
    return tableManager;
  }

  public createTransaction(): Transaction {
    return new Transaction(this.tablesMap);
  }
}