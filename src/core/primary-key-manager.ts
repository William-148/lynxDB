import { RecordWithId } from "../types/record.type";
import { 
  DuplicatePkDefinitionError, 
  DuplicatePrimaryKeyValueError, 
  PrimaryKeyValueNullError 
} from "./errors/table.error";

const DEFAULT_PK_NAME = '_id';

export class PrimaryKeyManager<T> {
  private _compositePrimaryKey: (keyof T)[];
  private _simplePrimaryKey: keyof T | undefined; 

  constructor(primaryKeyDef: (keyof T)[]) {
    const primaryKey = this.validatePKDefinition(primaryKeyDef);
    if (Array.isArray(primaryKey)){
      this._compositePrimaryKey = primaryKey;
    }
    else {
      this._simplePrimaryKey = primaryKey;
      this._compositePrimaryKey = [];
    }
  }

  private validatePKDefinition(primaryKeyDef: (keyof T)[]): (keyof T)[] | keyof T{
    const uniqueKeys = new Set(primaryKeyDef);
    if (uniqueKeys.size !== primaryKeyDef.length) {
      throw new DuplicatePkDefinitionError(String(primaryKeyDef));
    }

    return (uniqueKeys.size <= 1) 
      ? primaryKeyDef[0] ?? DEFAULT_PK_NAME // Single primary key
      : primaryKeyDef;  // Composite primary key
  }

  get isSimplePrimaryKey(): boolean {
    return this._simplePrimaryKey !== undefined;
  }

  /**
   * Indicates whether the table has a default primary key.
   */
  get hasDefaultPk(): boolean {
    return this._simplePrimaryKey === DEFAULT_PK_NAME;
  }

  /**
   * Creates a new error object for a duplicate primary key value.
   * 
   * @param primaryKey - Primary key value that is duplicated.
   * @returns {DuplicatePrimaryKeyValueError} - The error object.
   */
  public createDuplicatePkValueError(primaryKey: string): DuplicatePrimaryKeyValueError {
    return new DuplicatePrimaryKeyValueError(
      this._simplePrimaryKey !== undefined ? String(this._simplePrimaryKey) : this._compositePrimaryKey.join(', '),
      primaryKey
    );
  }

  /**
   * Checks if a partial record contains any fields that are part of the primary key.
   *
   * @param record - The partial record to check.
   * @returns {boolean} - Returns true if the record contains any primary key fields, otherwise false.
   */
  public isPartialRecordPartOfPk(record: Partial<T>): boolean {
    return this.isSimplePrimaryKey
      ? record[this._simplePrimaryKey!] !== undefined
      : this._compositePrimaryKey.some(field => record[field] !== undefined);
  }

  /**
   * Build a primary key (PK) from a partial record.
   * 
   * @param record - The partial record containing the primary key fields.
   * @returns - The built primary key.
   * @throws {PrimaryKeyValueNullError} - If any primary key values are null or undefined.
   */
  public buildPkFromRecord(record: Partial<RecordWithId<T>>): string {
    if (this.isSimplePrimaryKey) {
      const pkValue = record[this._simplePrimaryKey!];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(this._simplePrimaryKey));
      return String(pkValue);
    }

    return this._compositePrimaryKey.map((pkName: keyof T) => {
      const pkValue = record[pkName];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(pkName));
      return pkValue;
    }).join('-');
  }

  public buildUpdatedPk(committedRecord: RecordWithId<T>, updatedFields: Partial<T>): string {
    return this.isSimplePrimaryKey 
      ? String(updatedFields[this._simplePrimaryKey!] ?? committedRecord[this._simplePrimaryKey!])
      : this._compositePrimaryKey.map(pkName => updatedFields[pkName] ?? committedRecord[pkName]).join('-');
  }

  /**
   * Generates new and old primary keys (PK) for updating a record.
   * 
   * @param registeredRecord - The existing record from which the old primary key is derived.
   * @param updatedFields - The partial record containing the updated fields.
   * @returns {{newPk: string, oldPk: string}} - An object containing the new and old primary keys.
   */
  public generateNewAndOldPk(committedRecord: RecordWithId<T>, updatedFields: Partial<T>): { newPk: string; oldPk: string } {
    return this.isSimplePrimaryKey
      ? {
        newPk: String(updatedFields[this._simplePrimaryKey!] ?? committedRecord[this._simplePrimaryKey!]),
        oldPk: String(committedRecord[this._simplePrimaryKey!])
      }
      : {
        newPk: this._compositePrimaryKey.map(pkName => updatedFields[pkName] ?? committedRecord[pkName]).join('-'),
        oldPk: this._compositePrimaryKey.map(pkName => committedRecord[pkName]).join('-')
      };
   
  }
}