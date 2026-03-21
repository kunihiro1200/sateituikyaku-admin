import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env') });

import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';

async function debugSync() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. DBのAA13811を確認
  const { data: dbSeller } = await supabase
    .from('sellers')
    .select('seller_number, valuation_reason, valuation_method, status, next_call_date, unreachable_status, comments')
    .eq('seller_number', 'AA13811')
    .single();

  console.log('=== DB AA13811 ===');
  console.log(JSON.stringify(dbSeller, null, 2));

  // 2. スプレッドシートのAA13811を確認
  const client = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || '',
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
  });
  await client.authenticate();
  const rows = await client.readAll();
  const sheetRow = rows.find((r: any) => r['売主番号'] === 'AA13811');

  console.log('\n=== スプレッドシート AA13811 ===');
  if (sheetRow) {
    console.log('査定理由（査定サイトから転記）:', sheetRow['査定理由（査定サイトから転記）']);
    console.log('査定方法:', sheetRow['査定方法']);
    console.log('状況（当社）:', sheetRow['状況（当社）']);
    console.log('次電日:', sheetRow['次電日']);
    console.log('不通:', sheetRow['不通']);
    console.log('コメント:', sheetRow['コメント']);
  } else {
    console.log('AA13811が見つかりません');
  }

  // 3. 差分チェック（detectUpdatedSellersと同じロジック）
  if (dbSeller && sheetRow) {
    console.log('\n=== 差分チェック ===');
    const dbValuationReason = (dbSeller as any).valuation_reason || '';
    const sheetValuationReason = sheetRow['査定理由（査定サイトから転記）'] || '';
    console.log(`valuation_reason: DB="${dbValuationReason}" vs Sheet="${sheetValuationReason}" → 差分=${dbValuationReason !== sheetValuationReason}`);

    const dbValuationMethod = (dbSeller as any).valuation_method || '';
    const sheetValuationMethod = sheetRow['査定方法'] || '';
    console.log(`valuation_method: DB="${dbValuationMethod}" vs Sheet="${sheetValuationMethod}" → 差分=${dbValuationMethod !== sheetValuationMethod}`);

    const dbStatus = (dbSeller as any).status || '';
    const sheetStatus = sheetRow['状況（当社）'] || '';
    console.log(`status: DB="${dbStatus}" vs Sheet="${sheetStatus}" → 差分=${dbStatus !== sheetStatus}`);

    const dbComments = (dbSeller as any).comments || '';
    const sheetComments = sheetRow['コメント'] || '';
    console.log(`comments: DB="${dbComments}" vs Sheet="${sheetComments}" → 差分=${dbComments !== sheetComments}`);
  }
}

debugSync().catch(console.error);
