import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkHeaders() {
  try {
    console.log('🔍 買主リストスプレッドシートのヘッダーを確認します...\n');

    // Google Sheets API認証
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ヘッダー行（1行目）を取得
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    });

    const headers = response.data.values?.[0] || [];

    console.log(`📊 ヘッダー数: ${headers.length}\n`);

    // 内覧日関連のカラムを検索
    console.log('🔍 内覧日関連のカラムを検索:\n');
    
    const viewingDateColumns: { index: number; name: string }[] = [];
    
    headers.forEach((header, index) => {
      const headerStr = String(header).trim();
      if (headerStr.includes('内覧日') || headerStr.includes('内覧') && headerStr.includes('日')) {
        viewingDateColumns.push({ index, name: headerStr });
      }
    });

    if (viewingDateColumns.length === 0) {
      console.log('❌ 内覧日関連のカラムが見つかりませんでした');
    } else {
      console.log('✅ 内覧日関連のカラム:');
      viewingDateColumns.forEach(col => {
        console.log(`   列${String.fromCharCode(65 + col.index)}（${col.index}）: "${col.name}"`);
      });
    }

    // 特定のカラム名を検索
    console.log('\n🔍 特定のカラム名を検索:\n');
    
    const searchColumns = [
      '●内覧日(最新）',
      '最新内覧日',
      '内覧日',
      '●希望時期',
    ];

    searchColumns.forEach(searchName => {
      const index = headers.findIndex(h => String(h).trim() === searchName);
      if (index !== -1) {
        console.log(`✅ "${searchName}" → 列${String.fromCharCode(65 + index)}（${index}）`);
      } else {
        console.log(`❌ "${searchName}" → 見つかりません`);
      }
    });

    // I列とJ列のヘッダーを確認
    console.log('\n🔍 I列とJ列のヘッダー:\n');
    console.log(`   I列（8）: "${headers[8] || '(空)'}"`);
    console.log(`   J列（9）: "${headers[9] || '(空)'}"`);

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.response?.data) {
      console.error('詳細:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkHeaders().catch(console.error);
