import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') });

async function debugNameField() {
  // GoogleSheetsClientを直接使用
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH!,
  });

  await sheetsClient.authenticate();

  console.log('=== GoogleSheetsClient.readAll()の結果を確認 ===\n');

  const allRows = await sheetsClient.readAll();
  
  const aa13175Row = allRows.find(row => row['売主番号'] === 'AA13175');
  const aa10618Row = allRows.find(row => row['売主番号'] === 'AA10618');

  if (aa13175Row) {
    console.log('AA13175:');
    console.log('  売主番号:', aa13175Row['売主番号']);
    console.log('  名前(漢字のみ）:', JSON.stringify(aa13175Row['名前(漢字のみ）']));
    console.log('  型:', typeof aa13175Row['名前(漢字のみ）']);
    console.log('  === null:', aa13175Row['名前(漢字のみ）'] === null);
    console.log('  === undefined:', aa13175Row['名前(漢字のみ）'] === undefined);
    console.log('  === "":', aa13175Row['名前(漢字のみ）'] === '');
    console.log('');
  }

  if (aa10618Row) {
    console.log('AA10618:');
    console.log('  売主番号:', aa10618Row['売主番号']);
    console.log('  名前(漢字のみ）:', JSON.stringify(aa10618Row['名前(漢字のみ）']));
    console.log('  型:', typeof aa10618Row['名前(漢字のみ）']);
    console.log('  === null:', aa10618Row['名前(漢字のみ）'] === null);
    console.log('  === undefined:', aa10618Row['名前(漢字のみ）'] === undefined);
    console.log('  === "":', aa10618Row['名前(漢字のみ）'] === '');
    console.log('');
  }

  // ColumnMapperでマッピングした結果を確認
  console.log('=== ColumnMapper.mapToDatabase()の結果を確認 ===\n');

  const { ColumnMapper } = await import('./src/services/ColumnMapper');
  const columnMapper = new ColumnMapper();

  if (aa13175Row) {
    const mapped = columnMapper.mapToDatabase(aa13175Row);
    console.log('AA13175:');
    console.log('  mapped.name:', JSON.stringify(mapped.name));
    console.log('  型:', typeof mapped.name);
    console.log('');
  }

  if (aa10618Row) {
    const mapped = columnMapper.mapToDatabase(aa10618Row);
    console.log('AA10618:');
    console.log('  mapped.name:', JSON.stringify(mapped.name));
    console.log('  型:', typeof mapped.name);
    console.log('');
  }
}

debugNameField().catch(console.error);
