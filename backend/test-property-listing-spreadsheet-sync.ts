/**
 * PropertyListingSpreadsheetSync のテストスクリプト
 * 
 * 使い方:
 * npx ts-node backend/test-property-listing-spreadsheet-sync.ts
 */

import dotenv from 'dotenv';
import { PropertyListingSpreadsheetSync } from './src/services/PropertyListingSpreadsheetSync';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { createClient } from '@supabase/supabase-js';

// 環境変数を読み込み
dotenv.config({ path: './backend/.env' });

async function testPropertyListingSpreadsheetSync() {
  console.log('🧪 PropertyListingSpreadsheetSync テスト開始\n');

  try {
    // Supabaseクライアントを初期化
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // GoogleSheetsClientを初期化
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.PROPERTY_LISTING_SPREADSHEET_ID!,
      sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
    });

    await sheetsClient.authenticate();
    console.log('✅ Google Sheets認証成功\n');

    // PropertyListingSpreadsheetSyncを初期化
    const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);

    // テスト1: findRowIndex()
    console.log('=== テスト1: findRowIndex() ===');
    const testPropertyNumber = 'BB1234'; // 実際に存在する物件番号に変更してください
    const rowIndex = await syncService.findRowIndex(testPropertyNumber);
    console.log(`物件番号 ${testPropertyNumber} の行インデックス: ${rowIndex}\n`);

    // テスト2: syncToSpreadsheet()（実際には実行しない、コメントアウト）
    // console.log('=== テスト2: syncToSpreadsheet() ===');
    // const result = await syncService.syncToSpreadsheet(testPropertyNumber);
    // console.log('同期結果:', result);

    console.log('✅ テスト完了');
  } catch (error: any) {
    console.error('❌ テスト失敗:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPropertyListingSpreadsheetSync();
