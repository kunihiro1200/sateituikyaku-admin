import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'backend/.env' });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAA13762Status() {
  console.log('🔍 AA13762のデータを確認中...\n');

  const { data: seller, error } = await supabase
    .from('sellers')
    .select('seller_number, status, visit_assignee, next_call_date')
    .eq('seller_number', 'AA13762')
    .single();

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  if (!seller) {
    console.log('❌ AA13762が見つかりません');
    return;
  }

  console.log('📊 AA13762のデータ:');
  console.log('  売主番号:', seller.seller_number);
  console.log('  状況（当社）:', seller.status);
  console.log('  営担:', seller.visit_assignee);
  console.log('  次電日:', seller.next_call_date);
  console.log('');

  // フィルター条件をチェック
  console.log('🔍 フィルター条件チェック:');
  
  // 営担チェック
  const hasVisitAssignee = seller.visit_assignee && seller.visit_assignee.trim() !== '' && seller.visit_assignee.trim() !== '外す';
  console.log('  営担あり:', hasVisitAssignee, `(値: "${seller.visit_assignee}")`);
  
  // 状況チェック
  const hasExclusiveOrGeneral = seller.status && (
    seller.status.includes('専任媒介') || 
    seller.status.includes('一般媒介')
  );
  console.log('  専任媒介/一般媒介を含む:', hasExclusiveOrGeneral);
  
  if (seller.status) {
    console.log('    - 専任媒介を含む:', seller.status.includes('専任媒介'));
    console.log('    - 一般媒介を含む:', seller.status.includes('一般媒介'));
  }
  
  // 次電日チェック
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextCallDate = seller.next_call_date ? new Date(seller.next_call_date) : null;
  if (nextCallDate) {
    nextCallDate.setHours(0, 0, 0, 0);
  }
  const isTodayOrBefore = nextCallDate && nextCallDate <= today;
  console.log('  次電日が今日以前:', isTodayOrBefore);
  
  console.log('');
  console.log('📝 結論:');
  
  if (hasVisitAssignee) {
    console.log('  ✅ 営担あり → 当日TEL（担当）の対象');
    
    if (hasExclusiveOrGeneral) {
      console.log('  ❌ 専任媒介/一般媒介を含む → 除外されるべき');
    } else {
      console.log('  ✅ 専任媒介/一般媒介を含まない → 表示OK');
    }
  } else {
    console.log('  ❌ 営担なし → 当日TEL（担当）の対象外');
  }
}

checkAA13762Status().catch(console.error);
