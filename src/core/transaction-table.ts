import { Filter } from "../types/filter.type";
import { LockType } from "../types/lock.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { Table } from "./table";
import { RecordWithId } from "../types/table.type";
import { IsolationLevel, TwoPhaseCommitParticipant } from "../types/transaction.type";
import { Config } from "./config";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";
import { LockTimeoutError } from "./errors/record-lock-manager.error";
import { ExternalModificationError } from "./errors/transaction-table.error";
import { TransactionCompletedError, TransactionConflictError } from "./errors/transaction.error";

export class TransactionTable<T> extends Table<T> implements TwoPhaseCommitParticipant {
  private _transactionId: string;
  private _isActive: boolean;
  private _transactionConfig: Config;
  /**
   * Temporal Map that stores new records and updated committed records. The records in this 
   * map have the most recent data.
   * 
   * This map stores:
   * - New records inserted that have not yet been applied.
   * - Committed records updated that have not yet been applied. These records have the most 
   *   recently updated PK as the map key.
   */
  private _tempRecordsMap: Map<string, RecordWithId<T>>;
  /**
   * Temporal Array that stores the new inserted records that will be inserted in the committed 
   * Array.
   * 
   * This array stores:
   * - New records inserted that have not yet been applied.
   */
  private _tempRecordsArray: RecordWithId<T>[];
  /**
   * Temporal Map that stores the updates of the committed records that will be applied in the 
   * committed Map and Array.
   * 
   * This map stores:
   * - Committed records that have been updated and have not yet been applied.
   *   These records have the committed/oldest PK as the map key.
   */
  private _tempUpdatedRecordsMap: Map<string, RecordWithId<T>>;
  /**
   * Temporal Set that stores the PK of the committed records that will be deleted in the 
   * committed Map and Array.
   * 
   * This set stores:
   * - Committed records PK that have been deleted and have not yet been applied.
   */
  private _tempDeletedRecordsSet: Set<string>;

  /** Contain the PKs that have a shared lock in the current transaction. */
  private _sharedLocks: Set<string>;
  /** Contain the PKs that have an exclusive lock in the current transaction. */
  private _exclusiveLocks: Set<string>;

  /**
   * @param transactionId The ID of the transaction.
   * @param table The table to be used in the transaction.
   * @param transactionConfig The configuration object for the transaction.
   */
  constructor(transactionId: string, table: Table<T>, transactionConfig?: Config) {
    super({ primaryKey: table.pkDefinition }, transactionConfig);
    this._transactionId = transactionId;
    this._isActive = true;
    this._transactionConfig = transactionConfig ?? new Config();
    this._tempRecordsMap = new Map();
    this._tempRecordsArray = [];

    this._tempUpdatedRecordsMap = new Map();
    this._tempDeletedRecordsSet = new Set();

    this._sharedLocks = new Set();
    this._exclusiveLocks = new Set();

    // Copy references from the table to the transaction table
    this._recordsArray = table.recordsArray;
    this._recordsMap = table.recordsMap;
    this._lockManager = table.lockManager;
  }

  get transactionId(): string { return this._transactionId; }
  get config(): Config { return this._config; }

  override get sizeMap(): number {
    // In this case, _tempRecordsArray is used to complement the size of the Map, because the 
    // Temporary Map stores new and updated records, so its size is not real. Instead, the size 
    // of the Temporary Array is used because it will only store new records.
    return this._recordsMap.size + this._tempRecordsArray.length;
  }

  /**
   * Clears all temporary records, including temporary records map, temporary records array, 
   * updated records map, and deleted records set.
   */
  public clearTemporaryRecords(): void {
    this._tempRecordsMap.clear();
    this._tempRecordsArray = [];
    this._tempUpdatedRecordsMap.clear();
    this._tempDeletedRecordsSet.clear();
  }

  /**
   * Releases all current locks, including shared and exclusive locks, and clears the lock sets.
   */
  private releaseCurrentLocks(): void {
    this._sharedLocks.forEach((pk) => this._lockManager.releaseLock(this._transactionId, pk));
    this._exclusiveLocks.forEach((pk) => this._lockManager.releaseLock(this._transactionId, pk));
    this._sharedLocks.clear();
    this._exclusiveLocks.clear();
  }

