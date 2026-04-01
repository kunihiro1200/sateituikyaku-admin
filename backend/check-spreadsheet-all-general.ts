import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function checkAllGeneral() {
  console.log('🔍 スプレッドシートの一般媒介データを全件確認...\n');

  const today = new Date();
  const jstTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
  const todayStr = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log(`📅 今日（JST）: ${todayStr}\n`);

  const client = new GoogleSheetsClient({
    spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });

  await client.authenticate();

  const allData = await client.readAll();
  console.log(`📊 全データ: ${allData.length}行\n`);

  // 一般媒介の売主を抽出
  const generalSellers = allData.filter((row: any) => {
    const status = row['状況（当社）'] ? String(row['状況（当社）']) : '';
    return status === '一般媒介';
  });

  console.log(`📊 一般媒介の売主: ${generalSellers.length}件\n`);

  // GASの条件を段階的に適用
  let step1 = generalSellers;
  console.log(`ステップ1: 状況 = "一般媒介" → ${step1.length}件`);

  const step2 = step1.filter((row: any) => {
    const exclusiveOtherDecisionMeeting = row['専任他決打合せ'] ? String(row['専任他決打合せ']) : '';
    return exclusiveOtherDecisionMeeting !== '完了';
  });
  console.log(`ステップ2: 専任他決打合せ ≠ "完了" → ${step2.length}件`);

  const step3 = step2.filter((row: any) => {
    const nextCallDate = row['次電日'];
    if (!nextCallDate) return false;
    const dateStr = String(nextCallDate).trim();
    if (dateStr.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const parts = dateStr.split('/');
      const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return formatted !== todayStr;
    }
    return false;
  });
  console.log(`ステップ3: 次電日が存在 AND 次電日 ≠ 今日 → ${step3.length}件`);

  const step4 = step3.filter((row: any) => {
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (!contractYearMonth) return false;
    const dateStr = String(contractYearMonth).trim();
    if (dateStr.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
      const parts = dateStr.split('/');
      const formatted = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      return formatted >= '2025-06-23';
    }
    return false;
  });
  console.log(`ステップ4: 契約年月が存在 AND 契約年月 >= "2025-06-23" → ${step4.length}件\n`);

  console.log('📋 一般媒介の売主（条件に一致）:');
  step4.forEach((row: any) => {
    const sellerNumber = row['売主番号'];
    const nextCallDate = row['次電日'];
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    const exclusiveOtherDecisionMeeting = row['専任他決打合せ'] || '';
    console.log(`   - ${sellerNumber}: 次電日=${nextCallDate}, 契約年月=${contractYearMonth}, 専任他決打合せ=${exclusiveOtherDecisionMeeting}`);
  });
}

checkAllGeneral().catch(console.error);
