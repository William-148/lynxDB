import { OperatorType, OperatorHandlerMap, OperatorHandler } from "../../types/filter.type";

let operators: OperatorHandlerMap<any> | undefined;

/**
 * Retrieves the handler function for a specified operator type.
 * 
 * @template T - The type of the values being compared.
 * @param {OperatorType} operatorType - The type of operator for which the handler is to be retrieved.
 * @returns {OperatorHandler<T>} - The handler function corresponding to the specified operator type.
 * @throws {Error} - Throws an error if the specified operator type is unsupported.
 */
export function getOperatorHandler<T>(operatorType: OperatorType): OperatorHandler<T> {
  if (!operators) {
    operators = Object.freeze({
      [OperatorType.eq]: deepEqual,
      [OperatorType.gt]: (recordValue: T, conditionValue: T) => recordValue > conditionValue,
      [OperatorType.lt]: (recordValue: T, conditionValue: T) => recordValue < conditionValue,
      [OperatorType.gte]: (recordValue: T, conditionValue: T) => recordValue >= conditionValue,
      [OperatorType.lte]: (recordValue: T, conditionValue: T) => recordValue <= conditionValue,
      [OperatorType.includes]: (recordValue: T, conditionValue: T[]) => Array.isArray(conditionValue) && conditionValue.includes(recordValue),
      [OperatorType.like]: likeComparison<T>
    });
  }
  const operatorHandlerFound = operators[operatorType];
  if (!operatorHandlerFound) {
    throw new Error(`Unsupported operator: ${operatorType}`);
  }
  return operatorHandlerFound as OperatorHandler<T>;
}


/**
 * Transforms a condition value based on the specified operator type.
 * 
 * @template T - The type of the condition value.
 * @param {T} conditionValue - The value to be transformed.
 * @param {OperatorType} operatorType - The type of operator to apply for the transformation.
 * @returns {T | RegExp} - The transformed condition value. If the operator type is 'like' and the condition value is a string, 
 * it returns a RegExp object. Otherwise, it returns the original condition value.
 */
export function transformConditionValue<T>(conditionValue: T, operatorType: OperatorType): T | RegExp {
  if (operatorType === OperatorType.like && typeof conditionValue === 'string') {
    const regexPattern = escapeRegExp(conditionValue)
      .replace(/%/g, '.*')
      .replace(/_/g, '.'); 
    return new RegExp(`^${regexPattern}$`, 'i'); 
  }
  return conditionValue;
}

function escapeRegExp(string: string): string { 
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function likeComparison<T>(recordValue: T, conditionValue: RegExp): boolean {
  if (!(conditionValue instanceof RegExp) || typeof recordValue !== 'string') return false;
  return conditionValue.test(recordValue);
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
