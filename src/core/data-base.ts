import { TableNotFoundError } from "./errors/data-base.error";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { ITable, TablesDefinition } from "../types/table.type";
import { TableManager } from "./table-manager";
import { ConfigOptions } from "../types/config.type";
import { Config } from "./config";

export class LynxDb<Tables extends Record<string, any>> {
  /** Map of tables in the database */
  private tablesMap: Map<string, Table<any>>;
  /** Map of table managers in the database */
  private tableManagersMap: Map<string, TableManager<any>>;
  /** Gobal configuration for the database */
  private dbConfig: Config;

  /**
   * @param databaseOptions Configuration options for the database
   */
  constructor(tablesDef: TablesDefinition<Tables>, databaseOptions: ConfigOptions = {}) {
    this.tablesMap = new Map();
    this.tableManagersMap = new Map();
    this.dbConfig = new Config(databaseOptions);
    this.generateTables(tablesDef);
  }

  private generateTables(configs: TablesDefinition<Tables>) {
    Object.keys(configs).forEach((tableName) => {
      const key = tableName as keyof Tables;
      const table = new Table(configs[key], this.dbConfig)
      this.tablesMap.set(String(key), table);
      const tableManager = new TableManager(table);
      this.tableManagersMap.set(String(key), tableManager);
    });
  }

  public get<K extends keyof Tables>(name: K): ITable<Tables[K]> {
    const tableManager = this.tableManagersMap.get(String(name));
    if (!tableManager) throw new TableNotFoundError(String(name));
    return tableManager;
  }

  public createTransaction(options?: ConfigOptions): Transaction<Tables> {
    return new Transaction<Tables>(
      this.tablesMap,
      options ? Config.fromOptions(this.dbConfig, options) : this.dbConfig
    );
  }

  public async transaction<T>(callback: (transaction: Transaction<Tables>) => Promise<T>, options?: ConfigOptions): Promise<T> {
    const transaction = this.createTransaction(options);
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

/**
 * Creates a new instance of LynxDB with the provided configuration options.
 * 
 * @param {TablesDefinition} tablesDef - The definition of the tables in the database.
 * @param {ConfigOptions} [databaseOptions] - Optional configuration options for the LynxDB instance.
 * @returns {LynxDB} The newly created LynxDB instance.
 */
export function Lynx<Tables extends Record<string, any>>(tablesDef: TablesDefinition<Tables>, databaseOptions: ConfigOptions = {}): LynxDb<Tables> {
  return new LynxDb<Tables>(tablesDef, databaseOptions);
}