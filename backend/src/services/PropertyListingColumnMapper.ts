// 物件リストのカラムマッピングサービス
import columnMapping from '../config/property-listing-column-mapping.json';

export class PropertyListingColumnMapper {
  private spreadsheetToDb: Record<string, string>;
  private dbToSpreadsheet: Record<string, string>;
  private typeConversions: Record<string, string>;

  constructor() {
    this.spreadsheetToDb = columnMapping.spreadsheetToDatabase;
    this.dbToSpreadsheet = {};
    for (const [key, value] of Object.entries(this.spreadsheetToDb)) {
      this.dbToSpreadsheet[value] = key;
    }
    this.typeConversions = columnMapping.typeConversions;
  }

  mapSpreadsheetToDatabase(headers: string[], row: any[]): Record<string, any>;
  mapSpreadsheetToDatabase(rowObject: Record<string, any>): Record<string, any>;
  mapSpreadsheetToDatabase(headersOrRow: string[] | Record<string, any>, row?: any[]): Record<string, any> {
    const result: Record<string, any> = {};
    
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

  private convertValue(column: string, value: any): any {
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

  private parseDate(value: any): string | null {
    if (!value) return null;
    
    const str = String(value).trim();
    if (!str) return null;

    // YYYY/MM/DD or YYYY-MM-DD
    const match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (match) {
      const [, year, month, day] = match;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return null;
  }

  private parseNumber(value: any): number | null {
    if (!value) return null;
    
    let str = String(value).trim();
    if (!str) return null;

    // 「約」「概算」などの接頭辞を除去
    str = str.replace(/^[約概算ほぼおよそ]+/g, '');
    
    // 「万」「千」の単位を処理
    const manMatch = str.match(/^([0-9０-９.,，]+)\s*万/);
    if (manMatch) {
      const numStr = manMatch[1].replace(/[,，]/g, '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));
      const num = parseFloat(numStr);
      return isNaN(num) ? null : num * 10000;
    }

    const senMatch = str.match(/^([0-9０-９.,，]+)\s*千/);
    if (senMatch) {
      const numStr = senMatch[1].replace(/[,，]/g, '').replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));
      const num = parseFloat(numStr);
      return isNaN(num) ? null : num * 1000;
    }

    // 通常の数値パース（カンマ、円、￥、スペースを除去）
    str = str.replace(/[,，円￥\s万千約]/g, '');
    // 全角数字を半角に変換
    str = str.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFF10 + 0x30));
    if (!str) return null;

    const num = parseFloat(str);
    return isNaN(num) ? null : num;
  }

  getDbColumns(): string[] {
    return Object.values(this.spreadsheetToDb);
  }

  getSpreadsheetColumns(): string[] {
    return Object.keys(this.spreadsheetToDb);
  }
}
