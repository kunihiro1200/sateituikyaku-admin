import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 環境変数を読み込む
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '.env.local'),
  path.join(__dirname, '.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;

async function findDifferentValuationSeller() {
  console.log('🔍 BC/BD/BE列とCB/CC/CD列の値が異なる売主を検索中...\n');

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '売主リスト!B:CZ',
    });

    const rows = response.data.values || [];
    const headers = rows[0];
    
    const getColumnIndex = (columnName: string) => {
      return headers.findIndex(h => h === columnName);
    };

    const bc_index = getColumnIndex('査定額1（自動計算）v');
    const bd_index = getColumnIndex('査定額2（自動計算）v');
    const be_index = getColumnIndex('査定額3（自動計算）v');
    const cb_index = getColumnIndex('査定額1');
    const cc_index = getColumnIndex('査定額2');
    const cd_index = getColumnIndex('査定額3');

    console.log(`列インデックス:`);
    console.log(`  BC（査定額1 自動計算）: ${bc_index}`);
    console.log(`  BD（査定額2 自動計算）: ${bd_index}`);
    console.log(`  BE（査定額3 自動計算）: ${be_index}`);
    console.log(`  CB（査定額1 手動入力）: ${cb_index}`);
    console.log(`  CC（査定額2 手動入力）: ${cc_index}`);
    console.log(`  CD（査定額3 手動入力）: ${cd_index}\n`);

    let foundCount = 0;
    const maxResults = 5;

    for (let i = 1; i < rows.length && foundCount < maxResults; i++) {
      const row = rows[i];
      const sellerNumber = row[0];
      
      if (!sellerNumber) continue;

      const bc_val = row[bc_index];
      const bd_val = row[bd_index];
      const be_val = row[be_index];
      const cb_val = row[cb_index];
      const cc_val = row[cc_index];
      const cd_val = row[cd_index];

      // BC/BD/BE列に値があり、CB/CC/CD列が空欄または異なる値の売主を検索
      const hasBCValues = bc_val || bd_val || be_val;
      const hasCBValues = cb_val || cc_val || cd_val;
      
      if (hasBCValues && !hasCBValues) {
        console.log(`✅ ${sellerNumber}:`);
        console.log(`  BC/BD/BE列（自動計算）: ${bc_val || '空欄'}, ${bd_val || '空欄'}, ${be_val || '空欄'}`);
        console.log(`  CB/CC/CD列（手動入力）: ${cb_val || '空欄'}, ${cc_val || '空欄'}, ${cd_val || '空欄'}`);
        console.log('');
        foundCount++;
      } else if (hasBCValues && hasCBValues && (bc_val !== cb_val || bd_val !== cc_val || be_val !== cd_val)) {
        console.log(`✅ ${sellerNumber}:`);
        console.log(`  BC/BD/BE列（自動計算）: ${bc_val || '空欄'}, ${bd_val || '空欄'}, ${be_val || '空欄'}`);
        console.log(`  CB/CC/CD列（手動入力）: ${cb_val || '空欄'}, ${cc_val || '空欄'}, ${cd_val || '空欄'}`);
        console.log('');
        foundCount++;
      }
    }

    if (foundCount === 0) {
      console.log('❌ BC/BD/BE列とCB/CC/CD列の値が異なる売主が見つかりませんでした');
    } else {
      console.log(`\n📊 合計 ${foundCount} 件の売主が見つかりました`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

findDifferentValuationSeller().catch(console.error);
