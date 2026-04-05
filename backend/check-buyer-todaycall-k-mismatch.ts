import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMismatch() {
  console.log('🔍 当日TEL(K)カテゴリのカウント不一致を調査中...\n');

  // 1. サイドバーカウントを取得
  const { data: sidebarData, error: sidebarError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'todayCallAssigned')
    .eq('assignee', 'K');

  if (sidebarError) {
    console.error('❌ サイドバーカウント取得エラー:', sidebarError);
    return;
  }

  const sidebarCount = sidebarData?.[0]?.count || 0;
  console.log(`📊 サイドバーカウント: ${sidebarCount}件\n`);

  // 2. 全買主データを取得
  const { data: allBuyers, error: buyersError } = await supabase
    .from('buyers')
    .select('buyer_number, follow_up_assignee, next_call_date');

  if (buyersError) {
    console.error('❌ 買主データ取得エラー:', buyersError);
    return;
  }

  console.log(`📊 全買主データ: ${allBuyers?.length}件\n`);

  // 3. 当日TEL(K)の条件を満たす買主を手動計算
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  console.log(`📅 今日の日付: ${today.toISOString().split('T')[0]}\n`);

  const matchingBuyers = allBuyers?.filter(buyer => {
    // 条件1: follow_up_assignee が 'K'
    if (buyer.follow_up_assignee !== 'K') return false;

    // 条件2: next_call_date が空でない
    if (!buyer.next_call_date) return false;

    // 条件3: next_call_date が今日以前
    const nextCallDate = new Date(buyer.next_call_date);
    nextCallDate.setHours(0, 0, 0, 0);
    
    return nextCallDate.getTime() <= today.getTime();
  }) || [];

  console.log(`🔢 手動計算結果: ${matchingBuyers.length}件\n`);

  if (matchingBuyers.length > 0) {
    console.log('✅ 当日TEL(K)の条件を満たす買主:');
    matchingBuyers.forEach(buyer => {
      const nextCallDate = new Date(buyer.next_call_date);
      nextCallDate.setHours(0, 0, 0, 0);
      console.log(`  - ${buyer.buyer_number}: follow_up_assignee=${buyer.follow_up_assignee}, next_call_date=${buyer.next_call_date} (${nextCallDate.toISOString().split('T')[0]})`);
    });
  } else {
    console.log('⚠️  当日TEL(K)の条件を満たす買主が見つかりません');
  }

  console.log('\n========================================');
  console.log('📊 比較:');
  console.log(`  - サイドバーカウント: ${sidebarCount}件`);
  console.log(`  - 手動計算結果: ${matchingBuyers.length}件`);
  console.log(`  - 差分: ${Math.abs(sidebarCount - matchingBuyers.length)}件`);
  console.log('========================================\n');

  if (sidebarCount !== matchingBuyers.length) {
    console.log('❌ カウント不一致が確認されました！');
    console.log('   GASの updateBuyerSidebarCounts_ 関数を実行して、サイドバーカウントを更新してください。');
    console.log('\n📋 手順:');
    console.log('   1. Google スプレッドシート「買主リスト」を開く');
    console.log('   2. 「拡張機能」→「Apps Script」を選択');
    console.log('   3. 関数選択で「updateBuyerSidebarCounts_」を選択');
    console.log('   4. 「実行」ボタンをクリック');
    console.log('   5. 実行ログを確認');
  } else {
    console.log('✅ カウントが一致しています！');
  }
}

checkMismatch().catch(console.error);
