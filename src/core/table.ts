import { Filter } from "../types/filter.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { generateId } from "../utils/generate-id";
import { RecordLockManager } from "./record-lock-manager";
import { Config } from "./config";
import { 
  ITable,
  RecordWithId,
  TableDefinition,
} from "../types/table.type";
import {
  DuplicatePrimaryKeyDefinitionError,
  DuplicatePrimaryKeyValueError,
  PrimaryKeyValueNullError,
} from "./errors/table.error";

export class Table<T> implements ITable<T> {
  private _name: string;
  protected _recordsMap: Map<string, RecordWithId<T>>;
  protected _recordsArray: RecordWithId<T>[];
  protected _pkDefinition: (keyof T)[];
  protected _lockManager: RecordLockManager;

  /**
   * @param definition Definition object for the table
   * @param config Configuration object for the table
   */
  constructor(definition: TableDefinition<T>, config?: Config) {
    this._name = definition.name;
    this._recordsMap = new Map();
    this._recordsArray = [];
    this._pkDefinition = this.validatePKDefinition(definition.primaryKey ?? []);
    this._lockManager = new RecordLockManager(config);
  }

  get name(): string { return this._name; }
  get sizeMap(): number { return this._recordsMap.size; }
  get recordsMap(): Map<string, RecordWithId<T>> { return this._recordsMap; }
  get recordsArray(): RecordWithId<T>[] { return this._recordsArray; }
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
   * Checks if a partial record contains any fields that are part of the primary key.
   *
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
   * @param {Partial<T>} updatedFields - The partial record containing the updated fields.
   * @param {T} registeredRecord - The existing record from which the old primary key is derived.
   * @returns {{newPk: string, oldPk: string}} - An object containing the new and old primary keys.
   */
  protected generatePkForUpdate(updatedFields: Partial<T>, registeredRecord: RecordWithId<T>): { newPk: string; oldPk: string } {
    const getPkValue = (field: keyof T) => String(updatedFields[field] ?? registeredRecord[field]);
    if (this.hasNotPkDefinition()) {
      return {
        newPk: getPkValue("_id" as keyof T),
        oldPk: String(registeredRecord._id)
      };
    }
    if (this.isSingleKey()) {
      const pkDefinitionName = this._pkDefinition[0];
      return {
        newPk: getPkValue(pkDefinitionName),
        oldPk: String(registeredRecord[pkDefinitionName])
      };
    }
    // Composite key
    return {
      newPk: this._pkDefinition.map(getPkValue).join('-'),
      oldPk: this._pkDefinition.map(pkName => registeredRecord[pkName]).join('-')
    }
  }

  /**
   * Extracts the specified fields from a record and returns a new partial record containing only those fields.
   *
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
   * Creates a new error object for a duplicate primary key value.
   * 
   * @param primaryKey - Primary key value that is duplicated.
   * @returns {DuplicatePrimaryKeyValueError} - The error object.
   */
  protected createDuplicatePkValueError(primaryKey: string): DuplicatePrimaryKeyValueError {
    return new DuplicatePrimaryKeyValueError(
      this.hasPkDefinition() ? this._pkDefinition.join(', ') : '_id',
      primaryKey
    );
  }

  /**
   * Checks if the primary key is already in use and throws an error if it is.
   *
   * @param {string} primaryKey - The primary key to check.
   * @throws {DuplicatePrimaryKeyValueError} - If the primary key is already in use.
   */
  protected checkIfPkIsInUse(primaryKey: string): void {
    if (!this._recordsMap.has(primaryKey)) return;
    
    throw this.createDuplicatePkValueError(primaryKey);
  }

  /**
   * Inserts a record into the record map.
   * 
   * @param {RecordWithVersion<T>} record - The record to be inserted.
   */
  private insertInMap(record: RecordWithId<T>): void {
    const primaryKey = this.buildPkFromRecord(record);
    this.checkIfPkIsInUse(primaryKey);

    this._recordsMap.set(primaryKey, record);
  }

  /**
   * Creates a new record with an initial version. Generates a new primary key 
   * if no primary key definition exists.
   * 
   * @param {T} record - The original record.
   * @returns {RecordWithId<T>} - The new record with an initial version.
   */
  protected createNewRecordWithId(record: T): RecordWithId<T> {
    const newRecord: RecordWithId<T> = { ...record } as RecordWithId<T>;

    if (this.hasNotPkDefinition() && !newRecord._id) {
      newRecord._id = generateId();
    }

    return newRecord;
  }

  public size(): number { return this._recordsArray.length; }
  
  public async insert(record: T): Promise<T> {
    const newRecord = this.createNewRecordWithId(record);
    this.insertInMap(newRecord);
    this._recordsArray.push(newRecord);
    return { ...newRecord };
  }

  public async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewRecordWithId(record);
      this.insertInMap(newRecord);
      this._recordsArray.push(newRecord);
    }
  }

  public async findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.buildPkFromRecord(primaryKey);

    await this._lockManager.waitUnlockToRead(primaryKeyBuilt);

    const recordFound = this._recordsMap.get(primaryKeyBuilt);

    return recordFound ? { ...recordFound } : null;
  }

  public async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const result: Partial<RecordWithId<T>>[] = [];
    const areFieldsToSelectEmpty = fields.length === 0;

    for (let currentRecord of this._recordsArray) {
      
      await this._lockManager.waitUnlockToRead(
        this.buildPkFromRecord(currentRecord)
      );

      if (!matchRecord(currentRecord, compiledFilter)) continue;

      result.push(areFieldsToSelectEmpty 
        ? { ...currentRecord }
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

      await this._lockManager.waitUnlockToWrite(
        this.buildPkFromRecord(currentRecord)
      );
  
      if (willPkBeModified) { 
        const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, currentRecord);
        this.checkIfPkIsInUse(newPk);
        
        this._recordsMap.delete(oldPk);
        Object.assign(currentRecord, updatedFields);
        this._recordsMap.set(newPk, currentRecord);
      }
      else {
        Object.assign(currentRecord, updatedFields);
      }
      affectedRecords++;
    }

    return affectedRecords;
  }

}
