/**
 * AA6 のコメントをスプレッドシートから強制同期するスクリプト
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

async function forceSyncAA6Comments() {
  const TARGET = 'AA6';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`📊 スプレッドシートから${TARGET}のデータを取得中...`);

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

  // 対象行を検索（B列 = index 0）
  let targetRow: any[] | null = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === TARGET) {
      targetRow = rows[i];
      console.log(`✅ ${TARGET} を ${i + 1} 行目で発見`);
      break;
    }
  }

  if (!targetRow) {
    console.error(`❌ ${TARGET} がスプレッドシートに見つかりませんでした`);
    return;
  }

  // ヘッダーとデータをマッピング
  const rowData: Record<string, any> = {};
  for (let i = 0; i < headers.length; i++) {
    rowData[headers[i]] = targetRow[i] !== undefined ? targetRow[i] : '';
  }

  console.log('\n📋 スプレッドシートのデータ:');
  console.log('  コメント（先頭200文字）:', String(rowData['コメント'] || '').substring(0, 200));
  console.log('  不通:', rowData['不通']);

  const updateData: Record<string, any> = {};

  // コメント
  const comments = rowData['コメント'];
  if (comments !== undefined && comments !== null && String(comments).trim() !== '') {
    updateData.comments = String(comments).trim();
    console.log('\n✅ コメントを更新します');
  } else {
    console.log('\nℹ️  コメントは空欄です');
  }

  // 不通ステータス
  const unreachableStatus = rowData['不通'];
  if (unreachableStatus !== undefined && unreachableStatus !== null) {
    updateData.unreachable_status = String(unreachableStatus).trim() || null;
    console.log('✅ 不通ステータスを更新します:', updateData.unreachable_status ?? 'null');
  }

  if (Object.keys(updateData).length === 0) {
    console.log('\nℹ️  更新するデータがありません');
    return;
  }

  updateData.updated_at = new Date().toISOString();

  console.log('\n🔄 DBを更新中...');
  const { error } = await supabase
    .from('sellers')
    .update(updateData)
    .eq('seller_number', TARGET);

  if (error) {
    console.error('❌ 更新エラー:', error.message);
    return;
  }

  // 確認
  const { data, error: fetchError } = await supabase
    .from('sellers')
    .select('seller_number, comments, unreachable_status')
    .eq('seller_number', TARGET)
    .single();

  if (fetchError) {
    console.error('❌ 確認エラー:', fetchError.message);
    return;
  }

  console.log('\n✅ 更新完了:');
  console.log('  comments (先頭200文字):', data?.comments?.substring(0, 200));
  console.log('  unreachable_status:', data?.unreachable_status);
}

forceSyncAA6Comments().catch(console.error);
