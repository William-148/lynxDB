import { Filter } from "../types/filter.type";
import { LockType } from "../types/lock.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { Table } from "./table";
import { RecordWithId, Versioned } from "../types/record.type";
import { IsolationLevel, TwoPhaseCommitParticipant } from "../types/transaction.type";
import { Config } from "./config";
import { isRecordDeleted, TransactionTempStore } from "./transaction-temp-store";
import { ExternalModificationError } from "./errors/transaction-table.error";
import { TransactionCompletedError, TransactionConflictError } from "./errors/transaction.error";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";
import { LockTimeoutError } from "./errors/record-lock-manager.error";

export class TransactionTable<T> extends Table<T> implements TwoPhaseCommitParticipant {
  private _transactionId: string;
  private _isActive: boolean;
  private _transactionConfig: Config;
  private _tempStore: TransactionTempStore<T>;

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
    super({ primaryKey: [] }, transactionConfig);
    this._transactionId = transactionId;
    this._isActive = true;
    this._transactionConfig = transactionConfig ?? new Config();
    this._sharedLocks = new Set();
    this._exclusiveLocks = new Set();

    // Copy references from the table to the transaction table
    this._recordsMap = table.recordsMap;
    this._lockManager = table.lockManager;
    this._primaryKeyManager = table.primaryKeyManager;
    this._tempStore = new TransactionTempStore(this._primaryKeyManager, this._recordsMap);
  }

  get transactionId(): string { return this._transactionId; }
  get config(): Config { return this._config; }

  /**
   * Clears all temporary changes, new inserts, updates and deletions.
   */
  public clearState(): void {
    this._tempStore.clear();
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
    this.clearState();
  }


  //#region LOCKS METHODS ***************************************************************
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
      case IsolationLevel.RepeatableRead:
        return this.acquireSharedLock(key);
      case IsolationLevel.Serializable:
        return this.acquireExclusiveLock(key);
    }
  }

  /**
   * Waits for the specified key to be unlocked.
   * 
   * @param key - The key for waiting to unlock
   */
  private async waitUlockToRead(key: string): Promise<void> {
    if (this._sharedLocks.has(key) || this._exclusiveLocks.has(key)) return;
    await this._lockManager.waitUnlockToRead(key, this._config.get("lockTimeout"));
  }
  //#endregion

  override size(): number {
    return this._tempStore.size;
  }

  override async insert(record: T): Promise<T> {
    const newRecord = this.createNewVersionedRecord(record);
    this._tempStore.insert(newRecord);

    return { ...newRecord.data };
  }

  override async bulkInsert(records: T[]): Promise<void> {
    for (let record of records) {
      const newRecord = this.createNewVersionedRecord(record);
      this._tempStore.insert(newRecord);
    }
  }

  override async findByPk(objectPrimaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this.primaryKeyManager.buildPkFromRecord(objectPrimaryKey);
    await this.acquireReadLock(primaryKeyBuilt);

    const result = this._tempStore.findByPk(primaryKeyBuilt);
    if (result) return result;
    if (result === undefined) this.releaseLock(primaryKeyBuilt);
    return null;
  }

  override async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const committedResults: Partial<T>[] = [];
    const newestResults: Partial<T>[] = [];

    const areFieldsEmpty = (fields.length === 0);

    const processFields = (data: RecordWithId<T>): Partial<T> => 
      areFieldsEmpty ? {...data} : this.extractSelectedFields(fields, data);

    const committedSelectProcess = async (committedRecordPk: string) => {
      await this.waitUlockToRead(committedRecordPk);
      const record = this._tempStore.getRecordState(committedRecordPk);
      if (!record) return;
      if (isRecordDeleted(record)) return;

      const recordToEvaluate = record.tempChanges?.changes ?? record.committed;
      if (!matchRecord(recordToEvaluate.data, compiledFilter)) return;

      await this.acquireReadLock(committedRecordPk);
      committedResults.push(processFields(recordToEvaluate.data));
    }

    const newestSelectProcess = async (versioned: Versioned<T>) => {
      const newestRecord = versioned.data;
      if (!matchRecord(newestRecord, compiledFilter)) return;
      newestResults.push(processFields(newestRecord));
    }

    // Loops 
    const committedPromises: Promise<void>[] = [];
    for (const data of this._recordsMap.keys()) {
      committedPromises.push(committedSelectProcess(data));
    }

    const uncommittedPromises: Promise<void>[] = [];
    for (const newestRecord of this._tempStore.tempInserts.values()) {
      uncommittedPromises.push(newestSelectProcess(newestRecord));
    }

    await Promise.all([
      this.processPromiseBatch(committedPromises),
      this.processPromiseBatch(uncommittedPromises)
    ]);

    return committedResults.concat(newestResults);
  }

  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const willPkBeModified = this._primaryKeyManager.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    const keys = Array.from(this._recordsMap.keys());
    let affectedRecords = 0;

    const committedUpdateProcess = async (committedRecordPk: string) => {
      const record = this._tempStore.getRecordState(committedRecordPk);
      if (!record) return;

      const versionSnapshot = record.committed.version;

      if (isRecordDeleted(record)) return;

      const recordToEvaluate = record.tempChanges?.changes ?? record.committed;

      if (!matchRecord(recordToEvaluate.data, compiledFilter)) return;

      await this.acquireExclusiveLock(committedRecordPk);
      // TODO: Hacer un test para ver que pasa cuando bloquea un registro que su pk fue modificado

      if ((versionSnapshot !== record.committed.version) && !matchRecord(recordToEvaluate.data, compiledFilter)) {
        this.releaseLock(committedRecordPk);
        return;
      }

      if (willPkBeModified) {
        this._tempStore.handleUpdateWithPKUpdated(record, updatedFields);
      }
      else {
        this._tempStore.handleUpdateWithPKNotUpdated(record, updatedFields, committedRecordPk);
      }

      affectedRecords++;
    }

    for (const newestRecord of Array.from(this._tempStore.tempInserts.values())) {
      if (!matchRecord(newestRecord.data, compiledFilter)) continue;
      this._tempStore.updateInsertedRecord(newestRecord, updatedFields, willPkBeModified);
      affectedRecords++;
    }

    await this.processPromiseBatch(keys.map(committedUpdateProcess));

    return affectedRecords;
  }

  override async deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this._primaryKeyManager.buildPkFromRecord(primaryKey);
    await this.acquireExclusiveLock(primaryKeyBuilt);

    const insertedDeletion = this._tempStore.handleInsertedDeletion(primaryKeyBuilt);
    if (insertedDeletion) {
      this.releaseLock(primaryKeyBuilt);
      return insertedDeletion;
    }

    const tempChangesDeletion = this._tempStore.handleTempChangesDeletion(primaryKeyBuilt);
    if (tempChangesDeletion !== undefined) return tempChangesDeletion;

    const committedDeletion = this._tempStore.handleCommittedDeletion(primaryKeyBuilt);
    if (committedDeletion) return committedDeletion;

    this.releaseLock(primaryKeyBuilt);
    return null;
  }

  //#region TWO-PHASE COMMIT METHODS ****************************************************
  public async prepare(): Promise<void> {
    if (!this._isActive) throw new TransactionCompletedError();
    try {
      const keysToLock = this._tempStore.getKeysToLock();
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
      this.applyChanges();
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
    for (const pk of this._tempStore.tempInserts.keys()) {
      if (this._recordsMap.has(pk)) {
        const committedChanges = this._tempStore.originalPrimaryKeyMap.get(pk)
        if (!committedChanges) throw this._primaryKeyManager.createDuplicatePkValueError(pk);
        if (committedChanges.action === 'updated' && committedChanges.hasTheOriginalPk){
          throw this._primaryKeyManager.createDuplicatePkValueError(pk);
        }
      }
    }

    // Validate that the updated records have not duplicated PKs
    for (const [newestPk, tempChanges] of this._tempStore.updatedPrimaryKeyMap) {
      if (tempChanges.action === 'deleted') continue;
      if (this._recordsMap.has(newestPk)) {
        const committedChanges = this._tempStore.originalPrimaryKeyMap.get(newestPk)
        if (!committedChanges) throw this._primaryKeyManager.createDuplicatePkValueError(newestPk);
        if (committedChanges.action === 'updated' && committedChanges.hasTheOriginalPk){
          throw this._primaryKeyManager.createDuplicatePkValueError(newestPk);
        }
      }
    }

    // Validate that the updated records have the correct version
    for (const [committedPk, committedChanges] of this._tempStore.originalPrimaryKeyMap) {
      const committedRecord = this._recordsMap.get(committedPk);
      if (!committedRecord || committedRecord.version !== committedChanges.changes.version) {
        throw new ExternalModificationError(committedPk);
      }
    }
  }

  /**
   * Applies updates to the committed records map.
   * 
   * @throws {ExternalModificationError} If the version of the updated record are different
   * from the original.
   */
  private applyChanges(): void {
    for (let [committedPk, committedChanges] of this._tempStore.originalPrimaryKeyMap) {
      const committed = this._recordsMap.get(committedPk);
      if (!committed) throw new ExternalModificationError(committedPk);
      
      if (committedChanges.action === 'deleted'){
        this._recordsMap.delete(committedPk);
      }else {
        if (committed.version !== committedChanges.changes.version) throw new ExternalModificationError(committedPk);
        this.updateVersionedRecord(committed, committedChanges.changes.data);
        if (!committedChanges.hasTheOriginalPk){
          // Update primary key in the Map
          this._recordsMap.delete(committedPk);
          this._recordsMap.set(this._primaryKeyManager.buildPkFromRecord(committed.data), committed);
        }
      }
    }
  }

  /**
   * Inserts new records into the committed records map and array.
   *
   * This method should be invoked after applying updates and deletions, because if a record 
   * is inserted with a primary key that already exists, an error is thrown, although this 
   * was already validated in the preparation phase, it is necessary to validate again.
   * 
   * @throws {DuplicatePrimaryKeyValueError} If a duplicate primary key is found.
   */
  private applyNewInsertions(): void {
    for (const [primaryKey, newRecord] of this._tempStore.tempInserts) {
      if (this._recordsMap.has(primaryKey)) {
        throw this._primaryKeyManager.createDuplicatePkValueError(primaryKey);
      }
      this._recordsMap.set(primaryKey, newRecord);
    }
  }
  //#endregion
}
