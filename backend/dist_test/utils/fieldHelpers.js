"use strict";
/**
 * フィールドヘルパー関数
 *
 * AppSheetのIFSロジックで使用されるフィールド関連の条件判定をサポートします。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBlank = isBlank;
exports.isNotBlank = isNotBlank;
exports.contains = contains;
exports.notContains = notContains;
exports.equals = equals;
exports.notEquals = notEquals;
exports.and = and;
exports.or = or;
exports.not = not;
function isBlank(value) {
    return value === null || value === undefined || value === '' || value === 'null';
}
function isNotBlank(value) {
    return !isBlank(value);
}
function contains(value, searchString) {
    if (isBlank(value))
        return false;
    if (isBlank(searchString))
        return false;
    return String(value).includes(searchString);
}
function notContains(value, searchString) {
    return !contains(value, searchString);
}
function equals(value, compareValue) {
    return value === compareValue;
}
function notEquals(value, compareValue) {
    return value !== compareValue;
}
function and(...conditions) {
    return conditions.every(condition => condition === true);
}
function or(...conditions) {
    return conditions.some(condition => condition === true);
}
function not(condition) {
    return !condition;
}
