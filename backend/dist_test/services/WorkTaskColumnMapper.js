"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkTaskColumnMapper = void 0;
const work_task_column_mapping_json_1 = __importDefault(require("../config/work-task-column-mapping.json"));
const phoneNormalizer_1 = require("../utils/phoneNormalizer");
/**
 * 業務依頼カラムマッパー
 *
 * 業務依頼スプレッドシートのカラムとSupabaseのカラムをマッピングし、
 * データ型の変換とバリデーションを行います。
 */
class WorkTaskColumnMapper {
    constructor() {
        // 3つのマッピングオブジェクトを統合
        this.spreadsheetToDb = {
            ...work_task_column_mapping_json_1.default.spreadsheetToDatabase,
            ...work_task_column_mapping_json_1.default.spreadsheetToDatabase2,
            ...work_task_column_mapping_json_1.default.spreadsheetToDatabase3,
        };
        this.typeConversions = work_task_column_mapping_json_1.default.typeConversions;
        this.categories = work_task_column_mapping_json_1.default.categories;
        this.requiredFields = work_task_column_mapping_json_1.default.requiredFields;
    }
    /**
     * スプレッドシートの行データをSupabaseのデータ形式に変換
     */
    mapToDatabase(sheetRow) {
        const dbData = {};
        const TEL_COLUMNS = ['seller_contact_tel', 'buyer_contact_tel'];
        for (const [sheetColumn, dbColumn] of Object.entries(this.spreadsheetToDb)) {
            const value = sheetRow[sheetColumn];
            if (value === null || value === undefined || value === '') {
                dbData[dbColumn] = null;
                continue;
            }
            // 型変換
            const targetType = this.typeConversions[dbColumn];
            const converted = this.convertValue(value, targetType);
            // 電話番号カラムは先頭「0」補完を適用
            if (TEL_COLUMNS.includes(dbColumn)) {
                dbData[dbColumn] = (0, phoneNormalizer_1.normalizePhoneNumber)(converted) ?? null;
            }
            else {
                dbData[dbColumn] = converted;
            }
        }
        return dbData;
    }
    /**
     * スプレッドシートのデータをバリデーション
     */
    validate(sheetRow) {
        const errors = [];
        // 必須フィールドのチェック
        for (const requiredField of this.requiredFields) {
            // DBカラム名からスプレッドシートカラム名を逆引き
            const sheetColumn = Object.entries(this.spreadsheetToDb)
                .find(([_, db]) => db === requiredField)?.[0];
            if (sheetColumn) {
                const value = sheetRow[sheetColumn];
                if (!value || value === '') {
                    errors.push(`必須フィールド「${sheetColumn}」が空です`);
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors,
        };
    }
    /**
     * 値を指定された型に変換（スプレッドシート → データベース）
     */
    convertValue(value, targetType) {
        if (!targetType) {
            return String(value);
        }
        switch (targetType) {
            case 'number':
                return this.parseNumber(value);
            case 'date':
                return this.parseDate(value);
            default:
                return String(value);
        }
    }
    /**
     * 数値をパース
     */
    parseNumber(value) {
        if (typeof value === 'number')
            return value;
        // カンマ区切りの数値文字列を処理
        const numStr = String(value).replace(/,/g, '').replace(/円/g, '').trim();
        const num = parseFloat(numStr);
        return isNaN(num) ? null : num;
    }
    /**
     * 日付文字列をパース
     */
    parseDate(value) {
        if (!value)
            return null;
        try {
            // 既にDate型の場合
            if (value instanceof Date) {
                return value.toISOString().split('T')[0];
            }
            // 文字列の場合
            const str = String(value).trim();
            // 空文字チェック
            if (!str)
                return null;
            // YYYY-MM-DD形式
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
                return str;
            }
            // YYYY/MM/DD形式
            if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(str)) {
                const parts = str.split('/');
                const year = parts[0];
                const month = parts[1].padStart(2, '0');
                const day = parts[2].padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            // MM/DD形式（年なし）- 現在の年を使用
            const mmddMatch = str.match(/^(\d{1,2})\/(\d{1,2})$/);
            if (mmddMatch) {
                const month = mmddMatch[1].padStart(2, '0');
                const day = mmddMatch[2].padStart(2, '0');
                const currentYear = new Date().getFullYear();
                return `${currentYear}-${month}-${day}`;
            }
            // その他の形式はDateオブジェクトでパース
            const date = new Date(str);
            if (!isNaN(date.getTime())) {
                return date.toISOString().split('T')[0];
            }
            return null;
        }
        catch {
            return null;
        }
    }
    /**
     * カラムのカテゴリを取得
     */
    getCategory(dbColumn) {
        for (const [category, columns] of Object.entries(this.categories)) {
            if (columns.includes(dbColumn)) {
                return category;
            }
        }
        return 'その他';
    }
    /**
     * カテゴリ別にカラムをグループ化
     */
    getColumnsByCategory() {
        return this.categories;
    }
    /**
     * 日付型カラムかどうかを判定
     */
    isDateColumn(dbColumn) {
        return this.typeConversions[dbColumn] === 'date';
    }
    /**
     * 数値型カラムかどうかを判定
     */
    isNumberColumn(dbColumn) {
        return this.typeConversions[dbColumn] === 'number';
    }
    /**
     * 全カラム数を取得
     */
    getTotalColumnCount() {
        return Object.keys(this.spreadsheetToDb).length;
    }
    /**
     * マッピング設定を取得
     */
    getMappingConfig() {
        return {
            spreadsheetToDb: this.spreadsheetToDb,
            typeConversions: this.typeConversions,
            categories: this.categories,
            requiredFields: this.requiredFields,
        };
    }
}
exports.WorkTaskColumnMapper = WorkTaskColumnMapper;
