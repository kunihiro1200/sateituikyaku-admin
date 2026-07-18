"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// 物件シートからproperty_listingsテーブルへデータを同期するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const PropertyListingSyncService_1 = require("../services/PropertyListingSyncService");
const GoogleSheetsClient_1 = require("../services/GoogleSheetsClient");
dotenv_1.default.config();
async function syncPropertyListings() {
    console.log('🔄 物件シートからproperty_listingsテーブルへの同期を開始...\n');
    // GoogleSheetsClientを初期化（物件シートを使用）
    const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
        spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID,
        sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件',
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    // 認証
    await sheetsClient.authenticate();
    console.log('✅ Google Sheets認証成功');
    console.log(`📋 スプレッドシートID: ${process.env.PROPERTY_LISTING_SPREADSHEET_ID}`);
    console.log(`📋 シート名: ${process.env.PROPERTY_LISTING_SHEET_NAME || '物件'}\n`);
    // PropertyListingSyncServiceを初期化
    const syncService = new PropertyListingSyncService_1.PropertyListingSyncService(sheetsClient);
    // 同期実行
    const result = await syncService.syncUpdatedPropertyListings();
    console.log('\n📊 同期完了:');
    console.log(`  更新: ${result.updated}件`);
    console.log(`  失敗: ${result.failed}件`);
    console.log(`  所要時間: ${result.duration_ms}ms`);
    if (result.failed > 0 && result.errors) {
        console.log('\n❌ エラー詳細:');
        result.errors.slice(0, 10).forEach(err => {
            console.log(`  ${err.property_number}: ${err.error}`);
        });
        if (result.errors.length > 10) {
            console.log(`  ... 他 ${result.errors.length - 10}件のエラー`);
        }
    }
    process.exit(0);
}
syncPropertyListings().catch(error => {
    console.error('❌ 同期エラー:', error);
    process.exit(1);
});
