import { config } from 'dotenv';
import { resolve } from 'path';
import { createClient } from '@supabase/supabase-js';
import { SellerSidebarCountsUpdateService } from './src/services/SellerSidebarCountsUpdateService';

// .env.localを読み込む
config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

console.log('🔧 Supabase URL:', supabaseUrl ? '✅ 設定済み' : '❌ 未設定');
console.log('🔧 Supabase Key:', supabaseKey ? '✅ 設定済み' : '❌ 未設定');
console.log('');

const supabase = createClient(supabaseUrl, supabaseKey);

async function forceUpdateSidebarCounts() {
  console.log('🔄 サイドバーカウントを強制更新します...\n');

  try {
    const service = new SellerSidebarCountsUpdateService(supabase);
    await service.updateAllCounts();
    
    console.log('\n✅ サイドバーカウントの更新が完了しました');
    
    // マッチングカウントを確認
    const { data: matchingCount } = await supabase
      .from('seller_sidebar_counts')
      .select('count')
      .eq('category', 'matching')
      .is('label', null)
      .is('assignee', null)
      .single();
    
    console.log('\n📊 マッチングカウント:', matchingCount?.count || 0);
    
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

forceUpdateSidebarCounts();
