import { Filter } from "../types/filter.type";
import { LockType } from "../types/lock.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { RecordLockManager } from "./record-lock-manager";
import { Table } from "./table";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";
import { LockTimeoutError } from "./errors/record-lock-manager.error";
import { 
  RecordWithId,
  RecordWithVersion,
  TableTemporaryState
} from "../types/database-table.type";

export class TransactionTable<T> extends Table<T> {
  /**
   * Temporal Map that stores new records and updated committed records. 
   * The records in this map have the most recent data.
   * 
   * This map stores:
   * - New records inserted that have not yet been applied.
   * - Committed records updated that have not yet been applied. 
   *   These records have the most recently updated PK as the map key.
   * 
   */
  private _tempRecordsMap: Map<string, RecordWithVersion<T>>;
  /**
   * Temporal Array that stores the new inserted records that will be inserted 
   * in the committed Array.
   * 
   * This array stores:
   * - New records inserted that have not yet been applied.
   */
  private _tempRecordsArray: RecordWithVersion<T>[];
  /**
   * Temporal Map that stores the updates of the committed records that will be 
   * applied in the committed Map and Array.
   * 
   * This map stores:
   * - Committed records that have been updated and have not yet been applied.
   *   These records have the committed/oldest PK as the map key.
   */
  private _tempUpdatedRecordsMap: Map<string, RecordWithVersion<T>>;
  /**
   * Temporal Set that stores the PK of the committed records that will be deleted in the committed Map and Array.
   * 
   * This set stores:
   * - Committed records PK that have been deleted and have not yet been applied.
   */
  private _tempDeletedRecordsSet: Set<string>;

  constructor(
    name: string,
    recordsMap: Map<string, RecordWithVersion<T>>,
    recordsArray: RecordWithVersion<T>[],
    lockManager: RecordLockManager,
    pkDefinition: (keyof T)[]
  ) {
    super(name, pkDefinition);
    this._recordsArray = recordsArray;
    this._recordsMap = recordsMap;
    this._lockManager = lockManager;

    this._tempRecordsArray = [];
    this._tempRecordsMap = new Map();

    this._tempUpdatedRecordsMap = new Map();
    this._tempDeletedRecordsSet = new Set();
  }

  override get sizeMap(): number {
    // In this case, _tempRecordsArray is used to complement the size of the Map, because 
    // the Temporary Map stores new and updated records, so its size is not real. Instead, 
    // the size of the Temporary Array is used because it will only store new records.
    return this._recordsMap.size + this._tempRecordsArray.length;
  }

  /**
   * Retrieves the temporary state of the table.
   * 
   * @public
   * @returns {TableTemporaryState<T>} - The current temporary state of the table.
   */
  public getTemporaryState(): TableTemporaryState<T> {
    return {
      recordsMap: this._tempRecordsMap,
      recordsArray: this._tempRecordsArray,
      tempUpdatedRecordsMap: this._tempUpdatedRecordsMap,
      tempDeletedRecordsSet: this._tempDeletedRecordsSet
    };
  }

  /**
   * Clears the temporary state of the table.
   * 
   * @public
   * @returns {void}
   */
  public clearTemporaryRecords(): void {
    this._tempRecordsMap.clear();
    this._tempRecordsArray = [];
    this._tempUpdatedRecordsMap.clear();
    this._tempDeletedRecordsSet.clear();
  }

  /**
   * Checks if the primary key of a committed record has been updated.
   *
   * @private
   * @param {string} commitedPk - The primary key of the committed record.
   * @returns {boolean} - Returns true if the primary key has been updated, otherwise false.
   */
  private isCommitedRecordPkUpdated(commitedPk: string): boolean {
    // Retrieve the temporarily updated committed record
    const commitedRecordUpdated = this._tempUpdatedRecordsMap.get(commitedPk);
    if (!commitedRecordUpdated) return false;

    // If the record exists and its primary key has changed, return true
    const commitedRecordUpdatedPk = this.buildPkFromRecord(commitedRecordUpdated);
    return commitedPk !== commitedRecordUpdatedPk;
  }

