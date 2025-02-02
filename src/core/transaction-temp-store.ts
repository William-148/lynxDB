import { Versioned, TemporalChange, RecordWithId, RecordState } from "../types/record.type";
import { PrimaryKeyManager } from "./primary-key-manager";
import { createNewVersionedRecord } from "./record";

/**
 * Determines if a record was deleted.
 * 
 * @param record The record to check if it was deleted
 */
export function isRecordDeleted<T>(record: RecordState<T>): boolean {
  return record.tempChanges?.action === 'deleted';
}

export class TransactionTempStore<T> {
  private _primaryKeyManager: PrimaryKeyManager<T>;
  private _committedMap: Map<string, Versioned<T>>;
  private _tempInserts: Map<string, Versioned<T>>;
  /**
   * This Map is used to keep track of the newest primary key of a record that was updated.
   * 
   * Map structure:
   * - Key: newest/updated primary key
   * - Value: TemporalChange object, only updated changes
   */
  private _updatedPrimaryKeyMap: Map<string, TemporalChange<T>>;
  /**
   * This Map is used to keep track of the original primary key of a record that was updated 
   * or deleted.
   * 
   * Map structure:
   * - Key: original primary key
   * - Value: TemporalChange object, updated and deleted changes
   */
  private _originalPrimaryKeyMap: Map<string, TemporalChange<T>>;
  /** The number of records that were deleted. */
  private _committedDeleteCount: number;

  constructor(primaryKeyManager: PrimaryKeyManager<T>, committedMap: Map<string, Versioned<T>>) {
    this._primaryKeyManager = primaryKeyManager;
    this._committedMap = committedMap;
    this._tempInserts = new Map();
    this._updatedPrimaryKeyMap = new Map();
    this._originalPrimaryKeyMap = new Map();
    this._committedDeleteCount = 0;
  }

  get size(): number { return this._committedMap.size + this._tempInserts.size - this._committedDeleteCount; }
  get tempInserts(): Map<string, Versioned<T>> { return this._tempInserts; }
  /**
   * This Map is used to keep track of the newest primary key of a record that was updated.
   * 
   * Map structure:
   * - Key: newest/updated primary key
   * - Value: TemporalChange object, only updated changes
   */
  get updatedPrimaryKeyMap(): Map<string, TemporalChange<T>> { return this._updatedPrimaryKeyMap; }
  /**
   * This Map is used to keep track of the original primary key of a record that was updated 
   * or deleted.
   * 
   * Map structure:
   * - Key: original primary key
   * - Value: TemporalChange object, updated and deleted changes
   */
  get originalPrimaryKeyMap(): Map<string, TemporalChange<T>> { return this._originalPrimaryKeyMap; }

  public clear() {
    this._tempInserts.clear();
    this._updatedPrimaryKeyMap.clear();
    this._originalPrimaryKeyMap.clear();
    this._committedDeleteCount = 0;
  }

  public getKeysToLock(): string[] {
    const keysToLock = Array.from(this._originalPrimaryKeyMap.keys());
    return keysToLock;
  }

  /**
   * Creates a new TemporalChange object by merging the committed record with the updated fields.
   * 
   * @param {Versioned<T>} committedRecord - The committed record.
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @returns {Versioned<T>} - The new updated record.
   */
  private createNewTempUpdatedObject(committedRecord: Versioned<T>, updatedFields: Partial<T>, hasTheOriginalPk: boolean): TemporalChange<T> {
    return {
      action: 'updated',
      changes: {
        data: { ...committedRecord.data, ...updatedFields },
        version: committedRecord.version
      },
      hasTheOriginalPk
    }
  }

  /**
   * Creates a new TemporalChange object for a deleted record.
   * 
   * @param {Versioned<T>} committedRecord - The committed record to delete.
   * @returns {TemporalChange<T>} - The object representing the deleted record.
   */
  private createNewTempDeletedObject(committedRecord: Versioned<T>): TemporalChange<T> {
    return {
      action: 'deleted',
      changes: {
        data: { ...committedRecord.data },
        version: committedRecord.version
      },
      hasTheOriginalPk: true
    }
  }

  /**
   * Updates the record in the TemporalChange object.
   * 
   * @param tempChange The TemporalChange object to be updated.
   * @param updatedFields The fields to update in the record.
   * @param hasTheOriginalPk Indicates if the primary key was modified.
   */
  private updateTempChangeObject(tempChange: TemporalChange<T>, updatedFields: Partial<T>, hasTheOriginalPk: boolean): void {
    Object.assign(tempChange.changes.data, updatedFields);
    tempChange.hasTheOriginalPk = hasTheOriginalPk;
  }

