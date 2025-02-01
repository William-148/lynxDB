import { Filter } from "./filter.type";
import { RecordWithId } from "./record.type";

export type TableConfig<T> = {
  /** Definition of the primary key. Optional. */
  primaryKey?: (keyof T)[];
}

export type TablesDefinition<T extends Record<string, any>> = {
  [K in keyof T]: TableConfig<T[K]>;
};

export interface ITable<T> {
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
   * Find records in the table
   * 
   * @param fields The fields to select
   * @param where A function that matches the records to be selected
   * @returns The records found
   */
  select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]>;
  
  /**
   * Update a record in the table
   * 
   * @param updatedFields The fields to update
   * @param where A function that matches the records to be updated
   * @returns The number of records updated
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is duplicated
   */
  update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number>;
  
  /**
   * Delete a record in the table by its primary key
   * 
   * @param primaryKey The primary key of the record to delete
   * @returns The record deleted or null if not found
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null>;
}
