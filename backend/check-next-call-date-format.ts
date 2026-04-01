import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function checkNextCallDateFormat() {
  console.log('🔍 次電日のフォーマットを確認...\n');

  const client = new GoogleSheetsClient({
    spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });

  await client.authenticate();

  const allData = await client.readAll();

  // 一般媒介の売主を抽出
  const generalSellers = allData.filter((row: any) => {
    const status = row['状況（当社）'] ? String(row['状況（当社）']) : '';
    const exclusiveOtherDecisionMeeting = row['専任他決打合せ'] ? String(row['専任他決打合せ']) : '';
    return status === '一般媒介' && exclusiveOtherDecisionMeeting !== '完了';
  });

  console.log(`📊 一般媒介（専任他決打合せ ≠ "完了"）: ${generalSellers.length}件\n`);

  // 次電日が存在する売主を抽出
  const withNextCallDate = generalSellers.filter((row: any) => {
    const nextCallDate = row['次電日'];
    return nextCallDate && nextCallDate !== '';
  });

  console.log(`📊 次電日が存在: ${withNextCallDate.length}件\n`);

  // 次電日のフォーマットを確認（最初の10件）
  console.log('📋 次電日のフォーマット（最初の10件）:');
  withNextCallDate.slice(0, 10).forEach((row: any) => {
    const sellerNumber = row['売主番号'];
    const nextCallDate = row['次電日'];
    const type = typeof nextCallDate;
    const isDate = nextCallDate instanceof Date;
    console.log(`   - ${sellerNumber}: ${nextCallDate} (type=${type}, isDate=${isDate})`);
  });
}

checkNextCallDateFormat().catch(console.error);
