import { ExternalModificationError } from "./errors/transaction-table.error";
import { PrimaryKeyManager } from "./primary-key-manager";
import { 
  Versioned,
  TemporalChange,
  RecordWithId,
  RecordState,
  UpdatedFieldsDetails
} from "../types/record.type";
import { 
  createNewTempDeletedObject,
  createNewTempUpdatedObject,
  createNewVersionedRecord,
  updateRecord,
  updateTempChangeAsDeleted,
  updateTempChangeObject,
  updateVersionedRecord
} from "./record";

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

  public clear() {
    this._tempInserts.clear();
    this._updatedPrimaryKeyMap.clear();
    this._originalPrimaryKeyMap.clear();
    this._committedDeleteCount = 0;
  }

  public getKeysToLock(): string[] {
    return Array.from(this._originalPrimaryKeyMap.keys());
  }

  /**
   * Check if the primary key is in use in the temporal transaction store.
   * 
   * @param primaryKey - The primary key to check if it is in use.
   * @returns - True if the primary key is in use, otherwise false.
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
   * @param primaryKey - The committed primary key of the record to be found.
   * @returns - The record state if found. 
   *  - `undefined` if the committed record does not exist.
   */
  public getRecordState(primaryKey: string): RecordState<T> | undefined {
    const committed = this._committedMap.get(primaryKey);
    if (!committed) return undefined;
    return {
      committedPk: primaryKey,
      committed,
      tempChanges: this._originalPrimaryKeyMap.get(primaryKey)
    };
  }

  /**
   * Insert a record into the temporal transaction store
   * 
   * @param record - The record to be inserted
   * @returns - The versioned record that was created and inserted
   * @throws {DuplicatePrimaryKeyValueError} If the primary key is already in use
   */
  public insert(record: T): Versioned<T> {
    const versioned = createNewVersionedRecord(
      record,
      this._primaryKeyManager.hasDefaultPk
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
   * @param primaryKey - The primary key of the record to be found
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
   * @param updatedFields - The fields to update in the record.
   * @param insertedRecord - The newest record to update.
   * @param willPkBeModified - Indicates if the primary key will be modified.
   */
  public updateInsertedRecord([currentPk, currentRecord]: [string, Versioned<T>], updateDetails: UpdatedFieldsDetails<T>): void {
    if (updateDetails.isPartOfPrimaryKey) {
      const newPk = this._primaryKeyManager.buildUpdatedPk(currentRecord.data, updateDetails.updatedFields);
      if ((newPk !== currentPk) && this.isPrimaryKeyInUse(newPk)) {
        throw this._primaryKeyManager.createDuplicatePkValueError(newPk);
      }
      this._tempInserts.delete(currentPk);
      this._tempInserts.set(newPk, currentRecord);
    }
    updateRecord(currentRecord.data, updateDetails.updatedFields);
  }

  /**
   * Handles the update of the committed record, including primary key modification if necessary.
   *
   * @param record - The committed record with his temporal changes to update.
   * @param updateDetails - Contains the details of the fields to update.
   */
  public handleUpdate(record: RecordState<T>, updateDetails: UpdatedFieldsDetails<T>): void {
    const { committedPk, committed, tempChanges } = record;
    let oldPk: string = committedPk;
    let newPk: string = committedPk;
    let arePkDifferents = false;
    
    if (updateDetails.isPartOfPrimaryKey) {
      // Generate the new and old PK to avoid the conflict of not deleting 
      // the temporal record (it will change PK) from `_updatedPrimaryKeyMap`.
      const generated = this._primaryKeyManager.generateNewAndOldPk(
        tempChanges?.changes.data || committed.data,
        updateDetails.updatedFields
      );
      
      oldPk = generated.oldPk;
      newPk = generated.newPk;
      arePkDifferents = (oldPk !== newPk);

      if (arePkDifferents && this.isPrimaryKeyInUse(newPk)) {
        throw this._primaryKeyManager.createDuplicatePkValueError(newPk);
      }
    }

    if (tempChanges) {
      // Update the temporal changes and update the PKs in the maps
      updateTempChangeObject(tempChanges, updateDetails.updatedFields, !arePkDifferents);
      if (arePkDifferents){
        this._updatedPrimaryKeyMap.delete(oldPk);
        this._updatedPrimaryKeyMap.set(newPk, tempChanges);
      }
    } else {
      // Create a new object to not modify the committed record
      const newTempChanges = createNewTempUpdatedObject(committed, updateDetails.updatedFields, !arePkDifferents);
      this._originalPrimaryKeyMap.set(oldPk, newTempChanges);
      if (arePkDifferents){
        this._updatedPrimaryKeyMap.set(newPk, newTempChanges);
      }
    }
  }
  //#endregion

  //#region DELETE METHODS ****************************************************
  /**
   * Try to delete a recently inserted record.
   * 
   * @param primaryKey - The primary key of the record to be deleted.
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
   * @param primaryKey - he primary key of the record to be deleted.
   * @returns - The deleted record if it exists.
   *  - If the record was already deleted, returns `null`.
   *  - If the record does not exist in the Maps, returns `undefined`.
   */
  public handleTempChangesDeletion(primaryKey: string): RecordWithId<T> | null | undefined {
    const tempChangesWithNewPk = this._updatedPrimaryKeyMap.get(primaryKey);

    if (tempChangesWithNewPk && tempChangesWithNewPk.action === 'updated') {
      // Remove the record from the updated map
      this._updatedPrimaryKeyMap.delete(primaryKey);
      updateTempChangeAsDeleted(tempChangesWithNewPk);
      this._committedDeleteCount++;
      return { ...tempChangesWithNewPk.changes.data };
    }

    const tempChangesWithOriginalPk = this._originalPrimaryKeyMap.get(primaryKey);
    if (!tempChangesWithOriginalPk) return undefined;

    if(tempChangesWithOriginalPk.action === 'deleted') return null;
    if (tempChangesWithOriginalPk.action === 'updated') {
      updateTempChangeAsDeleted(tempChangesWithOriginalPk);
      this._committedDeleteCount++;
      return { ...tempChangesWithOriginalPk.changes.data };
    }
  }

  /**
   * Try to delete a committed record, in other words, a record that has not been modified.
   * 
   * @param primaryKey - The primary key of the record to be deleted.
   * @returns - The deleted record if it exists.
   *  - If the record does not exist in the temporal inserts, returns `undefined`.
   */
  public handleCommittedDeletion(primaryKey: string): RecordWithId<T> | undefined {
    const committedRecord = this._committedMap.get(primaryKey);
    if (!committedRecord) return undefined;

    const deleteChange = createNewTempDeletedObject(committedRecord);
    this._originalPrimaryKeyMap.set(primaryKey, deleteChange);
    this._committedDeleteCount++;

    return { ...committedRecord.data };
  }
  //#endregion

  /**
   * Validates the changes made to the records.
   * 
   * This method performs the following validations:
   * 1. Ensures that the inserted records do not have duplicated primary keys (PKs).
   * 2. Ensures that the updated records do not have duplicated PKs.
   * 3. Ensures that the updated records have the correct version.
   * 
   * @throws {DuplicatePkValueError} - If a duplicated PK is found in the inserted or updated records.
   * @throws {ExternalModificationError} - If the version of an updated record does not match the committed version.
   */
  public async validateChanges(): Promise<void> {
    // Validate that the inserted records have not duplicated PKs
    for (const newInsertedPk of this._tempInserts.keys()) {
      if (this._committedMap.has(newInsertedPk)) {
        const committedChanges = this._originalPrimaryKeyMap.get(newInsertedPk)

        if (!committedChanges || (committedChanges.action === 'updated' && committedChanges.hasTheOriginalPk)){
          throw this._primaryKeyManager.createDuplicatePkValueError(newInsertedPk);
        }
      }
    }

    // Validate that the updated records have not duplicated PKs
    for (const [newestPk, tempChanges] of this._updatedPrimaryKeyMap) {
      if (tempChanges.action === 'updated' && this._committedMap.has(newestPk)) {
        const committedChanges = this._originalPrimaryKeyMap.get(newestPk);
        
        if (!committedChanges || (committedChanges.action === 'updated' && committedChanges.hasTheOriginalPk)){
          throw this._primaryKeyManager.createDuplicatePkValueError(newestPk);
        }
      }
    }

    // Validate that the updated records have the correct version
    for (const [committedPk, committedChanges] of this._originalPrimaryKeyMap) {
      const committedRecord = this._committedMap.get(committedPk);
      
      if (!committedRecord || committedRecord.version !== committedChanges.changes.version) {
        throw new ExternalModificationError(committedPk);
      }
    }
  }

  //#region APPLY CHANGES ******************************************************
  /**
   * Applies all changes to the committed Map.
   * 
   * This method performs the following actions:
   * 1. Applies updates and deletions to the committed Map.
   * 2. Applies new insertions to the committed Map.
   * 
   * @throws {DuplicatePkValueError} If a duplicated PK is found in the committed map.
   * @throws {ExternalModificationError} If the version of the updated record are different
   * from the original.
   */
  public applyChanges(): void {
    this.applyUpdatesAndDeletes();
    this.applyNewInsertions();
  }

  /**
   * Applies updates and deletes to the committed records Map.
   * 
   * @throws {ExternalModificationError} If the version of the updated record are different
   * from the original.
   */
  private applyUpdatesAndDeletes(): void {
    for (let [committedPk, committedChanges] of this._originalPrimaryKeyMap) {
      const committed = this._committedMap.get(committedPk);
      if (!committed) throw new ExternalModificationError(committedPk);

      switch (committedChanges.action) {
        case 'updated':
          if (committed.version !== committedChanges.changes.version) {
            throw new ExternalModificationError(committedPk);
          }

          updateVersionedRecord(committed, committedChanges.changes.data);

          if (!committedChanges.hasTheOriginalPk){
            // Update primary key in the Map
            // At this point `commited` has been updated
            this._committedMap.delete(committedPk);
            this._committedMap.set(this._primaryKeyManager.buildPkFromRecord(committed.data), committed);
          }
        break;
        case 'deleted':
          this._committedMap.delete(committedPk);
        break;
      }
    }
  }

  /**
   * Applies new insertions to the committed Map.
   * 
   * This method should be invoked after applying updates and deletions, because if a record 
   * is inserted with a primary key that already exists, an error is thrown, although this 
   * was already validated in the preparation phase, it is necessary to validate again.
   * 
   * @throws {DuplicatePkValueError} If a duplicated PK is found in the committed Map.
   */
  private applyNewInsertions(): void {
    for (const [primaryKey, newRecord] of this._tempInserts) {
      if (this._committedMap.has(primaryKey)) {
        throw this._primaryKeyManager.createDuplicatePkValueError(primaryKey);
      }

      this._committedMap.set(primaryKey, newRecord);
    }
  }
  //#endregion

}