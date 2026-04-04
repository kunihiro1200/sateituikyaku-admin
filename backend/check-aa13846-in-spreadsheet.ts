import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: 'backend/.env' });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SERVICE_ACCOUNT_KEY_PATH = path.resolve(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!);

async function checkAA13846InSpreadsheet() {
  console.log('🔍 スプレッドシートでAA13846を確認中...\n');

  // Google Sheets API認証
  const auth = new google.auth.GoogleAuth({
    keyFile: SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートからデータを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: '売主リスト!A:GZ',
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ データが見つかりません');
    return;
  }

  const headers = rows[0];
  const sellerNumberIndex = headers.indexOf('売主番号');

  if (sellerNumberIndex === -1) {
    console.log('❌ 売主番号カラムが見つかりません');
    return;
  }

  // AA13846を検索
  const aa13846Rows = rows.filter((row, index) => {
    if (index === 0) return false; // ヘッダー行をスキップ
    return row[sellerNumberIndex] === 'AA13846';
  });

  if (aa13846Rows.length === 0) {
    console.log('❌ AA13846が見つかりません');
    return;
  }

  console.log(`✅ AA13846を${aa13846Rows.length}件見つけました\n`);

  // 各行のデータ長をチェック
  for (let i = 0; i < aa13846Rows.length; i++) {
    const row = aa13846Rows[i];
    console.log(`\n--- AA13846 (${i + 1}/${aa13846Rows.length}) ---`);

    const longFields: { field: string; length: number; value: string }[] = [];

    for (let j = 0; j < row.length; j++) {
      const value = row[j];
      if (typeof value === 'string' && value.length > 100) {
        longFields.push({
          field: headers[j] || `列${j}`,
          length: value.length,
          value: value.substring(0, 150) + (value.length > 150 ? '...' : ''),
        });
      }
    }

    if (longFields.length === 0) {
      console.log('✅ 100文字を超えるフィールドはありません');
      continue;
    }

    console.log('🚨 100文字を超えるフィールド:\n');
    for (const field of longFields) {
      console.log(`📊 ${field.field}:`);
      console.log(`   長さ: ${field.length}文字`);
      console.log(`   値: ${field.value}\n`);
    }
  }
}

checkAA13846InSpreadsheet().catch(console.error);
