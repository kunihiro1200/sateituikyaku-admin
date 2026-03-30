// 買主番号7260のスプレッドシート値確認スクリプト
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const SPREADSHEET_ID = process.env.BUYER_SPREADSHEET_ID!;
const SHEET_NAME = '買主リスト';

async function checkBuyer7260Spreadsheet() {
  console.log('=== 買主番号7260のスプレッドシート値確認 ===\n');

  try {
    // Google Sheets API認証
    const keyPath = path.resolve(process.cwd(), process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!);
    const auth = new google.auth.GoogleAuth({
      keyFile: keyPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 1. ヘッダー行を取得
    console.log('1. ヘッダー行を取得中...');
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    });

    const headers = headerResponse.data.values?.[0] || [];
    console.log(`✅ ヘッダー行を取得しました（${headers.length}列）\n`);

    // 2. 買主番号7260の行を検索
    console.log('2. 買主番号7260の行を検索中...');