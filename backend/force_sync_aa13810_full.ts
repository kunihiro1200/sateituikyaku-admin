/**
 * AA13810 の氏名・物件住所・査定額・査定方法・状況（売主）を強制同期するスクリプト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import { encrypt } from './src/utils/encryption';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
const SHEET_NAME = '売主リスト';

async function getSheetsClient() {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || '';
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  const str = String(value).replace(/,/g, '').trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

async function forceSyncAA13810Full() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📊 スプレッドシートからAA13810のデータを取得中...');

  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B:CZ`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    console.error('❌ スプレッドシートのデータが取得できませんでした');
    return;
  }

  const headers = rows[0];
  console.log(`📋 ヘッダー行: ${headers.length}列`);

  // AA13810の行を検索（B列 = index 0）
  let targetRow: any[] | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'AA13810') {
      targetRow = rows[i];
      console.log(`✅ AA13810 を ${i + 1} 行目で発見`);
      break;
    }
  }

  if (!targetRow) {
    console.error('❌ AA13810 がスプレッドシートに見つかりませんでした');
    return;
  }

  // ヘッダーとデータをマッピング
  const rowData: Record<string, any> = {};
  for (let i = 0; i < headers.length; i++) {
    rowData[headers[i]] = targetRow[i] || '';
  }

  console.log('\n📋 スプレッドシートのデータ:');
  console.log('  売主番号:', rowData['売主番号']);
  console.log('  名前:', rowData['名前(漢字のみ）']);
  console.log('  物件所在地:', rowData['物件所在地']);
  console.log('  状況（売主）:', rowData['状況（売主）']);
  console.log('  状況（当社）:', rowData['状況（当社）']);
  console.log('  査定方法:', rowData['査定方法']);
  console.log('  査定額1（手動）:', rowData['査定額1']);
  console.log('  査定額2（手動）:', rowData['査定額2']);
  console.log('  査定額3（手動）:', rowData['査定額3']);
  console.log('  査定額1（自動）:', rowData['査定額1（自動計算）v']);
  console.log('  査定額2（自動）:', rowData['査定額2（自動計算）v']);
  console.log('  査定額3（自動）:', rowData['査定額3（自動計算）v']);

  const updateData: Record<string, any> = {};

  // 氏名（暗号化）
  const name = rowData['名前(漢字のみ）'];
  if (name && name.trim() !== '') {
    updateData.name = encrypt(name.trim());
    console.log('\n✅ 氏名を暗号化して更新します');
  }

  // 物件住所
  const propertyAddress = rowData['物件所在地'];
  if (propertyAddress && propertyAddress.trim() !== '') {
    updateData.property_address = propertyAddress.trim();
    console.log('✅ 物件住所を更新します:', propertyAddress.trim());
  }

  // 状況（売主）
  const currentStatus = rowData['状況（売主）'];
  if (currentStatus && currentStatus.trim() !== '') {
    updateData.current_status = currentStatus.trim();
    console.log('✅ 状況（売主）を更新します:', currentStatus.trim());
  }

  // 査定方法
  const valuationMethod = rowData['査定方法'];
  if (valuationMethod && valuationMethod.trim() !== '') {
    updateData.valuation_method = valuationMethod.trim();
    console.log('✅ 査定方法を更新します:', valuationMethod.trim());
  }

  // 査定額（手動入力優先、なければ自動計算）
  const val1Raw = rowData['査定額1'] || rowData['査定額1（自動計算）v'];
  const val2Raw = rowData['査定額2'] || rowData['査定額2（自動計算）v'];
  const val3Raw = rowData['査定額3'] || rowData['査定額3（自動計算）v'];

  const val1 = parseNumeric(val1Raw);
  const val2 = parseNumeric(val2Raw);
  const val3 = parseNumeric(val3Raw);

  if (val1 !== null) {
    updateData.valuation_amount_1 = val1 * 10000;
    console.log(`✅ 査定額1: ${val1}万円 → ${val1 * 10000}円`);
  }
  if (val2 !== null) {
    updateData.valuation_amount_2 = val2 * 10000;
    console.log(`✅ 査定額2: ${val2}万円 → ${val2 * 10000}円`);
  }
  if (val3 !== null) {
    updateData.valuation_amount_3 = val3 * 10000;
    console.log(`✅ 査定額3: ${val3}万円 → ${val3 * 10000}円`);
  }

  updateData.updated_at = new Date().toISOString();

  if (Object.keys(updateData).length <= 1) {
    console.log('\n⚠️  更新するデータがありません');
    return;
  }

  console.log('\n🔄 DBを更新中...');
  const { error } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('seller_number', 'AA13810');

  if (error) {
    console.error('❌ 更新エラー:', error.message);
    return;
  }

  // 確認
  const { data, error: fetchError } = await supabase
    .from('sellers')
    .select('seller_number, name, property_address, current_status, valuation_method, valuation_amount_1, valuation_amount_2, valuation_amount_3')
    .eq('seller_number', 'AA13810')
    .single();

  if (fetchError) {
    console.error('❌ 確認エラー:', fetchError.message);
    return;
  }

  console.log('\n✅ 更新完了:');
  console.log('  name (暗号化済):', data?.name ? '設定済み' : 'null');
  console.log('  property_address:', data?.property_address);
  console.log('  current_status:', data?.current_status);
  console.log('  valuation_method:', data?.valuation_method);
  console.log('  valuation_amount_1:', data?.valuation_amount_1);
  console.log('  valuation_amount_2:', data?.valuation_amount_2);
  console.log('  valuation_amount_3:', data?.valuation_amount_3);
}

forceSyncAA13810Full().catch(console.error);
