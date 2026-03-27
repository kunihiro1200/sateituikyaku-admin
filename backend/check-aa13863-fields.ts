/**
 * AA13863のスプシデータを確認するスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function main() {
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();

  const allRows = await sheetsClient.readAll();
  const row = allRows.find((r: any) => r['売主番号'] === 'AA13863');

  if (!row) {
    console.log('AA13863が見つかりません');
    return;
  }

  console.log('=== AA13863の全フィールド ===');
  for (const [key, value] of Object.entries(row)) {
    if (value !== undefined && value !== null && value !== '') {
      console.log(`${JSON.stringify(key)}: ${JSON.stringify(value)}`);
    }
  }

  // 不通カラムを特に確認
  console.log('\n=== 不通カラム ===');
  console.log('不通:', JSON.stringify(row['不通']));
  console.log('訪問日 Y/M/D:', JSON.stringify(row['訪問日 Y/M/D']));
}

main().catch(console.error);
