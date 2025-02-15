import { 
  ComparisonOp, 
  CompiledQuery, 
  OpeartorType, 
  LogicalOp
} from "../../types/query.type";

const comparisonOperators: Record<ComparisonOp, (a: any, b: any) => boolean> = {
  '$eq': (a, b) => deepEqual(a, b),
  '$ne': (a, b) => !deepEqual(a, b),
  '$gt': (a, b) => a > b,
  '$gte': (a, b) => a >= b,
  '$lt': (a, b) => a < b,
  '$lte': (a, b) => a <= b,
  '$in': (a, b) => Array.isArray(a) ? a.some(value => b.has(value)) : b.has(a),
  '$nin': (a, b) => !Array.isArray(a) ? !b.has(a) : !a.some(value => b.has(value)),
  '$like': (a, b) => typeof a === 'string' && (b as RegExp).test(a)
};

const logicalOperators: Record<LogicalOp, (record: any, expressions: CompiledQuery<any>[]) => boolean> = {
  '$and': (record, expressions) => expressions.every(exp =>  match(record, exp)),
  '$or': (record, expressions) => expressions.some(exp =>  match(record, exp)),
  '$not': (record, expressions) => !match(record, expressions[0])
};

export function match<T>(record: T, compiled: CompiledQuery<T> | null): boolean {
  if (!compiled) return true;
  
  switch (compiled.type) {
    case OpeartorType.Comparison:
      const fnComp = comparisonOperators[compiled.operator];
      if (!fnComp) throw new Error(`Unsupported operator: ${compiled.operator}`);
      return fnComp(record[compiled.field], compiled.operand);

    case OpeartorType.Logical:
      const fnLogic = logicalOperators[compiled.operator];
      if (!fnLogic) throw new Error(`Unsupported operator: ${compiled.operator}`);
      return fnLogic(record, compiled.expressions);
  }

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
