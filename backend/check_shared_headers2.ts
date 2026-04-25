/**
 * 共有シートの実際のヘッダーを確認するスクリプト
 * GOOGLE_SERVICE_ACCOUNT_JSON を直接設定して使用
 */
import * as fs from 'fs';
import * as path from 'path';

// .env.production.local を手動で読み込む
const envPath = path.join(__dirname, '.env.production.local');
const envContent = fs.readFileSync(envPath, 'utf-8');

// GOOGLE_SERVICE_ACCOUNT_JSON を抽出
const match = envContent.match(/GOOGLE_SERVICE_ACCOUNT_JSON="([\s\S]+?)"\s*\n/);
if (match) {
  let jsonStr = match[1];
  // エスケープを処理
  jsonStr = jsonStr.replace(/\\n/g, '\n').replace(/\\"/g, '"');
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = jsonStr;
  console.log('GOOGLE_SERVICE_ACCOUNT_JSON set, length:', jsonStr.length);
}

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function main() {
  const client = new GoogleSheetsClient({
    spreadsheetId: '1BuvYd9cKOdgIAy0XhL-voVx1tiGA-cd6MCU_dYvbAQE',
    sheetName: '共有',
    serviceAccountKeyPath: './google-service-account.json',
  });

  await client.authenticate();
  const headers = await client.getHeaders();
  
  console.log('\n=== 共有シートのヘッダー ===');
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
