/**
 * スプシの訪問日カラム名を確認するスクリプト
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
  if (allRows.length === 0) {
    console.log('データなし');
    return;
  }

  // 最初の行のキー一覧を表示（訪問関連のみ）
  const firstRow = allRows[0];
  const keys = Object.keys(firstRow);
  console.log('=== 訪問関連カラム名 ===');
  keys.filter(k => k.includes('訪問')).forEach(k => {
    console.log(JSON.stringify(k)); // エスケープ文字も見える形で表示
  });

  console.log('\n=== AA13863の訪問日フィールド ===');
  const aa13863 = allRows.find((r: any) => r['売主番号'] === 'AA13863');
  if (aa13863) {
    keys.filter(k => k.includes('訪問')).forEach(k => {
      console.log(`${JSON.stringify(k)}: ${JSON.stringify(aa13863[k])}`);
    });
  } else {
    console.log('AA13863が見つかりません');
  }

  // AA13000以降で訪問日っぽいカラムに値がある件数を確認
  console.log('\n=== AA13000以降の訪問日カラム別件数 ===');
  const visitKeys = keys.filter(k => k.includes('訪問日'));
  for (const vk of visitKeys) {
    const count = allRows.filter((r: any) => {
      const num = parseInt(String(r['売主番号'] || '').replace('AA', ''), 10);
      return num >= 13000 && r[vk] && String(r[vk]).trim() !== '';
    }).length;
    console.log(`${JSON.stringify(vk)}: ${count}件`);
  }
}

main().catch(console.error);
