import { google } from 'googleapis';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: 'backend/.env' });

const SPREADSHEET_ID = '1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY';
const SHEET_NAME = '買主リスト';

async function checkBuyer4151Spreadsheet() {
  console.log('🔍 買主4151のスプレッドシートデータを確認します...\n');

  // Google Sheets API認証
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || path.join(__dirname, '../google-service-account-key.json');
  const auth = new google.auth.GoogleAuth({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // スプレッドシートからデータを取得
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:GZ`,
  });

  const rows = response.data.values;
  if (!rows || rows.length === 0) {
    console.log('❌ データが見つかりませんでした');
    return;
  }

  // ヘッダー行
  const headers = rows[0];
  
  // 買主番号の列位置を確認（E列 = 0-indexed: 4）
  const buyerNumberIndex = 4;
  const nextCallDateIndex = headers.indexOf('★次電日');
  const followUpAssigneeIndex = headers.indexOf('後続担当');
  const latestStatusIndex = headers.indexOf('★最新状況');

  console.log('📋 列位置:');
  console.log('  - 買主番号:', buyerNumberIndex, '(E列)');
  console.log('  - ★次電日:', nextCallDateIndex);
  console.log('  - 後続担当:', followUpAssigneeIndex);
  console.log('  - ★最新状況:', latestStatusIndex);

  // 買主4151を検索
  const buyer4151Row = rows.find(row => row[buyerNumberIndex] === '4151');

  if (!buyer4151Row) {
    console.log('\n❌ 買主4151が見つかりませんでした');
    return;
  }

  console.log('\n✅ 買主4151のスプレッドシートデータ:');
  console.log('  - 買主番号:', buyer4151Row[buyerNumberIndex]);
  console.log('  - ★次電日:', buyer4151Row[nextCallDateIndex] || '(空)');
  console.log('  - 後続担当:', buyer4151Row[followUpAssigneeIndex] || '(空)');
  console.log('  - ★最新状況:', buyer4151Row[latestStatusIndex] || '(空)');

  // 今日の日付
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  console.log('\n📅 今日の日付:', todayStr);

  // 次電日の値を確認
  const nextCallDate = buyer4151Row[nextCallDateIndex];
  if (nextCallDate) {
    console.log('\n🔍 次電日の値:', nextCallDate);
    
    // 日付形式を変換（YYYY/MM/DD → YYYY-MM-DD）
    const nextCallDateFormatted = nextCallDate.replace(/\//g, '-');
    console.log('  - 変換後:', nextCallDateFormatted);
    
    const isTodayOrPast = nextCallDateFormatted <= todayStr;
    console.log('  - 今日以前:', isTodayOrPast);
  } else {
    console.log('\n❌ 次電日が空です');
  }

  // 後続担当の値を確認
  const followUpAssignee = buyer4151Row[followUpAssigneeIndex];
  if (followUpAssignee) {
    console.log('\n🔍 後続担当の値:', followUpAssignee);
    console.log('  → 担当ありのため「当日TEL」ではなく「当日TEL(担当)」に分類されます');
  } else {
    console.log('\n✅ 後続担当が空です');
  }
}

checkBuyer4151Spreadsheet().catch(console.error);
