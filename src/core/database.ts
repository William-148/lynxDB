import { Database } from "../types/database.type";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { TableSchema, TablesDefinition } from "../types/table.type";
import { TableManager } from "./table-manager";
import { ConfigOptions } from "../types/config.type";
import { Config } from "./config";
import { TransactionHandler } from "../types/transaction.type";
import { TransactionManager } from "./transaction-manager";
import { TableNotFoundError } from "./errors/data-base.error";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";
import { LockTimeoutError } from "./errors/record-lock-manager.error";

/**
 * Represents a database with tables defined as key-value pairs.
 * @template Tables An object where keys are table names and values are the types 
 * of objects stored in the tables.
 * 
 * Example:
 * ```typescript
 * type Person { id: number; name: string; }
 * type MyTables = { persons: Person; ... }
 * const db = new LynxDB<MyTables>(...);
 * 
 * ```
 */
export class LynxDB<Tables extends Record<string, any>> implements Database<Tables> {
  /** Map of tables in the database */
  private tablesMap: Map<string, Table<Tables[any]>>;
  /** Map of table managers in the database */
  private tableManagersMap: Map<string, TableManager<Tables[any]>>;
  /** Gobal configuration for the database */
  private dbConfig: Config;

  /**
   * @param tablesDef Definition of the tables in the database
   * @param databaseOptions Configuration options for the database
   */
  constructor(tablesDef: TablesDefinition<Tables>, databaseOptions: ConfigOptions = {}) {
    this.tablesMap = new Map();
    this.tableManagersMap = new Map();
    this.dbConfig = new Config(databaseOptions);
    this.generateTables(tablesDef);
  }

  /**
   * Generates the tables and table managers for the database from the provided definition.
   * 
   * @param tablesDef Object with the definition of the tables for the database.
   */
  private generateTables(tablesDef: TablesDefinition<Tables>) {
    Object.keys(tablesDef).forEach((tableName) => {
      const key = tableName as keyof Tables;
      const table = new Table(tablesDef[key], this.dbConfig)
      this.tablesMap.set(String(key), table);
      const tableManager = new TableManager(table);
      this.tableManagersMap.set(String(key), tableManager);
    });
  }

  public reset(): void {
    this.tablesMap.forEach((table) => table.reset());
  }

  public get<K extends keyof Tables>(tableName: K): TableSchema<Tables[K]> {
    const tableManager = this.tableManagersMap.get(String(tableName));
    if (!tableManager) throw new TableNotFoundError(String(tableName));
    return tableManager;
  }

  public createTransaction(options?: ConfigOptions): TransactionHandler<Tables> {
    const transaction = new Transaction<Tables>(
      this.tablesMap,
      options ? Config.fromOptions(this.dbConfig, options) : this.dbConfig
    );
    return new TransactionManager(transaction);
  }

  public async transaction<T>(callback: (transaction: TransactionHandler<Tables>) => Promise<T>, options?: ConfigOptions): Promise<T> {
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
