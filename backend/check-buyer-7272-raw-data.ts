import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkBuyer7272RawData() {
  console.log('🔍 買主番号7272のスプレッドシート生データを確認...\n');
  
  const sheetsConfig = {
    spreadsheetId: process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_BUYER_SHEET_NAME || '買主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };
  
  const sheetsClient = new GoogleSheetsClient(sheetsConfig);
  await sheetsClient.authenticate();
  
  const allRows = await sheetsClient.readAll();
  
  // 7272を検索
  const buyer7272 = allRows.find(row => String(row['買主番号']) === '7272');
  
  if (!buyer7272) {
    console.log('❌ 買主番号7272が見つかりませんでした');
    return;
  }
  
  console.log('✅ 買主番号7272が見つかりました\n');
  console.log('📋 全フィールド:');
  
  // 日付フィールドを特定
  const dateFields = ['受付日', '★次電日', '反響日付', '契約年月'];
  
  for (const [key, value] of Object.entries(buyer7272)) {
    const isDateField = dateFields.some(df => key.includes(df));
    const valueType = typeof value;
    const valueStr = value === null ? 'null' : value === undefined ? 'undefined' : String(value);
    
    if (isDateField) {
      console.log(`  🗓️  ${key}: ${valueStr} (型: ${valueType})`);
    } else {
      console.log(`  - ${key}: ${valueStr} (型: ${valueType})`);
    }
  }
  
  // 特に問題がありそうな日付フィールドを詳細表示
  console.log('\n🔍 日付フィールドの詳細:');
  for (const field of dateFields) {
    const value = buyer7272[field];
    console.log(`\n  ${field}:`);
    console.log(`    - 値: ${value}`);
    console.log(`    - 型: ${typeof value}`);
    console.log(`    - null?: ${value === null}`);
    console.log(`    - undefined?: ${value === undefined}`);
    console.log(`    - 空文字?: ${value === ''}`);
    if (value instanceof Date) {
      console.log(`    - Date型: はい`);
      console.log(`    - getTime(): ${value.getTime()}`);
      console.log(`    - toISOString(): ${value.toISOString()}`);
    }
  }
}

checkBuyer7272RawData().catch(console.error);
