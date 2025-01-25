import { TableAlreadyExistsError, TableNotFoundError } from "./errors/data-base.error";
import { Transaction } from "./transaction";
import { Table } from "./table";
import { ITable, TableDefinition } from "../types/table.type";
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

  /**
   * Creates a new table in the database.
   * 
   * @param {TableDefinition<T>} definition - The definition of the table to be created.
   * @throws {TableAlreadyExistsError} If a table with the same name already exists.
   * @returns {ITable<T>} The table manager for the newly created table.
   */
  public createTable<T>(definition: TableDefinition<T>): ITable<T> {
    if (this.tablesMap.has(definition.name)) throw new TableAlreadyExistsError(definition.name);
    const table = new Table<T>(definition, this.dbConfig);
    this.tablesMap.set(definition.name, table);
    const tableManager = new TableManager(table);
    this.tableManagersMap.set(definition.name, tableManager);
    return tableManager;
  }
  
  /**
   * Retrieves a table from the database.
   * 
   * @param {string} name - The name of the table to retrieve.
   * @returns {ITable<T>} The table corresponding to the given name.
   * @throws {TableNotFoundError} If the table with the specified name does not exist.
   */
  public get<T>(name: string): ITable<T> {
    const tableManager = this.tableManagersMap.get(name);
    if (!tableManager) throw new TableNotFoundError(name);
    return tableManager;
  }

  /**
   * Creates a new transaction in the database.
   * 
   * @param {ConfigOptions} [options] - Optional configuration options for the transaction.
   * @returns {Transaction} The newly created transaction.
   */
  public createTransaction(options?: ConfigOptions): Transaction {
    return new Transaction(
      this.tablesMap, 
      options ? Config.fromOptions(this.dbConfig, options) : this.dbConfig
    );
  }

  /**
   * Executes a callback function within a database transaction.
   * 
   * @param {function} callback - The callback function to execute within the transaction. 
   *  The callback receives a `Transaction` object as its argument and returns a promise.
   * @returns {Promise<T>} A promise that resolves to the result of the callback function.
   * @throws {Error} If an error occurs during the execution of the callback, the transaction 
   * is rolled back and the error is rethrown.
   */
  public async transaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
    const transaction = this.createTransaction();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    }catch(error){
      await transaction.rollback();
      throw error;
    }
  }

}

/**
 * Creates a new instance of LynxDB with the provided configuration options.
 * 
 * @param {ConfigOptions} [options] - Optional configuration options for the LynxDB instance.
 * @returns {LynxDB} The newly created LynxDB instance.
 */
export function Lynx(options?: ConfigOptions): LynxDB {
  return new LynxDB(options);
}