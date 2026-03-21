/**
 * AA13814 の物件住所・状況（売主）を強制同期するスクリプト
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';

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

async function forceSyncAA13814PropertyStatus() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📊 スプレッドシートからAA13814のデータを取得中...');

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

  // AA13814の行を検索（B列 = index 0）
  let targetRow: any[] | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'AA13814') {
      targetRow = rows[i];
      console.log(`✅ AA13814 を ${i + 1} 行目で発見`);
      break;
    }
  }

  if (!targetRow) {
    console.error('❌ AA13814 がスプレッドシートに見つかりませんでした');
    return;
  }

  // ヘッダーとデータをマッピング
  const rowData: Record<string, any> = {};
  for (let i = 0; i < headers.length; i++) {
    rowData[headers[i]] = targetRow[i] || '';
  }

  console.log('\n📋 スプレッドシートのデータ:');
  console.log('  売主番号:', rowData['売主番号']);
  console.log('  物件所在地:', rowData['物件所在地']);
  console.log('  状況（売主）:', rowData['状況（売主）']);
  console.log('  状況（当社）:', rowData['状況（当社）']);

  const updateData: Record<string, any> = {};

  // 物件住所
  const propertyAddress = rowData['物件所在地'];
  if (propertyAddress && propertyAddress.trim() !== '') {
    updateData.property_address = propertyAddress.trim();
    console.log('\n✅ 物件住所を更新します:', propertyAddress.trim());
  } else {
    console.log('\n⚠️  物件住所がスプレッドシートに入力されていません');
  }

  // 状況（売主）
  const currentStatus = rowData['状況（売主）'];
  if (currentStatus && currentStatus.trim() !== '') {
    updateData.current_status = currentStatus.trim();
    console.log('✅ 状況（売主）を更新します:', currentStatus.trim());
  } else {
    console.log('⚠️  状況（売主）がスプレッドシートに入力されていません');
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
    .eq('seller_number', 'AA13814');

  if (error) {
    console.error('❌ 更新エラー:', error.message);
    return;
  }

  // 確認
  const { data, error: fetchError } = await supabase
    .from('sellers')
    .select('seller_number, property_address, current_status, status')
    .eq('seller_number', 'AA13814')
    .single();

  if (fetchError) {
    console.error('❌ 確認エラー:', fetchError.message);
    return;
  }

  console.log('\n✅ 更新完了:');
  console.log('  property_address:', data?.property_address);
  console.log('  current_status:', data?.current_status);
  console.log('  status（当社）:', data?.status);
}

forceSyncAA13814PropertyStatus().catch(console.error);
