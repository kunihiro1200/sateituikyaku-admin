// 買主番号7272がスプレッドシートに存在するか確認
import { google } from 'googleapis';
import * as path from 'path';

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkBuyer7272() {
  console.log('=== 買主番号7272のスプレッドシート確認 ===\n');

  // Google Sheets API認証
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートから全データを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:E`, // A-E列（買主番号を含む）
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ データが見つかりません');
    return;
  }

  const headers = rows[0];
  console.log('📋 ヘッダー:', headers);
  console.log('');

  // 買主番号列のインデックスを取得
  const buyerNumberIndex = headers.findIndex((h: string) => 
    h && h.trim() === '買主番号'
  );

  if (buyerNumberIndex === -1) {
    console.log('❌ 買主番号列が見つかりません');
    return;
  }

  console.log(`✅ 買主番号列: ${buyerNumberIndex}列目 (${String.fromCharCode(65 + buyerNumberIndex)}列)`);
  console.log('');

  // 7272を含む行を検索
  const matches: any[] = [];
  for (let i = 1; i < rows.length; i++) {
    const buyerNumber = rows[i][buyerNumberIndex];
    if (buyerNumber && String(buyerNumber).includes('7272')) {
      matches.push({
        row: i + 1,
        buyerNumber: buyerNumber,
        rawValue: buyerNumber,
        type: typeof buyerNumber,
      });
    }
  }

  if (matches.length === 0) {
    console.log('❌ 7272を含む買主番号が見つかりません');
    console.log('');
    console.log('📊 スプレッドシート全体の買主番号サンプル（最初の10件）:');
    for (let i = 1; i <= Math.min(10, rows.length - 1); i++) {
      const buyerNumber = rows[i][buyerNumberIndex];
      console.log(`  行${i + 1}: "${buyerNumber}" (型: ${typeof buyerNumber})`);
    }
  } else {
    console.log(`✅ 7272を含む買主番号が見つかりました: ${matches.length}件`);
    console.log('');
    matches.forEach((m) => {
      console.log(`  行${m.row}: "${m.buyerNumber}" (型: ${m.type})`);
    });
  }
}

checkBuyer7272().catch(console.error);
