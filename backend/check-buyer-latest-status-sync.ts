import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkLatestStatusSync() {
  try {
    console.log('🔍 買主リストの「★最新状況」同期状況を確認します...\n');

    // Google Sheets API認証
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
    
    // 「★最新状況」カラムのインデックスを検索
    const latestStatusIndex = headers.findIndex(h => String(h).trim() === '★最新状況');
    
    if (latestStatusIndex === -1) {
      console.log('❌ スプレッドシートに「★最新状況」カラムが見つかりません');
      return;
    }

    console.log(`✅ 「★最新状況」カラム: 列${String.fromCharCode(65 + latestStatusIndex)}（${latestStatusIndex}）\n`);

    // 買主番号のインデックス
    const buyerNumberIndex = headers.findIndex(h => String(h).trim() === '買主番号');
    
    if (buyerNumberIndex === -1) {
      console.log('❌ スプレッドシートに「買主番号」カラムが見つかりません');
      return;
    }

    console.log(`✅ 「買主番号」カラム: 列${String.fromCharCode(65 + buyerNumberIndex)}（${buyerNumberIndex}）\n`);

    // スプレッドシートから全データを取得
    const dataResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:GZ`,
    });

    const rows = dataResponse.data.values || [];
    
    // ヘッダー行を除く
    const dataRows = rows.slice(1);

    // 「★最新状況」に値がある買主を抽出（最初の10件）
    const buyersWithStatus = dataRows
      .filter(row => row[buyerNumberIndex] && row[latestStatusIndex])
      .slice(0, 10)
      .map(row => ({
        buyerNumber: String(row[buyerNumberIndex]).trim(),
        latestStatus: String(row[latestStatusIndex]).trim(),
      }));

    console.log(`📊 スプレッドシートで「★最新状況」に値がある買主: ${buyersWithStatus.length}件（最初の10件を表示）\n`);

    if (buyersWithStatus.length === 0) {
      console.log('⚠️ スプレッドシートに「★最新状況」に値がある買主が見つかりません');
      return;
    }

    // データベースと比較
    console.log('🔍 データベースと比較:\n');

    for (const buyer of buyersWithStatus) {
      const { data: dbBuyer } = await supabase
        .from('buyers')
        .select('buyer_number, latest_status')
        .eq('buyer_number', buyer.buyerNumber)
        .single();

      if (!dbBuyer) {
        console.log(`❌ ${buyer.buyerNumber}: データベースに存在しません`);
        continue;
      }

      const match = dbBuyer.latest_status === buyer.latestStatus;
      const icon = match ? '✅' : '❌';
      
      console.log(`${icon} ${buyer.buyerNumber}:`);
      console.log(`   スプレッドシート: "${buyer.latestStatus}"`);
      console.log(`   データベース: "${dbBuyer.latest_status || '(null)'}"`);
      
      if (!match) {
        console.log(`   ⚠️ 不一致！`);
      }
      console.log('');
    }

    // データベースで latest_status に値がある買主の数を確認
    const { count: dbCount } = await supabase
      .from('buyers')
      .select('*', { count: 'exact', head: true })
      .not('latest_status', 'is', null);

    console.log(`\n📊 データベースで latest_status に値がある買主: ${dbCount}件`);

  } catch (error: any) {
    console.error('❌ エラー:', error.message);
    if (error.response?.data) {
      console.error('詳細:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkLatestStatusSync().catch(console.error);
