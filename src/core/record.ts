import { RecordWithId, Versioned } from "../types/record.type";
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