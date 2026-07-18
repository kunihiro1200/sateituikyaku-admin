"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColumnMappingValidator = void 0;
// カラムマッピング検証サービス
const googleapis_1 = require("googleapis");
const path = __importStar(require("path"));
const buyer_column_mapping_json_1 = __importDefault(require("../config/buyer-column-mapping.json"));
const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';
class ColumnMappingValidator {
    /**
     * 物件番号のカラムマッピングを検証
     */
    async validatePropertyNumberMapping() {
        const result = {
            isValid: true,
            spreadsheetColumn: '物件番号',
            databaseColumn: 'property_number',
            sampleValues: [],
            issues: []
        };
        // 1. マッピング設定の確認
        const allMappings = {
            ...buyer_column_mapping_json_1.default.spreadsheetToDatabase,
            ...buyer_column_mapping_json_1.default.spreadsheetToDatabaseExtended
        };
        const mappedDbColumn = allMappings['物件番号'];
        if (!mappedDbColumn) {
            result.isValid = false;
            result.issues.push('「物件番号」カラムのマッピングが設定されていません');
            return result;
        }
        if (mappedDbColumn !== 'property_number') {
            result.isValid = false;
            result.issues.push(`「物件番号」が「${mappedDbColumn}」にマッピングされています（期待値: property_number）`);
            result.databaseColumn = mappedDbColumn;
            return result;
        }
        // 2. スプレッドシートからサンプルデータを読み取り
        try {
            const sampleValues = await this.readSampleSpreadsheetData('物件番号', 20);
            result.sampleValues = sampleValues;
            // 3. サンプルデータのフォーマット検証
            const invalidValues = sampleValues.filter(value => value && !this.validatePropertyNumberFormat(value));
            if (invalidValues.length > 0) {
                result.issues.push(`無効な物件番号フォーマットが見つかりました（${invalidValues.length}件）: ${invalidValues.slice(0, 5).join(', ')}`);
            }
            // 4. 空値の確認（警告のみ、エラーではない）
            const emptyCount = sampleValues.filter(value => !value || value.trim() === '').length;
            if (emptyCount > 0) {
                // 空値は許容されるが、統計情報として記録
                // result.issues.push(`空の物件番号が見つかりました（${emptyCount}/${sampleValues.length}件）`);
            }
            // 5. 最終判定
            if (result.issues.length > 0) {
                result.isValid = false;
            }
        }
        catch (error) {
            result.isValid = false;
            result.issues.push(`スプレッドシートからのデータ読み取りエラー: ${error.message}`);
        }
        return result;
    }
    /**
     * スプレッドシートから指定カラムのサンプルデータを読み取り
     */
    async readSampleSpreadsheetData(columnName, rows = 20) {
        const auth = new googleapis_1.google.auth.GoogleAuth({
            keyFile: path.join(__dirname, '../../google-service-account.json'),
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        });
        const sheets = googleapis_1.google.sheets({ version: 'v4', auth });
        // ヘッダー取得
        const headerResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!1:1`,
        });
        const headers = headerResponse.data.values?.[0] || [];
        // カラムインデックスを取得
        const columnIndex = headers.indexOf(columnName);
        if (columnIndex === -1) {
            throw new Error(`カラム「${columnName}」が見つかりません`);
        }
        // カラムレターを計算（A=0, B=1, ..., Z=25, AA=26, ...）
        const columnLetter = this.getColumnLetter(columnIndex);
        // データ取得
        const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `'${SHEET_NAME}'!${columnLetter}2:${columnLetter}${rows + 1}`,
        });
        const values = dataResponse.data.values || [];
        return values.map(row => row[0] ? String(row[0]).trim() : '');
    }
    /**
     * カラムインデックスをカラムレター（A, B, ..., AA, AB, ...）に変換
     */
    getColumnLetter(index) {
        let letter = '';
        let num = index;
        while (num >= 0) {
            letter = String.fromCharCode((num % 26) + 65) + letter;
            num = Math.floor(num / 26) - 1;
        }
        return letter;
    }
    /**
     * 物件番号のフォーマットを検証
     * 期待フォーマット: AA + 数字（例: AA12345）
     */
    validatePropertyNumberFormat(value) {
        if (!value || typeof value !== 'string') {
            return false;
        }
        const trimmed = value.trim();
        // AAで始まり、その後に数字が続くパターン
        const pattern = /^AA\d+$/;
        return pattern.test(trimmed);
    }
    /**
     * すべてのカラムマッピングを検証
     */
    async validateAllMappings() {
        const results = {};
        // 物件番号のマッピングを検証
        results['property_number'] = await this.validatePropertyNumberMapping();
        return results;
    }
}
exports.ColumnMappingValidator = ColumnMappingValidator;
