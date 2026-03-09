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

  const row = allRows.find((r: any) => r['売主番号'] === 'AA13757');
  if (row) {
    console.log('反響年:', JSON.stringify(row['反響年']));
    console.log('反響日付:', JSON.stringify(row['反響日付']));
  } else {
    console.log('AA13757が見つかりません');
  }
}
main().catch(console.error);
