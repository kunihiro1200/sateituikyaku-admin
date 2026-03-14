// スタッフスプシのヘッダーを確認するスクリプト
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function main() {
  const client = new GoogleSheetsClient({
    spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
    sheetName: 'スタッフ',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  });

  await client.authenticate();
  const headers = await client.getHeaders();
  console.log('Headers:', headers);
  console.log('H列 (index 7):', headers[7]);

  // 最初の3行も確認
  const rows = await client.readAll();
  console.log('\nFirst 3 rows:');
  rows.slice(0, 3).forEach((row, i) => {
    console.log(`Row ${i + 1}:`, JSON.stringify(row));
  });
}

main().catch(console.error);
