/**
 * 買主サイドバーパフォーマンスバグ - バグ条件探索テスト
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: Bug Condition - buyer_sidebar_counts テーブル全削除バグ
 *
 * バグの本質:
 *   `invalidateBuyerStatusCache()` が `buyer_sidebar_counts` テーブルを全削除する。
 *   その結果、次回 `getSidebarCounts()` 呼び出し時にフォールバック計算（約20秒）が実行される。
 *
 * **CRITICAL**: このテストは未修正コードで FAIL する必要がある - 失敗がバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードする - 修正後にパスすることで修正を検証する
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { BuyerService, invalidateBuyerStatusCache } from '../services/BuyerService';

// 環境変数を読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check backend/.env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * isBugCondition: buyer_sidebar_counts テーブルの行数 = 0 の場合 true
 */
async function isBugCondition(): Promise<boolean> {
  const { count, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[isBugCondition] Error:', error);
    return false;
  }

  return (count ?? 0) === 0;
}

/**
 * buyer_sidebar_counts テーブルの行数を取得する
 */
async function getBuyerSidebarCountsRowCount(): Promise<number> {
  const { count, error } = await supabase
    .from('buyer_sidebar_counts')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('[getBuyerSidebarCountsRowCount] Error:', error);
    return -1;
  }

  return count ?? 0;
}