  /**
   * Verifies if the primary key value already exists in the temporary Map or in the
   * committed Map.
   * 
   * If the PK not exist in the temp Map, but exists in the committed Map, the PK is available only when:
   * - The PK exist in the deleted Set.
   * - The PK exist in the updated Map, the PK is available only when the PK is 
   *  different from the PK of the updated record.
   * 
   * @private
   * @param primaryKey Primary key value
   * @throws {DuplicatePrimaryKeyValueError} If the primary key value already exists 
   * in the committed Map or in the temporary Map
   */
  private checkIfPkExistsInMaps(primaryKey: string): void {
    if (this._tempRecordsMap.has(primaryKey)) throw this.createDuplicatePkValueError(primaryKey);

    if (!this._recordsMap.has(primaryKey)) {
      // The PK is available because it is not found in the temporary Map or 
      // in the committed Map.
      return;
    }

    // At this point the PK exists in the committed Map. Before throwing an error, 
    // it must be checked if the committed record has been deleted or updated.

    if (this._tempDeletedRecordsSet.has(primaryKey)) {
      // The PK is available because the committed record is deleted.
      return;
    }

    if (this.isCommitedRecordPkUpdated(primaryKey)) {
      // The PK is available because the PK of the committed record has been updated and 
      // now it is different, therefore the committed record will be deleted.
      return;
    }

    // Throw error because the PK already exists in the committed Map and has not been 
    // deleted or updated.
    throw this.createDuplicatePkValueError(primaryKey);
  }

  /**
   * Inserts a record into the temporary map.
   * 
   * @private
   * @param {RecordWithVersion<T>} record - The record to be inserted.
   * @returns {void}
   */
  private insertInTemporaryMap(record: RecordWithVersion<T>): void {
    const primaryKey = this.buildPkFromRecord(record);
    this.checkIfPkExistsInMaps(primaryKey);
    this._tempRecordsMap.set(primaryKey, record);
  }

  /**
   * Retrieves the temporary changes from a committed record.
   *
   * @private
   * @param {RecordWithVersion<T>} committedRecord - The committed record to check for temporary changes.
   * @returns {RecordWithVersion<T> | null} - The temporary changes if they exist, or null if the record 
   * has been deleted or the committed record if no changes are found.
   */
  private getTempChangesFromCommittedRecord(committedRecord: RecordWithVersion<T>): RecordWithVersion<T> | null {
    const primaryKey = this.buildPkFromRecord(committedRecord);
    if (this._tempDeletedRecordsSet.has(primaryKey)) return null;
    return this._tempUpdatedRecordsMap.get(primaryKey) ?? committedRecord;
  }

  /**
   * Creates a new updated record by merging the committed record with the updated fields.
   * 
   * @private
   * @param {RecordWithVersion<T>} committedRecord - The committed record.
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @returns {RecordWithVersion<T>} - The new updated record.
   */
  private createNewUpdatedRecord(committedRecord: RecordWithVersion<T>, updatedFields: Partial<T>): RecordWithVersion<T> {
    return {
      ...committedRecord,
      ...updatedFields,
      __version: committedRecord.__version
    }
  }

  override size(): number {
    return this._recordsArray.length + this._tempRecordsArray.length;
  }

  override async insert(record: T): Promise<T> {
    const newRecord = this.createNewRecordWithVersion(record);
    this.insertInTemporaryMap(newRecord);
    this._tempRecordsArray.push(newRecord);
    return this.mapRecordVersionToRecord(newRecord);
  }

