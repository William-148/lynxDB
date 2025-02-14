/**
 * Enum representing the type of operator used in a query.
 */
export enum OpeartorType {
  Comparison = 1,
  Logical = 2
}

/**
 * Enum representing various comparison operators that can be used to filter data.
 */
export enum ComparisonOp {
  /** Equal to */
  $eq = '$eq',
  /** Not equal to */
  $ne = '$ne',
  /** Greater than */
  $gt = '$gt',
  /** Greater than or equal to */
  $gte = '$gte',
  /** Less than */
  $lt = '$lt',
  /** Less than or equal to */
  $lte = '$lte',
  /** Array inclusion check */
  $in = '$in',
  /** Array exclusion check */
  $nin = '$nin',
  /** String pattern match */
  $like = '$like'
}

/**
 * Represents a comparison query that can be used to filter data based on a specific field.
 */
export type ComparisonQuery<T> = {
  /** Equal to */
  [ComparisonOp.$eq]?: T;
  /** Not equal to */
  [ComparisonOp.$ne]?: T;
  /** Greater than */
  [ComparisonOp.$gt]?: T;
  /** Greater than or equal to */
  [ComparisonOp.$gte]?: T;
  /** Less than */
  [ComparisonOp.$lt]?: T;
  /** Less than or equal to */
  [ComparisonOp.$lte]?: T;
  /** Array include check */
  [ComparisonOp.$in]?: T extends any[] ? T[number][] : T[];
  /** Array exclude check */
  [ComparisonOp.$nin]?: T extends any[] ? T[number][] : T[];
  /** String pattern match */
  [ComparisonOp.$like]?: string;
};

/**
 * Enum representing various logical operators that can be used to combine multiple queries.
 */
export enum LogicalOp {
  /** Logical AND */
  $and = '$and',
  /** Logical OR */
  $or = '$or',
  /** Logical NOT */
  $not = '$not'
}

/**
 * Represents a logical query that can be used to combine multiple queries using logical operators.
 */
export type LogicalQuery<T> = {
  /** Logical AND */
  [LogicalOp.$and]?: Query<T>[];
  /** Logical OR */
  [LogicalOp.$or]?: Query<T>[];
  /** Logical NOT */
  [LogicalOp.$not]?: Query<T>;
}

/**
 * Represents a query that can be used to filter data based on multiple conditions.
 */
export type Query<T> = {
  [P in keyof T]?: T[P] | ComparisonQuery<T[P]>;
} & LogicalQuery<T>;

/**
 * Represents a logical compiled query that has many expressions.
 */
export type LogicalCompiledQuery<T> = {
  type: OpeartorType.Logical;
  operator: LogicalOp;
  expressions: CompiledQuery<T>[];
}

/**
 * Represents a comparison compiled query representing a single expression.
 */
export type ComparisonCompiledQuery<T> = {
  type: OpeartorType.Comparison;
  field: keyof T;
  operator: ComparisonOp;
  operand: any;
}

/**
 * Represents a compiled query that can be used to filter data based on multiple conditions.
 */
export type CompiledQuery<T> = LogicalCompiledQuery<T> | ComparisonCompiledQuery<T>;