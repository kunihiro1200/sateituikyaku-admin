"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertyListingColumnMapper = void 0;
// 物件リストのカラムマッピングサービス
const property_listing_column_mapping_json_1 = __importDefault(require("../config/property-listing-column-mapping.json"));
class PropertyListingColumnMapper {
    constructor() {
        this.spreadsheetToDb = property_listing_column_mapping_json_1.default.spreadsheetToDatabase;
        this.dbToSpreadsheet = {};
        for (const [key, value] of Object.entries(this.spreadsheetToDb)) {
            this.dbToSpreadsheet[value] = key;
        }
        this.typeConversions = property_listing_column_mapping_json_1.default.typeConversions;
    }
    mapSpreadsheetToDatabase(headersOrRow, row) {
        const result = {};
        // Overload 1: (headers, row) - array format
        if (Array.isArray(headersOrRow) && row) {
            const headers = headersOrRow;
            headers.forEach((header, index) => {
                const dbColumn = this.spreadsheetToDb[header];
                if (dbColumn && row[index] !== undefined) {
                    result[dbColumn] = this.convertValue(dbColumn, row[index]);
                }
            });
        }
        // Overload 2: (rowObject) - object format
        else if (typeof headersOrRow === 'object' && !Array.isArray(headersOrRow)) {
            const rowObject = headersOrRow;
            for (const [spreadsheetColumn, value] of Object.entries(rowObject)) {
                const dbColumn = this.spreadsheetToDb[spreadsheetColumn];
                if (dbColumn && value !== undefined) {
                    const converted = this.convertValue(dbColumn, value);
                    // 既に値がある場合はnullで上書きしない（複数列が同じDBカラムにマップされる場合の対策）
                    if (converted !== null || result[dbColumn] === undefined) {
                        result[dbColumn] = converted;
                    }
                }
            }
        }
        return result;
    }
    convertValue(column, value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const type = this.typeConversions[column];
        if (type === 'date') {
            return this.parseDate(value);
        }
        if (type === 'number') {
            return this.parseNumber(value);
        }
        return String(value).trim();
    }
    parseDate(value) {
        if (!value)
            return null;
        const str = String(value).trim();
        if (!str)
            return null;
        // YYYY/MM/DD or YYYY-MM-DD
        const match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
        if (match) {
            const [, year, month, day] = match;
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return null;
    }
    parseNumber(value) {
        if (!value)
            return null;
        const str = String(value).replace(/[,，円￥\s]/g, '').trim();
        if (!str)
            return null;
        const num = parseFloat(str);
        return isNaN(num) ? null : num;
    }
    getDbColumns() {
        return Object.values(this.spreadsheetToDb);
    }
    getSpreadsheetColumns() {
        return Object.keys(this.spreadsheetToDb);
    }
}
exports.PropertyListingColumnMapper = PropertyListingColumnMapper;
