import { 
  ComparisonOp, 
  CompiledQuery, 
  OpeartorType, 
  LogicalCompiledQuery 
} from "../../types/query.type";

export function match<T>(record: T, compiledQuery: CompiledQuery<T>[]): boolean {
  for (const compiled of compiledQuery) {
    if (compiled.type === OpeartorType.Comparison) {
      if (!proccessComparison(record[compiled.field], compiled.operator, compiled.operand)) {
        return false;
      }
    }
    else {
      if (!proccessLogic(record, compiled)) return false;
    }
  }
  return true;
}

function proccessComparison<T>(fieldValue: T, operator: ComparisonOp, operand: any): boolean {
  switch (operator) {
    case '$eq': return deepEqual(fieldValue, operand);
    case '$ne': return !deepEqual(fieldValue, operand);
    case '$gt': return fieldValue > operand;
    case '$gte': return fieldValue >= operand;
    case '$lt': return fieldValue < operand;
    case '$lte': return fieldValue <= operand;
    case '$in': return proccessInOp(fieldValue, operand);
    case '$nin': return !proccessInOp(fieldValue, operand);
    case '$like':
      return typeof fieldValue === 'string' && (operand as RegExp).test(fieldValue);
    default:
      throw new Error(`Unsupported operator: ${operator}`);
  }
}

function proccessLogic<T>(record: T, compiled: LogicalCompiledQuery<T>): boolean {
  switch (compiled.operator) {
    case '$and':
      return compiled.expressions.every(subQuery => matchLogic(record, subQuery));
    case '$or':
      return compiled.expressions.some(subQuery => matchLogic(record, subQuery));
    case '$not':
      return !matchLogic(record, compiled.expressions[0]);
    default:
      throw new Error(`Unsupported operator: ${compiled.operator}`);
  }
}

function matchLogic<T>(record: T, expression: CompiledQuery<T>): boolean {
  return (expression.type === OpeartorType.Comparison) 
    ? proccessComparison(
        record[expression.field],
        expression.operator,
        expression.operand
      )
    : proccessLogic(record, expression); 
}

function proccessInOp<T>(fieldValue: T, operand: Set<T>): boolean {
  return Array.isArray(fieldValue)
  ? fieldValue.some(value => operand.has(value))
  : operand.has(fieldValue);
}

function deepEqual<T>(recordValue: T, conditionValue: T): boolean {
  if (recordValue === conditionValue) return true;

  if (typeof recordValue !== 'object' || recordValue === null || typeof conditionValue !== 'object' || conditionValue === null) {
    return false;
  }

  // Handle array comparison
  if (Array.isArray(recordValue) && Array.isArray(conditionValue)) {
    if (recordValue.length !== conditionValue.length) return false;
    for (let i = 0; i < recordValue.length; i++) {
      if (!deepEqual(recordValue[i], conditionValue[i])) return false;
    }
    return true;
  }

  // Handle object comparison
  const recordKeys = Object.keys(recordValue);
  const conditionKeys = Object.keys(conditionValue);
  if (recordKeys.length !== conditionKeys.length) return false;

  for (let key of recordKeys) {
    if (!deepEqual(recordValue[key as keyof T], conditionValue[key as keyof T])) return false;
  }

  return true;
}
