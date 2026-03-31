import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const SHEET_NAME = '売主リスト';

async function debugApiResponse() {
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // ヘッダー行を取得
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!1:1`,
  });

  const headers = headerResponse.data.values?.[0] || [];
  console.log('ヘッダー行の取得結果:');
  console.log('V列のヘッダー:', headers[21]); // V列はindex 21
  console.log('');

  // AA13175の行を取得（複数の範囲指定方法でテスト）
  console.log('=== AA13175の行を取得（複数の方法でテスト） ===\n');

  // 方法1: 全列を取得
  const allColumnsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!B:V`,
  });

  const allRows = allColumnsResponse.data.values || [];
  const aa13175Index = allRows.findIndex(row => row[0] === 'AA13175');
  
  if (aa13175Index !== -1) {
    const row = allRows[aa13175Index];
    console.log('方法1: B:V範囲で取得');
    console.log('  行番号:', aa13175Index + 1);
    console.log('  行の長さ:', row.length);
    console.log('  V列 (index 20):', JSON.stringify(row[20]));
    console.log('  V列の型:', typeof row[20]);
    console.log('  V列 === undefined:', row[20] === undefined);
    console.log('  V列 === null:', row[20] === null);
    console.log('  V列 === "":', row[20] === '');
    console.log('');
  }

  // 方法2: GoogleSheetsClientと同じ方法（A:CZ）
  const wideRangeResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:CZ`,
  });

  const wideRows = wideRangeResponse.data.values || [];
  const aa13175WideIndex = wideRows.findIndex(row => row[1] === 'AA13175'); // B列はindex 1
  
  if (aa13175WideIndex !== -1) {
    const row = wideRows[aa13175WideIndex];
    console.log('方法2: A:CZ範囲で取得（GoogleSheetsClientと同じ）');
    console.log('  行番号:', aa13175WideIndex + 1);
    console.log('  行の長さ:', row.length);
    console.log('  V列 (index 21):', JSON.stringify(row[21])); // A列から始まるのでindex 21
    console.log('  V列の型:', typeof row[21]);
    console.log('  V列 === undefined:', row[21] === undefined);
    console.log('  V列 === null:', row[21] === null);
    console.log('  V列 === "":', row[21] === '');
    console.log('');
  }

  // 方法3: GoogleSheetsClient.readAll()をシミュレート
  console.log('方法3: GoogleSheetsClient.readAll()をシミュレート');
  const readAllResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}`,
  });

  const readAllRows = readAllResponse.data.values || [];
  const readAllHeaders = readAllRows[0] || [];
  const aa13175ReadAllIndex = readAllRows.findIndex(row => row[1] === 'AA13175');
  
  if (aa13175ReadAllIndex !== -1) {
    const row = readAllRows[aa13175ReadAllIndex];
    
    // ヘッダーとデータをマッピング
    const mappedRow: Record<string, any> = {};
    for (let i = 0; i < readAllHeaders.length; i++) {
      mappedRow[readAllHeaders[i]] = row[i];
    }
    
    console.log('  行番号:', aa13175ReadAllIndex + 1);
    console.log('  行の長さ:', row.length);
    console.log('  mappedRow["名前(漢字のみ）"]:', JSON.stringify(mappedRow['名前(漢字のみ）']));
    console.log('  型:', typeof mappedRow['名前(漢字のみ）']);
    console.log('  === undefined:', mappedRow['名前(漢字のみ）'] === undefined);
    console.log('  === null:', mappedRow['名前(漢字のみ）'] === null);
    console.log('  === "":', mappedRow['名前(漢字のみ）'] === '');
  }
}

debugApiResponse().catch(console.error);
