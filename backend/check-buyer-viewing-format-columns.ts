import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkViewingFormatColumns() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ヘッダー行を取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    });

    const headers = response.data.values?.[0] || [];

    console.log('\n📊 買主リストスプレッドシートの列構成確認\n');

    // BI列（列61、0-indexed: 60）
    const biColumnIndex = 60;
    const biHeader = headers[biColumnIndex];
    console.log(`BI列（列${biColumnIndex + 1}）: "${biHeader}"`);

    // 「内覧形態_一般媒介」を検索
    const generalMediationIndex = headers.findIndex(h => h && h.includes('内覧形態_一般媒介'));
    if (generalMediationIndex !== -1) {
      console.log(`「内覧形態_一般媒介」: 列${generalMediationIndex + 1}（0-indexed: ${generalMediationIndex}）`);
      console.log(`  ヘッダー: "${headers[generalMediationIndex]}"`);
    } else {
      console.log('⚠️ 「内覧形態_一般媒介」が見つかりませんでした');
      
      // 「内覧形態」を含む全ての列を表示
      console.log('\n「内覧形態」を含む列:');
      headers.forEach((h, i) => {
        if (h && h.includes('内覧形態')) {
          console.log(`  列${i + 1}（0-indexed: ${i}）: "${h}"`);
        }
      });
    }

    // 買主7187のデータを確認
    const buyerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!B:GZ`,
    });

    const rows = buyerResponse.data.values || [];
    const buyerRow = rows.find(row => row[0] === '7187');

    if (buyerRow) {
      console.log('\n📋 買主7187のデータ:');
      console.log(`  BI列（内覧形態）: "${buyerRow[biColumnIndex - 1] || ''}"`);
      if (generalMediationIndex !== -1) {
        console.log(`  列${generalMediationIndex + 1}（内覧形態_一般媒介）: "${buyerRow[generalMediationIndex - 1] || ''}"`);
      }
    } else {
      console.log('\n⚠️ 買主7187が見つかりませんでした');
    }

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

checkViewingFormatColumns();
