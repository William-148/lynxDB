import { Query } from "./query.type";
import { RecordWithId } from "./record.type";

export type TableConfig<T> = {
  /** Definition of the primary key. Optional. */
  primaryKey?: (keyof T)[];
}

/**
 * Defines the configuration of tables in a database.
 * 
 * @template Tables An object where keys are table names and values are the types 
 * of objects stored in the tables.
 * 
 * Example:
 * ```typescript
 * type Person { id: number; name: string; }
 * type MyTables = { persons: Person; ... }
 * 
 * const tableDefinition: TablesDefinition<MyTables> = {
 * persons: { primaryKey: ["id"] }
 * };
 * 
 * ```
 */
export type TablesDefinition<Tables extends Record<string, any>> = {
  [K in keyof Tables]: TableConfig<Tables[K]>;
};

export interface TableSchema<T> {
  /**
   * Return the number of records in the table
   */
  size(): number;

  /**
   * Insert a record in the table
   * 
   * @param record The record to insert
   * @returns The record inserted
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is duplicated
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  insert(record: T): Promise<T>;

  /**
   * Insert a list of records in the table
   * 
   * @param records The records to insert
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is duplicated
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  bulkInsert(records: T[]): Promise<void>;

  /**
   * Find a record by its primary key
   * 
   * @param primaryKey The primary key of the record to find
   * @returns The record found or null if not found
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null>;

  /**
   * Find the first record in the table that matches the query conditions
   * 
   * @param where The query conditions
   */
  findOne(where: Query<RecordWithId<T>>): Promise<T | null>;
  
  /**
   * Retrieves all records from the table.
   * Each record will contain all its fields.
   * 
   * @returns A promise that resolves to an array of all records.
   */
  select(): Promise<T[]>;
  /**
   * Retrieves all records from the table that match the given `where` condition.
   * Each record will contain all its fields.
   * 
   * @param where The condition to filter records by.
   * @returns A promise that resolves to an array of records that match the `where` condition.
   */
  select(where: Query<RecordWithId<T>>): Promise<T[]>;
  /**
   * Retrieves records from the table that match the given `where` condition.
   * If no `where` condition is provided, all records will be returned.
   * Only the specified fields will be included in each record.
   * 
   * @param fields The fields to include in the results.
   * @param [where] The condition to filter records by (optional).
   * @returns A promise that resolves to an array of records with the specified fields.
   */
  select(fields: (keyof T)[], where?: Query<RecordWithId<T>>): Promise<Partial<T>[]>;
  
  /**
   * Update records from the table that match the given `where` condition.
   * 
   * @param updatedFields The fields to update
   * @param where A function that matches the records to be updated
   * @returns The number of records updated
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is duplicated
   */
  update(updatedFields: Partial<T>, where: Query<RecordWithId<T>>): Promise<number>;
  
  /**
   * Delete a record in the table by its primary key
   * 
   * @param primaryKey The primary key of the record to delete
   * @returns The record deleted or null if not found
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null>;
}
