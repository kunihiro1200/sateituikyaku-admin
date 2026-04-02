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

async function testAA2Sync() {
  console.log('🔍 AA2の同期テスト\n');

  try {
    // 修正前のDB値を確認
    console.log('📊 修正前のDB値:');
    const { data: beforeSeller } = await supabase
      .from('sellers')
      .select('seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3')
      .eq('seller_number', 'AA2')
      .single();

    if (beforeSeller) {
      console.log(`  査定額1: ${beforeSeller.valuation_amount_1 ? beforeSeller.valuation_amount_1 / 10000 : 'null'}万円`);
      console.log(`  査定額2: ${beforeSeller.valuation_amount_2 ? beforeSeller.valuation_amount_2 / 10000 : 'null'}万円`);
      console.log(`  査定額3: ${beforeSeller.valuation_amount_3 ? beforeSeller.valuation_amount_3 / 10000 : 'null'}万円`);
    }

    // スプレッドシートから値を取得
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
    const sellerRow = rows.find(row => row[0] === 'AA2');

    if (!sellerRow) {
      console.log('\n❌ AA2がスプレッドシートに見つかりません');
      return;
    }

    const getColumnIndex = (columnName: string) => {
      return headers.findIndex(h => h === columnName);
    };

    const bc_index = getColumnIndex('査定額1（自動計算）v');
    const bd_index = getColumnIndex('査定額2（自動計算）v');
    const be_index = getColumnIndex('査定額3（自動計算）v');
    const cb_index = getColumnIndex('査定額1');
    const cc_index = getColumnIndex('査定額2');
    const cd_index = getColumnIndex('査定額3');

    console.log('\n📋 スプレッドシートの値:');
    console.log(`  BC列（自動計算）: ${sellerRow[bc_index] || '空欄'}万円`);
    console.log(`  BD列（自動計算）: ${sellerRow[bd_index] || '空欄'}万円`);
    console.log(`  BE列（自動計算）: ${sellerRow[be_index] || '空欄'}万円`);
    console.log(`  CB列（手動入力）: ${sellerRow[cb_index] || '空欄'}万円`);
    console.log(`  CC列（手動入力）: ${sellerRow[cc_index] || '空欄'}万円`);
    console.log(`  CD列（手動入力）: ${sellerRow[cd_index] || '空欄'}万円`);

    // 優先順位ロジック: 手動入力優先、なければ自動計算
    const valuation1 = sellerRow[cb_index] || sellerRow[bc_index];
    const valuation2 = sellerRow[cc_index] || sellerRow[bd_index];
    const valuation3 = sellerRow[cd_index] || sellerRow[be_index];

    console.log('\n📊 同期する値（優先順位適用後）:');
    console.log(`  査定額1: ${valuation1 || '空欄'}万円 ← ${sellerRow[cb_index] ? 'CB列（手動）' : 'BC列（自動）'}`);
    console.log(`  査定額2: ${valuation2 || '空欄'}万円 ← ${sellerRow[cc_index] ? 'CC列（手動）' : 'BD列（自動）'}`);
    console.log(`  査定額3: ${valuation3 || '空欄'}万円 ← ${sellerRow[cd_index] ? 'CD列（手動）' : 'BE列（自動）'}`);

    // 万円→円に変換
    const val1 = valuation1 ? parseFloat(valuation1) * 10000 : null;
    const val2 = valuation2 ? parseFloat(valuation2) * 10000 : null;
    const val3 = valuation3 ? parseFloat(valuation3) * 10000 : null;

    // DBを更新
    const { error } = await supabase
      .from('sellers')
      .update({
        valuation_amount_1: val1,
        valuation_amount_2: val2,
        valuation_amount_3: val3,
      })
      .eq('seller_number', 'AA2');

    if (error) {
      console.error('\n❌ DB更新エラー:', error);
      return;
    }

    console.log('\n✅ DBを更新しました');

    // 更新後の値を確認
    const { data: afterSeller } = await supabase
      .from('sellers')
      .select('seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3')
      .eq('seller_number', 'AA2')
      .single();

    if (afterSeller) {
      console.log('\n📊 更新後のDB値:');
      console.log(`  査定額1: ${afterSeller.valuation_amount_1 ? afterSeller.valuation_amount_1 / 10000 : 'null'}万円`);
      console.log(`  査定額2: ${afterSeller.valuation_amount_2 ? afterSeller.valuation_amount_2 / 10000 : 'null'}万円`);
      console.log(`  査定額3: ${afterSeller.valuation_amount_3 ? afterSeller.valuation_amount_3 / 10000 : 'null'}万円`);

      // 検証
      console.log('\n✅ 検証結果:');
      const expectedVal1 = sellerRow[bc_index] ? parseFloat(sellerRow[bc_index]) * 10000 : null;
      if (afterSeller.valuation_amount_1 === expectedVal1) {
        console.log('  ✅ 査定額1: BC列（自動計算）から正しく同期されました');
      } else {
        console.log('  ❌ 査定額1: 同期に失敗しました');
      }
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

testAA2Sync().catch(console.error);
