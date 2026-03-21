/**
 * スプレッドシートのAO列（査定理由）の実際のヘッダー名を確認するスクリプト
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { GoogleSheetsClient } from './backend/src/services/GoogleSheetsClient';

async function main() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '';
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト';

  const client = new GoogleSheetsClient({
    spreadsheetId,
    sheetName,
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  });

  await client.authenticate();
  const rows = await client.readAll();

  if (rows.length === 0) {
    console.log('データなし');
    return;
  }

  // 最初の行のキー一覧を表示（ヘッダー確認）
  const firstRow = rows[0];
  const keys = Object.keys(firstRow);
  console.log('=== スプレッドシートのカラム一覧 ===');
  keys.forEach((key, i) => {
    // 査定関連のカラムを強調
    const isValuation = key.includes('査定');
    const marker = isValuation ? ' <<<' : '';
    console.log(`[${i}] "${key}"${marker}`);
  });

  // AA13814のデータを確認
  const aa13814 = rows.find((r: any) => r['売主番号'] === 'AA13814');
  if (aa13814) {
    console.log('\n=== AA13814の査定関連フィールド ===');
    keys.filter(k => k.includes('査定')).forEach(k => {
      console.log(`"${k}": "${aa13814[k]}"`);
    });
  } else {
    console.log('\nAA13814が見つかりません');
  }
}

main().catch(console.error);
