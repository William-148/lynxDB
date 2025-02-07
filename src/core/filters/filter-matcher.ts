import { CompiledCondition, Filter, ComparisonOperatorType } from "../../types/filter.type";
import { getOperatorHandler, transformConditionValue } from "./operators";


export function compileFilter<T>(filter: Filter<T>): CompiledCondition<T>[] {
  const compiledConditions: CompiledCondition<T>[] = [];

  for (const [key, condition] of Object.entries(filter)) {
    for (const [operator, conditionValue] of Object.entries(condition as any)) {
      compiledConditions.push({
        key: key as keyof T,
        conditionValue: transformConditionValue(conditionValue as T[keyof T], operator as ComparisonOperatorType),
        operatorHandler: getOperatorHandler(operator as ComparisonOperatorType),
      });
    }
  }
  return compiledConditions;
}

export function matchRecord<T>(record: T, compiledFilter: CompiledCondition<T>[]): boolean {
  if (compiledFilter.length === 0) return true; // Empty filter matches everything
  
  for (const { key, operatorHandler, conditionValue } of compiledFilter) {
    const recordFieldValue = record[key];
    if (!operatorHandler(recordFieldValue, conditionValue)) {
      return false; // Fail immediately if it does not match
    }
  }
  return true; // Every condition matches
}

