// BB14のスプレッドシート同期をテストするスクリプト
import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { PropertyListingSpreadsheetSync } from './src/services/PropertyListingSpreadsheetSync';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const propertySpreadsheetId = process.env.PROPERTY_LISTING_SPREADSHEET_ID!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testBB14Sync() {
  console.log('🔍 BB14のスプレッドシート同期をテスト中...\n');

  // 環境変数を確認
  console.log('📊 環境変数:');
  console.log('  PROPERTY_LISTING_SPREADSHEET_ID:', propertySpreadsheetId ? '設定済み' : '未設定');
  console.log('  PROPERTY_LISTING_SHEET_NAME:', process.env.PROPERTY_LISTING_SHEET_NAME || '物件（デフォルト）');
  console.log('  GOOGLE_SERVICE_ACCOUNT_KEY_PATH:', process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH ? '設定済み' : '未設定');
  console.log('');

  if (!propertySpreadsheetId) {
    console.error('❌ PROPERTY_LISTING_SPREADSHEET_ID が設定されていません');
    return;
  }

  // GoogleSheetsClientを初期化
  console.log('📝 GoogleSheetsClientを初期化中...');
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: propertySpreadsheetId,
    sheetName: process.env.PROPERTY_LISTING_SHEET_NAME || '物件',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  });

  try {
    await sheetsClient.authenticate();
    console.log('✅ Google Sheets認証成功\n');
  } catch (error: any) {
    console.error('❌ Google Sheets認証失敗:', error.message);
    return;
  }

  // PropertyListingSpreadsheetSyncを初期化
  const syncService = new PropertyListingSpreadsheetSync(sheetsClient, supabase);

  // BB14の行番号を検索
  console.log('🔍 BB14の行番号を検索中...');
  try {
    const rowIndex = await syncService.findRowIndex('BB14');
    if (rowIndex) {
      console.log(`✅ BB14が見つかりました: 行番号 ${rowIndex}\n`);
    } else {
      console.log('❌ BB14が見つかりません\n');
      return;
    }

    // 現在のDQ列の値を読み取る
    console.log('📖 現在のDQ列の値を読み取り中...');
    const range = `DQ${rowIndex}`;
    const currentValue = await sheetsClient.readRawRange(range);
    console.log(`  現在の値: "${currentValue[0]?.[0] || '（空欄）'}"\n`);

    // 「未」に更新
    console.log('📝 DQ列を「未」に更新中...');
    await syncService.syncConfirmationToSpreadsheet('BB14', '未');
    console.log('✅ 更新完了\n');

    // 更新後の値を確認
    console.log('📖 更新後のDQ列の値を確認中...');
    const updatedValue = await sheetsClient.readRawRange(range);
    console.log(`  更新後の値: "${updatedValue[0]?.[0] || '（空欄）'}"\n`);

    if (updatedValue[0]?.[0] === '未') {
      console.log('✅ スプレッドシート同期成功！');
    } else {
      console.log('❌ スプレッドシート同期失敗（値が「未」になっていません）');
    }
  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    console.error('スタックトレース:', error.stack);
  }
}

testBB14Sync().catch(console.error);
