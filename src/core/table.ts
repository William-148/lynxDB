import { LocalTable, RecordWithId, RecordWithVersion } from "../types/database-table.type";
import { Filter } from "../types/filter.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import {
  DuplicatePrimaryKeyDefinitionError,
  DuplicatePrimaryKeyValueError,
  PrimaryKeyValueNullError,
} from "./errors/table.error";
import { generateId } from "../utils/generate-id";
import { RecordLockManager } from "./record-lock-manager";

export class Table<T> implements LocalTable<T> {
  private _name: string;
  protected _recordsMap: Map<string, RecordWithVersion<T>>;
  protected _recordsArray: RecordWithVersion<T>[];
  protected _pkDefinition: (keyof T)[];
  protected _lockManager: RecordLockManager;

  /**
   * @param name Name of the table
   * @param pkDefinition Definition of the primary key. if a primary key is not required, pass an empty array
   */
  constructor(name: string, pkDefinition: (keyof T)[] = []) {
    this._name = name;
    this._recordsMap = new Map();
    this._recordsArray = [];
    this._pkDefinition = this.validatePKDefinition(pkDefinition);
    this._lockManager = new RecordLockManager();
  }

  get name(): string { return this._name; }
  get sizeMap(): number { return this._recordsMap.size; }
  get recordsMap(): Map<string, RecordWithVersion<T>> { return this._recordsMap; }
  get recordsArray(): RecordWithVersion<T>[] { return this._recordsArray; }
  get pkDefinition(): (keyof T)[] { return this._pkDefinition; }
  get lockManager(): RecordLockManager { return this._lockManager; }

  private validatePKDefinition(pkDefinition: (keyof T)[]): (keyof T)[] {
    const uniqueKeys = new Set(pkDefinition);
    if (uniqueKeys.size !== pkDefinition.length) {
      throw new DuplicatePrimaryKeyDefinitionError(pkDefinition.toString());
    }
    return pkDefinition;
  }

  protected hasPkDefinition(): boolean {
    return this._pkDefinition.length > 0;
  }

  protected hasNotPkDefinition(): boolean {
    return this._pkDefinition.length === 0;
  }

  protected isSingleKey(): boolean {
    return this._pkDefinition.length === 1;
  }

  /**
   * Maps a record with version information to a record without version information.
   *
   * @protected
   * @template T
   * @param {RecordWithVersion<T>} recordWithVersion - The record that includes version information.
   * @returns {T} - The record without version information.
   */
  protected mapRecordVersionToRecord(recordWithVersion: RecordWithVersion<T>): RecordWithId<T> {
    const { __version, ...record } = recordWithVersion;
    return record as unknown as RecordWithId<T>;
  }

  /**
   * Updates a record with the provided fields and increments its version.
   *
   * @protected
   * @template T
   * @param {RecordWithVersion<T>} record - The record to be updated.
   * @param {Partial<T>} updatedFields - The updated fields to apply to the record.
   * @returns {void}
   */
  protected updateRecordAndVersion(record: RecordWithVersion<T>, updatedFields: Partial<T>): void {
    record.__version++;
    Object.assign(record, updatedFields);
  }
  
  /**
   * Checks if a partial record contains any fields that are part of the primary key.
   *
   * @protected
   * @template T
   * @param {Partial<T>} record - The partial record to check.
   * @returns {boolean} - Returns true if the record contains any primary key fields, otherwise false.
   */
  protected isPartialRecordPartOfPk(record: Partial<T>): boolean {
    if (this.hasNotPkDefinition()) return (("_id" in record) && record['_id'] !== undefined);
    if (this.isSingleKey()) return record[this._pkDefinition[0]] !== undefined;
    return this._pkDefinition.some(field => record[field] !== undefined);
  }

