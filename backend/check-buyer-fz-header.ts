// スプシの買主リストのFZ列付近のヘッダーを確認するスクリプト
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
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  });

  const headers = response.data.values?.[0] || [];
  console.log(`Total headers: ${headers.length}`);

  // FZ列のインデックスを計算（FZ = 26*6 + 26 = 182列目、0-indexed: 181）
  // F=6, Z=26 → FZ = (6-1)*26 + 26 = 156 (1-indexed)
  // 実際: A=1, Z=26, AA=27, AZ=52, BA=53, BZ=78, CA=79, CZ=104, DA=105, DZ=130, EA=131, EZ=156, FA=157, FZ=182
  const fzIndex = 181; // 0-indexed

  // FZ列付近（175〜185）のヘッダーを表示
  console.log('\nHeaders around FZ column (index 175-185):');
  for (let i = 175; i <= Math.min(185, headers.length - 1); i++) {
    const colName = getColumnName(i + 1);
    console.log(`  [${i}] ${colName}: "${headers[i]}"`);
  }

  // 「業者向けアンケート」を検索
  console.log('\nSearching for 業者向けアンケート:');
  headers.forEach((h: string, i: number) => {
    if (h && h.includes('業者向け')) {
      const colName = getColumnName(i + 1);
      console.log(`  Found at index ${i} (${colName}): "${h}"`);
    }
  });

  // 7092の行データのFZ列を確認
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A:GZ`,
  });
  const rows = dataResponse.data.values || [];
  const buyerRow = rows.find((row: any[]) => row[1] === '7092');
  if (buyerRow) {
    console.log(`\n7092 FZ value (index ${fzIndex}): "${buyerRow[fzIndex]}"`);
    // 業者向けアンケートのヘッダーインデックスで値を確認
    const vendorIdx = headers.findIndex((h: string) => h && h.includes('業者向け'));
    if (vendorIdx >= 0) {
      console.log(`7092 vendor_survey value (index ${vendorIdx}): "${buyerRow[vendorIdx]}"`);
    }
  } else {
    console.log('\n7092 not found in spreadsheet');
  }
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
