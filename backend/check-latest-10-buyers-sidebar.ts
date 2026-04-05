import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function checkLatest10BuyersSidebar() {
  console.log('🔍 最新10件の買主のサイドバーカウント更新を確認...\n');

  // 最新10件の買主番号
  const buyerNumbers = ['7201', '7286', '7288', '7289', '7290', '7282', '7285', '7273', '7274'];

  // buyer_sidebar_countsテーブルから最新の更新を取得
  const { data: sidebarCounts, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('❌ エラー:', error);
    return;
  }

  console.log('📊 最新のサイドバーカウント更新（上位20件）:\n');
  
  if (!sidebarCounts || sidebarCounts.length === 0) {
    console.log('⚠️ サイドバーカウントが見つかりません');
    return;
  }

  sidebarCounts.forEach((count, index) => {
    const updatedAt = new Date(count.updated_at);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - updatedAt.getTime()) / 1000 / 60);
    
    console.log(`${index + 1}. Category: ${count.category}`);
    console.log(`   Label: ${count.label || 'null'}`);
    console.log(`   Assignee: ${count.assignee || 'null'}`);
    console.log(`   Count: ${count.count}`);
    console.log(`   Updated: ${updatedAt.toISOString()} (${diffMinutes}分前)\n`);
  });

  // 最新の更新が5分以内かチェック
  const latestUpdate = new Date(sidebarCounts[0].updated_at);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - latestUpdate.getTime()) / 1000 / 60);

  if (diffMinutes <= 5) {
    console.log('✅ サイドバーカウントが最近更新されています（5分以内）');
  } else {
    console.log(`⚠️ サイドバーカウントの最終更新は ${diffMinutes}分前です`);
  }
}

checkLatest10BuyersSidebar().catch(console.error);
