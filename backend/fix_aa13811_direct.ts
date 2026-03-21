/**
 * AA13811の査定理由をスプレッドシートから直接DBに反映するスクリプト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function fixAA13811() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('=== AA13811 直接修正スクリプト ===\n');

  // 1. 現在のDBの状態を確認
  const { data: dbSeller, error: dbError } = await supabase
    .from('sellers')
    .select('seller_number, valuation_reason, valuation_method, status, next_call_date, unreachable_status, comments')
    .eq('seller_number', 'AA13811')
    .single();

  if (dbError) {
    console.error('DB取得エラー:', dbError.message);
    return;
  }

  console.log('=== 現在のDB状態 ===');
  console.log(JSON.stringify(dbSeller, null, 2));

  // 2. スプレッドシートからAA13811のデータを取得
  console.log('\n=== スプレッドシートからデータ取得中... ===');
  const client = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '',
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  });
  await client.authenticate();
  const rows = await client.readAll();
  const sheetRow = rows.find((r: any) => r['売主番号'] === 'AA13811');

  if (!sheetRow) {
    console.error('スプレッドシートにAA13811が見つかりません');
    return;
  }

  console.log('=== スプレッドシートのデータ ===');
  console.log('査定理由（査定サイトから転記）:', sheetRow['査定理由（査定サイトから転記）']);
  console.log('査定方法:', sheetRow['査定方法']);
  console.log('状況（当社）:', sheetRow['状況（当社）']);
  console.log('次電日:', sheetRow['次電日']);
  console.log('不通:', sheetRow['不通']);
  console.log('コメント:', sheetRow['コメント']);

  // 3. 更新データを構築
  const updateData: any = {};

  const sheetValuationReason = sheetRow['査定理由（査定サイトから転記）'] || '';
  const sheetValuationMethod = sheetRow['査定方法'] || '';

  if (sheetValuationReason) {
    updateData.valuation_reason = sheetValuationReason;
  }
  if (sheetValuationMethod) {
    updateData.valuation_method = sheetValuationMethod;
  }

  console.log('\n=== 更新するデータ ===');
  console.log(JSON.stringify(updateData, null, 2));

  if (Object.keys(updateData).length === 0) {
    console.log('更新するデータがありません');
    return;
  }

  // 4. DBを直接更新
  const { error: updateError } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('seller_number', 'AA13811');

  if (updateError) {
    console.error('更新エラー:', updateError.message);
    return;
  }

  console.log('\n✅ AA13811を更新しました');

  // 5. 更新後の確認
  const { data: updatedSeller } = await supabase
    .from('sellers')
    .select('seller_number, valuation_reason, valuation_method')
    .eq('seller_number', 'AA13811')
    .single();

  console.log('\n=== 更新後のDB状態 ===');
  console.log(JSON.stringify(updatedSeller, null, 2));
}

fixAA13811().catch(console.error);
