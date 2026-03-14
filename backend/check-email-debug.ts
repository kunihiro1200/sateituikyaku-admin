/**
 * メール送信デバッグスクリプト
 * - employees テーブルの initials カラムを確認
 * - google_calendar_tokens テーブルのスコープを確認
 * - property_listings テーブルの sales_assignee を確認
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== メール送信デバッグ ===\n');

  // 1. employees テーブルの initials カラムを確認
  console.log('--- 1. employees テーブル (is_active=true) ---');
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('id, name, email, initials, is_active')
    .eq('is_active', true)
    .order('name');

  if (empError) {
    console.error('employees取得エラー:', empError);
  } else {
    console.log('社員一覧:');
    employees?.forEach(e => {
      console.log(`  name=${e.name}, email=${e.email}, initials=${e.initials || '(未設定)'}`);
    });
  }

  // 2. google_calendar_tokens のスコープを確認
  console.log('\n--- 2. google_calendar_tokens テーブル ---');
  const { data: tokens, error: tokenError } = await supabase
    .from('google_calendar_tokens')
    .select('id, employee_id, scope, token_expiry, updated_at');

  if (tokenError) {
    console.error('tokens取得エラー:', tokenError);
  } else {
    tokens?.forEach(t => {
      const hasGmailSend = t.scope?.includes('gmail.send');
      console.log(`  employee_id=${t.employee_id}`);
      console.log(`  scope=${t.scope}`);
      console.log(`  gmail.send スコープ: ${hasGmailSend ? '✅ あり' : '❌ なし'}`);
      console.log(`  token_expiry=${t.token_expiry}`);
      console.log(`  updated_at=${t.updated_at}`);
    });
  }

  // 3. property_listings の sales_assignee を確認（物件番号7133）
  console.log('\n--- 3. property_listings (sales_assignee確認) ---');
  const { data: listings, error: listError } = await supabase
    .from('property_listings')
    .select('property_number, address, sales_assignee')
    .not('sales_assignee', 'is', null)
    .limit(10);

  if (listError) {
    console.error('property_listings取得エラー:', listError);
  } else {
    console.log('物件リスト（sales_assigneeあり）:');
    listings?.forEach(l => {
      console.log(`  property_number=${l.property_number}, address=${l.address}, sales_assignee=${l.sales_assignee}`);
    });
  }

  // 4. tenant@ifoo-oita.com の employee ID を確認
  console.log('\n--- 4. tenant@ifoo-oita.com の確認 ---');
  const { data: tenant, error: tenantError } = await supabase
    .from('employees')
    .select('id, name, email, initials, is_active')
    .eq('email', 'tenant@ifoo-oita.com')
    .single();

  if (tenantError) {
    console.error('tenant取得エラー:', tenantError.message);
  } else {
    console.log('tenant:', tenant);
  }
}

main().catch(console.error);
