import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

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

async function findFixedAssetTaxColumn() {
  console.log('🔍 固定資産税路線価のカラムを検索中...\n');

  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: '売主リスト!B1:CZ1',
    });

    const headers = response.data.values?.[0] || [];
    
    console.log('固定資産税関連のカラム:');
    headers.forEach((h, i) => {
      if (h && (h.includes('固定') || h.includes('路線') || h.includes('税'))) {
        console.log(`  列${i}: ${h}`);
      }
    });

  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

findFixedAssetTaxColumn().catch(console.error);
