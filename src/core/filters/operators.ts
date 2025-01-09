import { OperatorType, OperatorHandlerMap } from "../../types/filter.type";

let operators: OperatorHandlerMap<any> | undefined;

export function getOperatorsHandlerMap<T>(): OperatorHandlerMap<T> {
  if (operators) return operators as OperatorHandlerMap<T>;
  operators = {
    [OperatorType.eq]: (recordValue: T, conditionValue: T) => recordValue === conditionValue,
    [OperatorType.gt]: (recordValue: T, conditionValue: T) => recordValue > conditionValue,
    [OperatorType.lt]: (recordValue: T, conditionValue: T) => recordValue < conditionValue,
    [OperatorType.gte]: (recordValue: T, conditionValue: T) => recordValue >= conditionValue,
    [OperatorType.lte]: (recordValue: T, conditionValue: T) => recordValue <= conditionValue,
    [OperatorType.includes]: (recordValue: T, conditionValue: T[]) => Array.isArray(conditionValue) && conditionValue.includes(recordValue),
    [OperatorType.like]: (recordValue: T, conditionValue: string) => {
      if (typeof recordValue !== 'string') return false;
      const regexPattern = conditionValue.replace(/%/g, '.*').replace(/_/g, '.'); 
      const regex = new RegExp(`^${regexPattern}$`, 'i'); 
      return regex.test(recordValue);
    }
  };
  Object.freeze(operators);
  return operators as OperatorHandlerMap<T>;
}

