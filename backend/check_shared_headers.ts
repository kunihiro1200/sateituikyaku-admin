/**
 * 共有シートの実際のヘッダーを確認するスクリプト
 * .env.production.local の GOOGLE_SERVICE_ACCOUNT_JSON を使用
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env.production.local を読み込む
dotenv.config({ path: path.join(__dirname, '.env.production.local') });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function main() {
  const client = new GoogleSheetsClient({
    spreadsheetId: '1BuvYd9cKOdgIAy0XhL-voVx1tiGA-cd6MCU_dYvbAQE',
    sheetName: '共有',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });

  await client.authenticate();
  const headers = await client.getHeaders();
  
  console.log('=== 共有シートのヘッダー ===');
  headers.forEach((h, i) => {
    let col: string;
    if (i < 26) {
      col = String.fromCharCode(65 + i);
    } else {
      col = String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
    }
    console.log(`${col}列 (index ${i}): "${h}"`);
  });
  console.log(`\n合計 ${headers.length} 列`);
}

main().catch(console.error);
