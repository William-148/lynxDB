
/**
 * Error thrown when a primary key is defined more than once.
 * @class
 * @extends {Error}
 * @param {string} providedKeys - The keys that were provided.
 */
export class DuplicatePkDefinitionError extends Error {
  constructor(providedKeys: string) {
    super(`The primary key definition must not be repeated. Provided: ${providedKeys}`);
  }
}

/**
 * Error thrown when the value of a primary key is null.
 * @class
 * @extends {Error}
 * @param {string} providedKey - The key that was provided.
 */
export class PrimaryKeyValueNullError extends Error {
  constructor(providedKey: string) {
    super(`The value of the primary key "${providedKey}" cannot be null`);
  }
}

/**
 * Error thrown when a record with a duplicate primary key value is inserted.
 * @class
 * @extends {Error}
 */
export class DuplicatePrimaryKeyValueError extends Error {
  constructor(pkName: string, pkValue: string) {
    super(`Key (${pkName})=(${pkValue}) already exists`);
  }
}