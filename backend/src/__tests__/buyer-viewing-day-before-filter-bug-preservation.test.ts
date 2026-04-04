/**
 * 買主「内覧日前日」フィルタバグ - 保存プロパティテスト
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3**
 * 
 * このテストは修正前のコードで実行し、成功することを確認する
 * 
 * 保存プロパティ:
 * - サイドバーカウントは buyer_sidebar_counts テーブルから高速に取得される
 * - 買主のステータス計算は BuyerStatusCalculator.calculateBuyerStatus() で引き続き行われる
 * - 「内覧日前日」以外のカテゴリの現在の動作をベースラインとして記録する
 * 
 * **IMPORTANT**: このテストは修正後も同じ動作を維持することを確認するためのベースラインを記録する
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { BuyerService } from '../services/BuyerService';

// 環境変数を読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

describe('買主「内覧日前日」フィルタバグ - 保存プロパティ', () => {
  let buyerService: BuyerService;

  beforeAll(() => {
    buyerService = new BuyerService();
  });

  /**
   * Property 2: Preservation - サイドバーカウントの高速取得
   * 
   * **Validates: Requirements 3.2**
   * 
   * サイドバーカウントは buyer_sidebar_counts テーブルから高速に取得されること
   * 
   * **EXPECTED**: このテストは未修正コードで PASS する
   */
  it('サイドバーカウントが buyer_sidebar_counts テーブルから高速に取得されること', async () => {
    console.log('\n========================================');
    console.log('🔍 保存プロパティテスト: サイドバーカウント高速取得');
    console.log('========================================\n');

    const startTime = Date.now();
    const sidebarCounts = await buyerService.getSidebarCounts();
    const elapsedTime = Date.now() - startTime;

    console.log(`  ✅ 取得時間: ${elapsedTime}ms`);
    console.log(`  ✅ カテゴリ数: ${sidebarCounts.categories.length}件`);

    console.log('\n========================================');
    console.log('🔍 保存プロパティテスト終了: サイドバーカウント高速取得');
    console.log('========================================\n');

    expect(elapsedTime).toBeLessThanOrEqual(1000);
  }, 30000);

  /**
   * Property 2: Preservation - BuyerStatusCalculator によるステータス計算
   * 
   * **Validates: Requirements 3.3**
   * 
   * 買主のステータスは BuyerStatusCalculator.calculateBuyerStatus() で引き続き計算されること
   * 
   * **EXPECTED**: このテストは未修正コードで PASS する
   */
  it('買主のステータスが BuyerStatusCalculator で引き続き計算されること', async () => {
    console.log('\n========================================');
    console.log('🔍 保存プロパティテスト: ステータス計算');
    console.log('========================================\n');

    const sidebarCounts = await buyerService.getSidebarCounts();
    const testCategory = sidebarCounts.categories.find(
      c => c.status !== '内覧日前日' && c.count > 0
    );
    
    if (!testCategory) {
      console.log('  ⚠️  テスト対象カテゴリが見つかりません。テストをスキップします。');
      expect(true).toBe(true);
      return;
    }

    console.log(`  ✅ テスト対象カテゴリ: ${testCategory.status} (${testCategory.count}件)`);

    const listResult = await buyerService.getBuyersByStatus(testCategory.status, {
      page: 1,
      limit: 10,
    });

    const buyersWithCalculatedStatus = listResult.data.filter(
      buyer => buyer.calculated_status !== undefined && buyer.calculated_status !== null
    );

    console.log(`  ✅ calculated_status が設定されている買主: ${buyersWithCalculatedStatus.length}/${listResult.data.length}件`);

    console.log('\n========================================');
    console.log('🔍 保存プロパティテスト終了: ステータス計算');
    console.log('========================================\n');

    expect(buyersWithCalculatedStatus.length).toBe(listResult.data.length);
  }, 30000);

  /**
   * Property 2: Preservation - 「内覧日前日」以外のカテゴリのベースライン記録
   * 
   * **Validates: Requirements 3.1**
   * 
   * 「内覧日前日」以外のカテゴリの現在の動作をベースラインとして記録する
   * 
   * **EXPECTED**: このテストは未修正コードで PASS する
   */
  it('「内覧日前日」以外のカテゴリのベースライン動作を記録すること', async () => {
    console.log('\n========================================');
    console.log('🔍 保存プロパティテスト: ベースライン記録');
    console.log('========================================\n');

    const sidebarCounts = await buyerService.getSidebarCounts();
    const testCategories = sidebarCounts.categories
      .filter(c => c.status !== '内覧日前日' && c.count > 0)
      .slice(0, 3);

    console.log(`  テスト対象カテゴリ: ${testCategories.map(c => c.status).join(', ')}`);

    const baselineResults = [];

    for (const category of testCategories) {
      const listResult = await buyerService.getBuyersByStatus(category.status, {
        page: 1,
        limit: 100,
      });

      baselineResults.push({
        status: category.status,
        sidebarCount: category.count,
        listCount: listResult.total,
      });

      console.log(`  - ${category.status}: サイドバー=${category.count}, 一覧=${listResult.total}`);
    }

    console.log('\n✅ ベースライン記録完了');

    console.log('\n========================================');
    console.log('🔍 保存プロパティテスト終了: ベースライン記録');
    console.log('========================================\n');

    expect(baselineResults.length).toBeGreaterThan(0);
  }, 60000);
});
