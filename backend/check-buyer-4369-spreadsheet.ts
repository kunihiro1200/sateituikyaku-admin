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

  // ヘッダー取得
  const headerResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!1:1`,
  });
  const headers = headerResponse.data.values?.[0] || [];

  // 受付日と買主番号の列インデックスを確認
  const buyerNumberIdx = headers.indexOf('買主番号');
  const receptionDateIdx = headers.indexOf('受付日');
  const createdDatetimeIdx = headers.indexOf('作成日時');

  console.log(`買主番号 column index: ${buyerNumberIdx}`);
  console.log(`受付日 column index: ${receptionDateIdx}`);
  console.log(`作成日時 column index: ${createdDatetimeIdx}`);

  // データ取得
  const dataResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A2:GZ`,
  });
  const rows = dataResponse.data.values || [];

  // 買主4369を探す
  const buyerRow = rows.find(row => String(row[buyerNumberIdx]) === '4369');
  if (!buyerRow) {
    console.log('Buyer 4369 not found in spreadsheet');
    return;
  }

  console.log('\nBuyer 4369 raw values:');
  console.log('受付日 raw:', JSON.stringify(buyerRow[receptionDateIdx]));
  console.log('作成日時 raw:', JSON.stringify(buyerRow[createdDatetimeIdx]));

  // valueRenderOption を NUMBER_UNFORMATTED で取得して実際の値を確認
  const dataResponse2 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A2:GZ`,
    valueRenderOption: 'UNFORMATTED_VALUE',
  });
  const rows2 = dataResponse2.data.values || [];
  const buyerRow2 = rows2.find(row => String(row[buyerNumberIdx]) === '4369');
  if (buyerRow2) {
    console.log('\nUNFORMATTED_VALUE:');
    console.log('受付日 unformatted:', JSON.stringify(buyerRow2[receptionDateIdx]));
    console.log('作成日時 unformatted:', JSON.stringify(buyerRow2[createdDatetimeIdx]));
  }

  // FORMULA で取得
  const dataResponse3 = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${SHEET_NAME}'!A2:GZ`,
    valueRenderOption: 'FORMULA',
  });
  const rows3 = dataResponse3.data.values || [];
  const buyerRow3 = rows3.find(row => String(row[buyerNumberIdx]) === '4369');
  if (buyerRow3) {
    console.log('\nFORMULA:');
    console.log('受付日 formula:', JSON.stringify(buyerRow3[receptionDateIdx]));
    console.log('作成日時 formula:', JSON.stringify(buyerRow3[createdDatetimeIdx]));
  }
}

check().catch(console.error);
