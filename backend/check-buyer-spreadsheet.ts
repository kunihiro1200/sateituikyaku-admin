// 買主スプレッドシートで7271と7272を確認
import { config } from 'dotenv';
import { resolve } from 'path';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

config({ path: resolve(__dirname, '.env') });

async function checkBuyersInSpreadsheet() {
  console.log('🔍 買主スプレッドシートで7271と7272を確認中...\n');

  const buyerSpreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim();
  if (!buyerSpreadsheetId) {
    console.error('❌ GOOGLE_SHEETS_BUYER_SPREADSHEET_ID が設定されていません');
    return;
  }

  const sheetsConfig = {
    spreadsheetId: buyerSpreadsheetId,
    sheetName: '買主リスト',
    serviceAccountKeyPath: './google-service-account.json',
  };

  const sheetsClient = new GoogleSheetsClient(sheetsConfig);
  await sheetsClient.authenticate();

  const allRows = await sheetsClient.readAll();
  console.log(`📊 スプレッドシート行数: ${allRows.length}\n`);

  // 最初の行のカラム名を表示
  if (allRows.length > 0) {
    console.log('📋 スプレッドシートのカラム名:');
    console.log(Object.keys(allRows[0]).slice(0, 10).join(', '), '...\n');
  }

  const buyer7271 = allRows.find(row => String(row['買主番号']) === '7271');
  const buyer7272 = allRows.find(row => String(row['買主番号']) === '7272');

  if (buyer7271) {
    console.log('✅ 買主番号7271がスプレッドシートに存在します');
    console.log('   全データ:', JSON.stringify(buyer7271, null, 2).substring(0, 500));
    console.log('---\n');
  } else {
    console.log('❌ 買主番号7271がスプレッドシートに存在しません\n');
  }

  if (buyer7272) {
    console.log('✅ 買主番号7272がスプレッドシートに存在します');
    console.log('   全データ:', JSON.stringify(buyer7272, null, 2).substring(0, 500));
    console.log('---\n');
  } else {
    console.log('❌ 買主番号7272がスプレッドシートに存在しません\n');
  }

  console.log(`\n📊 結果:`);
  console.log(`7271: ${buyer7271 ? '✅ スプレッドシートに存在' : '❌ スプレッドシートに存在しない'}`);
  console.log(`7272: ${buyer7272 ? '✅ スプレッドシートに存在' : '❌ スプレッドシートに存在しない'}`);
}

checkBuyersInSpreadsheet();
