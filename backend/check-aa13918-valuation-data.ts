import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkAA13918() {
  console.log('🔍 AA13918のデータを確認中...\n');

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('*')
    .eq('seller_number', 'AA13918')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!seller) {
    console.log('❌ AA13918が見つかりません');
    return;
  }

  console.log('📊 AA13918のデータ:');
  console.log('  売主番号:', seller.seller_number);
  console.log('  状況（当社）:', seller.status);
  console.log('  営担:', seller.visit_assignee);
  console.log('  反響日付:', seller.inquiry_date);
  console.log('  査定方法:', seller.valuation_method);
  console.log('  郵送ステータス:', seller.mailing_status);
  console.log('  査定額1:', seller.valuation_amount_1);
  console.log('  査定額2:', seller.valuation_amount_2);
  console.log('  査定額3:', seller.valuation_amount_3);
  console.log('  次電日:', seller.next_call_date);
  console.log('  不通:', seller.unreachable_status);
  console.log('  確度:', seller.confidence_level);
  console.log('  除外日:', seller.exclusion_date);
  console.log('  電話担当:', seller.phone_contact_person);
  console.log('  連絡取りやすい時間:', seller.preferred_contact_time);
  console.log('  連絡方法:', seller.contact_method);

  console.log('\n✅ 未査定の条件チェック:');
  console.log('  1. 査定方法が「不要」ではない:', seller.valuation_method !== '不要');
  console.log('  2. 状況に「追客中」が含まれる:', seller.status?.includes('追客中'));
  console.log('  3. 営担が空:', !seller.visit_assignee || seller.visit_assignee.trim() === '');
  console.log('  4. 査定額が全て空:', !seller.valuation_amount_1 && !seller.valuation_amount_2 && !seller.valuation_amount_3);
  console.log('  5. 反響日付が2025/12/8以降:', seller.inquiry_date >= '2025-12-08');

  console.log('\n✅ 当日TEL_未着手の条件チェック:');
  const hasInfo = seller.phone_contact_person?.trim() || seller.preferred_contact_time?.trim() || seller.contact_method?.trim();
  const todayStr = new Date().toISOString().split('T')[0];
  console.log('  1. 状況が「追客中」（完全一致）:', seller.status === '追客中');
  console.log('  2. 次電日が今日以前:', seller.next_call_date && seller.next_call_date <= todayStr);
  console.log('  3. コミュニケーション情報が全て空:', !hasInfo);
  console.log('  4. 不通が空:', !seller.unreachable_status || seller.unreachable_status.trim() === '');
  console.log('  5. 確度が「ダブり」「D」「AI査定」ではない:', seller.confidence_level !== 'ダブり' && seller.confidence_level !== 'D' && seller.confidence_level !== 'AI査定');
  console.log('  6. 除外日が空:', !seller.exclusion_date || seller.exclusion_date.trim() === '');
  console.log('  7. 反響日付が2026/1/1以降:', seller.inquiry_date >= '2026-01-01');

  const isTodayCallNotStarted = (
    seller.status === '追客中' &&
    seller.next_call_date && seller.next_call_date <= todayStr &&
    !hasInfo &&
    (!seller.unreachable_status || seller.unreachable_status.trim() === '') &&
    seller.confidence_level !== 'ダブり' && seller.confidence_level !== 'D' && seller.confidence_level !== 'AI査定' &&
    (!seller.exclusion_date || seller.exclusion_date.trim() === '') &&
    seller.inquiry_date >= '2026-01-01'
  );

  console.log('\n🎯 結論:');
  console.log('  当日TEL_未着手に該当:', isTodayCallNotStarted);
  console.log('  未査定に該当すべき:', !isTodayCallNotStarted && seller.valuation_method !== '不要');
}

checkAA13918().catch(console.error);
