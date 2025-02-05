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
 * Represents the information required for an update operation.
 */
export type UpdatedFieldsDetails<T> = {
  /**
   * The fields that have been updated.
   */
  updatedFields: Partial<T>;

  /**
   * Indicates whether the updated fields are part of the primary key.
   */
  isPartOfPrimaryKey: boolean;
};


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
  committedPk: string;
  committed: Versioned<T>;
  /** Temporal changes of the committed record. */
  tempChanges?: TemporalChange<T>;
}