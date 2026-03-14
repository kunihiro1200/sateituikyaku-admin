// スタッフスプシの内容を確認するスクリプト（StaffManagementServiceと同じ方法）
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

  // readAllで全行取得
  const rows = await client.readAll();
  console.log('Total rows:', rows.length);

  if (rows.length > 0) {
    console.log('\nAll keys in first row:', Object.keys(rows[0]));
    console.log('\nFirst 5 rows:');
    rows.slice(0, 5).forEach((row, i) => {
      console.log(`Row ${i + 1}:`, JSON.stringify(row));
    });
  }
}

main().catch(console.error);
