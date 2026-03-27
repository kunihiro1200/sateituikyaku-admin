/**
 * AA13863のupdateDataを確認するデバッグスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { ColumnMapper } from './src/services/ColumnMapper';

async function main() {
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();

  const allRows = await sheetsClient.readAll();
  const row = allRows.find((r: any) => r['売主番号'] === 'AA13863');
  if (!row) { console.log('AA13863が見つかりません'); return; }

  const columnMapper = new ColumnMapper();
  const mappedData = columnMapper.mapToDatabase(row);

  console.log('=== mappedData（全フィールド）===');
  for (const [key, value] of Object.entries(mappedData)) {
    if (value !== null && value !== undefined) {
      console.log(`  ${key}: ${JSON.stringify(value)} (type: ${typeof value})`);
    }
  }

  // boolean型の値を特に確認
  console.log('\n=== boolean型の値 ===');
  for (const [key, value] of Object.entries(mappedData)) {
    if (typeof value === 'boolean' || (typeof value === 'string' && (value === 'true' || value === 'false'))) {
      console.log(`  ${key}: ${JSON.stringify(value)}`);
    }
  }

  // 355.17が含まれるフィールドを確認
  console.log('\n=== 355.17が含まれるフィールド ===');
  for (const [key, value] of Object.entries(row)) {
    if (String(value).includes('355')) {
      console.log(`  スプシ[${JSON.stringify(key)}]: ${JSON.stringify(value)}`);
    }
  }
}

main().catch(console.error);