  /**
   * Finishes the transaction by releasing locks and clearing temporary records.
   */
  private finishTransaction(): void {
    this._isActive = false;
    this.releaseCurrentLocks();
    this.clearTemporaryRecords();
  }
  
  /**
   * Acquires a shared lock for the specified primary key.
   * 
   * @param key The primary key of the record to be locked.
   * @throws {LockTimeoutError} If the lock cannot be acquired within the timeout.
   */
  private async acquireSharedLock(key: string): Promise<void> {
    if (this._sharedLocks.has(key) || this._exclusiveLocks.has(key)) return;
    await this._lockManager.acquireLockWithTimeout(
      this._transactionId,
      key,
      LockType.Shared,
      this._transactionConfig.get("lockTimeout")
    );
    this._sharedLocks.add(key);
  }

  /**
   * Acquires an exclusive lock for the specified key.
   *
   * @param {string} key - The key for which to acquire the lock.
   * @returns {Promise<void>} - A promise that resolves when the lock is acquired.
   */
  private async acquireExclusiveLock(key: string): Promise<void> {
    if (this._exclusiveLocks.has(key)) return;
    if (this._sharedLocks.has(key)) {
      this._lockManager.releaseLock(this._transactionId, key);
      this._sharedLocks.delete(key);
    }
    await this._lockManager.acquireLockWithTimeout(
      this._transactionId,
      key,
      LockType.Exclusive,
      this._transactionConfig.get("lockTimeout")
    );
    this._exclusiveLocks.add(key);
  }

  /**
   * Acquires a read lock for the specified key based on the isolation level.
   *
   * @param {string} key - The key for which to acquire the read lock.
   * @returns {Promise<void>} - A promise that resolves when the lock is acquired.
   */
  private async acquireReadLock(key: string): Promise<void> {
    switch (this._transactionConfig.get("isolationLevel")) {
      case IsolationLevel.ReadLatest:
        return this.acquireSharedLock(key);
      case IsolationLevel.StrictLocking:
        return this.acquireExclusiveLock(key);
    }
  }

  /**
   * Checks if the primary key of a committed record has been updated.
   *
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
   * Verifies if the primary key value already exists in the temporary Map or in the committed Map.
   * 
   * If the PK not exist in the temp Map, but exists in the committed Map, the PK is available 
   * only when:
   * - The PK exist in the deleted Set.
   * - The PK exist in the updated Map, the PK is available only when the PK is 
   *  different from the PK of the updated record.
   * 
   * @param primaryKey Primary key value
   * @throws {DuplicatePrimaryKeyValueError} If the primary key value already exists  in the 
   * committed Map or in the temporary Map
   */
  private checkIfPkExistsInMaps(primaryKey: string): void {
    if (this._tempRecordsMap.has(primaryKey)) throw this.createDuplicatePkValueError(primaryKey);

    if (!this._recordsMap.has(primaryKey)) {
      // The PK is available because it is not found in the temporary Map or in the committed Map.
      return;
    }

    // At this point the PK exists in the committed Map. Before throwing an error, it must be 
    // checked if the committed record has been deleted or updated.

    if (this._tempDeletedRecordsSet.has(primaryKey)) {
      // The PK is available because the committed record is deleted.
      return;
    }

    if (this.isCommitedRecordPkUpdated(primaryKey)) {
      // The PK is available because the PK of the committed record has been updated and now it is 
      // different, therefore the committed record will be deleted.
      return;
    }

    // Throw error because the PK already exists in the committed Map and has not been deleted 
    // or updated.
    throw this.createDuplicatePkValueError(primaryKey);
  }

  /**
   * Inserts a record into the temporary map.
   * 
   * @param {RecordWithId<T>} record - The record to be inserted.
   */
  private insertInTemporaryMap(record: RecordWithId<T>): void {
    const primaryKey = this.buildPkFromRecord(record);
    this.checkIfPkExistsInMaps(primaryKey);
    this._tempRecordsMap.set(primaryKey, record);
  }

