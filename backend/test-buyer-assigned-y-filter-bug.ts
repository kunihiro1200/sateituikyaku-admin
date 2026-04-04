/**
 * Bug Condition Exploration Test for 買主「担当(Y)」フィルタバグ
 * 
 * Property 1: Bug Condition - 担当(Y)カテゴリのフィルタリング不一致
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * Expected behavior:
 * - サイドバーカウント: 3件（GASが計算）
 * - 一覧表示: 3件（getBuyersByStatus('担当(Y)')が返す）
 * - 全ての買主が follow_up_assignee = 'Y' を満たす
 * 
 * Actual behavior (unfixed code):
 * - サイドバーカウント: 3件
 * - 一覧表示: 0件 ← バグ
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// 環境変数を読み込み（.env.localから）
dotenv.config({ path: path.join(__dirname, '.env.local') });

// 環境変数のクォートを削除（全ての環境変数に適用）
// IMPORTANT: これをインポート前に実行する必要がある
Object.keys(process.env).forEach(key => {
  if (process.env[key]) {
    process.env[key] = process.env[key]!.replace(/^"|"$/g, '');
  }
});

// 環境変数処理後にインポート
import { BuyerService } from './src/services/BuyerService';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

async function testBugCondition() {
  console.log('🔍 Bug Condition Exploration Test: 担当(Y)フィルタバグ');
  console.log('');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const buyerService = new BuyerService();

  // Step 1: サイドバーカウントを取得（GASが計算した値）
  console.log('Step 1: サイドバーカウントを取得');
  const { data: sidebarCounts, error: sidebarError } = await supabase
    .from('buyer_sidebar_counts')
    .select('*')
    .eq('category', 'assigned')
    .eq('assignee', 'Y')
    .single();

  if (sidebarError) {
    console.error('❌ サイドバーカウント取得エラー:', sidebarError);
    process.exit(1);
  }

  const sidebarCount = sidebarCounts?.count || 0;
  console.log(`  サイドバーカウント: ${sidebarCount}件`);
  console.log('');

  // Step 2: 一覧表示を取得（getBuyersByStatus('担当(Y)')）
  console.log('Step 2: 一覧表示を取得');
  const listResult = await buyerService.getBuyersByStatus('担当(Y)', { limit: 100 });
  console.log(`  一覧表示件数: ${listResult.total}件`);
  console.log('');

  // Step 3: 買主の詳細を確認
  console.log('Step 3: 買主の詳細を確認');
  if (listResult.data.length > 0) {
    console.log('  買主一覧:');
    listResult.data.forEach((buyer: any) => {
      console.log(`    - ${buyer.buyer_number}: follow_up_assignee=${buyer.follow_up_assignee}, calculated_status=${buyer.calculated_status}`);
    });
  } else {
    console.log('  ⚠️ 買主が0件です（バグの症状）');
  }
  console.log('');

  // Step 4: follow_up_assignee = 'Y' の買主を直接取得
  console.log('Step 4: follow_up_assignee = \'Y\' の買主を直接取得');
  const { data: directBuyers, error: directError } = await supabase
    .from('buyers')
    .select('buyer_number, follow_up_assignee, initial_assignee, viewing_date, next_call_date, latest_status')
    .or('follow_up_assignee.eq.Y,and(follow_up_assignee.is.null,initial_assignee.eq.Y)')
    .limit(100);

  if (directError) {
    console.error('❌ 直接取得エラー:', directError);
    process.exit(1);
  }

  console.log(`  直接取得件数: ${directBuyers?.length || 0}件`);
  if (directBuyers && directBuyers.length > 0) {
    console.log('  買主一覧:');
    directBuyers.forEach((buyer: any) => {
      console.log(`    - ${buyer.buyer_number}: follow_up_assignee=${buyer.follow_up_assignee}, initial_assignee=${buyer.initial_assignee}`);
    });
  }
  console.log('');

  // Step 5: テスト結果を判定
  console.log('Step 5: テスト結果を判定');
  console.log('');

  const expectedCount = sidebarCount;
  const actualCount = listResult.total;

  console.log('📊 テスト結果:');
  console.log(`  期待値: ${expectedCount}件`);
  console.log(`  実際値: ${actualCount}件`);
  console.log('');

  if (actualCount === expectedCount) {
    console.log('✅ テスト成功: サイドバーカウントと一覧表示件数が一致しています');
    console.log('');
    console.log('🎉 バグが修正されました！');
    process.exit(0);
  } else {
    console.log('❌ テスト失敗: サイドバーカウントと一覧表示件数が不一致です');
    console.log('');
    console.log('🐛 バグが存在します（これは期待される結果です - 未修正コードでテストを実行しています）');
    console.log('');
    console.log('Counterexamples:');
    console.log(`  - サイドバーカウント: ${sidebarCount}件`);
    console.log(`  - 一覧表示: ${actualCount}件`);
    console.log(`  - 差分: ${sidebarCount - actualCount}件`);
    console.log('');
    console.log('Root Cause:');
    console.log('  - GASは follow_up_assignee = \'Y\' の全買主をカウント');
    console.log('  - TypeScriptは calculated_status = \'担当(Y)\' でフィルタリング');
    console.log('  - BuyerStatusCalculatorが follow_up_assignee = \'Y\' の買主を3つのステータスに分類:');
    console.log('    1. 内覧済み(Y) - 内覧日が過去');
    console.log('    2. 当日TEL(Y) - 次電日が今日以前');
    console.log('    3. 担当(Y) - それ以外');
    console.log('');
    console.log('Fix Required:');
    console.log('  - getBuyersByStatus(\'担当(Y)\') を修正して、follow_up_assignee = \'Y\' の全買主を返すようにする');
    
    process.exit(1);
  }
}

testBugCondition().catch(error => {
  console.error('❌ テスト実行エラー:', error);
  process.exit(1);
});
