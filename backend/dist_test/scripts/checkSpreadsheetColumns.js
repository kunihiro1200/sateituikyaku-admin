"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// スプレッドシートのカラム名を確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const GoogleSheetsClient_1 = require("../services/GoogleSheetsClient");
dotenv_1.default.config();
async function checkSpreadsheetColumns() {
    console.log('🔍 スプレッドシートのカラム名を確認中...\n');
    // GoogleSheetsClientを初期化（物件リストスプレッドシートを使用）
    const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
        spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID,
        sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件',
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    // 認証
    await sheetsClient.authenticate();
    console.log('✅ Google Sheets認証成功\n');
    // 最初の1行を取得してカラム名を確認
    const allData = await sheetsClient.readAll();
    if (allData.length === 0) {
        console.log('❌ データが見つかりません');
        process.exit(1);
    }
    const firstRow = allData[0];
    const columnNames = Object.keys(firstRow);
    console.log(`📋 カラム数: ${columnNames.length}\n`);
    console.log('📋 カラム名一覧:');
    columnNames.forEach((name, index) => {
        const value = firstRow[name];
        const displayValue = value ? String(value).substring(0, 30) : '(空)';
        console.log(`  ${index + 1}. ${name} = ${displayValue}`);
    });
    // 物件番号に関連しそうなカラムを探す
    console.log('\n🔍 物件番号に関連しそうなカラム:');
    const propertyNumberColumns = columnNames.filter(name => name.includes('物件') || name.includes('番号') || name.toLowerCase().includes('property'));
    if (propertyNumberColumns.length > 0) {
        propertyNumberColumns.forEach(name => {
            console.log(`  - ${name}`);
        });
    }
    else {
        console.log('  見つかりませんでした');
    }
    // ATBB状態に関連しそうなカラムを探す
    console.log('\n🔍 ATBB状態に関連しそうなカラム:');
    const statusColumns = columnNames.filter(name => name.includes('ATBB') || name.includes('状態') || name.includes('ステータス'));
    if (statusColumns.length > 0) {
        statusColumns.forEach(name => {
            console.log(`  - ${name}`);
        });
    }
    else {
        console.log('  見つかりませんでした');
    }
    process.exit(0);
}
checkSpreadsheetColumns().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
