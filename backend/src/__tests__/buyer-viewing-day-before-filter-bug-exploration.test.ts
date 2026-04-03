/**
 * 買主「内覧日前日」フィルタバグ - バグ条件探索テスト
 * 
 * **Validates: Requirements 2.1, 2.2, 2.3**
 * 
 * このテストは修正前のコードで実行し、失敗することを確認する（失敗がバグの存在を証明）
 * 
 * バグ条件:
 * - サイドバーカウント: buyer_sidebar_counts テーブルから正しく3件を取得
 * - 一覧フィルタリング: getBuyersByStatus('内覧日前日') が全件を返す（フィルタリングが効いていない）
 * 
 * 根本原因（仮説）:
 * 1. サイドバーカウントとフィルタリングで異なるロジックを使用
 * 2. ページネーション問題（Supabaseのデフォルト1000件制限）
 * 3. calculated_status の計算ロジックが不一致
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { BuyerService } from '../services/BuyerService';

// 環境変数を読み込む（backendディレクトリの.envファイルを明示的に指定）
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables. Please check backend/.env file.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

describe('買主「内覧日前日」フィルタバグ - バグ条件探索', () => {
  let buyerService: BuyerService;

  beforeAll(() => {
    buyerService = new BuyerService();
  });

  /**
   * Property 1: Bug Condition - 内覧日前日カテゴリのフィルタリング不一致
   * 
   * **Validates: Requirements 2.1, 2.2, 2.3**
   * 
   * サイドバーカウントと一覧表示件数が一致すること
   * 
   * **CRITICAL**: このテストは未修正コードで FAIL する（これがバグの存在を証明する）
   */
  it('サイドバーカウントと一覧表示件数が不一致（バグ）', async () => {
    console.log('\n========================================');
    console.log('🔍 バグ条件探索テスト開始');
    console.log('========================================\n');

    // ステップ1: サイドバーカウントを取得
    console.log('📊 ステップ1: サイドバーカウントを取得');
    const sidebarCounts = await buyerService.getSidebarCounts();
    const viewingDayBeforeCategory = sidebarCounts.categories.find(
      c => c.status === '内覧日前日'
    );
    const sidebarCount = viewingDayBeforeCategory?.count || 0;
    console.log(`  ✅ サイドバーカウント: ${sidebarCount}件`);

    // ステップ2: 一覧フィルタリングを実行
    console.log('\n📋 ステップ2: 一覧フィルタリングを実行');
    const listResult = await buyerService.getBuyersByStatus('内覧日前日', {
      page: 1,
      limit: 100, // 十分な件数を取得
    });
    console.log(`  ✅ 一覧表示件数: ${listResult.total}件`);

    // ステップ3: buyer_sidebar_counts テーブルから直接取得
    console.log('\n🗄️  ステップ3: buyer_sidebar_counts テーブルから直接取得');
    const { data: sidebarCountsData } = await supabase
      .from('buyer_sidebar_counts')
      .select('*')
      .eq('category', 'viewingDayBefore');
    
    const directSidebarCount = sidebarCountsData?.reduce((sum, row) => sum + (row.count || 0), 0) || 0;
    console.log(`  ✅ buyer_sidebar_counts テーブル: ${directSidebarCount}件`);

    // ステップ4: 一覧表示の買主番号を確認
    console.log('\n🔢 ステップ4: 一覧表示の買主番号を確認');
    console.log(`  買主番号: ${listResult.data.map(b => b.buyer_number).join(', ')}`);

    // ステップ5: 各買主の calculated_status を確認
    console.log('\n🏷️  ステップ5: 各買主の calculated_status を確認');
    listResult.data.slice(0, 5).forEach(buyer => {
      console.log(`  - ${buyer.buyer_number}: ${buyer.calculated_status}`);
    });

    // ステップ6: バグの証明
    console.log('\n🚨 ステップ6: バグの証明');
    console.log(`  サイドバーカウント: ${sidebarCount}件`);
    console.log(`  一覧表示件数: ${listResult.total}件`);
    console.log(`  差分: ${Math.abs(sidebarCount - listResult.total)}件`);

    if (sidebarCount === listResult.total) {
      console.log('  ✅ カウント一致（バグなし）');
    } else {
      console.log('  ❌ カウント不一致（バグあり）');
    }

    console.log('\n========================================');
    console.log('🔍 バグ条件探索テスト終了');
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // これがバグの存在を証明する
    expect(sidebarCount).toBe(listResult.total);
  }, 30000); // タイムアウトを30秒に設定

  /**
   * Property 1 (詳細): 一覧表示の全買主が「内覧日前日」条件を満たすこと
   * 
   * **Validates: Requirements 2.2**
   * 
   * 一覧表示された全ての買主が「内覧日前日」の条件を満たすこと
   * 
   * **CRITICAL**: このテストは未修正コードで FAIL する可能性がある
   */
  it('一覧表示の全買主が「内覧日前日」条件を満たすこと（バグ）', async () => {
    console.log('\n========================================');
    console.log('🔍 詳細バグ条件探索テスト開始');
    console.log('========================================\n');

    // 一覧フィルタリングを実行
    const listResult = await buyerService.getBuyersByStatus('内覧日前日', {
      page: 1,
      limit: 100,
    });

    console.log(`📋 一覧表示件数: ${listResult.total}件`);

    // 各買主の calculated_status を確認
    const invalidBuyers = listResult.data.filter(
      buyer => buyer.calculated_status !== '内覧日前日'
    );

    console.log(`\n🏷️  calculated_status の確認:`);
    console.log(`  - 「内覧日前日」: ${listResult.data.length - invalidBuyers.length}件`);
    console.log(`  - その他: ${invalidBuyers.length}件`);

    if (invalidBuyers.length > 0) {
      console.log(`\n❌ 「内覧日前日」以外の買主が含まれています:`);
      invalidBuyers.slice(0, 5).forEach(buyer => {
        console.log(`  - ${buyer.buyer_number}: ${buyer.calculated_status}`);
      });
    }

    console.log('\n========================================');
    console.log('🔍 詳細バグ条件探索テスト終了');
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する可能性がある
    // 全ての買主が「内覧日前日」条件を満たすべき
    expect(invalidBuyers.length).toBe(0);
  }, 30000);

  /**
   * Property 1 (根本原因調査): ページネーション問題の確認
   * 
   * **Validates: Requirements 2.3**
   * 
   * Supabaseのデフォルト1000件制限により、1001件目以降の買主が取得できていない可能性を確認
   */
  it('ページネーション問題の確認（根本原因調査）', async () => {
    console.log('\n========================================');
    console.log('🔍 ページネーション問題の確認');
    console.log('========================================\n');

    // 全買主を取得（ページネーションなし）
    const { data: allBuyers, error } = await supabase
      .from('buyers')
      .select('buyer_number, latest_viewing_date, broker_inquiry, notification_sender')
      .limit(2000); // 十分な件数を指定

    if (error) {
      console.error('❌ エラー:', error.message);
      throw error;
    }

    console.log(`📊 全買主数: ${allBuyers?.length || 0}件`);

    // 「内覧日前日」条件を満たす買主を手動で計算
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const viewingDayBeforeBuyers = allBuyers?.filter(buyer => {
      if (!buyer.latest_viewing_date) return false;
      if (buyer.broker_inquiry === '業者問合せ') return false;
      if (buyer.notification_sender) return false;

      const viewingDate = new Date(buyer.latest_viewing_date);
      viewingDate.setHours(0, 0, 0, 0);

      const dayOfWeek = viewingDate.getDay();
      const daysBeforeViewing = dayOfWeek === 4 ? 2 : 1; // 木曜日は2日前、それ以外は1日前

      const notifyDate = new Date(viewingDate);
      notifyDate.setDate(notifyDate.getDate() - daysBeforeViewing);

      return today.getTime() === notifyDate.getTime();
    }) || [];

    console.log(`\n🔢 手動計算結果:`);
    console.log(`  - 「内覧日前日」条件を満たす買主: ${viewingDayBeforeBuyers.length}件`);
    console.log(`  - 買主番号: ${viewingDayBeforeBuyers.map(b => b.buyer_number).join(', ')}`);

    // サイドバーカウントと比較
    const sidebarCounts = await buyerService.getSidebarCounts();
    const viewingDayBeforeCategory = sidebarCounts.categories.find(
      c => c.status === '内覧日前日'
    );
    const sidebarCount = viewingDayBeforeCategory?.count || 0;

    console.log(`\n📊 比較:`);
    console.log(`  - サイドバーカウント: ${sidebarCount}件`);
    console.log(`  - 手動計算結果: ${viewingDayBeforeBuyers.length}件`);
    console.log(`  - 差分: ${Math.abs(sidebarCount - viewingDayBeforeBuyers.length)}件`);

    console.log('\n========================================');
    console.log('🔍 ページネーション問題の確認終了');
    console.log('========================================\n');

    // サイドバーカウントと手動計算結果が一致することを確認
    expect(sidebarCount).toBe(viewingDayBeforeBuyers.length);
  }, 30000);
});
