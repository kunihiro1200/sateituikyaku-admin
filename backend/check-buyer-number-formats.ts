// 買主番号の形式を確認（BBプレフィックスあり/なし）
import { google } from 'googleapis';
import * as path from 'path';

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkBuyerNumberFormats() {
  console.log('=== 買主番号の形式確認 ===\n');

  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートから買主番号列のみを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!E:E`, // E列（買主番号）
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ データが見つかりません');
    return;
  }

  console.log(`📊 総行数: ${rows.length - 1}件（ヘッダー除く）\n`);

  // 形式別にカウント
  let withBB = 0;
  let withoutBB = 0;
  let empty = 0;
  const samples: any = { withBB: [], withoutBB: [] };

  for (let i = 1; i < rows.length; i++) {
    const buyerNumber = rows[i][0];
    
    if (!buyerNumber || String(buyerNumber).trim() === '') {
      empty++;
      continue;
    }

    const str = String(buyerNumber).trim();
    
    if (str.match(/^BB\d+$/)) {
      withBB++;
      if (samples.withBB.length < 5) {
        samples.withBB.push({ row: i + 1, value: str });
      }
    } else if (str.match(/^\d+$/)) {
      withoutBB++;
      if (samples.withoutBB.length < 5) {
        samples.withoutBB.push({ row: i + 1, value: str });
      }
    }
  }

  console.log('📊 買主番号の形式分布:');
  console.log(`  BBプレフィックスあり: ${withBB}件`);
  console.log(`  BBプレフィックスなし: ${withoutBB}件`);
  console.log(`  空欄: ${empty}件`);
  console.log('');

  if (samples.withBB.length > 0) {
    console.log('✅ BBプレフィックスありのサンプル:');
    samples.withBB.forEach((s: any) => {
      console.log(`  行${s.row}: "${s.value}"`);
    });
    console.log('');
  }

  if (samples.withoutBB.length > 0) {
    console.log('⚠️ BBプレフィックスなしのサンプル:');
    samples.withoutBB.forEach((s: any) => {
      console.log(`  行${s.row}: "${s.value}"`);
    });
    console.log('');
  }

  // 7271と7272を検索
  console.log('🔍 7271と7272の検索:');
  for (let i = 1; i < rows.length; i++) {
    const buyerNumber = rows[i][0];
    if (buyerNumber && (String(buyerNumber).includes('7271') || String(buyerNumber).includes('7272'))) {
      console.log(`  行${i + 1}: "${buyerNumber}"`);
    }
  }
}

checkBuyerNumberFormats().catch(console.error);
