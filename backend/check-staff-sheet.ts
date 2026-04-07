import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function checkStaffSheet() {
  console.log('スタッフ管理シートを確認中...\n');
  
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
    sheetName: 'スタッフ',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  
  await sheetsClient.authenticate();
  
  // A列（イニシャル）を含む全データを取得
  const values = await sheetsClient.readRawRange('A:Z');
  
  if (!values || values.length === 0) {
    console.log('❌ データが見つかりませんでした');
    return;
  }
  
  console.log(`✅ ${values.length}行のデータを取得しました\n`);
  
  // ヘッダー行を表示
  console.log('ヘッダー行:');
  console.log(values[0]);
  console.log('');
  
  // データ行を表示（最初の15行）
  console.log('データ行（最初の15行）:');
  for (let i = 1; i < Math.min(16, values.length); i++) {
    const row = values[i];
    console.log(`${i}行目: イニシャル=${row[0] || '(空)'}, 名前=${row[1] || '(空)'}`);
  }
  
  // 営担「K」を検索
  console.log('\n営担「K」を検索中...');
  const kRow = values.find((row, index) => index > 0 && row[0] === 'K');
  if (kRow) {
    console.log('✅ 営担「K」が見つかりました:');
    console.log(`  イニシャル: ${kRow[0]}`);
    console.log(`  名前: ${kRow[1] || '(なし)'}`);
    console.log(`  全データ: ${kRow.join(', ')}`);
  } else {
    console.log('❌ 営担「K」は見つかりませんでした');
  }
}

checkStaffSheet().catch(console.error);
