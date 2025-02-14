import { 
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

function isQueryObject(value: any): boolean {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value);
  return keys.some(isComparisonOperator);
}

export function compileQuery<T>(query: Query<T>) {
  const compiledQuery: CompiledQuery<T>[] = [];
  recursiveCompileQuery(query, compiledQuery);
  return compiledQuery;
}

function recursiveCompileQuery<T>(query: Query<T>, compiledQuery: CompiledQuery<T>[]) {
  for (const [fieldKey, queryValue] of Object.entries(query)) {
    if (isLogicalOperator(fieldKey)) {
      const logicNode = compileLogicalQuery(fieldKey, queryValue);
      compiledQuery.push(logicNode);
    }
    else if (isQueryObject(queryValue)) {
      for (const [comparisonOperator, operandValue] of Object.entries(queryValue as ComparisonQuery<T>)) {
        compiledQuery.push({
          type: OpeartorType.Comparison,
          field: fieldKey as keyof T,
          operator: comparisonOperator as ComparisonOp,
          operand: transformOperandValue(operandValue, comparisonOperator as ComparisonOp),
        });
      }
    } 
    else {
      compiledQuery.push({
        type: OpeartorType.Comparison,
        field: fieldKey as keyof T,
        operator: ComparisonOp.$eq,
        operand: queryValue
      });
    }
  }
}

function compileLogicalQuery<T>(logicOperator: LogicalOp, queryValue: Query<T> | Query<T>[]): CompiledQuery<T> {
  const logicCompiledQuery: CompiledQuery<T>[] = [];
  if (Array.isArray(queryValue)) {
    for (const query of queryValue) recursiveCompileQuery(query, logicCompiledQuery);
  }
  else {
    recursiveCompileQuery(queryValue, logicCompiledQuery);
  }

  return {
    type: OpeartorType.Logical,
    operator: logicOperator,
    expressions: logicCompiledQuery,
  } as LogicalCompiledQuery<T>;
}