import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSeller() {
  const { data, error } = await supabase
    .from('sellers')
    .select('seller_number, status, next_call_date, visit_assignee, contact_method, preferred_contact_time, phone_contact_person')
    .eq('seller_number', 'AA13755')
    .single();
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('AA13755のデータ:');
  console.log('売主番号:', data.seller_number);
  console.log('状況（当社）:', data.status);
  console.log('次電日:', data.next_call_date);
  console.log('営担:', data.visit_assignee);
  console.log('連絡方法:', data.contact_method);
  console.log('連絡取りやすい時間:', data.preferred_contact_time);
  console.log('電話担当:', data.phone_contact_person);
  
  // 今日の日付
  const today = new Date().toISOString().split('T')[0];
  console.log('\n今日の日付:', today);
  
  // 当日TEL分の条件チェック
  console.log('\n当日TEL分の条件チェック:');
  console.log('1. 状況に「追客中」が含まれる:', data.status?.includes('追客中'));
  console.log('2. 次電日が今日以前:', data.next_call_date, '<=', today, '=', data.next_call_date <= today);
  console.log('3. コミュニケーション情報が全て空:', !data.contact_method && !data.preferred_contact_time && !data.phone_contact_person);
  console.log('4. 営担が空:', !data.visit_assignee || data.visit_assignee === '外す');
  
  // 結論
  const shouldBeInTodayCall = 
    data.status?.includes('追客中') &&
    data.next_call_date <= today &&
    !data.contact_method && !data.preferred_contact_time && !data.phone_contact_person &&
    (!data.visit_assignee || data.visit_assignee === '外す');
  
  console.log('\n結論: 当日TEL分に含まれるべきか?', shouldBeInTodayCall ? 'はい' : 'いいえ');
}

checkSeller();
