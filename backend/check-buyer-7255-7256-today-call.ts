import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyers() {
  console.log('=== 買主7255と7256の「当日TEL」条件チェック ===\n');

  const buyerNumbers = ['7255', '7256'];

  for (const buyerNumber of buyerNumbers) {
    console.log(`\n--- 買主${buyerNumber} ---`);

    const { data: buyer, error } = await supabase
      .from('buyers')
      .select('*')
      .eq('buyer_number', buyerNumber)
      .single();

    if (error || !buyer) {
      console.log(`❌ 買主${buyerNumber}が見つかりません`);
      continue;
    }

    console.log(`買主番号: ${buyer.buyer_number}`);
    console.log(`名前: ${buyer.name}`);
    console.log(`最新状況: ${buyer.latest_status}`);
    console.log(`次電日: ${buyer.next_call_date}`);
    console.log(`後続担当: ${buyer.follow_up_assignee}`);
    console.log(`初動担当: ${buyer.initial_assignee}`);
    console.log(`連絡方法: ${buyer.contact_method}`);
    console.log(`連絡取りやすい時間: ${buyer.preferred_contact_time}`);
    console.log(`電話担当: ${buyer.phone_contact_person}`);

    // 「当日TEL」の条件チェック（スプレッドシートの数式に基づく）
    console.log('\n【当日TEL条件チェック】');

    // 条件1: follow_up_assigneeが空
    const hasNoFollowUpAssignee = !buyer.follow_up_assignee;
    console.log(`1. 後続担当が空: ${hasNoFollowUpAssignee ? '✅' : '❌'} (follow_up_assignee: ${buyer.follow_up_assignee || '(空)'})`);

    // 条件2: next_call_dateが空でない
    const hasNextCallDate = !!buyer.next_call_date;
    console.log(`2. 次電日が空でない: ${hasNextCallDate ? '✅' : '❌'} (next_call_date: ${buyer.next_call_date || '(空)'})`);

    // 条件3: next_call_dateが今日以前
    const today = new Date('2026-04-04'); // 今日の日付を固定
    today.setHours(0, 0, 0, 0);
    const nextCallDate = buyer.next_call_date ? new Date(buyer.next_call_date) : null;
    if (nextCallDate) {
      nextCallDate.setHours(0, 0, 0, 0);
    }
    const isTodayOrBefore = nextCallDate ? nextCallDate <= today : false;
    console.log(`3. 次電日が今日以前: ${isTodayOrBefore ? '✅' : '❌'} (next_call_date: ${buyer.next_call_date}, today: ${today.toISOString().split('T')[0]})`);

    // 総合判定
    const isTodayCall = hasNoFollowUpAssignee && hasNextCallDate && isTodayOrBefore;
    console.log(`\n【総合判定】: ${isTodayCall ? '✅ 当日TELに該当' : '❌ 当日TELに該当しない'}`);
  }
}

checkBuyers().catch(console.error);