  override async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewRecordWithVersion(record);
      this.insertInTemporaryMap(newRecord);
      this._tempRecordsArray.push(newRecord);
    }
  }

  override async findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.buildPkFromRecord(primaryKey);

    // At this point, an attempt is made to find a recently inserted or updated record.
    const temporaryRecord = this._tempRecordsMap.get(primaryKeyBuilt);
    if (temporaryRecord) return this.mapRecordVersionToRecord(temporaryRecord);

    // Try to find a permanent/committed record from the committed Map.
    const committedRecord = this._recordsMap.get(primaryKeyBuilt);

    // * Check if the committed record was deleted.
    // * Check if the committed record was updated. If it does not exist in the temporary Map 
    //   but does exist in the temporary update Map, it means that the PK of the committed 
    //   record has been modified. Therefore, null must be returned because the committed record 
    //   no longer exists with this PK and will be deleted from the committed Map during the 
    //   commit operation.

    if (!committedRecord
      || this._tempDeletedRecordsSet.has(primaryKeyBuilt)
      || this._tempUpdatedRecordsMap.has(primaryKeyBuilt)) return null;

    return this.mapRecordVersionToRecord(committedRecord);
  }

  override async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const result: Partial<T>[] = [];
    const areFieldsToSelectEmpty = (fields.length === 0);

    const processSelect = (record: RecordWithVersion<T>, verifyCommittedRecordChanges: boolean) => {
      if (!matchRecord(record, compiledFilter)) return;

      let selectedRecord: Partial<T> | null = null;

      if (verifyCommittedRecordChanges) {
        const recordWithTempChanges = this.getTempChangesFromCommittedRecord(record);
        // The function execution is finished because the record is null, 
        // which means that it was deleted and should not be added to the result.
        if (recordWithTempChanges === null) return;

        selectedRecord = areFieldsToSelectEmpty
          ? this.mapRecordVersionToRecord(recordWithTempChanges)
          : this.extractSelectedFields(fields, recordWithTempChanges);
      } else {
        selectedRecord = areFieldsToSelectEmpty
          ? this.mapRecordVersionToRecord(record)
          : this.extractSelectedFields(fields, record);
      }

      result.push(selectedRecord);
    };

    // Loop through the committed and temporary Array to access 
    // the committed and newer records.
    for (let committedRecord of this._recordsArray) {
      processSelect(committedRecord, true);
    }
    for (let uncommittedRecord of this._tempRecordsArray) {
      processSelect(uncommittedRecord, false);
    }

    return result;
  }

  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;
    this.clearUpdatedFields(updatedFields);

    const willPkBeModified = this.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    let affectedRecords = 0;

    for (const newestRecord of this._tempRecordsArray) {
      if (!matchRecord(newestRecord, compiledFilter)) continue;

      if (willPkBeModified) {
        const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, newestRecord);
        this.checkIfPkExistsInMaps(newPk);

        this._tempRecordsMap.delete(oldPk);
        Object.assign(newestRecord, updatedFields);
        this._tempRecordsMap.set(newPk, newestRecord);
      }
      else {
        Object.assign(newestRecord, updatedFields);
      }
      affectedRecords++;
    }

    for (const committedRecord of this._recordsArray) {
      if (!matchRecord(committedRecord, compiledFilter)) continue;

      // Check if the committed record was deleted or PK was updated.
      // If the primary key (PK) of the committed record has changed, the record will be deleted 
      // during the commit operation. Therefore, the update should be ignored and not proceed.
      const committedPK = this.buildPkFromRecord(committedRecord);
      if (this._tempDeletedRecordsSet.has(committedPK)
        || this.isCommitedRecordPkUpdated(committedPK)) continue;

      if (willPkBeModified) { this.updateWithPKChange(committedRecord, updatedFields); }
      else { this.updateWithoutPKChange(committedRecord, updatedFields); }

      affectedRecords++;
    }

    return affectedRecords;
  }

  private updateWithPKChange(committedRecord: RecordWithVersion<T>, updatedFields: Partial<T>): void {
    const committedRecordPk = this.buildPkFromRecord(committedRecord);
    const recordAlreadyUpdated = this._tempUpdatedRecordsMap.get(committedRecordPk);

    const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, recordAlreadyUpdated ?? committedRecord);
    this.checkIfPkExistsInMaps(newPk);

    if (recordAlreadyUpdated) {
      // The committed record was already updated previously, that's why it exists 
      // in the tempUpdatedRecordsMap. To update it, the record with the old PK 
      // must be deleted and added again with the new PK.
      this._tempRecordsMap.delete(oldPk);
      Object.assign(recordAlreadyUpdated, updatedFields);
      this._tempRecordsMap.set(newPk, recordAlreadyUpdated);
    }
    else {
      // This is the first time the committed record is updated, that's why it doesn't 
      // exist in the temporary updated Map. The committed record is not modified, to update it, 
      // a new record is created with the updated fields and added to the temporary updated 
      // records Map and the temporary records Map.
      const newRecordUpdated = this.createNewUpdatedRecord(committedRecord, updatedFields);
      this._tempRecordsMap.set(newPk, newRecordUpdated); // Save with the new PK
      this._tempUpdatedRecordsMap.set(committedRecordPk, newRecordUpdated); // Save with the committed/oldest PK
    }
  }

  private updateWithoutPKChange(committedRecord: RecordWithVersion<T>, updatedFields: Partial<T>): void {
    const committedRecordPk = this.buildPkFromRecord(committedRecord);
    const recordAlreadyUpdated = this._tempUpdatedRecordsMap.get(committedRecordPk);

    if (recordAlreadyUpdated) {
      // The committed record was already updated previously, that's why it exists
      // in the tempUpdatedRecordsMap. To update it, the updated fields are assigned to it.
      Object.assign(recordAlreadyUpdated, updatedFields);
      return;
    }
    // This is the first time the committed record is updated, that's why it doesn't
    // exist in the temporary updated Map. The committed record is not modified, to update it,
    // a new record is created with the updated fields and added to the temporary updated
    // records Map and the temporary records Map.
    const newRecordUpdated = this.createNewUpdatedRecord(committedRecord, updatedFields);

    // Save the new updated record with the committed/oldest PK, becauste in this case
    // the PK is not modified.
    this._tempRecordsMap.set(committedRecordPk, newRecordUpdated);
    this._tempUpdatedRecordsMap.set(committedRecordPk, newRecordUpdated);
  }

  /**
   * Rolls back the changes by clearing the temporary records.
   *
   * This method clears any temporary records that were created during the transaction,
   * effectively rolling back any changes that were made.
   */
  public async rollback(): Promise<void> {
    this.clearTemporaryRecords();
  }
  
  /**
   * Commits the changes by locking the keys, validating, and writing the updates.
   *
   * This method collects the keys from the temporary updated records map and the
   * temporary deleted records set, then performs the validation and writing phases
   * asynchronously.
   * @throws {LockTimeoutError} If the locks cannot be acquired within the timeout.
   * @throws {DuplicatePrimaryKeyValueError} If there are duplicate primary keys.
   *
   */
  public async commit(): Promise<void> {
    const keysToLock = [
      ...this._tempUpdatedRecordsMap.keys(),
      ...this._tempDeletedRecordsSet.keys()
    ]
    await this.ValidationPhase(keysToLock);
    await this.WritingPhase(keysToLock);
  }

  /**
   * Acquires locks for the specified keys with a timeout.
   *
   * This method attempts to acquire locks for the provided keys using the specified lock type
   * and timeout. If the locks cannot be acquired within the timeout, a LockTimeoutError is thrown.
   * If an error occurs during the lock acquisition, any acquired locks are released.
   *
   * @param {string[]} keys - The keys for which to acquire locks.
   * @param {LockType} lockType - The type of lock to acquire.
   * @param {number} timeoutMs - The timeout duration in miliseconds for acquiring the locks.
   * @returns {Promise<string[]>} A promise that resolves to an array of acquired keys.
   * @throws {LockTimeoutError} If the locks cannot be acquired within the timeout.
   */
  private async acquireLocks(keys: string[], lockType: LockType, timeoutMs: number): Promise<string[]> {
    const acquiredKeys: string[] = [];
    try {
      await Promise.all(
        keys.map(async (key) => {
          await this._lockManager.acquireLockWithTimeout(key, lockType, timeoutMs);
          acquiredKeys.push(key);
        })
      );
      return acquiredKeys;
    } catch (error) {
      acquiredKeys.forEach((key) => this._lockManager.releaseLock(key));
      throw error;
    }
  }

  /**
   * Validates the data integrity by acquiring shared locks and checking for duplicate primary keys.
   *
   * This method acquires shared locks for the specified keys and validates the data integrity.
   * It checks for duplicate primary keys and ensures that the version of the updated records
   * matches the committed version. If any validation fails, an appropriate error is thrown.
   *
   * @param {string[]} keysToLock - The keys for which to acquire shared locks.
   * @throws {LockTimeoutError} If the locks cannot be acquired within the timeout.
   * @throws {DuplicatePrimaryKeyValueError} If there are duplicate primary keys.
   */
  private async ValidationPhase(keysToLock: string[]): Promise<void> {
    //** Acquire shared locks for updated and deleted records **
    const keysLocked = await this.acquireLocks(keysToLock, LockType.Shared, 1000);

    try {
      //** Validate data integrity **
      // Validate that there are no duplicate PKs
      for (let pk of this._tempRecordsMap.keys()) {
        if (this._recordsMap.has(pk) 
          && !this._tempUpdatedRecordsMap.has(pk) 
          && !this._tempDeletedRecordsSet.has(pk)) {
          throw this.createDuplicatePkValueError(pk);
        }
      }

      // Validate if the version of the updated records is the same as the committed
      for (const [pk, updatedRecord] of this._tempUpdatedRecordsMap) {
        const existingRecord = this._recordsMap.get(pk);
        if (!existingRecord || existingRecord.__version !== updatedRecord.__version) {
          throw new Error(
            `Validation failed: Record with PK ${pk} has been modified externally.`
          );
        }
      }
    }
    finally {
      // Release all acquired locks
      keysLocked.forEach(key => this._lockManager.releaseLock(key));
    }
  }

  /**
   * Applies changes by acquiring exclusive locks and performing updates, deletions, and insertions.
   *
   * This method acquires exclusive locks for the specified keys and then applies updates, deletions,
   * and new insertions to the committed map and array. If the locks cannot be acquired within the
   * timeout, a LockTimeoutError is thrown.
   *
   * @param {string[]} keysToLock - The keys for which to acquire exclusive locks.
   * @throws {LockTimeoutError} If the locks cannot be acquired within the timeout.
   */
  private async WritingPhase(keysToLock: string[]): Promise<void> {
    //** Acquire exclusive locks for updated and deleted records **
    const keysLocked = await this.acquireLocks(keysToLock, LockType.Exclusive, 1000);
    // Apply changes to the committed Map and Array
    try {
      this.applyUpdates();
      this.applyDeletes();
      this.applyNewInsertions();
    }
    finally {
      // Release all acquired locks
      keysLocked.forEach(key => this._lockManager.releaseLock(key));
    }
  }

  /**
   * Applies updates to the committed records map.
   *
   * This method iterates over the temporary updated records map and updates the corresponding
   * committed records. If the primary key (PK) of a record has changed, it updates the reference
   * in the committed records map accordingly.
   */
  private applyUpdates(): void {
    for (let [pk, updatedRecord] of this._tempUpdatedRecordsMap) {
      const committedRecord = this._recordsMap.get(pk);
      if (!committedRecord) continue;

      const updatedPk = this.buildPkFromRecord(updatedRecord);
      // Update the reference of the committed record with the updated record,
      // this way the changes of the committed record are reflected in the committed array.
      Object.assign(committedRecord, updatedRecord);
      
      // Delete from the Map because there is a possibility that the PK has changed
      this._recordsMap.delete(pk);
      // Add the original reference to the Map with the new PK
      this._recordsMap.set(updatedPk, committedRecord);
    }
  }

  /**
   * Deletes records from the committed records map and array.
   *
   * This method iterates over the temporary deleted records set and removes the corresponding
   * records from the committed records map. It also removes the deleted records from the committed
   * array by building the primary key (PK) for each record and checking if it is in the set of
   * records to be removed.
   */
  private applyDeletes(): void {
    if (this._tempDeletedRecordsSet.size === 0) return;

    for (let pk of this._tempDeletedRecordsSet) {
      this._recordsMap.delete(pk);
    }
    const newArray = [];
    for (let i = 0; i < this._recordsArray.length; i++) {
      const recordPK = this.buildPkFromRecord(this._recordsArray[i]);
      if (!this._tempDeletedRecordsSet.has(recordPK)) {
        newArray.push(this._recordsArray[i]);
      }
    }
    this._recordsArray = newArray;
  }

  /**
   * Inserts new records into the committed records map and array.
   *
   * This method iterates over the temporary records array, builds the primary key (PK) for each new record,
   * and inserts the record into the committed records map and array.
   */
  private applyNewInsertions(): void {
    for (let newRecord of this._tempRecordsArray) {
      const primaryKey = this.buildPkFromRecord(newRecord);
      this._recordsMap.set(primaryKey, newRecord);
      this._recordsArray.push(newRecord);
    }
  }

}
