import { CompiledCondition, Filter, OperatorType } from "../../types/filter.type";
import { getOperatorsHandlerMap } from "./operators";

export function compileFilter<T>(filter: Filter<T>): CompiledCondition<T>[] {
  const compiledConditions: CompiledCondition<T>[] = [];
  const operatorHandlerMap = getOperatorsHandlerMap<T[keyof T]>();

  for (const [key, condition] of Object.entries(filter)) {
    for (const [operator, conditionValue] of Object.entries(condition as any)) {
      const operatorHandlerFinded = operatorHandlerMap[operator as OperatorType];
      if (!operatorHandlerFinded) {
        throw new Error(`Unsupported operator: ${operator}`);
      }
      compiledConditions.push({
        key: key as keyof T,
        operatorType: operator as OperatorType,
        conditionValue: conditionValue as T[keyof T],
        operatorHandler: operatorHandlerFinded,
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

