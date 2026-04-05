import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { SidebarCountsUpdateService } from './src/services/SidebarCountsUpdateService';

dotenv.config({ path: 'backend/.env' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testBuyer5641SidebarUpdate() {
  console.log('=== 買主5641のサイドバーカウント更新テスト ===\n');

  // 買主5641のデータを取得
  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('*')
    .eq('buyer_number', 5641)
    .single();

  if (error || !buyer) {
    console.error('❌ 買主5641が見つかりません:', error);
    return;
  }

  console.log('📊 買主5641の現在のデータ:');
  console.log('  buyer_number:', buyer.buyer_number);
  console.log('  follow_up_assignee:', buyer.follow_up_assignee);
  console.log('  next_call_date:', buyer.next_call_date);
  console.log('');

  // サイドバーカウント更新サービスを実行
  console.log('🔄 SidebarCountsUpdateService.updateBuyerSidebarCounts() を実行...');
  const sidebarService = new SidebarCountsUpdateService(supabase);
  await sidebarService.updateBuyerSidebarCounts('5641');
  console.log('✅ 完了');
  console.log('');

  // buyer_sidebar_countsテーブルを確認
  console.log('🔍 buyer_sidebar_countsテーブルを確認:');
  const { data: counts, error: countsError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCall');

  if (countsError) {
    console.error('❌ エラー:', countsError);
  } else {
    console.log('  todayCallカテゴリーのカウント:', counts);
  }
}

testBuyer5641SidebarUpdate().catch(console.error);
