/**
 * スタッフシートの「営業」列を確認するスクリプト
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');
  
  const client = new GoogleSheetsClient({
    spreadsheetId: '19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs',
    sheetName: 'スタッフ',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await client.authenticate();
  const rows = await client.readAll();

  console.log(`\n=== スタッフシート: ${rows.length}行 ===\n`);
  console.log('名前 | メアド | 営業列の値');
  console.log('------|--------|----------');
  
  for (const row of rows) {
    const name = row['名前'] || row['氏名'] || row['スタッフ名'] || '(名前列不明)';
    const email = row['メアド'] || row['メールアドレス'] || row['email'] || '(メアド列不明)';
    const sales = row['営業'] || '(空)';
    console.log(`${name} | ${email} | ${sales}`);
  }

  // ヘッダー列名も表示
  if (rows.length > 0) {
    console.log('\n=== 列名一覧 ===');
    console.log(Object.keys(rows[0]).join(', '));
  }
}

main().catch(console.error);
