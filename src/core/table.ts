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
  private _pkDefinition: (keyof T)[];

  /**
   * @param name Name of the table
   * @param pkDefinition Definition of the primary key. if a primary key is not required, pass an empty array
   */
  constructor(name: string, pkDefinition: (keyof T)[] = []) {
    this._name = name;
    this._recordsMap = new Map();
    this._recordsArray = [];
    this._pkDefinition = this.validatePKDefinition(pkDefinition);
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
    return this._pkDefinition.length === 0;
  }

  private isSingleKey(): boolean {
    return this._pkDefinition.length === 1;
  }

  private isPartialRecordPartOfPk(record: Partial<T>): boolean {
    if (this.hasNotPkDefinition()) return false;
    if (this.isSingleKey()) return record[this._pkDefinition[0]] !== undefined;
    return this._pkDefinition.some(field => record[field] !== undefined);
  }

  /**
   * Generates a primary key (PK) from a partial record.
   * @param {Partial<T>} record - The partial record containing the primary key fields.
   * @returns {string} - The generated primary key.
   * @throws {PrimaryKeyNotDefinedError} - If there is no primary key definition.
   * @throws {PrimaryKeyValueNullError} - If any primary key values are null or undefined.
   */
  private generatePK(record: Partial<T>): string {
    if (this.hasNotPkDefinition())
      throw new PrimaryKeyNotDefinedError(this._name);

    function getPkValue(pkName: keyof T): Partial<T>[keyof T] {
      const pkValue = record[pkName];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(pkName));
      return pkValue;
    }

    return this.isSingleKey() 
      ? String(getPkValue(this._pkDefinition[0])) 
      : this._pkDefinition.map(getPkValue).join('-');
  }

  /**
   * Generates new and old primary keys (PK) for updating a record.
   * @param {Partial<T>} updatedFields - The partial record containing the updated fields.
   * @param {T} registeredRecord - The existing record from which the old primary key is derived.
   * @returns {{newPk: string, oldPk: string}} - An object containing the new and old primary keys.
   */
  private generatePkForUpdate(updatedFields: Partial<T>, registeredRecord: T): { newPk: string; oldPk: string } {
    if (this.isSingleKey()) {
      const pkDefinitionName = this._pkDefinition[0];
      return { 
        newPk: String(updatedFields[pkDefinitionName] ?? registeredRecord[pkDefinitionName]),
        oldPk: String(registeredRecord[pkDefinitionName])
      };
    }
    // Composite key
    return {
      newPk: this._pkDefinition.map(pkName => updatedFields[pkName] ?? registeredRecord[pkName]).join('-'),
      oldPk: this._pkDefinition.map(pkName => registeredRecord[pkName]).join('-')
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
        this._pkDefinition.join(', '),
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

  public async insert(record: T): Promise<T> {
    const newRecord = { ...record };
    this.insertInMap(newRecord);
    this._recordsArray.push(newRecord);
    return { ...record };
  }

  public async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = { ...record };
      this.insertInMap(newRecord);
      this._recordsArray.push(newRecord);
    }
  }

  public async findByPk(primaryKey: Partial<T>): Promise<T | null> {
    // throw exception if primary key is not defined
    const generatedPk = this.generatePK(primaryKey);
    const finded = this._recordsMap.get(generatedPk);

    return finded ? { ...finded } : null;
  }

  private selectFields(fields: (keyof T)[], record: T): Partial<T> {
    const newRecord: Partial<T> = {};
    for (let field of fields) {
      newRecord[field] = record[field];
    }
    return newRecord;
  }

  public async select(fields: (keyof T)[], where: Filter<T>): Promise<Partial<T>[]> {
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
    return result;
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