  /**
   * Updates the data of a versioned record with the updated fields.
   * 
   * @param record The versioned record that has the data to be updated
   * @param updatedFields The updated fields to be merged with the record data
   */
  private updateVersionedRecord(record: Versioned<T>, updatedFields: Partial<T>): void {
    Object.assign(record.data, updatedFields);
  }

  /**
   * Changes the TemporalChange object to represent a deleted record.
   * 
   * @param tempChange The TemporalChange object to be updated.
   */
  private updateTempChangeAsDeleted(tempChange: TemporalChange<T>): void {
    tempChange.action = 'deleted';
    tempChange.hasTheOriginalPk = true;
  }

  /**
   * Check if the primary key is in use in the temporal transaction store.
   * 
   * @param primaryKey The primary key to check if it is in use.
   * @returns True if the primary key is in use, otherwise false.
   */
  public isPrimaryKeyInUse(primaryKey: string): boolean {
    if (this._tempInserts.has(primaryKey)) return true;

    // Check if the pk provided does match with an updated pk in the map
    const updatedPkRecord = this._updatedPrimaryKeyMap.get(primaryKey);
    if (updatedPkRecord?.action === 'updated') return true;

    // Check if the pk provided does match with an original/committed pk in the map
    const changesFound = this._originalPrimaryKeyMap.get(primaryKey);
    if (changesFound) {
      switch (changesFound.action) {
        case 'updated': return changesFound.hasTheOriginalPk;
        case 'deleted': return false;
      }
    }

    return this._committedMap.has(primaryKey);
  }

  /**
   * Retrieve the committed record and the temporal changes of a record with the given primary key.
   * 
   * @param primaryKey The committed primary key of the record to be found.
   * @returns - The record state if found. 
   *  - `undefined` if the committed record does not exist.
   */
  public getRecordState(primaryKey: string): RecordState<T> | undefined {
    const committed = this._committedMap.get(primaryKey);
    if (!committed) return undefined;
    return {
      committed,
      tempChanges: this._originalPrimaryKeyMap.get(primaryKey)
    };
  }

  /**
   * Insert a record into the temporal transaction store
   * 
   * @param record The record to be inserted
   * @returns The versioned record that was created and inserted
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is already in use
   */
  public insert(record: T): Versioned<T> {
    const versioned = createNewVersionedRecord(
      record,
      this._primaryKeyManager.hasNotPkDefinition()
    );
    const primaryKey = this._primaryKeyManager.buildPkFromRecord(versioned.data);

    if (this.isPrimaryKeyInUse(primaryKey)) {
      throw this._primaryKeyManager.createDuplicatePkValueError(primaryKey);
    }

    this._tempInserts.set(primaryKey, versioned);

    return versioned;
  }

  /**
   * Find a record in the temporal transaction store. Creates a new object with the same 
   * properties as the record found.
   * 
   * @param primaryKey The primary key of the record to be found
   * @returns - The record if found
   *  - `null` if the record was deleted
   *  - `undefined` if the record with the primary key does not exist
   */
  public findByPk(primaryKey: string): RecordWithId<T> | null | undefined {
    const insertedRecord = this._tempInserts.get(primaryKey);
    if (insertedRecord) return { ...insertedRecord.data };

    // Check if the pk provided does match with an updated pk in the map
    const updatedPkRecord = this._updatedPrimaryKeyMap.get(primaryKey);
    if (updatedPkRecord?.action === 'updated') {
        return { ...updatedPkRecord.changes.data }
    }

    // Check if the pk provided does match with an original/committed pk in the map
    const changesFound = this._originalPrimaryKeyMap.get(primaryKey);
    if (changesFound) {
      if (changesFound.action === 'deleted') return null;
      return changesFound.hasTheOriginalPk 
        ? { ...changesFound.changes.data }
        : undefined;
    }

    const committed = this._committedMap.get(primaryKey);
    if (committed) {
      return { ...committed.data };
    }

    return undefined;
  }

  //#region UPDATE METHODS ****************************************************
  /**
   * Handles the update of the newest record, including primary key modification if necessary.
   *
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @param {RecordWithId<T>} insertedRecord - The newest record to update.
   * @param {boolean} willPkBeModified - Indicates if the primary key will be modified.
   */
  public updateInsertedRecord(insertedRecord: Versioned<T>, updatedFields: Partial<T>, willPkBeModified: boolean): void {
    if (willPkBeModified) {
      const { newPk, oldPk } = this._primaryKeyManager.generatePkForUpdate(insertedRecord.data, updatedFields);
      if ((newPk !== oldPk) && this.isPrimaryKeyInUse(newPk)) {
        throw this._primaryKeyManager.createDuplicatePkValueError(newPk);
      }

      this._tempInserts.delete(oldPk);
      this._tempInserts.set(newPk, insertedRecord);
      this.updateVersionedRecord(insertedRecord, updatedFields);
    }
    else {
      this.updateVersionedRecord(insertedRecord, updatedFields);
    }
  }

