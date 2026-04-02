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

async function findLandOrHouseSeller() {
  console.log('🔍 土地または戸建ての売主を検索中（landAreaがnullでない）...\n');

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

    const sellerNumberIndex = 0; // B列
    const propertyTypeIndex = getColumnIndex('種別');
    const landAreaIndex = getColumnIndex('土（㎡）');
    const bc_index = getColumnIndex('査定額1（自動計算）v');
    const bd_index = getColumnIndex('査定額2（自動計算）v');
    const be_index = getColumnIndex('査定額3（自動計算）v');

    console.log(`列インデックス:`);
    console.log(`  種別: ${propertyTypeIndex}`);
    console.log(`  土（㎡）: ${landAreaIndex}`);
    console.log(`  BC（査定額1 自動計算）: ${bc_index}`);
    console.log(`  BD（査定額2 自動計算）: ${bd_index}`);
    console.log(`  BE（査定額3 自動計算）: ${be_index}\n`);

    let foundCount = 0;
    const maxResults = 10;

    for (let i = 1; i < rows.length && foundCount < maxResults; i++) {
      const row = rows[i];
      const sellerNumber = row[sellerNumberIndex];
      
      if (!sellerNumber) continue;

      const propertyType = row[propertyTypeIndex];
      const landArea = row[landAreaIndex];
      const bc_val = row[bc_index];
      const bd_val = row[bd_index];
      const be_val = row[be_index];

      // 土地または戸建てで、landAreaがあり、査定額がある売主
      if ((propertyType === '土' || propertyType === '戸') && 
          landArea && 
          (bc_val || bd_val || be_val)) {
        console.log(`✅ ${sellerNumber}:`);
        console.log(`  種別: ${propertyType}`);
        console.log(`  土地面積: ${landArea}㎡`);
        console.log(`  査定額1/2/3: ${bc_val || '空欄'}, ${bd_val || '空欄'}, ${be_val || '空欄'}`);
        console.log('');
        foundCount++;
      }
    }

    if (foundCount === 0) {
      console.log('❌ 条件に合う売主が見つかりませんでした');
    } else {
      console.log(`\n📊 合計 ${foundCount} 件の売主が見つかりました`);
    }

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

findLandOrHouseSeller().catch(console.error);
