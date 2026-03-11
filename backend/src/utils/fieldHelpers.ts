/**
 * フィールドヘルパー関数
 *
 * AppSheetのIFSロジックで使用されるフィールド関連の条件判定をサポートします。
 */

export function isBlank(value: any): boolean {
  return value === null || value === undefined || value === '';
}

export function isNotBlank(value: any): boolean {
  return !isBlank(value);
}

export function contains(value: any, searchString: string): boolean {
  if (isBlank(value)) return false;
  if (isBlank(searchString)) return false;
  return String(value).includes(searchString);
}

export function notContains(value: any, searchString: string): boolean {
  return !contains(value, searchString);
}

export function equals(value: any, compareValue: any): boolean {
  return value === compareValue;
}

export function notEquals(value: any, compareValue: any): boolean {
  return value !== compareValue;
}

export function and(...conditions: boolean[]): boolean {
  return conditions.every(condition => condition === true);
}

export function or(...conditions: boolean[]): boolean {
  return conditions.some(condition => condition === true);
}

export function not(condition: boolean): boolean {
  return !condition;
}
