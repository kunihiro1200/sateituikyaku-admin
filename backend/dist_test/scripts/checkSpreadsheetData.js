"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// スプレッドシートのデータを確認するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const GoogleSheetsClient_1 = require("../services/GoogleSheetsClient");
dotenv_1.default.config();
async function checkSpreadsheetData() {
    console.log('🔍 スプレッドシートのデータを確認中...\n');
    // GoogleSheetsClientを初期化（物件リストスプレッドシートを使用）
    const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
        spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID,
        sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件',
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    // 認証
    await sheetsClient.authenticate();
    console.log('✅ Google Sheets認証成功\n');
    // 全データを取得
    const allData = await sheetsClient.readAll();
    console.log(`📊 スプレッドシート総行数: ${allData.length}行\n`);
    // 物件番号がある行をカウント
    const propertiesWithNumber = allData.filter(row => {
        const propertyNumber = String(row['物件番号'] || '').trim();
        return propertyNumber !== '';
    });
    console.log(`📋 物件番号がある行: ${propertiesWithNumber.length}行\n`);
    // atbb_statusの分布を確認
    const statusCounts = {};
    propertiesWithNumber.forEach(row => {
        const status = String(row['atbb成約済み/非公開'] || '未設定').trim();
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('📋 ATBB状態の分布:');
    Object.entries(statusCounts)
        .sort((a, b) => b[1] - a[1])
        .forEach(([status, count]) => {
        console.log(`  ${status}: ${count}件`);
    });
    // 公開中の物件を確認
    const publicProperties = propertiesWithNumber.filter(row => {
        const status = String(row['atbb成約済み/非公開'] || '').trim();
        return status.includes('公開中');
    });
    console.log(`\n✅ 公開中の物件: ${publicProperties.length}件`);
    if (publicProperties.length > 0) {
        console.log('\n最初の5件:');
        publicProperties.slice(0, 5).forEach(row => {
            const propertyNumber = String(row['物件番号'] || '').trim();
            const status = String(row['atbb成約済み/非公開'] || '').trim();
            const price = String(row['売買価格'] || '').trim();
            const address = String(row['所在地'] || '').trim();
            console.log(`  ${propertyNumber}: ${status} - ${price}万円 - ${address}`);
        });
    }
    // サンプル行の全カラムを表示
    if (publicProperties.length > 0) {
        console.log('\n🔍 サンプル物件の全カラム:');
        const sample = publicProperties[0];
        Object.entries(sample).forEach(([key, value]) => {
            if (value) {
                console.log(`  ${key}: ${String(value).substring(0, 50)}${String(value).length > 50 ? '...' : ''}`);
            }
        });
    }
    process.exit(0);
}
checkSpreadsheetData().catch(error => {
    console.error('❌ エラー:', error);
    process.exit(1);
});
