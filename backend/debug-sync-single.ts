/**
 * updateSingleSellerを直接呼び出してvisit_dateがDBに入るか確認する
 */
import dotenv from 'dotenv';
dotenv.config();

import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import { EnhancedAutoSyncService } from './src/services/EnhancedAutoSyncService';
import { createClient } from '@supabase/supabase-js';

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );

  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();

  const syncService = new EnhancedAutoSyncService(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
  );
  await syncService.initialize();

  const allRows = await sheetsClient.readAll();
  const row = allRows.find((r: any) => r['売主番号'] === 'AA13863');
  if (!row) { console.log('AA13863が見つかりません'); return; }

  // 事前にnullにリセット
  await supabase.from('sellers').update({ visit_date: null }).eq('seller_number', 'AA13863');
  console.log('visit_dateをnullにリセット');

  // updateSingleSellerを実行
  console.log('updateSingleSellerを実行...');
  await syncService.updateSingleSeller('AA13863', row);
  console.log('完了');

  // 直後にDB確認
  const { data } = await supabase
    .from('sellers')
    .select('seller_number, visit_date')
    .eq('seller_number', 'AA13863')
    .single();
  console.log('updateSingleSeller直後のDB:', data);

  // 3秒待ってから再確認（SyncQueueが上書きする場合）
  await new Promise(r => setTimeout(r, 3000));
  const { data: data2 } = await supabase
    .from('sellers')
    .select('seller_number, visit_date')
    .eq('seller_number', 'AA13863')
    .single();
  console.log('3秒後のDB:', data2);
}

main().catch(console.error);
