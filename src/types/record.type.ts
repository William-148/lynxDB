/**
 * Represents a record with a default primary key
 */
export type RecordWithId<T> = T & { 
  /** Default primary key if not defined */
  _id ?: string 
};

/**
 * Represents a versioned record
 */
export type Versioned<T> = {
  data: RecordWithId<T>;
  version: number;
}

/**
 * Represents a temporal change in a record
 */
export type TemporalChange<T> = {
  /** Action performed on the record */
  action: 'updated' | 'deleted';
  /** The uncommitted version of the record */
  changes: Versioned<T>;
  /** Indicates if the record has the original PK and it was not changed */
  hasTheOriginalPk: boolean;
}

/**
 * Represents a committed record with his temporal changes.
 */
export type RecordState<T> = {
  committed: Versioned<T>;
  /** Temporal changes of the committed record. */
  tempChanges?: TemporalChange<T>;
}