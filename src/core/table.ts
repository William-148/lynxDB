import { DatabaseTable } from "../types/database-table.type";
import { Filter } from "../types/filter.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import {
  DuplicatePrimaryKeyDefinitionError,
  DuplicatePrimaryKeyValueError,
  PrimaryKeyNotDefinedError,
  PrimaryKeyValueNullError
} from "./errors/table.error";

export class Table<T extends {}> implements DatabaseTable<T> {
  private _name: string;
  private _recordsMap: Map<string, T>;
  private _recordsArray: T[];
  private _PkDefinition: (keyof T)[];

  /**
   * @param name Name of the table
   * @param pkDefinition Definition of the primary key. if a primary key is not required, pass an empty array
   */
  constructor(name: string, pkDefinition: (keyof T)[] = []) {
    this._name = name;
    this._recordsMap = new Map();
    this._recordsArray = [];
    this._PkDefinition = this.validatePKDefinition(pkDefinition);
  }

  get name(): string { return this._name; }
  get sizeMap(): number { return this._recordsMap.size; }

  private validatePKDefinition(pkDefinition: (keyof T)[]): (keyof T)[] {
    const uniqueKeys = new Set(pkDefinition);
    if (uniqueKeys.size !== pkDefinition.length) {
      throw new DuplicatePrimaryKeyDefinitionError(pkDefinition.toString());
    }
    return pkDefinition;
  }

  private hasNotPkDefinition(): boolean {
    return this._PkDefinition.length === 0;
  }

  private isSingleKey(): boolean {
    return this._PkDefinition.length === 1;
  }

  private isPartialRecordPartOfPk(record: Partial<T>): boolean {
    if (this.hasNotPkDefinition()) return false;
    if (this.isSingleKey()) return record[this._PkDefinition[0]] !== undefined;
    return this._PkDefinition.some(field => record[field] !== undefined);
  }

  /**
   * @throws {PrimaryKeyNotDefinedError} If the primary key is not defined
   */
  private generatePK(record: Partial<T>): string {
    if (this.hasNotPkDefinition())
      throw new PrimaryKeyNotDefinedError(this._name);

    // Single key
    if (this.isSingleKey()) {
      const pkValue = record[this._PkDefinition[0]];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(this._PkDefinition[0]));

      return String(pkValue);
    }

    // Composite key
    return this._PkDefinition.map(field => {
      const pkValue = record[field];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(field));

      return pkValue;
    }).join('-');
  }

  private generatePkForUpdate(updatedFields: Partial<T>, registeredRecord: T): { newPk: string; oldPk: string } {
    if (this.isSingleKey()) {
      const pkDefinitionName = this._PkDefinition[0];
      return { 
        newPk: String(updatedFields[pkDefinitionName] ?? registeredRecord[pkDefinitionName]),
        oldPk: String(registeredRecord[pkDefinitionName])
      };
    }
    // Composite key
    return {
      newPk: this._PkDefinition.map(pkName => updatedFields[pkName] ?? registeredRecord[pkName]).join('-'),
      oldPk: this._PkDefinition.map(pkName => registeredRecord[pkName]).join('-')
    }
  }

  /**
   * Checks if the primary key already exists in the table.
   * Throws a `DuplicatePrimaryKeyValueError` if the primary key already in use.
   * @private
   * @param {string} primaryKey - The primary key to check for existence.
   * @throws {DuplicatePrimaryKeyValueError} If the primary key value is duplicated.
   */
  private checkIfPkIsInUse(primaryKey: string): void {
    if (this._recordsMap.has(primaryKey)) {
      throw new DuplicatePrimaryKeyValueError(
        this._PkDefinition.join(', '),
        primaryKey
      );
    }
  }

  private insertInMap(record: T): void {
    if (this.hasNotPkDefinition()) return;

    const primaryKey = this.generatePK(record);
    this.checkIfPkIsInUse(primaryKey);

    this._recordsMap.set(primaryKey, record);
  }

  public size(): number { return this._recordsArray.length; }

  public insert(record: T): Promise<T> {
    return new Promise((resolve) => {
      const newRecord = { ...record };
      this.insertInMap(newRecord);
      this._recordsArray.push(newRecord);
      resolve({ ...record });
    });
  }

  public bulkInsert(records: T[]): Promise<void> {
    return new Promise((resolve) => {
      for (let record of records) {
        const newRecord = { ...record };
        this.insertInMap(newRecord);
        this._recordsArray.push(newRecord);
      }
      resolve();
    });
  }

  public findByPk(primaryKey: Partial<T>): Promise<T | null> {
    return new Promise((resolve) => {
      // throw exception if primary key is not defined
      const generatedPk = this.generatePK(primaryKey);
      const finded = this._recordsMap.get(generatedPk);

      resolve(finded ? { ...finded } : null);
    });
  }

  private selectFields(fields: (keyof T)[], record: T): Partial<T> {
    const newRecord: Partial<T> = {};
    for (let field of fields) {
      newRecord[field] = record[field];
    }
    return newRecord;
  }

  public select(fields: (keyof T)[], where: Filter<T>): Promise<Partial<T>[]> {
    return new Promise((resolve) => {
      const compiledFilter = compileFilter(where);
      const result: Partial<T>[] = [];

      for (let currentRecord of this._recordsArray) {

        if (!matchRecord(currentRecord, compiledFilter)) continue;

        if (fields.length === 0) {
          result.push({ ...currentRecord });
          continue;
        }
        result.push(this.selectFields(fields, currentRecord));
      }
      resolve(result);
    });
  }

  public async update(updatedFields: Partial<T>, where: Filter<T>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const isUpdatedFieldsPartOfPK = this.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    let affectedRecords = 0;

    for (let currentRecord of this._recordsArray) {
      
      if (!matchRecord(currentRecord, compiledFilter)) continue;

      if (isUpdatedFieldsPartOfPK) { this.updateRecordWithNewPk(currentRecord, updatedFields); }
      else { Object.assign<T, Partial<T>>(currentRecord, updatedFields); }

      affectedRecords++;
    }
    return affectedRecords;
  }

  /**
   * Updates the current record with the new primary key and updated fields.
   * @param currentRecord Current record to be updated
   * @param updatedFields Object with the updated fields values
   * @throws {DuplicatePrimaryKeyValueError} If the new primary key is already in use
   */
  private updateRecordWithNewPk(currentRecord: T, updatedFields: Partial<T>): void {
    const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, currentRecord);

    this.checkIfPkIsInUse(newPk);

    this._recordsMap.delete(oldPk);
    Object.assign<T, Partial<T>>(currentRecord, updatedFields);
    this._recordsMap.set(newPk, currentRecord);
  }

}
