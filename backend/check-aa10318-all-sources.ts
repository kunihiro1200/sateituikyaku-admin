import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
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
const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAA10318AllSources() {
  console.log('🔍 AA10318の査定額を全ソースで確認中...\n');

  try {
    // 1. DBの値を確認
    console.log('📊 1. データベース（sellers テーブル）:');
    const { data: seller } = await supabase
      .from('sellers')
      .select('seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3, updated_at')
      .eq('seller_number', 'AA10318')
      .single();

    if (seller) {
      console.log(`  査定額1: ${seller.valuation_amount_1 ? (seller.valuation_amount_1 / 10000).toLocaleString() : 'null'}万円`);
      console.log(`  査定額2: ${seller.valuation_amount_2 ? (seller.valuation_amount_2 / 10000).toLocaleString() : 'null'}万円`);
      console.log(`  査定額3: ${seller.valuation_amount_3 ? (seller.valuation_amount_3 / 10000).toLocaleString() : 'null'}万円`);
      console.log(`  更新日時: ${seller.updated_at}`);
    }

    // 2. スプレッドシートの値を確認
    console.log('\n📋 2. スプレッドシート（売主リスト）:');
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '売主リスト!B:CZ',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    const sellerRow = rows.find(row => row[0] === 'AA10318');

    if (sellerRow) {
      const getColumnIndex = (columnName: string) => {
        return headers.findIndex(h => h === columnName);
      };

      const bc_index = getColumnIndex('査定額1（自動計算）v');
      const bd_index = getColumnIndex('査定額2（自動計算）v');
      const be_index = getColumnIndex('査定額3（自動計算）v');
      const cb_index = getColumnIndex('査定額1');
      const cc_index = getColumnIndex('査定額2');
      const cd_index = getColumnIndex('査定額3');

      console.log(`  BC列（査定額1 自動計算）: ${sellerRow[bc_index] || '空欄'}万円`);
      console.log(`  BD列（査定額2 自動計算）: ${sellerRow[bd_index] || '空欄'}万円`);
      console.log(`  BE列（査定額3 自動計算）: ${sellerRow[be_index] || '空欄'}万円`);
      console.log(`  CB列（査定額1 手動入力）: ${sellerRow[cb_index] || '空欄'}万円`);
      console.log(`  CC列（査定額2 手動入力）: ${sellerRow[cc_index] || '空欄'}万円`);
      console.log(`  CD列（査定額3 手動入力）: ${sellerRow[cd_index] || '空欄'}万円`);
    }

    // 3. SellerService APIの値を確認
    console.log('\n🔌 3. SellerService API（通話モードページで使用）:');
    console.log('  → ローカルサーバーが起動している場合のみ確認可能');
    console.log('  → http://localhost:3000/api/sellers/[seller_id] でAPIレスポンスを確認してください');

    console.log('\n📝 まとめ:');
    console.log('  1. DBの値を確認しました');
    console.log('  2. スプレッドシートの値を確認しました');
    console.log('  3. 通話モードページで表示される値は、SellerService APIから取得されます');
    console.log('     → ブラウザのDevTools（Network タブ）でAPIレスポンスを確認してください');

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

checkAA10318AllSources().catch(console.error);