describe('買主サイドバーパフォーマンスバグ - バグ条件探索', () => {
  let buyerService: BuyerService;

  beforeAll(() => {
    buyerService = new BuyerService();
  });

  /**
   * Property 1: Bug Condition - テーブル全削除の確認
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * `invalidateBuyerStatusCache()` を呼び出した後、
   * `buyer_sidebar_counts` テーブルが空になることを確認する。
   *
   * **CRITICAL**: このテストは未修正コードで FAIL する
   * 期待される動作（修正後）: テーブルが空にならない
   */
  it('Property 1: invalidateBuyerStatusCache() 呼び出し後にテーブルが空にならないこと（バグ条件）', async () => {
    console.log('\n========================================');
    console.log('🔍 バグ条件探索テスト開始: テーブル全削除確認');
    console.log('========================================\n');

    // ステップ1: 呼び出し前のテーブル行数を確認
    const rowCountBefore = await getBuyerSidebarCountsRowCount();
    console.log(`📊 ステップ1: invalidateBuyerStatusCache() 呼び出し前のテーブル行数: ${rowCountBefore}件`);

    if (rowCountBefore === 0) {
      console.log('⚠️  テーブルが既に空です。テストの前提条件が満たされていません。');
      console.log('   buyer_sidebar_counts テーブルにデータが必要です。');
      console.log('   /api/buyers/update-sidebar-counts を呼び出してデータを投入してください。');
    }

    // ステップ2: invalidateBuyerStatusCache() を呼び出す
    console.log('\n🔄 ステップ2: invalidateBuyerStatusCache() を呼び出す');
    await invalidateBuyerStatusCache();
    console.log('   ✅ invalidateBuyerStatusCache() 完了');

    // ステップ3: 呼び出し後のテーブル行数を確認
    const rowCountAfter = await getBuyerSidebarCountsRowCount();
    console.log(`\n📊 ステップ3: invalidateBuyerStatusCache() 呼び出し後のテーブル行数: ${rowCountAfter}件`);

    // ステップ4: バグ条件の確認
    const bugConditionActive = await isBugCondition();
    console.log(`\n🚨 ステップ4: バグ条件 (isBugCondition): ${bugConditionActive}`);

    if (bugConditionActive) {
      console.log('   ❌ バグ確認: テーブルが空になりました（バグあり）');
      console.log('   → invalidateBuyerStatusCache() が buyer_sidebar_counts テーブルを全削除している');
    } else {
      console.log('   ✅ テーブルにデータが残っています（バグなし）');
    }

    console.log('\n========================================');
    console.log('📋 テスト結果サマリー:');
    console.log(`   呼び出し前: ${rowCountBefore}件`);
    console.log(`   呼び出し後: ${rowCountAfter}件`);
    console.log(`   バグ条件: ${bugConditionActive ? '✅ 確認（テーブルが空）' : '❌ 未確認（テーブルにデータあり）'}`);
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 期待される動作: invalidateBuyerStatusCache() 後もテーブルが空にならない
    // 未修正コードでは: テーブルが全削除されて rowCountAfter = 0 になる → FAIL
    expect(rowCountAfter).toBeGreaterThan(0);
  }, 60000); // タイムアウト60秒

  /**
   * Property 1 (修正確認): invalidateBuyerStatusCache() 後もテーブルにデータが残ること
   *
   * **Validates: Requirements 1.1, 1.2**
   *
   * 修正後: invalidateBuyerStatusCache() を呼び出してもテーブルが空にならないため、
   * getSidebarCounts() は高速に応答できる。
   */
  it('Property 1: invalidateBuyerStatusCache() 後もテーブルにデータが残り getSidebarCounts() が高速に応答すること', async () => {
    console.log('\n========================================');
    console.log('🔍 バグ修正確認テスト: invalidateBuyerStatusCache() 後の応答時間');
    console.log('========================================\n');

    // ステップ1: テーブルにデータを確保
    let rowCountBefore = await getBuyerSidebarCountsRowCount();
    console.log(`📊 ステップ1: テーブル行数（確保前）: ${rowCountBefore}件`);

    if (rowCountBefore === 0) {
      const { createClient: cc } = await import('@supabase/supabase-js');
      const sb = cc(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      await sb.from('buyer_sidebar_counts').insert([
        { category: 'all', assignee: '', label: '全件', count: 100, updated_at: new Date().toISOString() },
      ]);
      rowCountBefore = await getBuyerSidebarCountsRowCount();
      console.log(`   テストデータ投入後: ${rowCountBefore}件`);
    }

    // ステップ2: invalidateBuyerStatusCache() を呼び出す
    console.log('\n🔄 ステップ2: invalidateBuyerStatusCache() を呼び出す');
    await invalidateBuyerStatusCache();
    console.log('   ✅ invalidateBuyerStatusCache() 完了');

    // ステップ3: テーブルにデータが残っていることを確認（修正後の期待動作）
    const rowCountAfter = await getBuyerSidebarCountsRowCount();
    console.log(`\n📊 ステップ3: invalidateBuyerStatusCache() 後のテーブル行数: ${rowCountAfter}件`);

    // ステップ4: getSidebarCounts() の応答時間を計測
    console.log('\n⏱️  ステップ4: getSidebarCounts() を呼び出して応答時間を計測');
    const startTime = Date.now();
    const FAST_THRESHOLD_MS = 5000;

    const timeoutPromise = new Promise<'timeout'>((resolve) =>
      setTimeout(() => resolve('timeout'), 6000)
    );
    const fetchPromise = buyerService.getSidebarCounts().then(() => 'done' as const);

    const winner = await Promise.race([fetchPromise, timeoutPromise]);
    const duration = Date.now() - startTime;

    console.log('\n========================================');
    console.log('📋 テスト結果サマリー:');
    console.log(`   テーブル行数（修正後）: ${rowCountAfter}件`);
    console.log(`   応答時間: ${winner === 'timeout' ? '>6000ms（タイムアウト）' : `${duration}ms`}`);
    console.log(`   テーブルが空にならない: ${rowCountAfter > 0 ? '✅ YES（修正済み）' : '❌ NO（バグあり）'}`);
    console.log(`   5秒未満で応答: ${winner !== 'timeout' && duration < FAST_THRESHOLD_MS ? '✅ YES（正常）' : '❌ NO（異常）'}`);
    console.log('========================================\n');

    // 修正後: テーブルが空にならない
    expect(rowCountAfter).toBeGreaterThan(0);
    // 修正後: テーブルにデータがあるので高速に応答する
    expect(winner).not.toBe('timeout');
    expect(duration).toBeLessThan(FAST_THRESHOLD_MS);
  }, 30000); // タイムアウト30秒
});
