"""
スプレッドシートのAO列（41列目、0-indexed=40）のヘッダー名を確認するスクリプト
"""
import subprocess
import json

# TypeScriptスクリプトを作成
ts_script = """
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function checkHeaders() {
  const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
  const SHEET_NAME = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';
  
  console.log('SPREADSHEET_ID:', SPREADSHEET_ID ? SPREADSHEET_ID.substring(0, 10) + '...' : 'NOT SET');
  console.log('SHEET_NAME:', SHEET_NAME);
  
  const client = new GoogleSheetsClient({
    spreadsheetId: SPREADSHEET_ID,
    sheetName: SHEET_NAME,
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  });
  
  await client.authenticate();
  const headers = await client.getHeaders();
  
  console.log('\\n=== 全ヘッダー一覧 ===');
  headers.forEach((h, i) => {
    const colLetter = String.fromCharCode(65 + (i % 26));
    const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : '';
    console.log(`${prefix}${colLetter}列(${i}): [${JSON.stringify(h)}]`);
  });
  
  // AO列は0-indexed=40
  console.log('\\n=== AO列（index=40）のヘッダー ===');
  console.log('AO列ヘッダー:', JSON.stringify(headers[40]));
  
  // 「査定理由」を含むヘッダーを検索
  console.log('\\n=== 「査定」を含むヘッダー ===');
  headers.forEach((h, i) => {
    if (h && h.includes('査定')) {
      const colLetter = String.fromCharCode(65 + (i % 26));
      const prefix = i >= 26 ? String.fromCharCode(65 + Math.floor(i / 26) - 1) : '';
      console.log(`${prefix}${colLetter}列(${i}): [${JSON.stringify(h)}]`);
    }
  });
  
  // AA13814のデータを確認
  console.log('\\n=== AA13814のデータ確認 ===');
  const rows = await client.readAll();
  const row13814 = rows.find(r => r['売主番号'] === 'AA13814');
  if (row13814) {
    console.log('AA13814 valuation_reason関連フィールド:');
    Object.entries(row13814).forEach(([k, v]) => {
      if (k.includes('査定')) {
        console.log(`  [${JSON.stringify(k)}]: ${JSON.stringify(v)}`);
      }
    });
  } else {
    console.log('AA13814が見つかりません');
  }
}

checkHeaders().catch(console.error);
"""

with open('backend/check_ao_header_temp.ts', 'w', encoding='utf-8') as f:
    f.write(ts_script)

print("check_ao_header_temp.ts を作成しました")
print("以下のコマンドで実行してください:")
print("cd backend && npx ts-node check_ao_header_temp.ts")