  /**
   * Build a primary key (PK) from a partial record.
   * 
   * @protected
   * @param {Partial<T>} record - The partial record containing the primary key fields.
   * @returns {string} - The built primary key.
   * @throws {PrimaryKeyValueNullError} - If any primary key values are null or undefined.
   */
  protected buildPkFromRecord(record: Partial<RecordWithId<T>>): string {
    if (this.hasNotPkDefinition()){
      if (!record._id) throw new PrimaryKeyValueNullError('_id');
      return record._id;
    }

    return this._pkDefinition.map((pkName: keyof T) => {
      const pkValue = record[pkName];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(pkName));
      return pkValue;
    }).join('-');
  }

  /**
   * Generates new and old primary keys (PK) for updating a record.
   * 
   * @protected
   * @param {Partial<T>} updatedFields - The partial record containing the updated fields.
   * @param {T} registeredRecord - The existing record from which the old primary key is derived.
   * @returns {{newPk: string, oldPk: string}} - An object containing the new and old primary keys.
   */
  protected generatePkForUpdate(updatedFields: Partial<T>, registeredRecord: RecordWithVersion<T>): { newPk: string; oldPk: string } {
    if (this.hasNotPkDefinition()) {
      return {
        newPk: String((updatedFields as any)["_id"] ?? registeredRecord._id),
        oldPk: String(registeredRecord._id)
      };
    }
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
   * Extracts the specified fields from a record and returns a new partial record containing only those fields.
   *
   * @protected
   * @template T
   * @param {Array<keyof T>} fields - The fields to extract from the record.
   * @param {T} record - The record from which to extract the fields.
   * @returns {Partial<T>} - A new partial record containing only the specified fields.
   */
  protected extractSelectedFields(fields: (keyof T)[], record: RecordWithId<T>): Partial<RecordWithId<T>> {
    const newRecord: Partial<RecordWithId<T>> = {};
    for (let field of fields) {
      newRecord[field] = record[field];
    }
    return newRecord;
  }

  /**
   * Checks if the primary key is already in use and throws an error if it is.
   *
   * @protected
   * @param {string} primaryKey - The primary key to check.
   * @throws {DuplicatePrimaryKeyValueError} - If the primary key is already in use.
   */
  protected checkIfPkIsInUse(primaryKey: string): void {
    if (!this._recordsMap.has(primaryKey)) return;
    
    throw new DuplicatePrimaryKeyValueError(
      this.hasPkDefinition() ? this._pkDefinition.join(', ') : '_id',
      primaryKey
    );
  }

  /**
   * Inserts a record into the record map.
   * 
   * @private
   * @param {RecordWithVersion<T>} record - The record to be inserted.
   */
  private insertInMap(record: RecordWithVersion<T>): void {
    const primaryKey = this.buildPkFromRecord(record);
    this.checkIfPkIsInUse(primaryKey);

    this._recordsMap.set(primaryKey, record);
  }

  /**
   * Creates a new record with an initial version. Generates a new primary key 
   * if no primary key definition exists.
   * 
   * @protected
   * @param {T} record - The original record.
   * @returns {RecordWithVersion<T>} - The new record with an initial version.
   */
  protected createNewRecordWithVersion(record: T): RecordWithVersion<T> {
    const newRecord: RecordWithVersion<T> = { 
      ...record, 
      __version: 1 
    };

    if (this.hasNotPkDefinition() && !newRecord._id) {
      newRecord._id = generateId();
    }

    return newRecord;
  }

  public size(): number { return this._recordsArray.length; }
  
  public async insert(record: T): Promise<T> {
    const newRecord = this.createNewRecordWithVersion(record);
    this.insertInMap(newRecord);
    this._recordsArray.push(newRecord);
    return this.mapRecordVersionToRecord(newRecord);
  }

  public async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewRecordWithVersion(record);
      this.insertInMap(newRecord);
      this._recordsArray.push(newRecord);
    }
  }

  public async findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.buildPkFromRecord(primaryKey);

    await this._lockManager.ensureUnlockedOnRead(primaryKeyBuilt);

    const recordFound = this._recordsMap.get(primaryKeyBuilt);

    return recordFound 
      ? this.mapRecordVersionToRecord(recordFound) 
      : null;
  }

  public async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const result: Partial<RecordWithId<T>>[] = [];
    const areFieldsToSelectEmpty = fields.length === 0;

    for (let currentRecord of this._recordsArray) {
      
      await this._lockManager.ensureUnlockedOnRead(
        this.buildPkFromRecord(currentRecord)
      );

      if (!matchRecord(currentRecord, compiledFilter)) continue;

      result.push(areFieldsToSelectEmpty 
        ? this.mapRecordVersionToRecord(currentRecord)
        : this.extractSelectedFields(fields, currentRecord)
      );
    }
    return result;
  }

  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const willPkBeModified = this.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    let affectedRecords = 0;

    for (let currentRecord of this._recordsArray) {

      if (!matchRecord(currentRecord, compiledFilter)) continue;

      await this._lockManager.ensureUnlockedOnWrite(
        this.buildPkFromRecord(currentRecord)
      );
  
      if (willPkBeModified) { 
        const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, currentRecord);
        this.checkIfPkIsInUse(newPk);
        
        this._recordsMap.delete(oldPk);
        this.updateRecordAndVersion(currentRecord, updatedFields);
        this._recordsMap.set(newPk, currentRecord);
      }
      else {
        this.updateRecordAndVersion(currentRecord, updatedFields);
      }
      affectedRecords++;
    }

    return affectedRecords;
  }

}
