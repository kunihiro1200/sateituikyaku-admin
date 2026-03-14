/**
 * 受付日のスプレッドシート上の実際の値を確認
 * UNFORMATTED_VALUE で取得して日付シリアル値かどうかを確認
 */
import { google } from 'googleapis';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '.env.local') });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function check() {
  const auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, 'google-service-account.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // ヘッダーとデータを1回のリクエストで取得（UNFORMATTED_VALUE）
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges: [`'${SHEET_NAME}'!1:1`, `'${SHEET_NAME}'!A2:GZ`],
    valueRenderOption: 'UNFORMATTED_VALUE',
  });

  const [headerRange, dataRange] = response.data.valueRanges || [];
  const headers = headerRange.values?.[0] || [];
  const rows = dataRange.values || [];

  const buyerNumberIdx = headers.indexOf('買主番号');
  const receptionDateIdx = headers.indexOf('受付日');
  const createdDatetimeIdx = headers.indexOf('作成日時');

  const buyerRow = rows.find(row => String(row[buyerNumberIdx]) === '4369');
  if (!buyerRow) {
    console.log('Buyer 4369 not found');
    return;
  }

  console.log('UNFORMATTED_VALUE:');
  console.log('受付日:', JSON.stringify(buyerRow[receptionDateIdx]));
  console.log('作成日時:', JSON.stringify(buyerRow[createdDatetimeIdx]));

  // Googleスプレッドシートの日付シリアル値を変換（1899/12/30起算）
  const serial = buyerRow[receptionDateIdx];
  if (typeof serial === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    console.log('受付日（シリアル値から変換）:', date.toISOString().substring(0, 10));
  }
}

check().catch(console.error);
