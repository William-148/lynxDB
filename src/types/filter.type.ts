
/**
 * Enum representing various comparison operators that can be used to filter data.
 * 
 * The available operators are:
 * 
 * - `eq`: Equal to
 * - `gt`: Greater than
 * - `lt`: Less than
 * - `gte`: Greater than or equal to
 * - `lte`: Less than or equal to
 * - `includes`: Array inclusion check
 */
export enum OperatorType {
  /** Equal to */
  eq = 'eq',
  /** Greater than */
  gt = 'gt',
  /** Less than */
  lt = 'lt',
  /** Greater than or equal to */
  gte = 'gte',
  /** Less than or equal to */
  lte = 'lte',
  /** Array inclusion check */
  includes = 'includes',
  /** String pattern match */
  like = 'like'
}

/**
 * Represents a filter operator for a specific type `T`.
 * 
 * This type allows for various comparison operations that can be used
 * to filter data. The available operators are:
 * 
 * - `eq`: Equal to
 * - `gt`: Greater than
 * - `lt`: Less than
 * - `gte`: Greater than or equal to
 * - `lte`: Less than or equal to
 * - `includes`: Array inclusion check
 * 
 * Each operator is optional and can be used to specify the corresponding
 * comparison value for the type `T`.
 * 
 * @template T - The type of the value to be compared.
 */
export type FilterOperator<T> = {
  [OperatorType.eq]?: T;
  [OperatorType.gt]?: T;
  [OperatorType.lt]?: T;
  [OperatorType.gte]?: T;
  [OperatorType.lte]?: T;
  [OperatorType.includes]?: T[];
  [OperatorType.like]?: string;
};

/**
 * Type alias for a function that handles a specific filter operator.
 * 
 * @template T - The type of the value to be compared.
 * @param recordValue - The value from the record being filtered.
 * @param conditionValue - The value to compare against.
 * @returns `true` if the condition is met, otherwise `false`.
 */
export type OperatorHandler<T> = (recordValue: T, conditionValue: any) => boolean;

/**
 * A map of operator types to their corresponding handler functions.
 * 
 * @template T - The type of the value to be compared.
 */
export type OperatorHandlerMap<T> = Record<OperatorType, OperatorHandler<T>>;

/**
 * Represents a filter object for a given type `T`.
 * Each property of `T` can have an optional filter operator applied to it.
 *
 * @template T - The type of the object to be filtered.
 */
export type Filter<T> = {
  [P in keyof T]?: FilterOperator<T[P]>;
};

/**
 * Represents a compiled condition for filtering.
 * 
 * @template T - The type of the object to be filtered.
 * @property key - The key of the property to be filtered.
 * @property operatorType - The type of operator to be used for filtering.
 * @property conditionValue - The value to compare against.
 * @property operatorHandler - The function that handles the comparison.
 */
export type CompiledCondition<T> = {
  key: keyof T;
  operatorType: OperatorType;
  conditionValue: T[keyof T];
  operatorHandler: OperatorHandler<T[keyof T]>;
};
