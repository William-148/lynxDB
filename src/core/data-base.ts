import { TableAlreadyExistsError, TableNotFoundError } from "./errors/data-base.error";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { LocalTable, TableDefinition } from "../types/database-table.type";
import { TableManager } from "./table-manager";

export class LynxDB {
  private tablesMap: Map<string, Table<any>>;
  private tableManagersMap: Map<string, TableManager<any>>;

  constructor() {
    this.tablesMap = new Map();
    this.tableManagersMap = new Map();
  }

  public createTable<T>(definition: TableDefinition<T>): void {
    if (this.tablesMap.has(definition.name)) throw new TableAlreadyExistsError(definition.name);
    const table = new Table<T>(definition);
    this.tablesMap.set(definition.name, table);
    this.tableManagersMap.set(definition.name, new TableManager(table));
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