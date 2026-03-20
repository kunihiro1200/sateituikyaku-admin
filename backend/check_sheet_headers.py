"""
スプレッドシートのヘッダー行（1行目）を確認するスクリプト
Y列（25列目）付近のヘッダー名を確認する
"""
import subprocess
import json

# TypeScriptスクリプトを作成して実行
ts_script = """
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env') });

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
  
  console.log('=== 全ヘッダー一覧 ===');
  headers.forEach((h, i) => {
    const col = String.fromCharCode(65 + (i % 26));
    const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : '';
    console.log(`${i + 1}列目 (${prefix}${col}): "${h}"`);
  });
  
  console.log('\\n=== Y列付近（20-30列目）===');
  for (let i = 19; i < Math.min(30, headers.length); i++) {
    const col = String.fromCharCode(65 + (i % 26));
    const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : '';
    console.log(`${i + 1}列目 (${prefix}${col}): "${headers[i]}"`);
  }
  
  // 「一番TEL」「1番電話」「TEL」を含むヘッダーを検索
  console.log('\\n=== 「TEL」「電話」を含むヘッダー ===');
  headers.forEach((h, i) => {
    if (h && (h.includes('TEL') || h.includes('電話') || h.includes('tel'))) {
      const col = String.fromCharCode(65 + (i % 26));
      const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : '';
      console.log(`${i + 1}列目 (${prefix}${col}): "${h}"`);
    }
  });
}

main().catch(console.error);
"""

with open('backend/check_headers.ts', 'w', encoding='utf-8') as f:
    f.write(ts_script)

print("check_headers.ts を作成しました")
print("実行コマンド: cd backend && npx ts-node check_headers.ts")
