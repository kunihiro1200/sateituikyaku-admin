"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// スプレッドシートから全物件データをproperty_listingsテーブルに同期するスクリプト
const dotenv_1 = __importDefault(require("dotenv"));
const PropertyListingSyncService_1 = require("../services/PropertyListingSyncService");
const GoogleSheetsClient_1 = require("../services/GoogleSheetsClient");
dotenv_1.default.config();
async function syncAllProperties() {
    console.log('🚀 Starting property sync from Google Sheets...\n');
    // GoogleSheetsClientを初期化
    const sheetsClient = new GoogleSheetsClient_1.GoogleSheetsClient({
        spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID,
        sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件',
        serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });
    // 認証
    await sheetsClient.authenticate();
    console.log('✅ Google Sheets authenticated\n');
    const syncService = new PropertyListingSyncService_1.PropertyListingSyncService(sheetsClient);
    try {
        console.log('📊 Step 1: Syncing new properties from spreadsheet...');
        const newPropertiesResult = await syncService.syncNewProperties();
        console.log(`✅ Added ${newPropertiesResult.added} new properties\n`);
        console.log('📊 Step 2: Syncing updates to existing properties...');
        const updatesResult = await syncService.syncUpdatedPropertyListings();
        console.log(`✅ Updated ${updatesResult.updated} properties`);
        console.log(`❌ Failed ${updatesResult.failed} properties\n`);
        console.log('\n🎉 Sync complete!');
        console.log(`📊 Total: ${newPropertiesResult.total} properties in spreadsheet`);
        console.log(`✅ Added: ${newPropertiesResult.added} new properties`);
        console.log(`✅ Updated: ${updatesResult.updated} existing properties`);
    }
    catch (error) {
        console.error('\n❌ Sync failed:', error.message);
        console.error('📋 Error details:', error);
        process.exit(1);
    }
    process.exit(0);
}
syncAllProperties();
