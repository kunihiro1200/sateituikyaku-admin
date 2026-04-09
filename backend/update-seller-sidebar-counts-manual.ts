import { createClient } from '@supabase/supabase-js';
import { SellerSidebarCountsUpdateService } from './src/services/SellerSidebarCountsUpdateService';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

(async () => {
  console.log('🚀 サイドバーカウント更新を開始...');
  const service = new SellerSidebarCountsUpdateService(supabase);
  await service.updateSellerSidebarCounts();
  console.log('✅ サイドバーカウント更新が完了しました');
  
  // 更新後のカウントを確認
  const { data, error } = await supabase
    .from('seller_sidebar_counts')
    .select('*')
    .eq('category', 'todayCall')
    .is('label', null)
    .is('assignee', null);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log('\n📊 更新後の「当日TEL分」カテゴリ:');
  console.log('件数:', data[0].count);
  console.log('最終更新日時:', data[0].updated_at);
})();
