import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;
  console.log('今日(JST):', todayJST);

  // todayCall（当日TEL分）のクエリ（listSellersと同じ）
  // コミュニケーション情報が全て空の条件
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, visit_assignee, phone_contact_person, preferred_contact_time, contact_method')
    .is('deleted_at', null)
    .ilike('status', '%追客中%')
    .lte('next_call_date', todayJST)
    .or('visit_assignee.is.null,visit_assignee.eq.,visit_assignee.eq.外す')
    .or('phone_contact_person.is.null,phone_contact_person.eq.')
    .or('preferred_contact_time.is.null,preferred_contact_time.eq.')
    .or('contact_method.is.null,contact_method.eq.');

  if (error) { console.error(error); return; }
  
  console.log(`\ntodayCallクエリ結果: ${data?.length}件`);
  // AA13688が含まれているか確認
  const aa13688 = data?.find(s => s.seller_number === 'AA13688');
  if (aa13688) {
    console.log('⚠️ AA13688が当日TEL分クエリに含まれています！');
    console.log(JSON.stringify(aa13688, null, 2));
  } else {
    console.log('✅ AA13688は当日TEL分クエリに含まれていません（正しい）');
  }
  
  // 最初の5件を表示
  console.log('\n最初の5件:');
  data?.slice(0, 5).forEach(s => {
    console.log(`  ${s.seller_number}: contact_method=${s.contact_method}, preferred_contact_time=${s.preferred_contact_time}, phone_contact_person=${s.phone_contact_person}`);
  });
}

check().catch(console.error);
