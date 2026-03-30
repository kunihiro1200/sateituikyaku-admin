import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const { data, error } = await supabase
    .from('buyers')
    .select(`
      buyer_number,
      name,
      latest_viewing_date,
      viewing_type_general,
      viewing_mobile,
      post_viewing_seller_contact,
      viewing_result_follow_up,
      follow_up_assignee,
      next_call_date,
      latest_status,
      viewing_unconfirmed
    `)
    .eq('buyer_number', '7145')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('7145のデータ:');
  console.log(JSON.stringify(data, null, 2));

  // 「一般媒介_内覧後売主連絡未」の条件チェック
  console.log('\n--- 条件A チェック ---');
  const hasViewingTypeGeneral = !!(data.viewing_type_general && String(data.viewing_type_general).trim());
  const hasViewingDate = !!(data.latest_viewing_date && String(data.latest_viewing_date).trim());
  const noViewingResult = !(data.viewing_result_follow_up && String(data.viewing_result_follow_up).trim());

  console.log('viewing_type_general:', data.viewing_type_general);
  console.log('viewing_type_general が非空?', hasViewingTypeGeneral);
  console.log('latest_viewing_date:', data.latest_viewing_date);
  console.log('latest_viewing_date が非空?', hasViewingDate);
  console.log('viewing_result_follow_up:', data.viewing_result_follow_up);
  console.log('viewing_result_follow_up が空?', noViewingResult);

  if (data.latest_viewing_date) {
    const parts = String(data.latest_viewing_date).includes('/')
      ? String(data.latest_viewing_date).split('/')
      : String(data.latest_viewing_date).split('-');
    const viewingDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    viewingDate.setHours(0, 0, 0, 0);

    const now = new Date();
    const jstOffset = 9 * 60 * 60000;
    const today = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + jstOffset);
    today.setHours(0, 0, 0, 0);

    const threshold = new Date(2025, 7, 1); // 2025-08-01
    threshold.setHours(0, 0, 0, 0);

    console.log('内覧日(parsed):', viewingDate.toISOString());
    console.log('今日(JST):', today.toISOString());
    console.log('isPast (内覧日 < 今日)?', viewingDate < today);
    console.log('isAfterOrEqual (内覧日 >= 2025-08-01)?', viewingDate >= threshold);
  }

  console.log('\n--- 条件B チェック ---');
  console.log('post_viewing_seller_contact:', data.post_viewing_seller_contact);
  console.log('post_viewing_seller_contact === "未"?', data.post_viewing_seller_contact === '未');

  const conditionA = hasViewingTypeGeneral && hasViewingDate && noViewingResult;
  const conditionB = data.post_viewing_seller_contact === '未';
  console.log('\n--- 総合判定 ---');
  console.log('条件A (日付チェック除く):', conditionA);
  console.log('条件B:', conditionB);
  console.log('OR(A, B):', conditionA || conditionB);
}

main().catch(console.error);
