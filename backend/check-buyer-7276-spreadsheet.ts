import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkBuyer7276() {
  console.log('🔍 買主7276のスプレッドシートデータを確認...\n');

  // Google Sheets API認証
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートからデータを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:GZ`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ データが見つかりません');
    return;
  }

  const headers = rows[0];
  const buyerNumberIndex = headers.indexOf('買主番号');
  const viewingMobileIndex = headers.indexOf('内覧形態');
  const viewingTypeGeneralIndex = headers.indexOf('内覧形態_一般媒介');

  console.log(`📊 ヘッダー情報:`);
  console.log(`  買主番号: 列${buyerNumberIndex} (${String.fromCharCode(65 + buyerNumberIndex)}列)`);
  console.log(`  内覧形態: 列${viewingMobileIndex} (${String.fromCharCode(65 + viewingMobileIndex)}列)`);
  console.log(`  内覧形態_一般媒介: 列${viewingTypeGeneralIndex} (${String.fromCharCode(65 + viewingTypeGeneralIndex)}列)\n`);

  // 買主7276を検索
  const buyer7276Row = rows.find((row, index) => {
    if (index === 0) return false; // ヘッダー行をスキップ
    return row[buyerNumberIndex] === '7276';
  });

  if (!buyer7276Row) {
    console.log('❌ 買主7276が見つかりません');
    return;
  }

  const rowIndex = rows.indexOf(buyer7276Row) + 1;
  console.log(`✅ 買主7276が見つかりました（行${rowIndex}）\n`);

  console.log(`📋 買主7276のデータ:`);
  console.log(`  買主番号: ${buyer7276Row[buyerNumberIndex]}`);
  console.log(`  内覧形態: "${buyer7276Row[viewingMobileIndex] || ''}"`);
  console.log(`  内覧形態_一般媒介: "${buyer7276Row[viewingTypeGeneralIndex] || ''}"\n`);

  // 空文字チェック
  const viewingMobile = buyer7276Row[viewingMobileIndex];
  const viewingTypeGeneral = buyer7276Row[viewingTypeGeneralIndex];

  console.log(`🔍 詳細チェック:`);
  console.log(`  内覧形態:`);
  console.log(`    値: ${viewingMobile}`);
  console.log(`    型: ${typeof viewingMobile}`);
  console.log(`    空文字か: ${viewingMobile === ''}`);
  console.log(`    nullか: ${viewingMobile === null}`);
  console.log(`    undefinedか: ${viewingMobile === undefined}`);
  console.log(`    長さ: ${viewingMobile ? viewingMobile.length : 0}`);
  
  console.log(`\n  内覧形態_一般媒介:`);
  console.log(`    値: ${viewingTypeGeneral}`);
  console.log(`    型: ${typeof viewingTypeGeneral}`);
  console.log(`    空文字か: ${viewingTypeGeneral === ''}`);
  console.log(`    nullか: ${viewingTypeGeneral === null}`);
  console.log(`    undefinedか: ${viewingTypeGeneral === undefined}`);
  console.log(`    長さ: ${viewingTypeGeneral ? viewingTypeGeneral.length : 0}`);
}

checkBuyer7276().catch(console.error);
