import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function checkContractYearMonth() {
  console.log('🔍 スプレッドシートの契約年月を確認...\n');

  const client = new GoogleSheetsClient({
    spreadsheetId: '1wKBRLWbT6pSKa9IlTDabjhjTnfs_GxX6Rn6M6kbio1I',
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });

  await client.authenticate();

  const allData = await client.readAll();

  // AA2090の契約年月を確認
  const aa2090 = allData.find((row: any) => row['売主番号'] === 'AA2090');
  if (aa2090) {
    console.log('AA2090の契約年月:');
    console.log(`  値: ${aa2090['契約年月 他決は分かった時点']}`);
    console.log(`  型: ${typeof aa2090['契約年月 他決は分かった時点']}`);
    console.log(`  isDate: ${aa2090['契約年月 他決は分かった時点'] instanceof Date}`);
  } else {
    console.log('AA2090が見つかりません');
  }
}

checkContractYearMonth().catch(console.error);
