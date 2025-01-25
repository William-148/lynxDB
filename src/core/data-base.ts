import { TableAlreadyExistsError, TableNotFoundError } from "./errors/data-base.error";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { LocalTable, TableDefinition } from "../types/table.type";
import { TableManager } from "./table-manager";
import { ConfigOptions } from "../types/config.type";
import { Config } from "./config";

export class LynxDB {
  /** Map of tables in the database */
  private tablesMap: Map<string, Table<any>>;
  /** Map of table managers in the database */
  private tableManagersMap: Map<string, TableManager<any>>;
  /** Gobal configuration for the database */
  private dbConfig:Config;

  /**
   * @param databaseOptions Configuration options for the database
   */
  constructor(databaseOptions: ConfigOptions = {}) {
    this.tablesMap = new Map();
    this.tableManagersMap = new Map();
    this.dbConfig = new Config(databaseOptions);
  }

  public createTable<T>(definition: TableDefinition<T>): void {
    if (this.tablesMap.has(definition.name)) throw new TableAlreadyExistsError(definition.name);
    const table = new Table<T>(definition, this.dbConfig);
    this.tablesMap.set(definition.name, table);
    this.tableManagersMap.set(definition.name, new TableManager(table));
  }
  
  public getTable<T>(name: string): LocalTable<T> {
    const tableManager = this.tableManagersMap.get(name);
    if (!tableManager) throw new TableNotFoundError(name);
    return tableManager;
  }

  public createTransaction(options?: ConfigOptions): Transaction {
    return new Transaction(
      this.tablesMap, 
      options ? Config.fromOptions(this.dbConfig, options) : this.dbConfig
    );
  }
}