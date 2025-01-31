import { Filter } from "../types/filter.type";
import { LockType } from "../types/lock.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { Table } from "./table";
import { RecordWithId, Versioned } from "../types/table.type";
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
   * Temporal Map that stores new records. The records in this map have the most recent data.
   * 
   * This map stores:
   * - New inserted records that will be applied in the commit phase.
   */
  private _tempInsertedRecordsMap: Map<string, Versioned<T>>;
  /**
   * Temporal Map that stores the updates of the committed records. These records will be applied
   * in the commit phase.
   * 
   * This map stores:
   * - Committed records that have been updated and have not yet been applied.
   *   These records have the committed/oldest PK as the map key.
   */
  private _tempUpdatedMap: Map<string, Versioned<T>>;
  /**
   * Temporal Map that stores the new and the original PK of the updated records as key-value pairs.
   * 
   * The key of this map is the new PK of the updated record, and the value is the original PK.
   * 
   * When a record is updated and the PK is not modified, the original PK is the key and the value.
   */
  private _tempUpdatedWithUpdatedPK: Map<string, string>;
  /**
   * Temporal Set that stores the PK of the deleted committed records that will be applied in the 
   * commit phase.
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
    super({ primaryKey: table.primaryKeyDef }, transactionConfig);
    this._transactionId = transactionId;
    this._isActive = true;
    this._transactionConfig = transactionConfig ?? new Config();
    this._tempInsertedRecordsMap = new Map();

    this._tempUpdatedMap = new Map();
    this._tempUpdatedWithUpdatedPK = new Map();
    this._tempDeletedRecordsSet = new Set();

    this._sharedLocks = new Set();
    this._exclusiveLocks = new Set();

    // Copy references from the table to the transaction table
    this._recordsMap = table.recordsMap;
    this._lockManager = table.lockManager;
  }

  get transactionId(): string { return this._transactionId; }
  get config(): Config { return this._config; }

  /**
   * Clears all temporary records, including temporary records map, temporary records array, 
   * updated records map, and deleted records set.
   */
  public clearTemporaryRecords(): void {
    this._tempInsertedRecordsMap.clear();
    this._tempUpdatedMap.clear();
    this._tempUpdatedWithUpdatedPK.clear();
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

  private async releaseLock(key: string): Promise<void> {
    await this._lockManager.releaseLock(this._transactionId, key);
    this._sharedLocks.delete(key);
    this._exclusiveLocks.delete(key);
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

  private async waitUlockToRead(key: string): Promise<void> {
    if (this._sharedLocks.has(key) || this._exclusiveLocks.has(key)) return;
    await this._lockManager.waitUnlockToRead(key, this._config.get("lockTimeout"));
  }

  /**
   * Checks if the primary key of a committed record has been updated.
   *
   * @param {string} commitedPk - The primary key of the committed record.
   * @param {RecordWithId<T>} commitedRecord - The committed record to check for updates.
   * @returns {boolean} - Returns true if the primary key has been updated, otherwise false.
   */
  private isCommitedRecordPkUpdated(commitedPk: string, commitedRecord?: RecordWithId<T>): boolean {
    // Retrieve the temporarily updated committed record
    const commitedRecordUpdated = commitedRecord || this._tempUpdatedMap.get(commitedPk)?.data;
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
    if (this._tempInsertedRecordsMap.has(primaryKey) || this._tempUpdatedWithUpdatedPK.has(primaryKey))
      throw this.createDuplicatePkValueError(primaryKey);

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
   * @param {Versioned<T>} record - The record to be inserted.
   */
  private insertInTemporaryMap(record: Versioned<T>): void {
    const primaryKey = this.buildPkFromRecord(record.data);
    this.checkIfPkExistsInMaps(primaryKey);
    this._tempInsertedRecordsMap.set(primaryKey, record);
  }

  /**
   * Retrieves the temporary changes from a committed record based on the primary key.
   *
   * @param {string} primaryKey - The primary key of the committed record.
   * @param {Versioned<T>} committedRecord - The committed record to check for temporary changes.
   * @returns {Versioned<T> | null} 
   *  - The temporary changes if they exist.
   *  - null if the record has been deleted.
   *  - The committed record passed as a parameter if there are no temporary changes.
   */
  private getTempChangesFromCommittedRecord(primaryKey: string, committedRecord: Versioned<T>): Versioned<T> | null {
    if (this._tempDeletedRecordsSet.has(primaryKey)) return null;
    return this._tempUpdatedMap.get(primaryKey) ?? committedRecord;
  }

  /**
   * Creates a new updated record by merging the committed record with the updated fields.
   * 
   * @param {Versioned<T>} committedRecord - The committed record.
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @returns {Versioned<T>} - The new updated record.
   */
  private createNewUpdatedRecord(committedRecord: Versioned<T>, updatedFields: Partial<T>): Versioned<T> {
    return {
      data: { ...committedRecord.data, ...updatedFields },
      // The version only changes on the commit phase
      version: committedRecord.version 
    }
  }

  /**
   * Updates a record with the updated fields.
   * 
   * @param record The record to be updated.
   * @param updatedFields The fields to update in the record.
   */
  private updateRecord(record: Versioned<T>, updatedFields: Partial<T>): void {
    Object.assign(record.data, updatedFields);
  }

  override size(): number {
    return this._recordsMap.size + this._tempInsertedRecordsMap.size - this._tempDeletedRecordsSet.size;
  }

  override async insert(record: T): Promise<T> {
    const newRecord = this.createNewVersionedRecord(record);
    this.insertInTemporaryMap(newRecord);
    return { ...newRecord.data };
  }

  override async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewVersionedRecord(record);
      this.insertInTemporaryMap(newRecord);
    }
  }

  //#region FIND BY PK METHODS
  override async findByPk(objectPrimaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.buildPkFromRecord(objectPrimaryKey);
    await this.acquireReadLock(primaryKeyBuilt);

    return this.findInInsertedRecords(primaryKeyBuilt)
      ?? this.findInUpdatedRecords(primaryKeyBuilt)
      ?? this.findInCommittedRecords(primaryKeyBuilt);
  }

  /**
   * Searches for a record in temporarily inserted records.
   * 
   * @param primaryKey - Built primary key string
   * @returns Cloned inserted record or null if not found
   * @sideEffect Releases lock if record is found because it's a temporary record
   */
  private findInInsertedRecords(primaryKey: string): T | null {
    const insertedRecord = this._tempInsertedRecordsMap.get(primaryKey);
    if (!insertedRecord) return null;

    this.releaseLock(primaryKey);
    return { ...insertedRecord.data };
  }

  /**
   * Searches for an updated record,
   * 
   * @param primaryKey - Built primary key string
   * @returns Cloned updated record or null if not found
   */
  private findInUpdatedRecords(primaryKey: string): T | null {
    const committedPk = this._tempUpdatedWithUpdatedPK.get(primaryKey);
    if (!committedPk) return null;

    const updatedRecord = this._tempUpdatedMap.get(committedPk);
    if (!updatedRecord) return null;

    return { ...updatedRecord.data };
  }

  /**
   * Searches in committed records and validates deletion/update status
   * 
   * @param primaryKey - Built primary key string
   * @returns Cloned committed record or null if deleted/not found
   * @sideEffect Releases lock if record doesn't exist
   */
  private findInCommittedRecords(primaryKey: string): T | null {
    const committedRecord = this._recordsMap.get(primaryKey);
    
    if (!committedRecord) {
      this.releaseLock(primaryKey);
      return null;
    }

    if (this._tempDeletedRecordsSet.has(primaryKey) || this._tempUpdatedMap.has(primaryKey)) {
      return null;
    }

    return { ...committedRecord.data };
  }
  //#endregion

  override async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const committedResults: Partial<T>[] = [];
    const newestResults: Partial<T>[] = [];

    const areFieldsToSelectEmpty = (fields.length === 0);

    const committedSelectProcess = async ([committedRecordPk, committedRecord]: [string, Versioned<T>]) => {
      await this.waitUlockToRead(committedRecordPk);

      const recordWithTempChanges = this.getTempChangesFromCommittedRecord(committedRecordPk, committedRecord);
      // Finish because the record is null, which means that it was deleted and should be ignored.
      if (recordWithTempChanges === null) return;

      if (!matchRecord(recordWithTempChanges.data, compiledFilter)) return;

      await this.acquireReadLock(committedRecordPk);

      committedResults.push(areFieldsToSelectEmpty
        ? { ...recordWithTempChanges.data }
        : this.extractSelectedFields(fields, recordWithTempChanges.data)
      );
    }

    const newestSelectProcess = async (versioned: Versioned<T>) => {
      const newestRecord = versioned.data;
      if (!matchRecord(newestRecord, compiledFilter)) return;
      newestResults.push(areFieldsToSelectEmpty
        ? { ...newestRecord }
        : this.extractSelectedFields(fields, newestRecord)
      );
    }

    // Loops 
    const committedPromises: Promise<void>[] = [];
    for (const data of this._recordsMap) {
      committedPromises.push(committedSelectProcess(data));
    }

    const uncommittedPromises: Promise<void>[] = [];
    for (const newestRecord of this._tempInsertedRecordsMap.values()) {
      uncommittedPromises.push(newestSelectProcess(newestRecord));
    }

    // Loop through the committed and temporary Array to access the committed and newest records.
    const proccessCommitted = this.processPromiseBatch(committedPromises);
    const proccessUncommited = this.processPromiseBatch(uncommittedPromises);

    await proccessCommitted;
    await proccessUncommited;

    return committedResults.concat(newestResults);
  }

  //#region UPDATE METHODS
  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const willPkBeModified = this.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    const keys = Array.from(this._recordsMap.keys());
    let affectedRecords = 0;

    const committedUpdateProcess = async (committedRecordPk: string) => {
      const committedRecord = this._recordsMap.get(committedRecordPk);
      
      if (!committedRecord) return;
      const versionSnapshot = committedRecord.version;

      const recordWithTempChanges = this.getTempChangesFromCommittedRecord(committedRecordPk, committedRecord);
      // Finish because the record is null, which means that it was deleted and should be ignored.
      if (recordWithTempChanges === null) return;

      if (!matchRecord(recordWithTempChanges.data, compiledFilter)) return;
      await this.acquireExclusiveLock(committedRecordPk);

      if((versionSnapshot !== committedRecord.version) 
          && !matchRecord(recordWithTempChanges.data, compiledFilter)) {
        this.releaseLock(committedRecordPk);
        return;
      }

      const isRecordFirstUpdate = (committedRecord === recordWithTempChanges);

      if (willPkBeModified) {
        this.handleUpdateWithPKUpdated(updatedFields, recordWithTempChanges, isRecordFirstUpdate);
      }
      else {
        this.handleUpdateWithPKNotUpdated(updatedFields, recordWithTempChanges, committedRecordPk, isRecordFirstUpdate);
      }
      affectedRecords++;
    }

    for (const newestRecord of Array.from(this._tempInsertedRecordsMap.values())) {
      if (!matchRecord(newestRecord.data, compiledFilter)) continue;
      this.handleNewestRecordUpdate(updatedFields, newestRecord, willPkBeModified);
      affectedRecords++;
    }
    
    await this.processPromiseBatch(keys.map(committedUpdateProcess));

    return affectedRecords;
  }

  /**
   * Handles the update of the newest record, including primary key modification if necessary.
   *
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @param {RecordWithId<T>} newestRecord - The newest record to update.
   * @param {boolean} willPkBeModified - Indicates if the primary key will be modified.
   */
  private handleNewestRecordUpdate(updatedFields: Partial<T>, newestRecord: Versioned<T>, willPkBeModified: boolean): void {
    if (willPkBeModified) {
      const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, newestRecord.data);
      if (newPk !== oldPk) this.checkIfPkExistsInMaps(newPk);

      this._tempInsertedRecordsMap.delete(oldPk);
      this._tempInsertedRecordsMap.set(newPk, newestRecord);
      this.updateRecord(newestRecord, updatedFields);
    }
    else {
      this.updateRecord(newestRecord, updatedFields);
    }
  }

  /**
   * Handles the update of a record when the primary key is modified.
   *
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @param {RecordWithId<T>} record - The record to update.
   * @param {boolean} isFirstUpdate - Indicates if this is the first update for the record.
   */
  private handleUpdateWithPKUpdated(updatedFields: Partial<T>, record: Versioned<T>, isFirstUpdate: boolean): void {
    const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, record.data);
    if (newPk !== oldPk) this.checkIfPkExistsInMaps(newPk);

    if (isFirstUpdate) {
      // At this point `record` is the committed record. The committed record is not modified, 
      // to update it, a new record is created with the updated fields.
      const newRecordUpdated = this.createNewUpdatedRecord(record, updatedFields);
      this._tempUpdatedMap.set(oldPk, newRecordUpdated);
      this._tempUpdatedWithUpdatedPK.set(newPk, oldPk);
    } else {
      // The committed record was already updated previously, `record` have the latest changes. 
      // The reference of the record (latest changes) is updated with the new updated fields.
      this.updateRecord(record, updatedFields);
      const committedPk = this._tempUpdatedWithUpdatedPK.get(oldPk);
      if (committedPk) {
        this._tempUpdatedWithUpdatedPK.delete(oldPk);
        this._tempUpdatedWithUpdatedPK.set(newPk, committedPk);
      }
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
    record: Versioned<T>,
    committedRecordPk: string,
    isFirstUpdate: boolean
  ): void {
    if (isFirstUpdate) {
      // At this point `record` is the committed record. The committed record is not modified, 
      // to update it, a new record is created with the updated fields.
      const newRecordUpdated = this.createNewUpdatedRecord(record, updatedFields);
      this._tempUpdatedMap.set(committedRecordPk, newRecordUpdated);
      this._tempUpdatedWithUpdatedPK.set(committedRecordPk, committedRecordPk);
    }
    else {
      // The committed record was already updated previously, `record` have the latest changes. 
      // The reference of the record (latest changes) is updated with the new updated fields.
      this.updateRecord(record, updatedFields);
    }
  }
  //#endregion

  //#region DELETE METHODS
  override async deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.buildPkFromRecord(primaryKey);
    await this.acquireExclusiveLock(primaryKeyBuilt);

    return this.handleInsertedRecordDeletion(primaryKeyBuilt)
      ?? await this.handleUpdatedRecordDeletion(primaryKeyBuilt)
      ?? this.handleCommittedRecordDeletion(primaryKeyBuilt);
  }

  /**
   * Try to delete a recently inserted record.
   * 
   * @param primaryKey The primary key of the record to be deleted.
   * @returns The deleted record if it exists, otherwise null.
   */
  private handleInsertedRecordDeletion(primaryKey: string): RecordWithId<T> | null {
    const insertedRecord = this._tempInsertedRecordsMap.get(primaryKey);
    if (!insertedRecord) return null;
    this._tempInsertedRecordsMap.delete(primaryKey);
    // Release the lock because it's a temporary record.
    this.releaseLock(primaryKey);
    return { ...insertedRecord.data };
  }

  /**
   * Try to delete a record that has been updated.
   * 
   * @param primaryKey The primary key of the record to be deleted.
   * @returns The deleted record if it exists, otherwise null.
   */
  private async handleUpdatedRecordDeletion(primaryKey: string): Promise<RecordWithId<T> | null> {
    const committedPk = this._tempUpdatedWithUpdatedPK.get(primaryKey);
    if (!committedPk) return null;

    const updatedCommittedRecord = this._tempUpdatedMap.get(committedPk);
    if (!updatedCommittedRecord) return null;

    // Acquire lock for committed record and mark as deleted
    await this.acquireExclusiveLock(committedPk);
    this._tempDeletedRecordsSet.add(committedPk);

    // Delete the updated records from the Maps.
    this._tempUpdatedWithUpdatedPK.delete(primaryKey);
    this._tempUpdatedMap.delete(committedPk);

    return { ...updatedCommittedRecord.data };
  }

  /**
   * Try to delete a committed record, in other words, a record that has not been modified.
   * 
   * @param primaryKey The primary key of the record to be deleted.
   * @returns The deleted record if it exists, otherwise null.
   */
  private handleCommittedRecordDeletion(primaryKey: string): RecordWithId<T> | null {
    const committedRecord = this._recordsMap.get(primaryKey);
    if (!committedRecord) {
      // Release the lock because the record with the given PK does not exist.
      this.releaseLock(primaryKey);
      return null;
    }

    // Mark the committed record as deleted
    this._tempDeletedRecordsSet.add(primaryKey);

    return { ...committedRecord.data };
  }
  //#endregion

  //#region TWO-PHASE COMMIT METHODS
  public async prepare(): Promise<void> {
    if (!this._isActive) throw new TransactionCompletedError();
    try {
      const keysToLock = [
        ...this._tempUpdatedMap.keys(),
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
      this.applyDeletes();
      this.applyNewInsertions();

      // Release locks and clear temporary records
      this.finishTransaction();
    }
    catch (error: any) {
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
    for (const pk of this._tempInsertedRecordsMap.keys()) {
      if (this._recordsMap.has(pk)
        && !this._tempUpdatedMap.has(pk)
        && !this._tempDeletedRecordsSet.has(pk)) {

        throw this.createDuplicatePkValueError(pk);
      }
    }

    // Validate that the updated records have not duplicated PKs
    for (const [newestPk, committedPk] of this._tempUpdatedWithUpdatedPK) {
      if ((committedPk !== newestPk) 
        && this._recordsMap.has(newestPk)
        && !this._tempDeletedRecordsSet.has(newestPk)) {

        throw this.createDuplicatePkValueError(newestPk);
      }
    }

    // Validate that the updated records have the correct version
    for (const [committedPk, updatedRecord] of this._tempUpdatedMap) {
      const committedRecord = this._recordsMap.get(committedPk);
      if (!committedRecord || committedRecord.version !== updatedRecord.version) {
        throw new ExternalModificationError(committedPk);
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
    for (const [primaryKey, newRecord] of this._tempInsertedRecordsMap) {
      if (this._recordsMap.has(primaryKey)) throw this.createDuplicatePkValueError(primaryKey);
      this._recordsMap.set(primaryKey, newRecord);
    }
  }

  /**
   * Applies updates to the committed records map.
   *
   * This method iterates over the temporary updated records map and updates the corresponding
   * committed records. If the primary key (PK) of a record has changed, it updates the reference
   * in the committed records map accordingly.
   * 
   * @throws {ExternalModificationError} If the version of the updated record are different
   * from the original.
   */
  private applyUpdates(): void {
    for (let [committedPk, updatedRecord] of this._tempUpdatedMap) {
      const committedRecord = this._recordsMap.get(committedPk);
      if (committedRecord) {
        const updatedPk = this.buildPkFromRecord(updatedRecord.data);
        // Update the reference of the committed record with the updated record,
        // this way the changes of the committed record are reflected in the committed array.
        if (committedRecord.version !== updatedRecord.version) throw new ExternalModificationError(committedPk);
        this.updateVersionedRecord(committedRecord, updatedRecord.data);

        if (committedPk !== updatedPk) {
          this._recordsMap.delete(committedPk);
          this._recordsMap.set(updatedPk, committedRecord);
        }
      }
    }
  }

  /**
   * Deletes records from the committed records map and array.
   *
   * This method iterates over the temporary deleted records set and removes the corresponding
   * records from the committed records map.
   */
  private applyDeletes(): void {
    for (const pk of this._tempDeletedRecordsSet) {
      this._recordsMap.delete(pk);
    }
  }
  //#endregion
}
