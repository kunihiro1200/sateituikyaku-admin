import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const today = new Date();
  const jstTime = new Date(today.getTime() + (9 * 60 * 60 * 1000));
  const todayStr = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log('今日:', todayStr);

  // 追客中 + 次電日が今日以前 + 営担なし + コミュニケーション情報あり
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, name, status, next_call_date, visit_assignee, contact_method, preferred_contact_time, phone_contact_person')
    .ilike('status', '%追客中%')
    .lte('next_call_date', todayStr)
    .is('deleted_at', null)
    .or('contact_method.neq.,preferred_contact_time.neq.,phone_contact_person.neq.')
    .order('seller_number');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // 営担なしのみ絞り込み
  const filtered = (data || []).filter(s => {
    const va = s.visit_assignee || '';
    return !va || va.trim() === '' || va.trim() === '外す';
  });

  console.log(`\n当日TEL（内容）対象: ${filtered.length}件`);
  filtered.forEach(s => {
    console.log(`  ${s.seller_number}: contact_method="${s.contact_method}", preferred_contact_time="${s.preferred_contact_time}", phone_contact_person="${s.phone_contact_person}", visit_assignee="${s.visit_assignee}"`);
  });
}

main().catch(console.error);
