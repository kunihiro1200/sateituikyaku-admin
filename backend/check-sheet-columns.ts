/**
 * スプレッドシートのカラム名とAA13760のデータを確認
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

async function main() {
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();
  const allRows = await sheetsClient.readAll();

  console.log(`全行数: ${allRows.length}`);

  // AA13760の行を探す
  const row13760 = allRows.find(r => r['売主番号'] === 'AA13760');
  if (row13760) {
    console.log('\nAA13760の全フィールド:');
    // 反響関連のキーを探す
    const keys = Object.keys(row13760);
    const inquiryKeys = keys.filter(k => k.includes('反響') || k.includes('日付') || k.includes('年'));
    console.log('反響/日付/年 関連キー:', inquiryKeys);
    inquiryKeys.forEach(k => console.log(`  "${k}": "${row13760[k]}"`));
  } else {
    console.log('\nAA13760が見つかりません');
  }

  // 最初の行のキーを全部表示（カラム名確認）
  if (allRows.length > 0) {
    const firstRow = allRows[0];
    const keys = Object.keys(firstRow);
    console.log('\n全カラム名（最初の行）:');
    keys.forEach((k, i) => console.log(`  [${i}] "${k}"`));
  }
}

main().catch(console.error);