  /**
   * Retrieves the temporary changes from a committed record based on the primary key.
   *
   * @param {string} primaryKey - The primary key of the committed record.
   * @param {RecordWithId<T>} committedRecord - The committed record to check for temporary changes.
   * @returns {RecordWithId<T> | null} - The temporary changes if they exist, or null if the record 
   * has been deleted, or the committed record if no changes are found.
   */
  private getTempChangesFromCommittedRecord(primaryKey: string, committedRecord: RecordWithId<T>): RecordWithId<T> | null {
    if (this._tempDeletedRecordsSet.has(primaryKey)) return null;
    return this._tempUpdatedRecordsMap.get(primaryKey) ?? committedRecord;
  }

  /**
   * Creates a new updated record by merging the committed record with the updated fields.
   * 
   * @param {RecordWithId<T>} committedRecord - The committed record.
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @returns {RecordWithId<T>} - The new updated record.
   */
  private createNewUpdatedRecord(committedRecord: RecordWithId<T>, updatedFields: Partial<T>): RecordWithId<T> {
    return {
      ...committedRecord,
      ...updatedFields
    }
  }

  override size(): number {
    return this._recordsArray.length + this._tempRecordsArray.length;
  }

  override async insert(record: T): Promise<T> {
    const newRecord = this.createNewRecordWithId(record);
    this.insertInTemporaryMap(newRecord);
    this._tempRecordsArray.push(newRecord);
    return { ...newRecord };
  }

