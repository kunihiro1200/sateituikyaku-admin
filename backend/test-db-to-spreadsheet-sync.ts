import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { SpreadsheetSyncService } from './src/services/SpreadsheetSyncService';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDbToSpreadsheetSync() {
  console.log('🔄 AA10318のDB→スプシ同期をテスト中...\n');

  try {
    // 1. DBの現在の値を確認
    const { data: seller } = await supabase
      .from('sellers')
      .select('id, seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3')
      .eq('seller_number', 'AA10318')
      .single();

    if (!seller) {
      console.log('❌ AA10318がDBに見つかりません');
      return;
    }

    console.log('📊 DBの現在の値:');
    console.log(`  売主ID: ${seller.id}`);
    console.log(`  査定額1: ${seller.valuation_amount_1 ? (seller.valuation_amount_1 / 10000).toLocaleString() : 'null'}万円`);
    console.log(`  査定額2: ${seller.valuation_amount_2 ? (seller.valuation_amount_2 / 10000).toLocaleString() : 'null'}万円`);
    console.log(`  査定額3: ${seller.valuation_amount_3 ? (seller.valuation_amount_3 / 10000).toLocaleString() : 'null'}万円`);

    // 2. SpreadsheetSyncServiceを初期化
    const sheetsClient = new GoogleSheetsClient({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
      serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!,
    });

    await sheetsClient.authenticate();
    const syncService = new SpreadsheetSyncService(sheetsClient, supabase);

    // 3. 同期を実行
    console.log('\n🔄 SpreadsheetSyncService.syncToSpreadsheet() を実行中...');
    const result = await syncService.syncToSpreadsheet(seller.id);

    console.log('\n📊 同期結果:');
    console.log(`  成功: ${result.success}`);
    console.log(`  操作: ${result.operation || 'N/A'}`);
    console.log(`  影響行数: ${result.rowsAffected}`);
    if (result.error) {
      console.log(`  エラー: ${result.error}`);
    }

    // 4. スプレッドシートの値を確認
    console.log('\n📋 スプレッドシートの値を確認中...');
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
      range: '売主リスト!B:CZ',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    const sellerRow = rows.find(row => row[0] === 'AA10318');

    if (!sellerRow) {
      console.log('❌ AA10318がスプレッドシートに見つかりません');
      return;
    }

    const getColumnIndex = (columnName: string) => {
      return headers.findIndex(h => h === columnName);
    };

    const bc_index = getColumnIndex('査定額1（自動計算）v');
    const bd_index = getColumnIndex('査定額2（自動計算）v');
    const be_index = getColumnIndex('査定額3（自動計算）v');

    console.log('📋 スプレッドシートの同期後の値:');
    console.log(`  BC列（査定額1 自動計算）: ${sellerRow[bc_index] || '空欄'}万円`);
    console.log(`  BD列（査定額2 自動計算）: ${sellerRow[bd_index] || '空欄'}万円`);
    console.log(`  BE列（査定額3 自動計算）: ${sellerRow[be_index] || '空欄'}万円`);

    console.log('\n✅ テスト完了！');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testDbToSpreadsheetSync().catch(console.error);
