import { RecordWithId, RecordWithVersion, TableTemporaryState } from "../types/database-table.type";
import { Filter } from "../types/filter.type";
import { DuplicatePrimaryKeyValueError } from "./errors/table.error";
import { compileFilter, matchRecord } from "./filters/filter-matcher";
import { RecordLockManager } from "./record-lock-manager";
import { Table } from "./table";

export class TransactionTable<T> extends Table<T> {
  /**
   * Temporary Map that stores the records that will be inserted in the original Map.
   * 
   * This saves new inserted and updated records that have not yet been applied.
   */
  private _tempRecordsMap: Map<string, RecordWithVersion<T>>;
  /**
   * Temporary Array that stores the records that will be inserted in the original Array.
   * 
   * This saves only new inserted records that have not yet been applied.
   */
  private _tempRecordsArray: RecordWithVersion<T>[];
  /**
   * Temporary Map that stores the records that will be updated in the original Map and Array.
   * 
   * This saves updated records that have not yet been applied.
   * 
   * The key is the Pk and the value is the updated record.
   */
  private _tempUpdatedRecordsMap: Map<string, RecordWithVersion<T>>;
  /**
   * Temporary Set that stores the records that will be deleted in the original Map and Array.
   * 
   * This saves deleted records that have not yet been applied.
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
   * Verifies if the primary key value already exists in the original Map or in the 
   * temporary Map
   * 
   * @param primaryKey Primary key value
   * @throws {DuplicatePrimaryKeyValueError} If the primary key value already exists 
   * in the original Map or in the temporary Map
   */
  private checkIfPkExistsInMaps(primaryKey: string): void {
    if (!this._tempRecordsMap.has(primaryKey) && !this._recordsMap.has(primaryKey)) return;
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
   * Get the temporary changes of a record found in the temporary updated Map, if it exists.
   * 
   * @param baseRecord The basic record of the original Map or Array
   * @returns The temporary changes of a record found in the temporary Map, if it exists. 
   * Otherwise, the original record is returned. If the record is in the deleted 
   * Map, null is returned.
   */
  private getTemporaryRecordChanges(baseRecord: RecordWithVersion<T>): RecordWithVersion<T> | null {
    const primaryKey = this.buildPkFromRecord(baseRecord);
    if (this._tempDeletedRecordsSet.has(primaryKey)) return null;
    return this._tempUpdatedRecordsMap.get(primaryKey) ?? baseRecord;
  }

  /**
   * Creates a new updated record by merging the original record with the updated fields.
   * 
   * @private
   * @param {RecordWithVersion<T>} record - The original record.
   * @param {Partial<T>} updatedFields - The fields to update in the record.
   * @returns {RecordWithVersion<T>} - The new updated record.
   */
  private createNewUpdatedRecord(record: RecordWithVersion<T>, updatedFields: Partial<T>): RecordWithVersion<T> {
    return {
      ...record,
      ...updatedFields,
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

    const temporaryRecord = this._tempRecordsMap.get(primaryKeyBuilt);
    if (temporaryRecord) return this.mapRecordVersionToRecord(temporaryRecord);

    const baseRecord = this._recordsMap.get(primaryKeyBuilt);
    if (!baseRecord) return null;

    const recordWithTempChanges = this.getTemporaryRecordChanges(baseRecord);
    if (!recordWithTempChanges) return null;

    return this.mapRecordVersionToRecord(recordWithTempChanges);
  }

  // REFACTOR
  override async select(fields: (keyof T)[], where: Filter<RecordWithId<T>>): Promise<Partial<T>[]> {
    const compiledFilter = compileFilter(where);
    const result: Partial<T>[] = [];
    const areFieldsToSelectEmpty = (fields.length === 0);

    const processSelect = (record: RecordWithVersion<T>, verifyTemporaryChanges: boolean) => {
      if (!matchRecord(record, compiledFilter)) return;

      let selectedRecord: Partial<T> | null = null;

      if (verifyTemporaryChanges) {
        const recordWithTempChanges = this.getTemporaryRecordChanges(record);
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

    // Loop through the original and temporary Array to access 
    // the older and newer records.
    for (let currentRecord of this._recordsArray) {
      processSelect(currentRecord, true);
    }
    for (let currentRecord of this._tempRecordsArray) {
      processSelect(currentRecord, false);
    }

    return result;
  }

  public async update(updatedFields: Partial<T>, where: Filter<RecordWithId<T>>): Promise<number> {
    if (Object.keys(updatedFields).length === 0) return 0;

    const willPkBeModified = this.isPartialRecordPartOfPk(updatedFields);
    const compiledFilter = compileFilter(where);
    let affectedRecords = 0;

    for (let baseRecord of this._recordsArray) {
      if (!matchRecord(baseRecord, compiledFilter) 
        || this._tempDeletedRecordsSet.has(this.buildPkFromRecord(baseRecord))) continue;

      if (willPkBeModified) { this.updateWithPKChange(baseRecord, updatedFields); } 
      else { this.updateWithoutPKChange(baseRecord, updatedFields); }

      affectedRecords++;
    }

    for (let newestRecord of this._tempRecordsArray) {
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

  private updateWithPKChange(record: RecordWithVersion<T>, updatedFields: Partial<T>): void {
    const baseRecordPk = this.buildPkFromRecord(record);
    const recordAlreadyUpdated = this._tempUpdatedRecordsMap.get(baseRecordPk);

    const { newPk, oldPk } = this.generatePkForUpdate(updatedFields, recordAlreadyUpdated ?? record);
    this.checkIfPkExistsInMaps(newPk);

    if (recordAlreadyUpdated) {
      // The original record was already updated previously, that's why it exists 
      // in the tempUpdatedRecordsMap. To update it, the record with the old PK 
      // must be deleted and added again with the new PK.
      this._tempRecordsMap.delete(oldPk);
      Object.assign(recordAlreadyUpdated, updatedFields);
      this._tempRecordsMap.set(newPk, recordAlreadyUpdated);
    }
    else {
      // This is the first time the original record is updated, that's why it doesn't 
      // exist in the temporary updated Map. The original record is not modified, to update it, 
      // a new record is created with the updated fields and added to the temporary updated 
      // records Map and the temporary records Map.
      const newRecordUpdated = this.createNewUpdatedRecord(record, updatedFields);
      this._tempRecordsMap.set(newPk, newRecordUpdated);
      this._tempUpdatedRecordsMap.set(newPk, newRecordUpdated);
    }
  }

  private updateWithoutPKChange(record: RecordWithVersion<T>, updatedFields: Partial<T>): void {
    const baseRecordPk = this.buildPkFromRecord(record);
    const recordAlreadyUpdated = this._tempUpdatedRecordsMap.get(baseRecordPk);

    if(recordAlreadyUpdated) {
      // The original record was already updated previously, that's why it exists
      // in the tempUpdatedRecordsMap. To update it, the updated fields are assigned to it.
      Object.assign(recordAlreadyUpdated, updatedFields);
      return;
    }
    // This is the first time the original record is updated, that's why it doesn't
    // exist in the temporary updated Map. The original record is not modified, to update it,
    // a new record is created with the updated fields and added to the temporary updated
    // records Map and the temporary records Map (If a Pk is defined).
    const newRecordUpdated = this.createNewUpdatedRecord(record, updatedFields);
    const newRecordPk = this.buildPkFromRecord(newRecordUpdated);

    this._tempRecordsMap.set(newRecordPk, newRecordUpdated);
    this._tempUpdatedRecordsMap.set(newRecordPk, newRecordUpdated);
  }

}