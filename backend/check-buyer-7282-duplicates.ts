import { google } from 'googleapis';
import * as path from 'path';
import * as dotenv from 'dotenv';

// 環境変数を読み込む
dotenv.config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkBuyer7282Duplicates() {
  console.log('🔍 買主7282の重複チェック開始...\n');

  // Google Sheets API認証
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートからデータ取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:Z`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ データが見つかりません');
    return;
  }

  const headers = rows[0];
  const buyerNumberIndex = headers.indexOf('買主番号');

  if (buyerNumberIndex === -1) {
    console.log('❌ 「買主番号」列が見つかりません');
    return;
  }

  // 買主7282を検索
  const buyer7282Rows: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const buyerNumber = rows[i][buyerNumberIndex];
    if (buyerNumber === '7282') {
      buyer7282Rows.push(i + 1); // 行番号（1-indexed）
    }
  }

  console.log(`📊 買主7282の出現回数: ${buyer7282Rows.length}件`);
  console.log(`📍 行番号: ${buyer7282Rows.join(', ')}\n`);

  if (buyer7282Rows.length > 1) {
    console.log('🚨 重複が検出されました！');
    console.log('   これが count=2 の原因です。\n');

    // 各行の詳細を表示
    for (const rowNum of buyer7282Rows) {
      const row = rows[rowNum - 1];
      console.log(`--- 行${rowNum} ---`);
      console.log(`  買主番号: ${row[buyerNumberIndex]}`);
      console.log(`  内覧日: ${row[headers.indexOf('●内覧日(最新）')]}`);
      console.log(`  業者問合せ: ${row[headers.indexOf('業者問合せ')]}`);
      console.log(`  通知送信者: ${row[headers.indexOf('通知送信者')]}`);
      console.log('');
    }
  } else if (buyer7282Rows.length === 1) {
    console.log('✅ 重複なし（1件のみ）');
    console.log('   count=2の原因は別にあります。');
  } else {
    console.log('❌ 買主7282が見つかりません');
  }
}

checkBuyer7282Duplicates().catch(console.error);
