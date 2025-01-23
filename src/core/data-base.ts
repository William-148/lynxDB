import { TableAlreadyExistsError, TableNotFoundError } from "./errors/data-base.error";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { LocalTable, TableDefinition } from "../types/table.type";
import { TableManager } from "./table-manager";
import { DatabaseOptions } from "../types/database.type";
import { IsolationLevel, TransactionOptions } from "../types/transaction.type";

export class LynxDB {
  private tablesMap: Map<string, Table<any>>;
  private tableManagersMap: Map<string, TableManager<any>>;
  private isolationLevel: IsolationLevel;

  constructor(options: DatabaseOptions) {
    this.isolationLevel = options.isolationLevel || IsolationLevel.ReadLatest;
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

  public createTransaction(options?: TransactionOptions): Transaction {
    return new Transaction(this.tablesMap, {
      isolationLevel: options?.isolationLevel || this.isolationLevel
    });
  }
}