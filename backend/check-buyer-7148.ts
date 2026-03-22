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
      post_viewing_seller_contact,
      viewing_result_follow_up,
      follow_up_assignee,
      next_call_date,
      latest_status,
      viewing_unconfirmed
    `)
    .eq('buyer_number', '7148')
    .single();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('7148のデータ:');
  console.log(JSON.stringify(data, null, 2));

  // 「一般媒介_内覧後売主連絡未」の条件チェック
  console.log('\n--- 条件チェック ---');
  console.log('viewing_type_general:', data.viewing_type_general);
  console.log('「一般・公開中」を含む?', data.viewing_type_general?.includes('一般・公開中'));
  console.log('latest_viewing_date:', data.latest_viewing_date);
  console.log('post_viewing_seller_contact:', data.post_viewing_seller_contact);
  
  if (data.latest_viewing_date) {
    const viewingDate = new Date(data.latest_viewing_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threshold = new Date('2026-03-01');
    console.log('内覧日が過去?', viewingDate < today);
    console.log('内覧日が2026/3/1以降?', viewingDate >= threshold);
  }
}

main().catch(console.error);
