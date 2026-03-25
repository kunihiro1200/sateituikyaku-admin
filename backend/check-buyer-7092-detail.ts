// 7092の行を正確に特定してvendor_surveyの値を確認するスクリプト
import { google } from 'googleapis';
import * as path from 'path';

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function main() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.resolve('C:\\Users\\kunih\\sateituikyaku-admin\\backend\\google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // ヘッダー行を取得
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  });
  const headers = headerResponse.data.values?.[0] || [];

  // 4517行目を直接取得（ヘッダーが1行目なのでデータは2行目から）
  const rowResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!4517:4517`,
  });
  const row4517 = rowResponse.data.values?.[0] || [];
  
  console.log('Row 4517 first 5 values:', row4517.slice(0, 5));
  console.log('Row 4517 length:', row4517.length);

  // 買主番号カラムのインデックスを確認
  const buyerNumIdx = headers.findIndex((h: string) => h === '買主番号');
  console.log(`\n買主番号 column index: ${buyerNumIdx}`);
  console.log(`Row 4517 buyer_number: "${row4517[buyerNumIdx]}"`);

  // FZ列（インデックス181）の値
  const vendorIdx = headers.findIndex((h: string) => h === '業者向けアンケート');
  console.log(`\n業者向けアンケート column index: ${vendorIdx}`);
  console.log(`Row 4517 vendor_survey: "${row4517[vendorIdx]}"`);

  // 全列を検索して7092を探す
  console.log('\nSearching for 7092 in all columns of row 4517:');
  row4517.forEach((val: any, i: number) => {
    if (String(val) === '7092') {
      console.log(`  Found at index ${i} (${getColumnName(i+1)}): "${val}"`);
    }
  });

  // データ範囲を絞って7092を検索（B列のみ）
  const bColResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!B:B`,
  });
  const bCol = bColResponse.data.values || [];
  const rowIdx = bCol.findIndex((r: any[]) => String(r[0]) === '7092');
  console.log(`\n7092 found at B column row index: ${rowIdx} (row ${rowIdx + 1})`);
}

function getColumnName(n: number): string {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

main().catch(console.error);
