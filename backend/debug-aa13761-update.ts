import { createClient } from '@supabase/supabase-js';
import { GoogleSheetsClient } from './src/services/GoogleSheetsClient';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatContractYearMonth(value: any): string | null {
  if (!value || value === '') return null;
  const str = String(value).trim();
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [year, month, day] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    const [year, month, day] = str.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (str.match(/^\d{4}\/\d{1,2}$/)) {
    const [year, month] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-01`;
  }
  if (str.match(/^\d{4}-\d{1,2}$/)) {
    const [year, month] = str.split('-');
    return `${year}-${month.padStart(2, '0')}-01`;
  }
  return null;
}

function formatVisitDate(value: any): string | null {
  if (!value || value === '') return null;
  const str = String(value).trim();
  if (str.match(/^\d{4}\/\d{1,2}\/\d{1,2}$/)) {
    const [year, month, day] = str.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  if (str.match(/^\d{4}-\d{1,2}-\d{1,2}$/)) {
    const [year, month, day] = str.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return null;
}

async function main() {
  const sheetsConfig = {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID!,
    sheetName: process.env.GOOGLE_SHEETS_SHEET_NAME || '売主リスト',
    serviceAccountKeyPath: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || './google-service-account.json',
  };
  const sheetsClient = new GoogleSheetsClient(sheetsConfig);
  await sheetsClient.authenticate();

  const allRows = await sheetsClient.readAll();
  const sheetRow = allRows.find((r: any) => r['売主番号'] === 'AA13761');
  
  if (!sheetRow) {
    console.log('AA13761 not found in spreadsheet');
    return;
  }

  console.log('=== スプレッドシートの値 ===');
  console.log('状況（当社）:', JSON.stringify(sheetRow['状況（当社）']));
  console.log('契約年月:', JSON.stringify(sheetRow['契約年月 他決は分かった時点']));
  console.log('営担:', JSON.stringify(sheetRow['営担']));
  console.log('次電日:', JSON.stringify(sheetRow['次電日']));
  console.log('不通:', JSON.stringify(sheetRow['不通']));
  console.log('コメント（先頭50文字）:', JSON.stringify(String(sheetRow['コメント'] || '').substring(0, 50)));
  console.log('電話担当（任意）:', JSON.stringify(sheetRow['電話担当（任意）']));
  console.log('連絡取りやすい日、時間帯:', JSON.stringify(sheetRow['連絡取りやすい日、時間帯']));
  console.log('連絡方法:', JSON.stringify(sheetRow['連絡方法']));
  console.log('反響日付:', JSON.stringify(sheetRow['反響日付']));
  console.log('反響年:', JSON.stringify(sheetRow['反響年']));

  const { data: dbSeller } = await supabase
    .from('sellers')
    .select('seller_number, status, contract_year_month, visit_assignee, phone_contact_person, preferred_contact_time, contact_method, next_call_date, unreachable_status, inquiry_date, comments, updated_at')
    .eq('seller_number', 'AA13761')
    .single();

  console.log('\n=== DBの値 ===');
  console.log('status:', JSON.stringify(dbSeller?.status));
  console.log('contract_year_month:', JSON.stringify(dbSeller?.contract_year_month));
  console.log('visit_assignee:', JSON.stringify(dbSeller?.visit_assignee));
  console.log('next_call_date:', JSON.stringify(dbSeller?.next_call_date));
  console.log('unreachable_status:', JSON.stringify(dbSeller?.unreachable_status));
  console.log('comments（先頭50文字）:', JSON.stringify(String(dbSeller?.comments || '').substring(0, 50)));
  console.log('phone_contact_person:', JSON.stringify(dbSeller?.phone_contact_person));
  console.log('preferred_contact_time:', JSON.stringify(dbSeller?.preferred_contact_time));
  console.log('contact_method:', JSON.stringify(dbSeller?.contact_method));
  console.log('inquiry_date:', JSON.stringify(dbSeller?.inquiry_date));

  console.log('\n=== 差分チェック ===');
  
  // contract_year_month
  const sheetContractYearMonth = sheetRow['契約年月 他決は分かった時点'];
  if (sheetContractYearMonth && sheetContractYearMonth !== '') {
    const formattedDate = formatContractYearMonth(sheetContractYearMonth);
    const dbDate = dbSeller?.contract_year_month ? String(dbSeller.contract_year_month).substring(0, 10) : null;
    console.log(`contract_year_month: sheet="${formattedDate}" db="${dbDate}" diff=${formattedDate !== dbDate}`);
  } else if (dbSeller?.contract_year_month !== null) {
    console.log(`contract_year_month: sheet=null db="${dbSeller?.contract_year_month}" diff=true`);
  }

  // visit_assignee
  const rawSheetVisitAssignee = sheetRow['営担'];
  const sheetVisitAssignee = (rawSheetVisitAssignee === '外す' || rawSheetVisitAssignee === '') ? null : (rawSheetVisitAssignee || null);
  const dbVisitAssignee = dbSeller?.visit_assignee || null;
  console.log(`visit_assignee: sheet="${sheetVisitAssignee}" db="${dbVisitAssignee}" diff=${sheetVisitAssignee !== dbVisitAssignee}`);

  // status
  const sheetStatus = sheetRow['状況（当社）'];
  console.log(`status: sheet="${sheetStatus}" db="${dbSeller?.status}" diff=${sheetStatus && sheetStatus !== dbSeller?.status}`);

  // next_call_date
  const sheetNextCallDate = sheetRow['次電日'];
  if (sheetNextCallDate) {
    const formattedNextCallDate = formatVisitDate(sheetNextCallDate);
    const dbNextCallDate = dbSeller?.next_call_date ? String(dbSeller.next_call_date).substring(0, 10) : null;
    console.log(`next_call_date: sheet="${formattedNextCallDate}" db="${dbNextCallDate}" diff=${formattedNextCallDate !== dbNextCallDate}`);
  }

  // unreachable_status
  const dbUnreachableStatus = dbSeller?.unreachable_status || '';
  const sheetUnreachable = sheetRow['不通'] || '';
  console.log(`unreachable_status: sheet="${sheetUnreachable}" db="${dbUnreachableStatus}" diff=${sheetUnreachable !== dbUnreachableStatus}`);

  // comments
  const dbComments = dbSeller?.comments || '';
  const sheetComments = sheetRow['コメント'] || '';
  console.log(`comments: diff=${sheetComments !== dbComments}`);
  if (sheetComments !== dbComments) {
    console.log('  sheet先頭100:', JSON.stringify(String(sheetComments).substring(0, 100)));
    console.log('  db先頭100:', JSON.stringify(String(dbComments).substring(0, 100)));
  }
}

main().catch(console.error);
