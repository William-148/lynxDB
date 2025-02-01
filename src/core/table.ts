import { Filter } from "../types/filter.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { generateId } from "../utils/generate-id";
import { RecordLockManager } from "./record-lock-manager";
import { Config } from "./config";
import { ITable, TableConfig } from "../types/table.type";
import { RecordWithId, Versioned } from "../types/record.type";
import { PrimaryKeyManager } from "./primary-key-manager";

export class Table<T> implements ITable<T> {
  /** Map that stores the records of the table. */
  protected _recordsMap: Map<string, Versioned<T>>;
  /** Definition of the primary key. */
  protected _primaryKeyManager: PrimaryKeyManager<T>;
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
    this._primaryKeyManager = new PrimaryKeyManager(definition.primaryKey ?? []);
    this._config = config ?? new Config();
    this._lockManager = new RecordLockManager(this._config);
  }

  get recordsMap(): Map<string, Versioned<T>> { return this._recordsMap; }
  get primaryKeyManager(): PrimaryKeyManager<T> { return this._primaryKeyManager; }
  get lockManager(): RecordLockManager { return this._lockManager; }
  get config(): Config { return this._config; }

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
   * Checks if the primary key is already in use and throws an error if it is.
   *
   * @param {string} primaryKey - The primary key to check.
   * @throws {DuplicatePrimaryKeyValueError} - If the primary key is already in use.
   */
  protected checkIfPrimaryKeyIsInUse(primaryKey: string): void {
    if (!this._recordsMap.has(primaryKey)) return;
    
    throw this._primaryKeyManager.createDuplicatePkValueError(primaryKey);
  }

  /**
   * Inserts a record into the record map.
   * 
   * @param {Versioned<T>} record - The record to be inserted.
   */
  private insertInMap(record: Versioned<T>): void {
    const primaryKey = this._primaryKeyManager.buildPkFromRecord(record.data);
    this.checkIfPrimaryKeyIsInUse(primaryKey);

    this._recordsMap.set(primaryKey, record);
  }

  /**
   * Creates a new record with an initial version. Generates a new primary key 
   * if no primary key definition exists.
   * 
   * @param {T} record - The original record.
   * @returns {Versioned<T>} - The new record with an initial version.
   */
  protected createNewVersionedRecord(record: T): Versioned<T> {
    const newRecord: RecordWithId<T> = { ...record } as RecordWithId<T>;

    if (this._primaryKeyManager.hasNotPkDefinition() && !newRecord._id) {
      newRecord._id = generateId();
    }

    return { data: newRecord, version: 1 };
  }

  /**
   * Updates the data and version of a versioned record.
   * 
   * @param versioned Versioned record to update.
   * @param updatedFields The updated fields to apply to the record.
   */
  protected updateVersionedRecord(versioned: Versioned<T>, updatedFields: Partial<T>): void {
    Object.assign(versioned.data, updatedFields);
    versioned.version++;
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
    const newRecord = this.createNewVersionedRecord(record);
    this.insertInMap(newRecord);
    return { ...newRecord.data };
  }

  public async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewVersionedRecord(record);
      this.insertInMap(newRecord);
    }
  }

  public async findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this._primaryKeyManager.buildPkFromRecord(primaryKey);

    await this._lockManager.waitUnlockToRead(primaryKeyBuilt);

    const recordFound = this._recordsMap.get(primaryKeyBuilt);

    return recordFound ? { ...recordFound.data } : null;
  }

  public async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const result: Partial<RecordWithId<T>>[] = [];
    const areFieldsToSelectEmpty = (fields.length === 0);

    const processSelect = async ([primaryKey, versioned]: [string, Versioned<T>]): Promise<void> => {
      const currentRecord = versioned.data;
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

    const willPkBeModified = this._primaryKeyManager.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    const keys = Array.from(this._recordsMap.keys());
    let affectedRecords = 0;

    const proccessUpdate = async (key: string) => {
      const currentVersioned = this._recordsMap.get(key);
      const currentRecord = currentVersioned?.data;

      await this._lockManager.waitUnlockToRead(key);

      if (!currentRecord || !matchRecord(currentRecord, compiledFilter)) return;
      
      await this._lockManager.waitUnlockToWrite(key);

      if (willPkBeModified) { 
        const { newPk, oldPk } = this._primaryKeyManager.generatePkForUpdate(currentRecord, updatedFields);

        if (oldPk !== newPk) this.checkIfPrimaryKeyIsInUse(newPk);
        
        this._recordsMap.delete(oldPk);
        this._recordsMap.set(newPk, currentVersioned);
        this.updateVersionedRecord(currentVersioned, updatedFields);
      }
      else {
        this.updateVersionedRecord(currentVersioned, updatedFields);
      }
      affectedRecords++;
    }

    await this.processPromiseBatch(keys.map(proccessUpdate));

    return affectedRecords;
  }

  public async deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this._primaryKeyManager.buildPkFromRecord(primaryKey);

    await this._lockManager.waitUnlockToWrite(primaryKeyBuilt);

    const found = this._recordsMap.get(primaryKeyBuilt);
    this._recordsMap.delete(primaryKeyBuilt);

    return found ? { ...found.data } : null;
  }

}