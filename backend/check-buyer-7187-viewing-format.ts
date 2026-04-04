import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkBuyer7187ViewingFormat() {
  try {
    console.log('\n📊 買主7187の「内覧形態」同期状態確認\n');

    // スプレッドシートから取得
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // ヘッダー行を取得
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!1:1`,
    });

    const headers = headerResponse.data.values?.[0] || [];

    // BI列（内覧形態）とFQ列（内覧形態_一般媒介）のインデックスを取得
    const biIndex = headers.findIndex(h => h === '内覧形態');
    const fqIndex = headers.findIndex(h => h === '内覧形態_一般媒介');

    console.log(`BI列（内覧形態）: 列${biIndex + 1}（0-indexed: ${biIndex}）`);
    console.log(`FQ列（内覧形態_一般媒介）: 列${fqIndex + 1}（0-indexed: ${fqIndex}）`);

    // 買主番号はE列（0-indexed: 4）
    const buyerNumberIndex = 4;
    console.log(`\n買主番号列: E列（0-indexed: ${buyerNumberIndex}）`);

    // 買主7187のデータを取得
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:GZ`,
    });

    const rows = dataResponse.data.values || [];
    
    // 最初の10行の買主番号を表示
    console.log('\n📋 スプレッドシートの最初の10行:');
    rows.slice(1, 11).forEach((row, i) => {
      console.log(`  行${i + 2}: 買主番号 = "${row[buyerNumberIndex] || ''}"`);
    });
    
    const buyerRow = rows.find(row => row[buyerNumberIndex] === '7187');

    if (!buyerRow) {
      console.log('\n❌ 買主7187が見つかりませんでした');
      
      // 「7187」を含む行を検索
      const partialMatch = rows.find(row => row[buyerNumberIndex] && String(row[buyerNumberIndex]).includes('7187'));
      if (partialMatch) {
        console.log(`⚠️ 部分一致: "${partialMatch[buyerNumberIndex]}"`);
      }
      return;
    }

    const sheetViewingMobile = buyerRow[biIndex] || '';
    const sheetViewingTypeGeneral = buyerRow[fqIndex] || '';

    console.log('\n📋 スプレッドシートのデータ:');
    console.log(`  内覧形態（BI列）: "${sheetViewingMobile}"`);
    console.log(`  内覧形態_一般媒介（FQ列）: "${sheetViewingTypeGeneral}"`);

    // データベースから取得
    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('buyer_number, viewing_mobile, viewing_type_general')
      .eq('buyer_number', '7187')
      .single();

    if (error) {
      console.log('\n❌ データベースエラー:', error.message);
      return;
    }

    console.log('\n💾 データベースのデータ:');
    console.log(`  viewing_mobile: "${buyer.viewing_mobile || ''}"`);
    console.log(`  viewing_type_general: "${buyer.viewing_type_general || ''}"`);

    // 比較
    console.log('\n🔍 同期状態:');
    const mobileMatch = sheetViewingMobile === (buyer.viewing_mobile || '');
    const generalMatch = sheetViewingTypeGeneral === (buyer.viewing_type_general || '');

    console.log(`  内覧形態: ${mobileMatch ? '✅ 一致' : '❌ 不一致'}`);
    console.log(`  内覧形態_一般媒介: ${generalMatch ? '✅ 一致' : '❌ 不一致'}`);

    if (!mobileMatch || !generalMatch) {
      console.log('\n⚠️ 同期が必要です');
    }

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
  }
}

checkBuyer7187ViewingFormat();
