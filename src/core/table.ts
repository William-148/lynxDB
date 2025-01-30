import { Filter } from "../types/filter.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { generateId } from "../utils/generate-id";
import { RecordLockManager } from "./record-lock-manager";
import { Config } from "./config";
import { 
  ITable,
  RecordWithId,
  TableConfig,
} from "../types/table.type";
import {
  DuplicatePrimaryKeyDefinitionError,
  DuplicatePrimaryKeyValueError,
  PrimaryKeyValueNullError,
} from "./errors/table.error";

export class Table<T> implements ITable<T> {
  /** Map that stores the records of the table. */
  protected _recordsMap: Map<string, RecordWithId<T>>;
  /** Definition of the primary key. */
  protected _primaryKeyDef: (keyof T)[];
  protected _lockManager: RecordLockManager;
  protected _config: Config;
  /** Number of records to process in a batch. */
  protected _batchSize: number = 500;

  /**
   * @param definition Definition object for the table
   * @param config Configuration object for the table
   */
  constructor(definition: TableConfig<T>, config?: Config) {
    this._recordsMap = new Map();
    this._primaryKeyDef = this.validatePKDefinition(definition.primaryKey ?? []);
    this._config = config ?? new Config();
    this._lockManager = new RecordLockManager(this._config);
  }

  get recordsMap(): Map<string, RecordWithId<T>> { return this._recordsMap; }
  get primaryKeyDef(): (keyof T)[] { return this._primaryKeyDef; }
  get lockManager(): RecordLockManager { return this._lockManager; }
  get config(): Config { return this._config; }

  private validatePKDefinition(primaryKeyDef: (keyof T)[]): (keyof T)[] {
    const uniqueKeys = new Set(primaryKeyDef);
    if (uniqueKeys.size !== primaryKeyDef.length) {
      throw new DuplicatePrimaryKeyDefinitionError(String(primaryKeyDef));
    }
    return primaryKeyDef;
  }

  protected hasPkDefinition(): boolean {
    return this._primaryKeyDef.length > 0;
  }

  protected hasNotPkDefinition(): boolean {
    return this._primaryKeyDef.length === 0;
  }

  protected isSingleKey(): boolean {
    return this._primaryKeyDef.length === 1;
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
    if (this.isSingleKey()) return record[this._primaryKeyDef[0]] !== undefined;
    return this._primaryKeyDef.some(field => record[field] !== undefined);
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

    return this._primaryKeyDef.map((pkName: keyof T) => {
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
      const pkDefinitionName = this._primaryKeyDef[0];
      return {
        newPk: getPkValue(pkDefinitionName),
        oldPk: String(registeredRecord[pkDefinitionName])
      };
    }
    // Composite key
    return {
      newPk: this._primaryKeyDef.map(getPkValue).join('-'),
      oldPk: this._primaryKeyDef.map(pkName => registeredRecord[pkName]).join('-')
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
      this.hasPkDefinition() ? this._primaryKeyDef.join(', ') : '_id',
      primaryKey
    );
  }

  /**
   * Checks if the primary key is already in use and throws an error if it is.
   *
   * @param {string} primaryKey - The primary key to check.
   * @throws {DuplicatePrimaryKeyValueError} - If the primary key is already in use.
   */
  protected checkIfPrimaryKeyIsInUse(primaryKey: string): void {
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
    this.checkIfPrimaryKeyIsInUse(primaryKey);

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

  /**
   * Processes a list of promises in batches.
   * 
   * @param promises List of promises to process in batches.
   */
  protected async processPromiseBatch(promises: Promise<void>[]): Promise<void> {
    for (let i = 0; i < promises.length; i += this._batchSize) {
      await Promise.all(promises.slice(i, i + this._batchSize));
    }
  }

  public size(): number { return this._recordsMap.size; }
  
  public async insert(record: T): Promise<T> {
    const newRecord = this.createNewRecordWithId(record);
    this.insertInMap(newRecord);
    return { ...newRecord };
  }

  public async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewRecordWithId(record);
      this.insertInMap(newRecord);
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
    const areFieldsToSelectEmpty = (fields.length === 0);

    const processSelect = async ([primaryKey, currentRecord]: [string, RecordWithId<T>]): Promise<void> => {
      await this._lockManager.waitUnlockToRead(primaryKey);

      if (!matchRecord(currentRecord, compiledFilter)) return;

      result.push(areFieldsToSelectEmpty 
        ? { ...currentRecord }
        : this.extractSelectedFields(fields, currentRecord)
      );
    }

    let promises: Promise<void>[] = [];
    for (const data of this._recordsMap) {
      promises.push(processSelect(data));
    }

    await this.processPromiseBatch(promises);

    return result;
  }

  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const willPkBeModified = this.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    const keys = Array.from(this._recordsMap.keys());
    let affectedRecords = 0;

    const proccessUpdate = async (key: string) => {
      const currentRecord = this._recordsMap.get(key);
      await this._lockManager.waitUnlockToRead(key);

      if (!currentRecord || !matchRecord(currentRecord, compiledFilter)) return;
      
      await this._lockManager.waitUnlockToWrite(key);

      if (willPkBeModified) { 
        const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, currentRecord);

        if (oldPk !== newPk) this.checkIfPrimaryKeyIsInUse(newPk);
        
        this._recordsMap.delete(oldPk);
        Object.assign(currentRecord, updatedFields);
        this._recordsMap.set(newPk, currentRecord);
      }
      else {
        Object.assign(currentRecord, updatedFields);
      }
      affectedRecords++;
    }

    await this.processPromiseBatch(keys.map(proccessUpdate));

    return affectedRecords;
  }

  public async deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.buildPkFromRecord(primaryKey);

    await this._lockManager.waitUnlockToWrite(primaryKeyBuilt);

    const found = this._recordsMap.get(primaryKeyBuilt);
    this._recordsMap.delete(primaryKeyBuilt);

    return found ? { ...found } : null;
  }

}
