/**
 * inquiry_dateがnullの売主をスプレッドシートから再同期するスクリプト
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function parseNumeric(value: any): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return value;
  const str = String(value).replace(/,/g, '');
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function formatInquiryDate(inquiryYear: any, inquiryDate: any): string | null {
  if (!inquiryYear || !inquiryDate) return null;

  const year = parseNumeric(inquiryYear);
  if (year === null) return null;

  const dateStr = String(inquiryDate).trim();

  // Excelシリアル値（純粋な数値）の場合
  if (dateStr.match(/^\d+$/)) {
    const serial = parseInt(dateStr, 10);
    if (serial > 1000) { // 1000以上なら日付シリアル値とみなす
      // Excelの基準日: 1899-12-30（1900/2/29バグを考慮）
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + serial * 86400000);
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // MM/DD 形式
  if (dateStr.match(/^\d{1,2}\/\d{1,2}$/)) {
    const [month, day] = dateStr.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // YYYY/MM/DD 形式
  if (dateStr.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [y, month, day] = dateStr.split('/');
    return `${y}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  return null;
}

async function main() {
  // inquiry_dateがnullの売主を全件取得
  const allNull: string[] = [];
  const pageSize = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from('sellers')
      .select('seller_number')
      .is('deleted_at', null)
      .is('inquiry_date', null)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    if (!data || data.length === 0) { hasMore = false; break; }

    for (const s of data) allNull.push(s.seller_number);
    offset += pageSize;
    if (data.length < pageSize) hasMore = false;
  }

  console.log(`inquiry_dateがnullの売主: ${allNull.length}件`);
  if (allNull.length === 0) { console.log('修正不要'); return; }

  // スプレッドシートから全データを取得
  const { getEnhancedAutoSyncService } = await import('./src/services/EnhancedAutoSyncService');
  const syncService = getEnhancedAutoSyncService();
  await syncService.initialize();

  // スプレッドシートデータを直接取得
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();
  const allRows = await sheetsClient.readAll();

  // 売主番号→行のマップを作成
  const rowMap = new Map<string, any>();
  for (const row of allRows) {
    const sn = row['売主番号'];
    if (sn) rowMap.set(String(sn), row);
  }

  let fixed = 0;
  let skipped = 0;
  let noData = 0;

  for (const sellerNumber of allNull) {
    const row = rowMap.get(sellerNumber);
    if (!row) {
      noData++;
      continue;
    }

    const inquiryYear = row['反響年'];
    const inquiryDate = row['反響日付'];
    const formatted = formatInquiryDate(inquiryYear, inquiryDate);

    if (!formatted) {
      skipped++;
      // console.log(`  ${sellerNumber}: スプシにも反響日付なし (year=${inquiryYear}, date=${inquiryDate})`);
      continue;
    }

    const { error } = await supabase
      .from('sellers')
      .update({ inquiry_date: formatted })
      .eq('seller_number', sellerNumber);

    if (error) {
      console.error(`  ❌ ${sellerNumber}: ${error.message}`);
    } else {
      fixed++;
      console.log(`  ✅ ${sellerNumber}: inquiry_date = ${formatted}`);
    }
  }

  console.log(`\n完了: 修正=${fixed}件, スプシにも日付なし=${skipped}件, DBにデータなし=${noData}件`);
}

main().catch(console.error);
