import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function main() {
  const sheetsConfig = {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };

  const client = new GoogleSheetsClient(sheetsConfig);
  await client.authenticate();
  const headers = await client.getHeaders();
  
  // Y列（25列目、0-indexed=24）のヘッダーを詳細確認
  const yHeader = headers[24];
  console.log('Y列ヘッダー:', yHeader);
  console.log('文字コード一覧:');
  for (let i = 0; i < yHeader.length; i++) {
    const code = yHeader.charCodeAt(i);
    console.log(`  [${i}] "${yHeader[i]}" = U+${code.toString(16).toUpperCase().padStart(4, '0')} (${code})`);
  }
  
  // コードで使っている文字列と比較
  const codeStr = '一番TEL';
  console.log('\nコード内の文字列 "一番TEL" の文字コード:');
  for (let i = 0; i < codeStr.length; i++) {
    const code = codeStr.charCodeAt(i);
    console.log(`  [${i}] "${codeStr[i]}" = U+${code.toString(16).toUpperCase().padStart(4, '0')} (${code})`);
  }
  
  console.log('\n一致確認:', yHeader === codeStr ? '✅ 一致' : '❌ 不一致');
  
  // 実際のデータ行を1件確認
  console.log('\n=== 実際のデータ確認（最初の5行のY列）===');
  const allRows = await client.readAll();
  let count = 0;
  for (const row of allRows) {
    if (count >= 5) break;
    const val = row[yHeader];
    if (val !== null && val !== undefined) {
      console.log(`行${count + 2}: "${val}"`);
      count++;
    }
  }
  if (count === 0) {
    console.log('Y列にデータがある行が見つかりませんでした');
    // 最初の5行を表示
    for (let i = 0; i < Math.min(5, allRows.length); i++) {
      console.log(`行${i + 2} Y列: ${JSON.stringify(allRows[i][yHeader])}`);
    }
  }
}

main().catch(console.error);
