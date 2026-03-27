/**
 * AA13863のupdateDataにvisit_dateが入っているか確認するデバッグスクリプト
 */
import dotenv from 'dotenv';
dotenv.config();

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { ColumnMapper } from './src/services/ColumnMapper';

// formatVisitDateをコピー
function formatVisitDate(value: any): string | null {
  if (!value || value === '') return null;
  if (typeof value === 'number') {
    const excelEpochMs = Date.UTC(1899, 11, 31);
    const date = new Date(excelEpochMs + (value - 1) * 86400000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const str = String(value).trim();
  if (str.match(/^\d+$/) && parseInt(str, 10) > 1000) {
    const serial = parseInt(str, 10);
    const excelEpochMs = Date.UTC(1899, 11, 31);
    const date = new Date(excelEpochMs + (serial - 1) * 86400000);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [year, month, day] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    return str;
  }
  return null;
}

async function main() {
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();

  const allRows = await sheetsClient.readAll();
  const row = allRows.find((r: any) => r['売主番号'] === 'AA13863');
  if (!row) { console.log('AA13863が見つかりません'); return; }

  const visitDate = row['訪問日 Y/M/D'];
  console.log('visitDate raw value:', visitDate, '(type:', typeof visitDate, ')');
  console.log('if (visitDate) =>', !!visitDate);
  console.log('formatVisitDate result:', formatVisitDate(visitDate));

  // mappedDataのvisit_dateも確認
  const columnMapper = new ColumnMapper();
  const mappedData = columnMapper.mapToDatabase(row);
  console.log('mappedData.visit_date:', (mappedData as any).visit_date);
}

main().catch(console.error);