  override async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewRecordWithId(record);
      this.insertInTemporaryMap(newRecord);
      this._tempRecordsArray.push(newRecord);
    }
  }

  override async findByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.buildPkFromRecord(primaryKey);

    // At this point, an attempt is made to find a recently inserted or updated record.
    const temporaryRecord = this._tempRecordsMap.get(primaryKeyBuilt);
    if (temporaryRecord) {
      await this.acquireReadLock(primaryKeyBuilt);
      return { ...temporaryRecord };
    }

    // Try to find a permanent/committed record from the committed Map.
    const committedRecord = this._recordsMap.get(primaryKeyBuilt);

    if (!committedRecord) return null;

    // * Check if the committed record was deleted.
    // * Check if the committed record was updated. If it does not exist in the temporary Map 
    //   but does exist in the temporary update Map, it means that the PK of the committed 
    //   record has been modified. Therefore, null must be returned because the committed record 
    //   no longer exists with this PK and will be deleted from the committed Map during the 
    //   commit operation.
    await this.acquireReadLock(primaryKeyBuilt);
    if (this._tempDeletedRecordsSet.has(primaryKeyBuilt)
      || this._tempUpdatedRecordsMap.has(primaryKeyBuilt)) return null;

    return { ...committedRecord };
  }

  override async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const committedResults: Partial<T>[] = [];
    const newestResults: Partial<T>[] = [];

    const areFieldsToSelectEmpty = (fields.length === 0);

    const committedSelectProcess = async (committedRecord: RecordWithId<T>) => {
      const commitedRecordPK = this.buildPkFromRecord(committedRecord);
      const recordWithTempChanges = this.getTempChangesFromCommittedRecord(commitedRecordPK, committedRecord);

      // The function execution is finished because the record is null, which means that it was 
      // deleted and should not be added to the result.
      if (recordWithTempChanges === null) return;

      if (!matchRecord(recordWithTempChanges, compiledFilter)) return;

      await this.acquireReadLock(commitedRecordPK);

      committedResults.push(areFieldsToSelectEmpty
        ? { ...recordWithTempChanges }
        : this.extractSelectedFields(fields, recordWithTempChanges)
      );
    }

    const newestSelectProcess = async (newestRecord: RecordWithId<T>) => {
      if (!matchRecord(newestRecord, compiledFilter)) return;
      newestResults.push(areFieldsToSelectEmpty
        ? { ...newestRecord }
        : this.extractSelectedFields(fields, newestRecord)
      );
    }

    // Loop through the committed and temporary Array to access the committed and newest records.
    const committedPromises = Promise.all(this._recordsArray.map(committedSelectProcess));
    const uncommitedPromises = Promise.all(this._tempRecordsArray.map(newestSelectProcess));

    await committedPromises;
    await uncommitedPromises;

    return committedResults.concat(newestResults);
  }

  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const willPkBeModified = this.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    let affectedRecords = 0;

    const committedUpdateProcess = async (committedRecord: RecordWithId<T>) => {
      const committedRecordPk = this.buildPkFromRecord(committedRecord);
      const recordWithTempChanges = this.getTempChangesFromCommittedRecord(committedRecordPk, committedRecord);

      // The function execution is finished because the record is null, which means that it was 
      // deleted and should be ignored.
      if (recordWithTempChanges === null) return;

      if (!matchRecord(recordWithTempChanges, compiledFilter)) return;
      await this.acquireExclusiveLock(committedRecordPk);

      const isRecordFirstUpdate = (committedRecord === recordWithTempChanges);

      if (willPkBeModified) {
        this.handleUpdateWithPKUpdated(updatedFields, recordWithTempChanges, isRecordFirstUpdate);
      }
      else {
        this.handleUpdateWithPKNotUpdated(updatedFields, recordWithTempChanges, committedRecordPk, isRecordFirstUpdate);
      }
      affectedRecords++;
    }

    for (const newestRecord of this._tempRecordsArray) {
      if (!matchRecord(newestRecord, compiledFilter)) continue;
      this.handleNewestRecordUpdate(updatedFields, newestRecord, willPkBeModified);
      affectedRecords++;
    }

    await Promise.all(this._recordsArray.map(committedUpdateProcess));

    return affectedRecords;
  }

  /**
   * Handles the update of the newest record, including primary key modification if necessary.
   *
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @param {RecordWithId<T>} newestRecord - The newest record to update.
   * @param {boolean} willPkBeModified - Indicates if the primary key will be modified.
   */
  private handleNewestRecordUpdate(updatedFields: Partial<T>, newestRecord: RecordWithId<T>, willPkBeModified: boolean): void {
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
  }

  /**
   * Handles the update of a record when the primary key is modified.
   *
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @param {RecordWithId<T>} record - The record to update.
   * @param {boolean} isFirstUpdate - Indicates if this is the first update for the record.
   */
  private handleUpdateWithPKUpdated(updatedFields: Partial<T>, record: RecordWithId<T>, isFirstUpdate: boolean): void {
    const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, record);
    this.checkIfPkExistsInMaps(newPk);

    if (isFirstUpdate) {
      // At this point `record` is the committed record. The committed record is not modified, 
      // to update it, a new record is created with the updated fields.
      const newRecordUpdated = this.createNewUpdatedRecord(record, updatedFields);
      this._tempRecordsMap.set(newPk, newRecordUpdated);
      this._tempUpdatedRecordsMap.set(oldPk, newRecordUpdated);
    } else {
      // The committed record was already updated previously, `record` have the latest changes. 
      // The reference of the record (latest changes) is updated with the new updated fields.
      Object.assign(record, updatedFields);
      this._tempRecordsMap.delete(oldPk);
      this._tempRecordsMap.set(newPk, record);
    }
  }

  /**
   * Handles the update of a record when the primary key is not modified.
   * 
   * @param updatedFields - The fields to update in the record.
   * @param record - The record to update.
   * @param committedRecordPk - The primary key of the committed record.
   * @param isFirstUpdate - Indicates if this is the first update for the record.
   */
  private handleUpdateWithPKNotUpdated(
    updatedFields: Partial<T>,
    record: RecordWithId<T>,
    committedRecordPk: string,
    isFirstUpdate: boolean
  ): void {
    if (isFirstUpdate) {
      // At this point `record` is the committed record. The committed record is not modified, 
      // to update it, a new record is created with the updated fields.
      const newRecordUpdated = this.createNewUpdatedRecord(record, updatedFields);
      this._tempRecordsMap.set(committedRecordPk, newRecordUpdated);
      this._tempUpdatedRecordsMap.set(committedRecordPk, newRecordUpdated);
    }
    else {
      // The committed record was already updated previously, `record` have the latest changes. 
      // The reference of the record (latest changes) is updated with the new updated fields.
      Object.assign(record, updatedFields);
    }
  }

  public async prepare(): Promise<void> {
    if (!this._isActive) throw new TransactionCompletedError();
    try {
      const keysToLock = [
        ...this._tempUpdatedRecordsMap.keys(),
        ...this._tempDeletedRecordsSet.keys()
      ];
      await this.acquireExclusiveLocks(keysToLock);
      await this.validateChanges();
    }
    catch (error: any) {
      this.rollback();
      throw new TransactionConflictError(this._transactionId, error?.message);
    }
  }

  public async apply(): Promise<void> {
    if (!this._isActive) throw new TransactionCompletedError();
    try {
      // Apply the changes
      this.applyUpdates();
      // this.applyDeletes(); // NOT IMPLEMENTED YET
      this.applyNewInsertions();
  
      // Release locks and clear temporary records
      this.finishTransaction();
    }
    catch(error: any) {
      this.rollback();
      throw new TransactionConflictError(this._transactionId, error?.message);
    }
  }

  public async rollback(): Promise<void> {
    this.finishTransaction();
  }

  /**
   * Commits the changes.
   * 
   * Applies the changes permanently by updating the committed records map and array.
   * 
   * Phases:
   * 1. Prepare: Validates changes and locks resources.
   * 2. Apply/Commit: Applies the changes permanently.
   * 
   * If any phase fails, the changes are rolled back automatically.
   * 
   * @throws {TransactionCompletedError} If the transaction is already completed.
   * @throws {LockTimeoutError} If the locks cannot be acquired within the timeout.
   * @throws {DuplicatePrimaryKeyValueError} If there are duplicate primary keys.
   */
  public async commit(): Promise<void> {
    await this.prepare();
    await this.apply();
  }

  /**
   * Acquires exclusive locks for the specified keys.
   *
   * @param {string[]} keys - The keys for which to acquire exclusive locks.
   * @returns {Promise<void[]>} - A promise that resolves when all locks are acquired.
   */
  private async acquireExclusiveLocks(keys: string[]): Promise<void[]> {
    const promises: Promise<void>[] = [];
    for (let key of keys) {
      promises.push(this.acquireExclusiveLock(key));
    }
    return Promise.all(promises);
  }

  /**
   * Validates the data integrity by acquiring shared locks and checking for duplicate primary keys.
   *
   * This method acquires shared locks for the specified keys and validates the data integrity.
   * It checks for duplicate primary keys and ensures that the version of the updated records
   * matches the committed version. If any validation fails, an appropriate error is thrown.
   *
   * @throws {LockTimeoutError} If the locks cannot be acquired within the timeout.
   * @throws {DuplicatePrimaryKeyValueError} If there are duplicate primary keys.
   */
  public async validateChanges(): Promise<void> {
    // Validate that there are no duplicate PKs
    for (let pk of this._tempRecordsMap.keys()) {
      if (this._recordsMap.has(pk)
        && !this._tempUpdatedRecordsMap.has(pk)
        && !this._tempDeletedRecordsSet.has(pk)) {
        throw this.createDuplicatePkValueError(pk);
      }
    }
  }

  /**
   * Inserts new records into the committed records map and array.
   *
   * This method iterates over the temporary records array, builds the primary key (PK) for each 
   * new record, and inserts the record into the committed records map and array.
   * 
   * @throws {DuplicatePrimaryKeyValueError} If a duplicate primary key is found.
   */
  private applyNewInsertions(): void {
    for (let newRecord of this._tempRecordsArray) {
      const primaryKey = this.buildPkFromRecord(newRecord);
      if (this._recordsMap.has(primaryKey)) throw this.createDuplicatePkValueError(primaryKey);
      this._recordsMap.set(primaryKey, newRecord);
      this._recordsArray.push(newRecord);
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
      if (committedRecord) {
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
  }

  /**
   * @ignore NOT IMPLEMENTED YET
   * Deletes records from the committed records map and array.
   *
   * This method iterates over the temporary deleted records set and removes the corresponding
   * records from the committed records map. It also removes the deleted records from the committed
   * array by building the primary key (PK) for each record and checking if it is in the set of
   * records to be removed.
   */
  // private applyDeletes(): void {
  //   if (this._tempDeletedRecordsSet.size === 0) return;

  //   for (let pk of this._tempDeletedRecordsSet) {
  //     this._recordsMap.delete(pk);
  //   }
  //   const newArray = [];
  //   for (let i = 0; i < this._recordsArray.length; i++) {
  //     const recordPK = this.buildPkFromRecord(this._recordsArray[i]);
  //     if (!this._tempDeletedRecordsSet.has(recordPK)) {
  //       newArray.push(this._recordsArray[i]);
  //     }
  //   }
  //   this._recordsArray = newArray;
  // }
}
