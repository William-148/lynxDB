import { TableNotFoundError } from "./errors/data-base.error";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { ITable, TablesDefinition } from "../types/table.type";
import { TableManager } from "./table-manager";
import { ConfigOptions } from "../types/config.type";
import { Config } from "./config";
import { LockTimeoutError } from "./errors/record-lock-manager.error";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";

export class LynxDb<Tables extends Record<string, any>> {
  /** Map of tables in the database */
  private tablesMap: Map<string, Table<any>>;
  /** Map of table managers in the database */
  private tableManagersMap: Map<string, TableManager<any>>;
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

  /**
   * Retrieves a table for the specified table name.
   * 
   * @template K - Union type of keys from the Tables interface/type
   * @param {K} name - Name of the table to retrieve (type-safe key from Tables)
   * @returns {ITable<Tables[K]>} Transaction table manager instance for the specified table
   * @throws {TransactionCompletedError} If the transaction has already been committed or rolled back
   * @throws {TableNotFoundError} If the table doesn't exist in the main tables collection (via createTransactionTable)
   */
  public get<K extends keyof Tables>(name: K): ITable<Tables[K]> {
    const tableManager = this.tableManagersMap.get(String(name));
    if (!tableManager) throw new TableNotFoundError(String(name));
    return tableManager;
  }

  /**
   * Creates a new transaction in the database.
   * 
   * @param {ConfigOptions} [options] - Optional configuration options for the transaction.
   * @returns {Transaction<Tables>} The newly created transaction.
   */
  public createTransaction(options?: ConfigOptions): Transaction<Tables> {
    return new Transaction<Tables>(
      this.tablesMap,
      options ? Config.fromOptions(this.dbConfig, options) : this.dbConfig
    );
  }

  /**
   * Executes a callback function within a database transaction.
   * 
   * Possible scenarios:
   * - If the transaction completes successfully, the changes are committed.
   * - If an error occurs during the transaction, the changes are rolled back.
   * 
   * @param {function} callback - The callback function to execute within the transaction. 
   * The callback receives a `Transaction<Tables>` object as its argument and returns a promise.
   * 
   * @param {ConfigOptions} [options] - Optional configuration options for the transaction.
   * @returns {Promise<T>} A promise that resolves to the result of the callback function.
   * @throws {LockTimeoutError} If a record lock cannot be acquired within the specified timeout.
   * @throws {DuplicatePrimaryKeyValueError} If an insert operation violates a primary key constraint.
   * @throws {Error} If an error occurs during the execution of the callback, 
   * the transaction is rolled back and the error is rethrown.
   */
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
 * Creates a new instance of LynxDb with the provided table definitions and configuration options.
 * 
 * @param {TablesDefinition<Tables>} tablesDef - The definitions of the tables to be used 
 * in the LynxDb instance.
 * @param {ConfigOptions} [databaseOptions={}] - Optional configuration options for the LynxDb 
 * instance. Defaults to an empty object.
 * @returns {LynxDb<Tables>} The newly created LynxDb instance.
 */
export function Lynx<Tables extends Record<string, any>>(tablesDef: TablesDefinition<Tables>, databaseOptions: ConfigOptions = {}): LynxDb<Tables> {
  return new LynxDb<Tables>(tablesDef, databaseOptions);
}