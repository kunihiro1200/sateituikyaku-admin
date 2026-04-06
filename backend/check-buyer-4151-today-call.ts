import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuyer4151() {
  console.log('🔍 買主4151の「当日TEL」表示問題を調査します...\n');

  // 買主4151のデータを取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', '4151')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!buyer) {
    console.log('❌ 買主4151が見つかりませんでした');
    return;
  }

  console.log('✅ 買主4151のデータ:');
  console.log('  - buyer_number:', buyer.buyer_number);
  console.log('  - follow_up_assignee:', buyer.follow_up_assignee);
  console.log('  - next_call_date:', buyer.next_call_date);
  console.log('  - latest_status:', buyer.latest_status);
  console.log('  - viewing_date:', buyer.viewing_date);
  console.log('  - broker_inquiry:', buyer.broker_inquiry);
  console.log('  - inquiry_email_phone:', buyer.inquiry_email_phone);
  console.log('  - inquiry_email_reply:', buyer.inquiry_email_reply);
  console.log('  - three_calls_confirmed:', buyer.three_calls_confirmed);

  // 今日の日付
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  console.log('\n📅 今日の日付:', todayStr);

  // 「当日TEL」の条件をチェック
  console.log('\n🔍 「当日TEL」の条件チェック:');
  
  const hasFollowUpAssignee = buyer.follow_up_assignee && buyer.follow_up_assignee.trim() !== '';
  const hasNextCallDate = buyer.next_call_date && buyer.next_call_date.trim() !== '';
  const nextCallDateStr = buyer.next_call_date ? buyer.next_call_date.substring(0, 10) : null;
  const isTodayOrPast = nextCallDateStr ? nextCallDateStr <= todayStr : false;

  console.log('  1. follow_up_assignee が空:', !hasFollowUpAssignee, `(値: "${buyer.follow_up_assignee}")`);
  console.log('  2. next_call_date が空でない:', hasNextCallDate, `(値: "${buyer.next_call_date}")`);
  console.log('  3. next_call_date が今日以前:', isTodayOrPast, `(next_call_date: "${nextCallDateStr}", today: "${todayStr}")`);

  const shouldBeInTodayCall = !hasFollowUpAssignee && hasNextCallDate && isTodayOrPast;
  console.log('\n✅ 「当日TEL」に表示されるべきか:', shouldBeInTodayCall);

  if (!shouldBeInTodayCall) {
    console.log('\n❌ 「当日TEL」の条件を満たしていません:');
    if (hasFollowUpAssignee) {
      console.log('  - follow_up_assignee が入力されています（担当あり）');
      console.log('  → 「当日TEL(担当)」カテゴリに分類されます');
    }
    if (!hasNextCallDate) {
      console.log('  - next_call_date が空です');
    }
    if (!isTodayOrPast) {
      console.log('  - next_call_date が今日より未来です');
    }
  }

  // 他の優先度の高いカテゴリをチェック
  console.log('\n🔍 他のカテゴリの条件チェック:');
  
  // Priority 3: 内覧日前日
  if (buyer.viewing_date) {
    const viewingDateStr = buyer.viewing_date.substring(0, 10);
    const viewingDate = new Date(viewingDateStr);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowStr = dayAfterTomorrow.toISOString().split('T')[0];
    
    const dayOfWeek = viewingDate.getDay();
    const isThursday = dayOfWeek === 4;
    
    const isViewingDayBefore = (viewingDateStr === tomorrowStr && !isThursday) || (viewingDateStr === dayAfterTomorrowStr && isThursday);
    
    console.log('  - 内覧日前日:', isViewingDayBefore, `(viewing_date: "${viewingDateStr}", tomorrow: "${tomorrowStr}", dayAfterTomorrow: "${dayAfterTomorrowStr}", isThursday: ${isThursday})`);
  }

  // Priority 5: 問合メール未対応
  const isInquiryEmailUnanswered = 
    buyer.inquiry_email_phone === '未' ||
    buyer.inquiry_email_reply === '未' ||
    (
      !buyer.viewing_date &&
      buyer.inquiry_email_phone === '不要' &&
      (buyer.inquiry_email_reply === '未' || !buyer.inquiry_email_reply)
    );
  console.log('  - 問合メール未対応:', isInquiryEmailUnanswered);

  // Priority 7: 3回架電未
  const isThreeCallUnchecked = 
    buyer.three_calls_confirmed === '3回架電未' &&
    (buyer.inquiry_email_phone === '不通' || buyer.inquiry_email_phone === '未');
  console.log('  - 3回架電未:', isThreeCallUnchecked);
}

checkBuyer4151().catch(console.error);
