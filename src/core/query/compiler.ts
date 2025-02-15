import {
  ComparisonCompiledQuery,
  ComparisonOp,
  ComparisonQuery,
  CompiledQuery,
  LogicalCompiledQuery,
  LogicalOp,
  OpeartorType,
  Query
} from "../../types/query.type";

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Transforms the operand value based on the given comparison operator type.
 *
 * If the operator type is `$like` and the operand is a string, the operand is
 * transformed into a regular expression that matches the pattern used in SQL
 * LIKE. The pattern is also case-insensitive.
 *
 * @template T - The type of the operand.
 * @param {T} operand - The value to be transformed.
 * @param {ComparisonOp} operatorType - The type of comparison operator.
 * @returns {T | RegExp | Set<T>} - When the operator is $like, returns a regular expression.
 * - When the operator is $in or $nin, returns a Set.
 * - Otherwise, returns the original operand.
 */
function transformOperandValue<T>(operand: T, operatorType: ComparisonOp): T | RegExp | Set<T> {
  if (operatorType === ComparisonOp.$like) {
    if (operand instanceof RegExp) return operand;
    if (typeof operand !== 'string') return /^$/;
    const regexPattern = escapeRegExp(operand)
      .replace(/%/g, '.*')
      .replace(/_/g, '.');
    return new RegExp(`^${regexPattern}$`, 'i');
  }
  if (operatorType === ComparisonOp.$in || operatorType === ComparisonOp.$nin) {
    if (!Array.isArray(operand)) return new Set();
    return new Set(operand);
  }
  return operand;
}

function isLogicalOperator(key: string): key is LogicalOp {
  return Object.hasOwnProperty.call(LogicalOp, key);
}

function isComparisonOperator(key: string): key is ComparisonOp {
  return Object.hasOwnProperty.call(ComparisonOp, key);
}

function isComparisonObject(value: any): string[] | boolean {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.keys(value).some(isComparisonOperator);
}

export function compileQuery<T>(query: Query<T>): CompiledQuery<T> | null {
  const queryEntries = Object.entries(query);
  if (queryEntries.length === 0) return null;

  const isComparison = (queryEntries.length === 1);
  const compiledQuery: CompiledQuery<T>[] = [];

  for (const [fieldKey, queryValue] of queryEntries) {
    const result = processQuery(fieldKey, queryValue);
    if (result) compiledQuery.push(result);
  }

  return isComparison 
    ? compiledQuery[0]
    : {
      type: OpeartorType.Logical,
      operator: LogicalOp.$and,
      expressions: compiledQuery
    } as LogicalCompiledQuery<T>;
}

function processQuery<T>(fieldKey: string, queryValue: Query<T> | Query<T>[]): CompiledQuery<T> | null {
  // Proccess logical operators
  // - fieldKey = $and, $or, $not
  // - queryValue = { ... } | [{ ... }, ... ]
  // Example: { $and: [{ ... }, ...] } | { $or: [{ ... }, ...] } | { $not: { ... } }
  if (isLogicalOperator(fieldKey)) return proccessLogical(fieldKey, queryValue);

  // Proccess comparison operators
  // - fieldKey = Property name of the object to be compared
  // - queryValue = { $eq: 1 } | { $gt: 1, $lt: 10, ... } | { $like: 'pattern' } | ...
  // Example: { field: { $eq: 1 } } | { field: { $gt: 1, $lt: 10, ... } } | ...
  if (isComparisonObject(queryValue)) {
    const comparisonList = Object.entries(queryValue as ComparisonQuery<T>)
      .map(([comparisonOperator, operandValue]): ComparisonCompiledQuery<T> => ({
        type: OpeartorType.Comparison,
        field: fieldKey as keyof T,
        operator: comparisonOperator as ComparisonOp,
        operand: transformOperandValue(operandValue, comparisonOperator as ComparisonOp),
      }));
    
    return (comparisonList.length === 1)
      ? comparisonList[0]
      : {
        type: OpeartorType.Logical,
        operator: LogicalOp.$and,
        expressions: comparisonList
      }
  }

  // Default
  // fieldKey = Property name of the object to be compared
  // queryValue = number | string | object | array | ...
  // Example: { field: 1 } | { field: 'value' } | { field: { ... } } | { field: [ ... ] } | ...
  return {
    type: OpeartorType.Comparison,
    field: fieldKey as keyof T,
    operator: ComparisonOp.$eq,
    operand: queryValue
  } as ComparisonCompiledQuery<T>;
}

function proccessLogical<T>(logicalOpeartion: LogicalOp, queryValue: Query<T> | Query<T>[]): LogicalCompiledQuery<T> {
  const exps: CompiledQuery<T>[] = [];
  if (Array.isArray(queryValue)) {
    // $and or $or
    for (const query of queryValue) {
      const result = compileQuery(query);
      if (result) exps.push(result);
    }
  }
  else {
    // $not
    const result = compileQuery(queryValue);
    if (!result) throw new Error(`Invalid value for logical operator "${logicalOpeartion}"=${queryValue}`);
    exps.push(result);
  }
  return {
    type: OpeartorType.Logical,
    operator: logicalOpeartion,
    expressions: exps
  };
}