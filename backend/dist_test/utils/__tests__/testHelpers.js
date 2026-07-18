"use strict";
/**
 * テストヘルパーユーティリティ
 * プロパティベーステストとユニットテストで使用する共通ヘルパー関数
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.delay = exports.withTimeout = exports.MockDatabase = exports.sum = exports.intersection = exports.union = exports.hasRequiredFields = exports.isValidEnumValue = exports.isValidSellerNumber = exports.matchesPattern = exports.isChronologicallySorted = exports.areAllUnique = exports.areObjectsEqualExcludingDatesAndIds = void 0;
/**
 * 2つのオブジェクトが等しいかチェック（日付とUUIDを除く）
 */
const areObjectsEqualExcludingDatesAndIds = (obj1, obj2, excludeFields = ['id', 'createdAt', 'updatedAt', 'created_at', 'updated_at']) => {
    const keys1 = Object.keys(obj1).filter(k => !excludeFields.includes(k));
    const keys2 = Object.keys(obj2).filter(k => !excludeFields.includes(k));
    if (keys1.length !== keys2.length)
        return false;
    for (const key of keys1) {
        if (obj1[key] !== obj2[key]) {
            return false;
        }
    }
    return true;
};
exports.areObjectsEqualExcludingDatesAndIds = areObjectsEqualExcludingDatesAndIds;
/**
 * 配列内の要素がすべて一意かチェック
 */
const areAllUnique = (arr, keyFn = (x) => x) => {
    const keys = arr.map(keyFn);
    return keys.length === new Set(keys).size;
};
exports.areAllUnique = areAllUnique;
/**
 * 配列が時系列順（降順）にソートされているかチェック
 */
const isChronologicallySorted = (dates) => {
    for (let i = 0; i < dates.length - 1; i++) {
        if (dates[i].getTime() < dates[i + 1].getTime()) {
            return false;
        }
    }
    return true;
};
exports.isChronologicallySorted = isChronologicallySorted;
/**
 * 文字列が指定されたパターンにマッチするかチェック
 */
const matchesPattern = (str, pattern) => {
    return pattern.test(str);
};
exports.matchesPattern = matchesPattern;
/**
 * 売主番号が正しい形式かチェック（AA + 5桁の数字）
 */
const isValidSellerNumber = (sellerNumber) => {
    return /^AA\d{5}$/.test(sellerNumber);
};
exports.isValidSellerNumber = isValidSellerNumber;
/**
 * 列挙型の値が有効かチェック
 */
const isValidEnumValue = (value, validValues) => {
    return validValues.includes(value);
};
exports.isValidEnumValue = isValidEnumValue;
/**
 * オブジェクトの必須フィールドがすべて存在するかチェック
 */
const hasRequiredFields = (obj, requiredFields) => {
    return requiredFields.every(field => obj[field] !== undefined && obj[field] !== null);
};
exports.hasRequiredFields = hasRequiredFields;
/**
 * 2つの配列の和集合を取得
 */
const union = (arr1, arr2) => {
    return Array.from(new Set([...arr1, ...arr2]));
};
exports.union = union;
/**
 * 2つの配列の積集合を取得
 */
const intersection = (arr1, arr2) => {
    const set2 = new Set(arr2);
    return arr1.filter(item => set2.has(item));
};
exports.intersection = intersection;
/**
 * 配列の要素数の合計を計算
 */
const sum = (arr) => {
    return arr.reduce((acc, val) => acc + val, 0);
};
exports.sum = sum;
/**
 * テスト用のモックデータベース接続
 */
class MockDatabase {
    constructor() {
        this.data = new Map();
        this.data.set('sellers', []);
        this.data.set('activities', []);
        this.data.set('valuations', []);
    }
    async insert(table, record) {
        const records = this.data.get(table) || [];
        const newRecord = { ...record, id: this.generateId() };
        records.push(newRecord);
        this.data.set(table, records);
        return newRecord;
    }
    async findById(table, id) {
        const records = this.data.get(table) || [];
        return records.find(r => r.id === id) || null;
    }
    async findAll(table) {
        return this.data.get(table) || [];
    }
    async update(table, id, updates) {
        const records = this.data.get(table) || [];
        const index = records.findIndex(r => r.id === id);
        if (index === -1)
            return null;
        records[index] = { ...records[index], ...updates };
        this.data.set(table, records);
        return records[index];
    }
    async delete(table, id) {
        const records = this.data.get(table) || [];
        const filtered = records.filter(r => r.id !== id);
        this.data.set(table, filtered);
        return filtered.length < records.length;
    }
    clear() {
        this.data.clear();
        this.data.set('sellers', []);
        this.data.set('activities', []);
        this.data.set('valuations', []);
    }
    generateId() {
        return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
}
exports.MockDatabase = MockDatabase;
/**
 * 非同期関数のタイムアウトを設定
 */
const withTimeout = (promise, timeoutMs, errorMessage = 'Operation timed out') => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(errorMessage)), timeoutMs)),
    ]);
};
exports.withTimeout = withTimeout;
/**
 * 遅延を追加（テスト用）
 */
const delay = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};
exports.delay = delay;
