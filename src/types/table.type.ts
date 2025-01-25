import { Filter } from "./filter.type";

export type TableConfig<T> = {
  /** Definition of the primary key. Optional. */
  primaryKey?: (keyof T)[];
}

export type TablesDefinition<T extends Record<string, any>> = {
  [K in keyof T]: TableConfig<T[K]>;
};

export type RecordWithId<T> = T & { 
  /** Default primary key if not defined */
  _id ?: string 
};

export interface ITable<T> {
  /**
   * Return the number of records in the table
   */
  size(): number;
  /**
   * Insert a record in the table
   * @params record The record to insert
   * @returns The record inserted
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is duplicated
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  insert(record: T): Promise<T>;
  /**
   * Insert a list of records in the table
   * @params records The records to insert
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is duplicated
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  bulkInsert(records: T[]): Promise<void>;
  /**
   * Find a record by its primary key
   * @params primaryKey The primary key of the record to find
   * @returns The record found or null if not found
   * @throws {PrimaryKeyValueNullError} If the primary key is null
   */
  findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null>;
  /**
   * Find records in the table
   * @params fields The fields to select
   * @params predicate A function that matches the records to be selected
   * @returns The records found
   */
  select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]>;
  
  /**
   * Update a record in the table
   * @params updatedFields The fields to update
   * @params predicate A function that matches the records to be updated
   * @returns The number of records updated
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is duplicated
   */
  update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number>;
}
