import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function findMissing2Sellers() {
  console.log('🔍 スプレッドシート23件とバックエンド21件の差分（2件）を調査...\n');

  // Google Sheets認証
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json';
  const keyFile = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials: keyFile,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートから全データを取得
  const spreadsheetId = '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I';
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: '売主リスト!B:CZ',
  });

  const rows = response.data.values || [];
  const headers = rows[0];
  
  // 今日の日付（JST）
  const now = new Date();
  const jstOffset = 9 * 60 * 60 * 1000;
  const todayJST = new Date(now.getTime() + jstOffset).toISOString().split('T')[0];
  console.log(`📅 今日の日付（JST）: ${todayJST}\n`);

  // スプレッドシートで一般カテゴリの条件を満たす売主を抽出
  const generalCutoffDate = '2025-06-23';
  const spreadsheetGeneralSellers: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const sellerNumber = row[0]; // B列
    const status = row[headers.indexOf('状況（当社）')];
    const nextCallDate = row[headers.indexOf('次電日')];
    const contractYearMonth = row[headers.indexOf('契約年月 他決は分かった時点')];
    const exclusiveMeeting = row[headers.indexOf('専任他決打合せ')];

    // 一般カテゴリの条件
    if (
      exclusiveMeeting !== '完了' &&
      nextCallDate !== todayJST &&
      status === '一般媒介' &&
      contractYearMonth &&
      contractYearMonth >= generalCutoffDate
    ) {
      spreadsheetGeneralSellers.push(sellerNumber);
    }
  }

  console.log(`📊 スプレッドシートで一般カテゴリ: ${spreadsheetGeneralSellers.length}件\n`);

  // バックエンドフィルタで取得
  const { data: backendSellers, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, contract_year_month, exclusive_other_decision_meeting')
    .or('exclusive_other_decision_meeting.is.null,exclusive_other_decision_meeting.neq.完了')
    .neq('next_call_date', todayJST)
    .eq('status', '一般媒介')
    .not('contract_year_month', 'is', null)
    .gte('contract_year_month', '2025-06-23')
    .is('deleted_at', null)
    .order('seller_number');

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  const backendSellerNumbers = backendSellers?.map((s: any) => s.seller_number) || [];
  console.log(`📊 バックエンドで一般カテゴリ: ${backendSellerNumbers.length}件\n`);

  // 差分を計算
  const missingInBackend = spreadsheetGeneralSellers.filter(
    (sn) => !backendSellerNumbers.includes(sn)
  );

  console.log(`🔍 スプレッドシートにあってバックエンドにない売主: ${missingInBackend.length}件\n`);

  if (missingInBackend.length > 0) {
    console.log('📋 不足している売主:\n');
    for (const sellerNumber of missingInBackend) {
      const rowIndex = rows.findIndex((r) => r[0] === sellerNumber);
      if (rowIndex > 0) {
        const row = rows[rowIndex];
        const status = row[headers.indexOf('状況（当社）')];
        const nextCallDate = row[headers.indexOf('次電日')];
        const contractYearMonth = row[headers.indexOf('契約年月 他決は分かった時点')];
        const exclusiveMeeting = row[headers.indexOf('専任他決打合せ')];

        console.log(`${sellerNumber}:`);
        console.log(`  - 状況: ${status}`);
        console.log(`  - 次電日: ${nextCallDate}`);
        console.log(`  - 契約年月: ${contractYearMonth}`);
        console.log(`  - 専任他決打合せ: ${exclusiveMeeting || '(空欄)'}`);

        // データベースの状態を確認
        const { data: dbSeller } = await supabase
          .from('sellers')
          .select('seller_number, status, next_call_date, contract_year_month, exclusive_other_decision_meeting, deleted_at')
          .eq('seller_number', sellerNumber)
          .single();

        if (dbSeller) {
          console.log(`  - DB状態:`);
          console.log(`    - 状況: ${dbSeller.status}`);
          console.log(`    - 次電日: ${dbSeller.next_call_date}`);
          console.log(`    - 契約年月: ${dbSeller.contract_year_month || '(null)'}`);
          console.log(`    - 専任他決打合せ: ${dbSeller.exclusive_other_decision_meeting || '(null)'}`);
          console.log(`    - deleted_at: ${dbSeller.deleted_at || '(null)'}`);
        } else {
          console.log(`  - DB状態: 見つからない`);
        }
        console.log('');
      }
    }
  }
}

findMissing2Sellers().catch(console.error);
