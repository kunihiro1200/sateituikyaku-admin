/**
 * AA13888の「状況（当社）」フィールドをスプレッドシートとDBで比較
 */
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';

async function check() {
  console.log('🔍 AA13888の「状況（当社）」フィールドをチェック\n');

  // Google Sheets認証
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートからデータ取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:ZZ`,
  });

  const rows = response.data.values || [];
  if (rows.length === 0) {
    console.log('❌ スプレッドシートにデータがありません');
    return;
  }

  const headers = rows[0];
  const dataRows = rows.slice(1);

  // 売主番号と状況（当社）の列インデックスを取得
  const sellerNumberIndex = headers.indexOf('売主番号');
  const statusIndex = headers.indexOf('状況（当社）');

  console.log('📊 スプレッドシートの列情報:');
  console.log(`  売主番号の列: ${sellerNumberIndex} (${headers[sellerNumberIndex]})`);
  console.log(`  状況（当社）の列: ${statusIndex} (${headers[statusIndex]})`);
  console.log('');

  // AA13888の行を検索
  const aa13888Row = dataRows.find(row => row[sellerNumberIndex] === 'AA13888');

  if (!aa13888Row) {
    console.log('❌ AA13888がスプレッドシートに見つかりません');
    return;
  }

  const spreadsheetStatus = aa13888Row[statusIndex] || '(空)';
  console.log('📄 スプレッドシートの値:');
  console.log(`  状況（当社）: "${spreadsheetStatus}"`);
  console.log('');

  // データベースから取得
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, status, updated_at')
    .eq('seller_number', 'AA13888')
    .is('deleted_at', null)
    .single();

  if (error || !seller) {
    console.log('❌ データベースにAA13888が見つかりません');
    return;
  }

  const dbStatus = seller.status || '(空)';
  console.log('💾 データベースの値:');
  console.log(`  状況（当社）: "${dbStatus}"`);
  console.log(`  更新日時: ${seller.updated_at}`);
  console.log('');

  // 比較
  if (spreadsheetStatus === dbStatus) {
    console.log('✅ 一致しています');
  } else {
    console.log('❌ 不一致です！');
    console.log('');
    console.log('📋 詳細:');
    console.log(`  スプレッドシート: "${spreadsheetStatus}"`);
    console.log(`  データベース: "${dbStatus}"`);
    console.log('');
    console.log('💡 考えられる原因:');
    console.log('  1. スプレッドシートからDBへの同期が実行されていない');
    console.log('  2. 同期処理でエラーが発生している');
    console.log('  3. カラムマッピングが正しく設定されていない');
    console.log('  4. 手動でDBを更新した後、スプレッドシートが更新されていない');
  }
}

check().catch(console.error);
