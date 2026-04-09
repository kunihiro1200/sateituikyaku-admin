/**
 * AA13888のスプレッドシート行データを確認
 */
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';

async function check() {
  console.log('🔍 AA13888のスプレッドシート行データを確認\n');

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

  console.log('📊 ヘッダー情報:');
  console.log(`  売主番号の列: ${sellerNumberIndex} (${headers[sellerNumberIndex]})`);
  console.log(`  状況（当社）の列: ${statusIndex} (${headers[statusIndex]})`);
  console.log('');

  if (statusIndex === -1) {
    console.log('❌ 「状況（当社）」列が見つかりません！');
    console.log('');
    console.log('📋 利用可能なヘッダー（状況を含むもの）:');
    headers.forEach((header, index) => {
      if (header.includes('状況')) {
        console.log(`  [${index}] ${header}`);
      }
    });
    return;
  }

  // AA13888の行を検索
  const aa13888RowIndex = dataRows.findIndex(row => row[sellerNumberIndex] === 'AA13888');

  if (aa13888RowIndex === -1) {
    console.log('❌ AA13888がスプレッドシートに見つかりません');
    return;
  }

  const aa13888Row = dataRows[aa13888RowIndex];
  const spreadsheetStatus = aa13888Row[statusIndex];

  console.log('📄 AA13888のデータ:');
  console.log(`  行番号: ${aa13888RowIndex + 2} (ヘッダー含む)`);
  console.log(`  売主番号: ${aa13888Row[sellerNumberIndex]}`);
  console.log(`  状況（当社）[列${statusIndex}]: "${spreadsheetStatus}"`);
  console.log(`  状況（当社）の型: ${typeof spreadsheetStatus}`);
  console.log(`  状況（当社）が空か: ${!spreadsheetStatus}`);
  console.log('');

  // rowオブジェクトを作成（EnhancedAutoSyncServiceと同じ方法）
  const rowObject: any = {};
  headers.forEach((header, index) => {
    rowObject[header] = aa13888Row[index];
  });

  console.log('🔧 rowオブジェクトの「状況（当社）」:');
  console.log(`  rowObject['状況（当社）']: "${rowObject['状況（当社）']}"`);
  console.log(`  型: ${typeof rowObject['状況（当社）']}`);
  console.log(`  空か: ${!rowObject['状況（当社）']}`);
  console.log('');

  // カラムマッピングを確認
  const columnMapping = require('./src/config/column-mapping.json');
  const dbColumn = columnMapping.spreadsheetToDatabase['状況（当社）'];
  console.log('📋 カラムマッピング:');
  console.log(`  スプレッドシート列: "状況（当社）"`);
  console.log(`  データベース列: "${dbColumn}"`);
  console.log('');

  // mappedDataをシミュレート
  const mappedStatus = rowObject['状況（当社）'] || '追客中';
  console.log('🎯 同期処理の結果（シミュレーション）:');
  console.log(`  mappedData.status || '追客中': "${mappedStatus}"`);
  console.log('');

  if (spreadsheetStatus !== mappedStatus) {
    console.log('❌ 問題発見！');
    console.log(`  スプレッドシートの値: "${spreadsheetStatus}"`);
    console.log(`  同期される値: "${mappedStatus}"`);
  } else {
    console.log('✅ 正しく同期されるはずです');
  }
}

check().catch(console.error);
