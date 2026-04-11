const { createClient } = require('@supabase/supabase-js');
const { GoogleSheetsClient } = require('./dist/src/services/GoogleSheetsClient');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

function parseDate(value) {
  if (!value) return null;
  const str = String(value).trim();
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [year, month, day] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    const [year, month, day] = str.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (str.match(/^\d+$/) && parseInt(str, 10) > 1000) {
    const serial = parseInt(str, 10);
    const excelEpochMs = Date.UTC(1899, 11, 31);
    const date = new Date(excelEpochMs + (serial - 1) * 86400000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}-${String(date.getUTCDate()).padStart(2,'0')}`;
  }
  return null;
}

async function main() {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const today = jst.toISOString().split('T')[0];
  console.log('Today JST:', today);

  // DBで当日TEL分の全売主を取得
  const { data: sellers, error } = await supabase
    .from('sellers')
    .select('seller_number, next_call_date')
    .eq('status', '追客中')
    .lte('next_call_date', today)
    .is('visit_assignee', null)
    .is('phone_contact_person', null)
    .is('preferred_contact_time', null)
    .is('contact_method', null)
    .is('deleted_at', null);

  if (error) { console.error('Error:', error.message); return; }
  console.log('DBの当日TEL分:', sellers?.length, '件');
  if (!sellers || sellers.length === 0) { console.log('修正対象なし'); return; }

  // スプレッドシートから全データ取得
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();
  const allRows = await sheetsClient.readAll();
  const rowMap = new Map();
  for (const row of allRows) {
    const sn = row['売主番号'];
    if (sn) rowMap.set(String(sn), row);
  }

  let updated = 0, skipped = 0;
  for (const seller of sellers) {
    const row = rowMap.get(seller.seller_number);
    if (!row) { console.log(`⚠️ ${seller.seller_number}: スプシに見つからない`); skipped++; continue; }
    const sheetDate = parseDate(row['次電日']);
    if (!sheetDate) { console.log(`⚠️ ${seller.seller_number}: 次電日が空`); skipped++; continue; }
    if (sheetDate <= today) {
      console.log(`ℹ️ ${seller.seller_number}: スプシも今日以前 (${sheetDate}) - 正しく当日TEL分`);
      skipped++; continue;
    }
    const { error: updateError } = await supabase
      .from('sellers')
      .update({ next_call_date: sheetDate })
      .eq('seller_number', seller.seller_number);
    if (updateError) {
      console.error(`❌ ${seller.seller_number}: 更新失敗 - ${updateError.message}`);
    } else {
      console.log(`✅ ${seller.seller_number}: ${seller.next_call_date} → ${sheetDate}`);
      updated++;
    }
  }
  console.log(`\n完了: ${updated}件更新, ${skipped}件スキップ`);
}

main().catch(console.error);
