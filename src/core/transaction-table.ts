import { RecordWithId, RecordWithVersion, TableTemporaryState } from "../types/database-table.type";
import { Filter } from "../types/filter.type";
import { LockType } from "../types/lock.type";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { RecordLockManager } from "./record-lock-manager";
import { Table } from "./table";

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
  public clearTemporaryState(): void {
    this._tempRecordsMap.clear();
    this._tempRecordsArray = [];
    this._tempUpdatedRecordsMap.clear();
    this._tempDeletedRecordsSet.clear();
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
   * @param primaryKey Primary key value
   * @throws {DuplicatePrimaryKeyValueError} If the primary key value already exists 
   * in the committed Map or in the temporary Map
   */
  private checkIfPkExistsInMaps(primaryKey: string): void {
    if (this._tempRecordsMap.has(primaryKey)) throw new DuplicatePrimaryKeyValueError(
      this._pkDefinition.join(', '),
      primaryKey
    );

    if (!this._recordsMap.has(primaryKey)) {
      // The PK is available because it is not found in the temporary Map or 
      // in the committed Map.
      return;
    }

    // At this point the PK exists in the committed Map. Before throwing an error, 
    // it must be checked if the committed record has been deleted or updated.

    // Check if the committed record with the PK is in the deleted Set.
    if (this._tempDeletedRecordsSet.has(primaryKey)) {
      // The PK is available because the committed record is deleted.
      return;
    }

    // Check if the committed record with the PK is in the temp updated Map.
    const updatedRecord = this._tempUpdatedRecordsMap.get(primaryKey);
    if (updatedRecord) {
      const updatedPK = this.buildPkFromRecord(updatedRecord);
      if (primaryKey !== updatedPK) {
        // The PK is available because the PK of the committed record has been updated and 
        // now it is different, therefore the committed record will be deleted.
        return;
      }
    }

    // Throw error because the PK already exists in the committed Map and has not been 
    // deleted or updated.
    throw new DuplicatePrimaryKeyValueError(
      this._pkDefinition.join(', '),
      primaryKey
    );
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

    // * Check if the committed record is in the deleted Set. Return null if it is.
    // * Check if the committed record is in the temporary updated Map. If it does not exist in the 
    //   temporary Map but does exist in the temporary update Map, it means that the PK of the 
    //   committed record has been modified, therefore null must be returned, because the committed record 
    //   no longer exists with this PK because it will be deleted from the committed Map in the commit operation.
    if (!committedRecord 
      || this._tempDeletedRecordsSet.has(primaryKeyBuilt) 
      || this._tempUpdatedRecordsMap.has(primaryKeyBuilt)) return null;

    return this.mapRecordVersionToRecord(committedRecord);
  }

  override async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const result: Partial<T>[] = [];
    const areFieldsToSelectEmpty = (fields.length === 0);

    const processSelect = (record: RecordWithVersion<T>, verifyTemporaryChanges: boolean) => {
      if (!matchRecord(record, compiledFilter)) return;

      let selectedRecord: Partial<T> | null = null;

      if (verifyTemporaryChanges) {
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

    for (const committedRecord of this._recordsArray) {
      if (!matchRecord(committedRecord, compiledFilter)
        || this._tempDeletedRecordsSet.has(this.buildPkFromRecord(committedRecord))) continue;

      if (willPkBeModified) { this.updateWithPKChange(committedRecord, updatedFields); }
      else { this.updateWithoutPKChange(committedRecord, updatedFields); }

      affectedRecords++;
    }

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

  public async commit(): Promise<void> {
    /**
     * The commit process is divided into two phases:
     * 
     * Validation Phase:
     * - Acquire shared locks for updated records
     * - Acquire shared locks for deleted records
     * - Validate PKs of new records and updated records with new PK
     * - Validate if the version of the updated records is the same as the committed
     * - On finally: release all acquired locks
     * 
     * Writting Phase:
     * - Acquire exclusive locks for updated records
     * - Acquire exclusive locks for deleted records
     * - Add the new records to the committed Map and Array
     * - Update the records in the committed Map and Array, taking into account the updated PKs
     * - Delete the records from the committed Map and Array
     * - On finally: release all acquired locks
     * 
     */
    // Validation phase
    await this.ValidationPhase();

    // Writting phase
  }

  public async ValidationPhase(): Promise<void> {
    // Acquire shared locks for modified records
    const keysLocked: string[] = [];
    try {
      // Acquire shared locks for updated records
      for (let [pk, record] of this._tempUpdatedRecordsMap) {
        await this._lockManager.acquireLockWithTimeout(pk, LockType.Shared, 1000);
        keysLocked.push(pk);
      }

      // Aquiring shared locks for deleted records
      for (let pk of this._tempDeletedRecordsSet) {
        await this._lockManager.acquireLockWithTimeout(pk, LockType.Shared, 1000);
        keysLocked.push(pk);
      }

      // Validate if the primary key of the new records already exists in the committed Map.
      // The `_tempRecordsMap` Map is iterated because it contains the new records and the
      // updated records that have not yet been applied. For each record, it's checked if
      // exists in the committed Map and if it isn't in the temporary updated Map.
      for (let [pk, record] of this._tempRecordsMap) {
        if (this._recordsMap.has(pk) && !this._tempUpdatedRecordsMap.has(pk)) {
          throw new DuplicatePrimaryKeyValueError(
            this.hasPkDefinition() ? this._pkDefinition.join(', ') : '_id',
            pk
          );
        }
      }



    }
    catch (err) {
      throw err;
    }
    finally {
      // Release all acquired locks
      for (let key of keysLocked) {
        this._lockManager.releaseLock(key);
      }
    }

  }

}
