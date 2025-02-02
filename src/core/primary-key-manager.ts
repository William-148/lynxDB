import { RecordWithId, Versioned } from "../types/record.type";
import { 
  DuplicatePrimaryKeyDefinitionError, 
  DuplicatePrimaryKeyValueError, 
  PrimaryKeyValueNullError 
} from "./errors/table.error";

export class PrimaryKeyManager<T> {
  private _primaryKeyDefinition: (keyof T)[];

  constructor(primaryKeyDef: (keyof T)[]) {
    this._primaryKeyDefinition = this.validatePKDefinition(primaryKeyDef);
  }

  private validatePKDefinition(primaryKeyDef: (keyof T)[]): (keyof T)[] {
    const uniqueKeys = new Set(primaryKeyDef);
    if (uniqueKeys.size !== primaryKeyDef.length) {
      throw new DuplicatePrimaryKeyDefinitionError(String(primaryKeyDef));
    }
    return primaryKeyDef;
  }

  public hasPkDefinition(): boolean {
    return this._primaryKeyDefinition.length > 0;
  }

  public hasNotPkDefinition(): boolean {
    return this._primaryKeyDefinition.length === 0;
  }

  public isSingleKey(): boolean {
    return this._primaryKeyDefinition.length === 1;
  }

  /**
   * Creates a new error object for a duplicate primary key value.
   * 
   * @param primaryKey - Primary key value that is duplicated.
   * @returns {DuplicatePrimaryKeyValueError} - The error object.
   */
  public createDuplicatePkValueError(primaryKey: string): DuplicatePrimaryKeyValueError {
    return new DuplicatePrimaryKeyValueError(
      this.hasPkDefinition() ? this._primaryKeyDefinition.join(', ') : '_id',
      primaryKey
    );
  }

  /**
   * Checks if a partial record contains any fields that are part of the primary key.
   *
   * @template T
   * @param {Partial<T>} record - The partial record to check.
   * @returns {boolean} - Returns true if the record contains any primary key fields, otherwise false.
   */
  public isPartialRecordPartOfPk(record: Partial<T>): boolean {
    if (this.hasNotPkDefinition()) return (("_id" in record) && record['_id'] !== undefined);
    if (this.isSingleKey()) return record[this._primaryKeyDefinition[0]] !== undefined;
    return this._primaryKeyDefinition.some(field => record[field] !== undefined);
  }

  /**
   * Build a primary key (PK) from a partial record.
   * 
   * @param {Partial<T>} record - The partial record containing the primary key fields.
   * @returns {string} - The built primary key.
   * @throws {PrimaryKeyValueNullError} - If any primary key values are null or undefined.
   */
  public buildPkFromRecord(record: Partial<RecordWithId<T>>): string {
    if (this.hasNotPkDefinition()) {
      if (!record._id) throw new PrimaryKeyValueNullError('_id');
      return record._id;
    }

    return this._primaryKeyDefinition.map((pkName: keyof T) => {
      const pkValue = record[pkName];
      if (!pkValue) throw new PrimaryKeyValueNullError(String(pkName));
      return pkValue;
    }).join('-');
  }

  /**
   * Generates new and old primary keys (PK) for updating a record.
   * 
   * @param {T} registeredRecord - The existing record from which the old primary key is derived.
   * @param {Partial<T>} updatedFields - The partial record containing the updated fields.
   * @returns {{newPk: string, oldPk: string}} - An object containing the new and old primary keys.
   */
  public generatePkForUpdate(registeredRecord: RecordWithId<T>, updatedFields: Partial<T>): { newPk: string; oldPk: string } {
    const getPkValue = (field: keyof T) => String(updatedFields[field] ?? registeredRecord[field]);
    if (this.hasNotPkDefinition()) {
      return {
        newPk: getPkValue("_id" as keyof T),
        oldPk: String(registeredRecord._id)
      };
    }
    if (this.isSingleKey()) {
      const pkDefinitionName = this._primaryKeyDefinition[0];
      return {
        newPk: getPkValue(pkDefinitionName),
        oldPk: String(registeredRecord[pkDefinitionName])
      };
    }
    // Composite key
    return {
      newPk: this._primaryKeyDefinition.map(getPkValue).join('-'),
      oldPk: this._primaryKeyDefinition.map(pkName => registeredRecord[pkName]).join('-')
    }
  }

}