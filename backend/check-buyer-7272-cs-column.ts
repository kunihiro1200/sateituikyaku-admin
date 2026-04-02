import { config } from 'dotenv';
config({ path: './backend/.env' });

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function checkCS() {
  console.log('🔍 買主番号7272のCS列（【問合メール】電話対応）を確認...\n');
  
  const client = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
    sheetName: '買主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    privateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  });
  
  await client.authenticate();
  
  const spreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!;
  
  // ヘッダー行を取得
  const headerRange = await client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '買主リスト!1:1',
  });
  const headers = headerRange.data.values?.[0] || [];
  
  // CS列のインデックスを探す（CS = 96列目、0-indexed = 95）
  const csIndex = headers.findIndex((h: string) => h && h.includes('【問合メール】電話対応'));
  console.log(`CS列インデックス: ${csIndex}`);
  console.log(`ヘッダー名: "${headers[csIndex]}"\n`);
  
  // 全データを取得（CT列まで拡大）
  const allDataRange = await client.sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '買主リスト!A:CT',
  });
  const allData = allDataRange.data.values || [];
  
  console.log(`総行数: ${allData.length}\n`);
  
  // 買主番号7272の行を探す（E列 = index 4）
  const buyerNumberIndex = 4; // E列
  
  const row7272 = allData.find((row: any[]) => String(row[buyerNumberIndex]) === '7272');
  
  if (!row7272) {
    console.log('❌ 買主番号7272が見つかりません');
    return;
  }
  
  const csValue = row7272[csIndex];
  console.log(`✅ 買主番号7272のCS列の値: "${csValue}"`);
  console.log(`   型: ${typeof csValue}`);
  console.log(`   条件判定: csValue === '未' → ${csValue === '未'}`);
}

checkCS().catch(console.error);
