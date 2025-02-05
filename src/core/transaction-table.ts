import { ITable } from "../types/table.type";
import { Table } from "./table";
import { Filter } from "../types/filter.type";
import { LockType } from "../types/lock.type";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { RecordWithId, UpdatedFieldsDetails, Versioned } from "../types/record.type";
import { IsolationLevel, TwoPhaseCommitParticipant } from "../types/transaction.type";
import { Config } from "./config";
import { TransactionTempStore } from "./transaction-temp-store";
import { RecordLockManager } from "./record-lock-manager";
import { PrimaryKeyManager } from "./primary-key-manager";
import { extractFieldsFromRecord, isCommittedRecordDeleted } from "./record";
import { processPromiseBatch } from "../utils/batch-processor";
import { TransactionCompletedError, TransactionConflictError } from "./errors/transaction.error";
import { ExternalModificationError } from "./errors/transaction-table.error";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";
import { LockTimeoutError } from "./errors/record-lock-manager.error";

export class TransactionTable<T> implements ITable<T>, TwoPhaseCommitParticipant {
  private _transactionId: string;
  private _isActive: boolean;
  private _transactionConfig: Config;
  private _tempStore: TransactionTempStore<T>;
  private _recordsMap: Map<string, Versioned<T>>;
  private _lockManager: RecordLockManager;
  private _primaryKeyManager: PrimaryKeyManager<T>;

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
  get transactionConfig(): Config { return this._transactionConfig; }

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
    this._tempStore.clear();
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
   * @param key - The key for which to acquire the lock.
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
   * @param keys - The keys for which to acquire exclusive locks.
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
   * @param key - The key for which to acquire the read lock.
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
    await this._lockManager.waitUnlockToRead(key, this._transactionConfig.get("lockTimeout"));
  }
  //#endregion

  size(): number {
    return this._tempStore.size;
  }

  async insert(record: T): Promise<T> {
    const created = this._tempStore.insert(record);

    return { ...created.data };
  }

  async bulkInsert(records: T[]): Promise<void> {
    for (const record of records) {
      this._tempStore.insert(record);
    }
  }

  async findByPk(objectPrimaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
    const primaryKeyBuilt = this._primaryKeyManager.buildPkFromRecord(objectPrimaryKey);
    await this.acquireReadLock(primaryKeyBuilt);

    const result = this._tempStore.findByPk(primaryKeyBuilt);
    if (result) return result;
    if (result === undefined) this.releaseLock(primaryKeyBuilt);
    return null;
  }

  async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const committedResults: Partial<T>[] = [];
    const newestResults: Partial<T>[] = [];

    const areFieldsEmpty = (fields.length === 0);

    const processFields = (data: RecordWithId<T>): Partial<T> => 
      areFieldsEmpty ? {...data} : extractFieldsFromRecord(fields, data);

    const committedSelectProcess = async (committedRecordPk: string) => {
      await this.waitUlockToRead(committedRecordPk);
      const record = this._tempStore.getRecordState(committedRecordPk);
      if (!record) return;
      if (isCommittedRecordDeleted(record)) return;

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
      processPromiseBatch(committedPromises),
      processPromiseBatch(uncommittedPromises)
    ]);

    return committedResults.concat(newestResults);
  }

  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const updatedDetails: UpdatedFieldsDetails<T> = { 
      updatedFields, 
      isPartOfPrimaryKey: this._primaryKeyManager.isPartialRecordPartOfPk(updatedFields) 
    };
    const compiledFilter = compileFilter(where);
    const keys = Array.from(this._recordsMap.keys());
    let affectedRecords = 0;

    const committedUpdateProcess = async (committedRecordPk: string) => {
      const record = this._tempStore.getRecordState(committedRecordPk);
      if (!record) return;

      const versionSnapshot = record.committed.version;

      if (isCommittedRecordDeleted(record)) return;

      const recordToEvaluate = record.tempChanges?.changes ?? record.committed;

      if (!matchRecord(recordToEvaluate.data, compiledFilter)) return;

      await this.acquireExclusiveLock(committedRecordPk);
      // TODO: Hacer un test para ver que pasa cuando bloquea un registro que su pk fue modificado

      if ((versionSnapshot !== record.committed.version) && !matchRecord(recordToEvaluate.data, compiledFilter)) {
        this.releaseLock(committedRecordPk);
        return;
      }

      this._tempStore.handleUpdate(record, updatedDetails);

      affectedRecords++;
    }

    for (const newestRecord of Array.from(this._tempStore.tempInserts.entries())) {
      if (!matchRecord(newestRecord[1].data, compiledFilter)) continue;
      this._tempStore.updateInsertedRecord(newestRecord, updatedDetails);
      affectedRecords++;
    }

    await processPromiseBatch(keys.map(committedUpdateProcess));

    return affectedRecords;
  }

  async deleteByPk(primaryKey: Partial<RecordWithId<T>>): Promise<T | null> {
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

  public async prepare(): Promise<void> {
    if (!this._isActive) throw new TransactionCompletedError();
    try {
      const keysToLock = this._tempStore.getKeysToLock();
      await this.acquireExclusiveLocks(keysToLock);
      await this._tempStore.validateChanges();
    }
    catch (error: any) {
      this.rollback();
      throw new TransactionConflictError(this._transactionId, error?.message);
    }
  }

  public async apply(): Promise<void> {
    if (!this._isActive) throw new TransactionCompletedError();
    try {
      this._tempStore.applyChanges();
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
  //#endregion
}