  /**
   * Handles the update of a record when the primary key is modified.
   *
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @param {RecordWithId<T>} record - The record to update.
   * @param {boolean} isFirstUpdate - Indicates if this is the first update for the record.
   */
  public handleUpdateWithPKUpdated(record: RecordState<T>, updatedFields: Partial<T>): void {
    const { committed, tempChanges } = record;
    const { newPk, oldPk } = this._primaryKeyManager.generatePkForUpdate(
      tempChanges?.changes.data || committed.data,
      updatedFields
    );

    if ((newPk !== oldPk) && this.isPrimaryKeyInUse(newPk)) {
      throw this._primaryKeyManager.createDuplicatePkValueError(newPk);
    }

    if (tempChanges) {
      // Update the temporal changes and update the PKs in the maps
      this.updateTempChangeObject(tempChanges, updatedFields, false);
      this._updatedPrimaryKeyMap.delete(oldPk);
      this._updatedPrimaryKeyMap.set(newPk, tempChanges);
    } else {
      // Create a new object to not modify the committed record
      const newTempChanges = this.createNewTempUpdatedObject(committed, updatedFields, false);
      this._updatedPrimaryKeyMap.set(newPk, newTempChanges);
      this._originalPrimaryKeyMap.set(oldPk, newTempChanges);
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
  public handleUpdateWithPKNotUpdated(record: RecordState<T>, updatedFields: Partial<T>, committedRecordPk: string): void {
    const { committed, tempChanges } = record;
    if (tempChanges) {
      // Update only the temporal changes because the committed record was already 
      // updated previously
      Object.assign(tempChanges.changes.data, updatedFields);
      this.updateTempChangeObject(tempChanges, updatedFields, true);
    }
    else {
      // Create a new object to not modify the committed record
      const newTempChanges = this.createNewTempUpdatedObject(committed, updatedFields, true);
      this._originalPrimaryKeyMap.set(committedRecordPk, newTempChanges);
    }
  }
  //#endregion

  //#region DELETE METHODS ****************************************************
  /**
   * Try to delete a recently inserted record.
   * 
   * @param primaryKey The primary key of the record to be deleted.
   * @returns - The deleted record if it exists.
   *  - If the record does not exist in the temporal inserts, returns `undefined`.
   */
  public handleInsertedDeletion(primaryKey: string): RecordWithId<T> | undefined {
    const insertedRecord = this._tempInserts.get(primaryKey);
    if (!insertedRecord) return undefined;

    this._tempInserts.delete(primaryKey);

    return { ...insertedRecord.data };
  }

  /**
   * Try to delete a record that has been updated or deleted.
   * 
   * @param primaryKey The primary key of the record to be deleted.
   * @returns - The deleted record if it exists.
   *  - If the record was already deleted, returns `null`.
   *  - If the record does not exist in the Maps, returns `undefined`.
   */
  public handleTempChangesDeletion(primaryKey: string): RecordWithId<T> | null | undefined {
    const tempChangesWithNewPk = this._updatedPrimaryKeyMap.get(primaryKey);

    if (tempChangesWithNewPk && tempChangesWithNewPk.action === 'updated') {
      // Remove the record from the updated map
      this._updatedPrimaryKeyMap.delete(primaryKey);
      this.updateTempChangeAsDeleted(tempChangesWithNewPk);
      this._committedDeleteCount++;
      return { ...tempChangesWithNewPk.changes.data };
    }

    const tempChangesWithOriginalPk = this._originalPrimaryKeyMap.get(primaryKey);
    if (!tempChangesWithOriginalPk) return undefined;

    if(tempChangesWithOriginalPk.action === 'deleted') return null;
    if (tempChangesWithOriginalPk.action === 'updated') {
      this.updateTempChangeAsDeleted(tempChangesWithOriginalPk);
      this._committedDeleteCount++;
      return { ...tempChangesWithOriginalPk.changes.data };
    }

    return undefined;
  }

  /**
   * Try to delete a committed record, in other words, a record that has not been modified.
   * 
   * @param primaryKey The primary key of the record to be deleted.
   * @returns - The deleted record if it exists.
   *  - If the record does not exist in the temporal inserts, returns `undefined`.
   */
  public handleCommittedDeletion(primaryKey: string): RecordWithId<T> | undefined {
    const committedRecord = this._committedMap.get(primaryKey);
    if (!committedRecord) return undefined;

    const deleteChange = this.createNewTempDeletedObject(committedRecord);
    this._originalPrimaryKeyMap.set(primaryKey, deleteChange);
    this._committedDeleteCount++;

    return { ...committedRecord.data };
  }
  //#endregion

}