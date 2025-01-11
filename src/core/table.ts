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

  // private hasPkDefinition(): boolean {
  //   return this._PkDefinition.length > 0;
  // }

  private hasNotPkDefinition(): boolean {
    return this._PkDefinition.length === 0;
  }

  private isSingleKey(): boolean {
    return this._PkDefinition.length === 1;
  }

  private isCompositeKey(): boolean {
    return this._PkDefinition.length > 1;
  }

  private existPkValueInPartialRecord(record: Partial<T>): boolean {
    if (this.hasNotPkDefinition()) return false;
    if (this.isSingleKey()) return record[this._PkDefinition[0]] !== undefined;
    return this._PkDefinition.every(field => record[field] !== undefined);
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

      return `${pkValue}`;
    }

    // Composite key
    return this._PkDefinition.map(field => {
      const pkValue = record[field];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(field));

      return pkValue;
    }).join('-');
  }

  /**
   * Checks if the primary key already exists in the records map.
   * Throws a `DuplicatePrimaryKeyValueError` if the primary key already exists.
   * @private
   * @param {string} primaryKey - The primary key to check for existence.
   * @param {Partial<T>} record - The record that contains the primary key.
   * @throws {DuplicatePrimaryKeyValueError} If the primary key value is duplicated.
   */
  private checkIfExistPK(primaryKey: string, record: Partial<T>): void {
    if (this._recordsMap.has(primaryKey)) {
      const isSingleKey = this.isSingleKey();
      const pkName = isSingleKey
        ? String(this._PkDefinition[0])
        : this._PkDefinition.join(', ')
        ;
      const pkValue = isSingleKey
        ? String(record[this._PkDefinition[0]])
        : this._PkDefinition.map(field => record[field]).join(', ')
        ;

      throw new DuplicatePrimaryKeyValueError(pkName, pkValue);
    }
  }

  private insertInMap(record: T): void {
    if (this.hasNotPkDefinition()) return;

    const primaryKey = this.generatePK(record);
    this.checkIfExistPK(primaryKey, record);

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
        const match = matchRecord(currentRecord, compiledFilter);
        if (!match) continue;

        if (fields.length === 0) {
          result.push({ ...currentRecord });
          continue;
        }

        result.push(this.selectFields(fields, currentRecord));
      }
      resolve(result);
    });
  }


  private checkPkBeforeStartingUpdateProcess(updatedFields: Partial<T>): void {
    if (this.hasNotPkDefinition()) return;
    const primaryKey = this.generatePK(updatedFields);
    this.checkIfExistPK(primaryKey, updatedFields);
  }

  private _IsPartOfPk(record: Partial<T>): boolean {
    if (this.hasNotPkDefinition()) return false;
    if (this.isSingleKey()) return record[this._PkDefinition[0]] !== undefined;
    return this._PkDefinition.some(field => record[field] !== undefined);
  }

  public update(updatedFields: Partial<T>, where: Filter<T>): Promise<number> {
    return new Promise((resolve) => {
      if (Object.keys(updatedFields).length === 0) resolve(0);
      const isUpdatedFieldsPartOfPK = this._IsPartOfPk(updatedFields);

      const compiledFilter = compileFilter(where);
      let affectedRecords = 0;
      let index = 0;
      for (let currentRecord of this._recordsArray) {
        const match = matchRecord(currentRecord, compiledFilter);
        if (match) {
          // this.updatePkInMap(currentRecord, updatedFields);
          if (!isUpdatedFieldsPartOfPK){
            Object.assign<T, Partial<T>>(currentRecord, updatedFields);
            affectedRecords++;
            continue;
          }

          let newPrimaryKey: string;
          let oldPrimaryKey: string;
          if (this.isSingleKey()) {
            let pkValue: any;
            pkValue = updatedFields[this._PkDefinition[0]] ?? currentRecord[this._PkDefinition[0]];
            newPrimaryKey = `${pkValue}`;
            oldPrimaryKey = `${currentRecord[this._PkDefinition[0]]}`;

            if (this._recordsMap.has(newPrimaryKey)) {
              throw new DuplicatePrimaryKeyValueError(
                String(this._PkDefinition[0]), 
                pkValue
              );
            }

            this._recordsMap.delete(oldPrimaryKey);
            Object.assign<T, Partial<T>>(currentRecord, updatedFields);
            this._recordsMap.set(newPrimaryKey, currentRecord);
            affectedRecords++;
            continue;
          }

          // Composite key
          const newPkValues: (T[keyof T])[] = [];
          const oldPkValues: (T[keyof T])[] = [];
          for (let field of this._PkDefinition) {
            let pkValue = updatedFields[field] ?? currentRecord[field];
            newPkValues.push(pkValue);
            oldPkValues.push(currentRecord[field]);
          }

          newPrimaryKey = newPkValues.join('-');
          oldPrimaryKey = oldPkValues.join('-');

          if (this._recordsMap.has(newPrimaryKey)) {
            throw new DuplicatePrimaryKeyValueError(
              this._PkDefinition.join(', '), 
              newPrimaryKey
            );
          }

          this._recordsMap.delete(oldPrimaryKey);
          Object.assign<T, Partial<T>>(currentRecord, updatedFields);
          this._recordsMap.set(newPrimaryKey, currentRecord);
          affectedRecords++;
        }
        index++;
      }
      resolve(affectedRecords);
    });
  }

}
