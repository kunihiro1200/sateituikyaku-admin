import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '.env.local') });
delete (process.env as any).GOOGLE_SERVICE_ACCOUNT_JSON;
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

async function main() {
  // DBの状態確認
  const { data, error } = await supabase.from('sellers').select('seller_number, unreachable_sms_assignee').eq('seller_number', 'AA13867').single();
  if (error) console.error('DB error:', error.message);
  else console.log('DB before:', JSON.stringify(data));

  // スプレッドシートの値確認
  const { GoogleSheetsClient } = await import('./src/services/GoogleSheetsClient');
  const sheetsClient = new GoogleSheetsClient({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  });
  await sheetsClient.authenticate();
  const allRows = await sheetsClient.readAll();
  const row = allRows.find((r: any) => r['売主番号'] === 'AA13867');
  if (row) {
    const val = row['不通時Sメール担当'];
    console.log('スプシ 不通時Sメール担当:', JSON.stringify(val));
    if (val && String(val).trim() !== '') {
      const { error: updateError } = await supabase
        .from('sellers')
        .update({ unreachable_sms_assignee: String(val).trim() })
        .eq('seller_number', 'AA13867');
      if (updateError) console.error('Update error:', updateError.message);
      else console.log('✅ AA13867 updated:', String(val).trim());
    }
  } else {
    console.log('AA13867 not found in spreadsheet');
  }

  // 更新後確認
  const { data: after } = await supabase.from('sellers').select('seller_number, unreachable_sms_assignee').eq('seller_number', 'AA13867').single();
  console.log('DB after:', JSON.stringify(after));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
