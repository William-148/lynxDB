import { RecordState, RecordWithId, TemporalChange, Versioned } from "../types/record.type";
import { generateId } from "../utils/generate-id";

//#region RECORD_WITH_ID OBJECT FUNCTIONS *************************************************
/**
 * Updates a record with the updated fields.
 * 
 * @param record - The record to be updated.
 * @param updatedFields - The updated fields to be merged with the record data.
 */
export function updateRecord<T>(record: RecordWithId<T>, updatedFields: Partial<T>): void {
  Object.assign(record, updatedFields);
}

/**
 * Extracts the specified fields from a record and returns a new partial record containing only those fields.
 *
 * @param fieldsToExtract - The fields to extract from the record.
 * @param record - The record from which to extract the fields.
 * @returns - A new partial record containing only the specified fields.
 */
export function extractFieldsFromRecord<T>(fieldsToExtract: (keyof T)[], record: RecordWithId<T>): Partial<RecordWithId<T>> {
  const newRecord: Partial<RecordWithId<T>> = {};
  for (let field of fieldsToExtract) {
    newRecord[field] = record[field];
  }
  return newRecord;
}
//#endregion

//#region VERSIONED OBJECT FUNCTIONS ******************************************************
/**
 * Creates a new record with an initial version. 
 * 
 * @param record - The base record to create a new versioned record from.
 * @param generateDefaultId - If true, generates a default primary key if no primary key 
 *  is defined in `record`.
 * @returns - The new versioned record with an initial version. 
 */
export function createNewVersionedRecord<T>(record: T, generateDefaultId: boolean): Versioned<T> {
  const newRecord: RecordWithId<T> = { ...record } as RecordWithId<T>;

  if (generateDefaultId && !newRecord._id) {
    newRecord._id = generateId();
  }

  return { data: newRecord, version: 1 };
}

/**
 * Updates the data of a versioned record with the updated fields.
 * Also updates the version of the record.
 * 
 * @param versioned - Versioned record to update.
 * @param updatedFields - The updated fields to apply to the record.
 */
export function updateVersionedRecord<T>(versioned: Versioned<T>, updatedFields: Partial<T>): void {
  Object.assign(versioned.data, updatedFields);
  versioned.version++;
}
//#endregion

//#region TEMPORAL_CHANGE OBJECT FUNCTIONS ************************************************
/**
 * Updates the record in the TemporalChange object.
 * 
 * @param tempChange - The TemporalChange object to be updated.
 * @param updatedFields - The fields to update in the record.
 * @param hasTheOriginalPk - Indicates if the record has the original primary key.
 */
export function updateTempChangeObject<T>(tempChange: TemporalChange<T>, updatedFields: Partial<T>, hasTheOriginalPk: boolean): void {
  Object.assign(tempChange.changes.data, updatedFields);
  tempChange.hasTheOriginalPk = hasTheOriginalPk;
}

/**
 * Creates a new TemporalChange object by merging the committed record with the updated fields.
 * 
 * @param committedRecord - The committed record.
 * @param updatedFields - The fields to update in the record.
 * @param hasTheOriginalPk - Indicates if the record has the original primary key.
 * @returns - The new updated record.
 */
export function createNewTempUpdatedObject<T>(committedRecord: Versioned<T>, updatedFields: Partial<T>, hasTheOriginalPk: boolean): TemporalChange<T> {
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
 * @param committedRecord - The committed record to delete.
 * @returns - The object representing the deleted record.
 */
export function createNewTempDeletedObject<T>(committedRecord: Versioned<T>): TemporalChange<T> {
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
 * Changes the TemporalChange object to represent a deleted record.
 * 
 * @param tempChange - The TemporalChange object to be updated.
 */
export function updateTempChangeAsDeleted<T>(tempChange: TemporalChange<T>): void {
  tempChange.action = 'deleted';
  tempChange.hasTheOriginalPk = true;
}
//#endregion

/**
 * Determines if a record was deleted.
 * 
 * @param record - The record to check if it was deleted
 */
export function isCommittedRecordDeleted<T>(record: RecordState<T>): boolean {
  return record.tempChanges?.action === 'deleted';
}