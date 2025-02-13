import { RecordLockManager } from "./record-lock-manager";
import { Config } from "./config";
import { TableSchema, TableConfig } from "../types/table.type";
import { RecordWithId, Versioned } from "../types/record.type";
import { PrimaryKeyManager } from "./primary-key-manager";
import { Query } from "../types/query.type";
import { match } from "./query/matcher";
import { compileQuery } from "./query/compiler";
import { processPromiseBatch } from "../utils/batch-processor";
import { 
  createNewVersionedRecord, 
  extractFieldsFromRecord, 
  updateVersionedRecord 
} from "./record";

export class Table<T> implements TableSchema<T> {
  /** Map that stores the records of the table. */
  protected _recordsMap: Map<string, Versioned<T>>;
  /** Definition of the primary key. */
  protected _primaryKeyManager: PrimaryKeyManager<T>;
  protected _lockManager: RecordLockManager;
  protected _config: Config;

  /**
   * @param definition - Definition object for the table
   * @param config - Configuration object for the table
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
   * Checks if the primary key is already in use and throws an error if it is.
   *
   * @param primaryKey - The primary key to check.
   * @throws {DuplicatePrimaryKeyValueError} - If the primary key is already in use.
   */
  private checkIfPrimaryKeyIsInUse(primaryKey: string): void {
    if (this._recordsMap.has(primaryKey)){
      throw this._primaryKeyManager.createDuplicatePkValueError(primaryKey);
    }
  }

  /**
   * Inserts a record into the record map.
   * 
   * @param record - The record to be inserted.
   * @returns - The versioned record that was created and inserted.
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is already in use
   */
  private insertInMap(record: T): Versioned<T> {
    const versionedRecord = createNewVersionedRecord(
      record, 
      this._primaryKeyManager.hasDefaultPk
    );
    const primaryKey = this._primaryKeyManager.buildPkFromRecord(versionedRecord.data);

    this.checkIfPrimaryKeyIsInUse(primaryKey);
    this._recordsMap.set(primaryKey, versionedRecord);
    return versionedRecord;
  }

  public size(): number { return this._recordsMap.size; }
  
  public async insert(record: T): Promise<T> {
    const inserted = this.insertInMap(record);
    return { ...inserted.data };
  }

  public async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      this.insertInMap(record);
    }
  }

  public async findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this._primaryKeyManager.buildPkFromRecord(primaryKey);

    await this._lockManager.waitUnlockToRead(primaryKeyBuilt);

    const recordFound = this._recordsMap.get(primaryKeyBuilt);

    return recordFound ? { ...recordFound.data } : null;
  }

  public async findOne(where: Query<RecordWithId<T>>): Promise<T | null> {
    const compiledQuery = compileQuery(where);

    for (const [primaryKey, versioned] of this._recordsMap) {
      await this._lockManager.waitUnlockToRead(primaryKey);
      if (match(versioned.data, compiledQuery)) {
        return { ...versioned.data };
      }
    }

    return null;
  }

  select(where?: Query<RecordWithId<T>>): Promise<T[]>;
  select(fields?: (keyof T)[], where?: Query<RecordWithId<T>>): Promise<Partial<T>[]>;
  async select(arg1?: (keyof T)[] | Query<RecordWithId<T>>, arg2?: Query<RecordWithId<T>>): Promise<Partial<T>[] | T[]> {
    const [fields, query] = Array.isArray(arg1)
      ? [arg1, arg2]
      : [undefined, arg1];

    const compiledQuery = query ? compileQuery(query) : [];
    const result: Partial<RecordWithId<T>>[] = [];
    const areFieldsToSelectEmpty = !fields || (fields.length === 0);

    const processSelect = async ([primaryKey, versioned]: [string, Versioned<T>]): Promise<void> => {
      await this._lockManager.waitUnlockToRead(primaryKey);
      const currentRecord = versioned.data;
      if (!match(currentRecord, compiledQuery)) return;

      result.push(areFieldsToSelectEmpty 
        ? { ...currentRecord }
        : extractFieldsFromRecord(fields, currentRecord)
      );
    }

    let promises: Promise<void>[] = [];
    for (const data of this._recordsMap) {
      promises.push(processSelect(data));
    }

    await processPromiseBatch(promises);

    return result;
  }

  public async update(updatedFields: Partial<T>, where: Query<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const willPkBeModified = this._primaryKeyManager.isPartialRecordPartOfPk(updatedFields);
    const compiledQuery = compileQuery(where);
    const keys = Array.from(this._recordsMap.keys());
    let affectedRecords = 0;

    const proccessUpdate = async (currentPrimaryKey: string) => {
      await this._lockManager.waitUnlockToRead(currentPrimaryKey);

      const currentVersioned = this._recordsMap.get(currentPrimaryKey);
      if (!currentVersioned) return;
      const versionSnapshot = currentVersioned.version;

      if (!match(currentVersioned.data, compiledQuery)) return;
      
      await this._lockManager.waitUnlockToWrite(currentPrimaryKey);
      if ((versionSnapshot !== currentVersioned.version) && !match(currentVersioned.data, compiledQuery)) {
        return;
      }

      if (willPkBeModified) { 
        const newPk = this._primaryKeyManager.buildUpdatedPk(currentVersioned.data, updatedFields);
        if (currentPrimaryKey !== newPk) this.checkIfPrimaryKeyIsInUse(newPk);
        this._recordsMap.delete(currentPrimaryKey);
        this._recordsMap.set(newPk, currentVersioned);
      }

      updateVersionedRecord(currentVersioned, updatedFields);

      affectedRecords++;
    }

    await processPromiseBatch(keys.map(proccessUpdate));

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