import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

function excelSerialToDate(serial: number): string {
  // Excelのシリアル値を日付に変換（1900年1月1日からの日数）
  // Excelは1900年を閏年として扱うバグがあるため、60日以降は1日引く
  const excelEpoch = new Date(1899, 11, 30); // 1899年12月30日
  const days = serial > 60 ? serial - 1 : serial;
  const date = new Date(excelEpoch.getTime() + days * 24 * 60 * 60 * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function convertAndCheck() {
  console.log('🔍 Excelシリアル値を日付に変換...\n');

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

  // 一般媒介の売主を抽出
  const generalSellers = allData.filter((row: any) => {
    const status = row['状況（当社）'] ? String(row['状況（当社）']) : '';
    const exclusiveOtherDecisionMeeting = row['専任他決打合せ'] ? String(row['専任他決打合せ']) : '';
    return status === '一般媒介' && exclusiveOtherDecisionMeeting !== '完了';
  });

  console.log(`📊 一般媒介（専任他決打合せ ≠ "完了"）: ${generalSellers.length}件\n`);

  // 次電日が存在し、今日ではない売主を抽出
  const filtered = generalSellers.filter((row: any) => {
    const nextCallDate = row['次電日'];
    if (!nextCallDate) return false;
    
    let dateStr: string;
    if (typeof nextCallDate === 'number') {
      dateStr = excelSerialToDate(nextCallDate);
    } else if (typeof nextCallDate === 'string') {
      const trimmed = nextCallDate.trim();
      if (trimmed.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
        const parts = trimmed.split('/');
        dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        return false;
      }
    } else {
      return false;
    }
    
    return dateStr !== todayStr;
  });

  console.log(`📊 次電日が存在 AND 次電日 ≠ 今日: ${filtered.length}件\n`);

  // 契約年月が2025-06-23以降の売主を抽出
  const finalFiltered = filtered.filter((row: any) => {
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    if (!contractYearMonth) return false;
    
    let dateStr: string;
    if (typeof contractYearMonth === 'number') {
      dateStr = excelSerialToDate(contractYearMonth);
    } else if (typeof contractYearMonth === 'string') {
      const trimmed = contractYearMonth.trim();
      if (trimmed.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
        const parts = trimmed.split('/');
        dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        return false;
      }
    } else {
      return false;
    }
    
    return dateStr >= '2025-06-23';
  });

  console.log(`📊 契約年月 >= "2025-06-23": ${finalFiltered.length}件\n`);

  console.log('📋 一般媒介の売主（条件に一致）:');
  finalFiltered.forEach((row: any) => {
    const sellerNumber = row['売主番号'];
    const nextCallDate = row['次電日'];
    const contractYearMonth = row['契約年月 他決は分かった時点'];
    
    const nextCallDateStr = typeof nextCallDate === 'number' ? excelSerialToDate(nextCallDate) : nextCallDate;
    const contractYearMonthStr = typeof contractYearMonth === 'number' ? excelSerialToDate(contractYearMonth) : contractYearMonth;
    
    console.log(`   - ${sellerNumber}: 次電日=${nextCallDateStr}, 契約年月=${contractYearMonthStr}`);
  });
}

convertAndCheck().catch(console.error);
