import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 環境変数を読み込む
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

async function forceSyncAA10318() {
  console.log('🔄 AA10318を強制同期中...\n');

  try {
    // Google Sheets APIクライアントを初期化
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // スプレッドシートからAA10318の行を取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '売主リスト!B:CZ',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    
    // AA10318の行を検索
    const sellerRow = rows.find(row => row[0] === 'AA10318');
    
    if (!sellerRow) {
      console.log('❌ AA10318がスプレッドシートに見つかりません');
      return;
    }

    // 列インデックスを取得
    const getColumnIndex = (columnName: string) => {
      return headers.findIndex(h => h === columnName);
    };

    // BC/BD/BE列（自動計算）のインデックス
    const bc_index = getColumnIndex('査定額1（自動計算）v');
    const bd_index = getColumnIndex('査定額2（自動計算）v');
    const be_index = getColumnIndex('査定額3（自動計算）v');

    // CB/CC/CD列（手動入力）のインデックス
    const cb_index = getColumnIndex('査定額1');
    const cc_index = getColumnIndex('査定額2');
    const cd_index = getColumnIndex('査定額3');

    console.log('📋 スプレッドシートの値:');
    console.log(`  BC列（査定額1 自動計算）: ${sellerRow[bc_index] || '空欄'}`);
    console.log(`  BD列（査定額2 自動計算）: ${sellerRow[bd_index] || '空欄'}`);
    console.log(`  BE列（査定額3 自動計算）: ${sellerRow[be_index] || '空欄'}`);
    console.log(`  CB列（査定額1 手動入力）: ${sellerRow[cb_index] || '空欄'}`);
    console.log(`  CC列（査定額2 手動入力）: ${sellerRow[cc_index] || '空欄'}`);
    console.log(`  CD列（査定額3 手動入力）: ${sellerRow[cd_index] || '空欄'}`);

    // 優先順位ロジック: 手動入力優先、なければ自動計算
    const valuation1 = sellerRow[cb_index] || sellerRow[bc_index];
    const valuation2 = sellerRow[cc_index] || sellerRow[bd_index];
    const valuation3 = sellerRow[cd_index] || sellerRow[be_index];

    console.log('\n📊 同期する値（優先順位適用後）:');
    console.log(`  査定額1: ${valuation1 || '空欄'}万円`);
    console.log(`  査定額2: ${valuation2 || '空欄'}万円`);
    console.log(`  査定額3: ${valuation3 || '空欄'}万円`);

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
      .eq('seller_number', 'AA10318');

    if (error) {
      console.error('\n❌ DB更新エラー:', error);
      return;
    }

    console.log('\n✅ DBを更新しました');

    // 更新後の値を確認
    const { data: seller } = await supabase
      .from('sellers')
      .select('seller_number, valuation_amount_1, valuation_amount_2, valuation_amount_3')
      .eq('seller_number', 'AA10318')
      .single();

    if (seller) {
      console.log('\n📊 更新後のDBの査定額（万円単位）:');
      console.log(`  査定額1: ${seller.valuation_amount_1 ? seller.valuation_amount_1 / 10000 : 'null'}万円`);
      console.log(`  査定額2: ${seller.valuation_amount_2 ? seller.valuation_amount_2 / 10000 : 'null'}万円`);
      console.log(`  査定額3: ${seller.valuation_amount_3 ? seller.valuation_amount_3 / 10000 : 'null'}万円`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

forceSyncAA10318().catch(console.error);
