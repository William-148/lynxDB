import { RecordState, RecordWithId, Versioned } from "../types/record.type";
import { generateId } from "../utils/generate-id";

/**
 * Creates a new record with an initial version. 
 * 
 * @param {T} record - The base record to create a new versioned record from.
 * @param generateDefaultId - If true, generates a default primary key if no primary key 
 *  is defined in `record`.
 * @returns {Versioned<T>} - The new versioned record with an initial version. 
 */
export function createNewVersionedRecord<T>(record: T, generateDefaultId: boolean): Versioned<T> {
  const newRecord: RecordWithId<T> = { ...record } as RecordWithId<T>;

  if (generateDefaultId && !newRecord._id) {
    newRecord._id = generateId();
  }

  return { data: newRecord, version: 1 };
}

/**
 * Updates the data of a versioned record with the specified fields.
 * Also updates the version of the record.
 * 
 * @param versioned Versioned record to update.
 * @param updatedFields The updated fields to apply to the record.
 */
export function updateVersionedRecord<T>(versioned: Versioned<T>, updatedFields: Partial<T>): void {
  Object.assign(versioned.data, updatedFields);
  versioned.version++;
}

/**
 * Extracts the specified fields from a record and returns a new partial record containing only those fields.
 *
 * @template T
 * @param {Array<keyof T>} fieldsToExtract - The fields to extract from the record.
 * @param {T} record - The record from which to extract the fields.
 * @returns {Partial<T>} - A new partial record containing only the specified fields.
 */
export function extractFieldsFromRecord<T>(fieldsToExtract: (keyof T)[], record: RecordWithId<T>): Partial<RecordWithId<T>> {
  const newRecord: Partial<RecordWithId<T>> = {};
  for (let field of fieldsToExtract) {
    newRecord[field] = record[field];
  }
  return newRecord;
}

/**
 * Determines if a record was deleted.
 * 
 * @param record The record to check if it was deleted
 */
export function isCommittedRecordDeleted<T>(record: RecordState<T>): boolean {
  return record.tempChanges?.action === 'deleted';
}