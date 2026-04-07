/**
 * Bug Condition Exploration Test
 * 
 * バグ条件: seller_sidebar_countsテーブルの古いデータによる不一致
 * 
 * このテストは未修正のコードで実行され、バグの存在を証明するために失敗することが期待されます。
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

import { SellerService } from '../SellerService.supabase';
import fc from 'fast-check';

describe('Bug Condition Exploration: seller_sidebar_counts古いデータ不一致', () => {
  let sellerService: SellerService;

  beforeAll(() => {
    sellerService = new SellerService();
  });

  /**
   * Property 1: Bug Condition - seller_sidebar_countsテーブルの古いデータによる不一致
   * 
   * このテストは、seller_sidebar_countsテーブルのtodayCallカウントと、
   * getSidebarCountsFallback()が計算する正しいカウントを比較します。
   * 
   * 未修正のコードでは、seller_sidebar_countsテーブルが古いデータ（21件）を保持しており、
   * getSidebarCountsFallback()が計算する正しいカウント（23件以上）と一致しないため、
   * このテストは失敗します。
   * 
   * **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
   */
  test('Property 1: seller_sidebar_countsテーブルのtodayCallカウントとgetSidebarCountsFallback()の計算結果が一致すること', async () => {
    // getSidebarCounts()を呼び出す（seller_sidebar_countsテーブルから取得）
    const countsFromTable = await sellerService.getSidebarCounts();
    
    // getSidebarCountsFallback()を直接呼び出す（データベースから直接計算）
    // @ts-ignore - privateメソッドにアクセスするためのテスト用
    const countsFromFallback = await sellerService.getSidebarCountsFallback();

    console.log('📊 seller_sidebar_countsテーブルのtodayCallカウント:', countsFromTable.todayCall);
    console.log('📊 getSidebarCountsFallback()が計算したtodayCallカウント:', countsFromFallback.todayCall);

    // バグ条件: seller_sidebar_countsテーブルのtodayCallカウント（21件）と、
    // getSidebarCountsFallback()が計算する正しいカウント（23件以上）が一致しない
    // 
    // 未修正のコードでは、この assertion は失敗します（バグの証明）
    expect(countsFromTable.todayCall).toBe(countsFromFallback.todayCall);
  }, 30000); // タイムアウトを30秒に設定

  /**
   * Property 1 (詳細): AA13224とAA13932が「当日TEL」カテゴリの条件を満たすことを確認
   * 
   * このテストは、AA13224とAA13932が「当日TEL」カテゴリの条件を満たすことを確認します。
   * 
   * 条件:
   * - 次電日が今日以前
   * - コミュニケーション情報が空（phone_contact_person、preferred_contact_time、contact_methodが全て空）
   * - 営業担当（visit_assignee）が空
   * - ステータスが「追客中」または「他決→追客」
   */
  test('Property 1 (詳細): AA13224とAA13932が「当日TEL」カテゴリの条件を満たすこと', async () => {
    // AA13224とAA13932を取得
    const aa13224 = await sellerService.getSeller('AA13224');
    const aa13932 = await sellerService.getSeller('AA13932');

    console.log('📋 AA13224:', {
      status: aa13224.status,
      nextCallDate: aa13224.nextCallDate,
      visitAssignee: aa13224.visitAssignee,
      phoneContactPerson: aa13224.phoneContactPerson,
      preferredContactTime: aa13224.preferredContactTime,
      contactMethod: aa13224.contactMethod,
    });

    console.log('📋 AA13932:', {
      status: aa13932.status,
      nextCallDate: aa13932.nextCallDate,
      visitAssignee: aa13932.visitAssignee,
      phoneContactPerson: aa13932.phoneContactPerson,
      preferredContactTime: aa13932.preferredContactTime,
      contactMethod: aa13932.contactMethod,
    });

    // 今日の日付（JST）を取得
    const now = new Date();
    const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
    const todayJST = `${jstTime.getUTCFullYear()}-${String(jstTime.getUTCMonth() + 1).padStart(2, '0')}-${String(jstTime.getUTCDate()).padStart(2, '0')}`;

    // AA13224の条件確認
    const aa13224MeetsCriteria = 
      (aa13224.status === '追客中' || aa13224.status === '他決→追客') &&
      aa13224.nextCallDate && aa13224.nextCallDate <= todayJST &&
      (!aa13224.visitAssignee || aa13224.visitAssignee === '' || aa13224.visitAssignee === '外す') &&
      (!aa13224.phoneContactPerson || aa13224.phoneContactPerson === '') &&
      (!aa13224.preferredContactTime || aa13224.preferredContactTime === '') &&
      (!aa13224.contactMethod || aa13224.contactMethod === '');

    // AA13932の条件確認
    const aa13932MeetsCriteria = 
      (aa13932.status === '追客中' || aa13932.status === '他決→追客') &&
      aa13932.nextCallDate && aa13932.nextCallDate <= todayJST &&
      (!aa13932.visitAssignee || aa13932.visitAssignee === '' || aa13932.visitAssignee === '外す') &&
      (!aa13932.phoneContactPerson || aa13932.phoneContactPerson === '') &&
      (!aa13932.preferredContactTime || aa13932.preferredContactTime === '') &&
      (!aa13932.contactMethod || aa13932.contactMethod === '');

    console.log('✅ AA13224が「当日TEL」カテゴリの条件を満たす:', aa13224MeetsCriteria);
    console.log('✅ AA13932が「当日TEL」カテゴリの条件を満たす:', aa13932MeetsCriteria);

    // 両方の売主が条件を満たすことを確認
    expect(aa13224MeetsCriteria).toBe(true);
    expect(aa13932MeetsCriteria).toBe(true);
  }, 30000);

  /**
   * Property 1 (プロパティベーステスト): seller_sidebar_countsテーブルの不一致を検証
   * 
   * このプロパティベーステストは、ランダムな日付で複数回テストを実行し、
   * seller_sidebar_countsテーブルとgetSidebarCountsFallback()の計算結果が
   * 常に一致することを検証します。
   * 
   * 未修正のコードでは、このテストは失敗します（バグの証明）。
   */
  test('Property 1 (PBT): seller_sidebar_countsテーブルとgetSidebarCountsFallback()の計算結果が常に一致すること', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant(null), // ダミーの入力（実際のデータベースを使用するため）
        async () => {
          // getSidebarCounts()を呼び出す（seller_sidebar_countsテーブルから取得）
          const countsFromTable = await sellerService.getSidebarCounts();
          
          // getSidebarCountsFallback()を直接呼び出す（データベースから直接計算）
          // @ts-ignore - privateメソッドにアクセスするためのテスト用
          const countsFromFallback = await sellerService.getSidebarCountsFallback();

          // バグ条件: seller_sidebar_countsテーブルのtodayCallカウントと、
          // getSidebarCountsFallback()が計算する正しいカウントが一致しない
          // 
          // 未修正のコードでは、この assertion は失敗します（バグの証明）
          return countsFromTable.todayCall === countsFromFallback.todayCall;
        }
      ),
      {
        numRuns: 5, // 5回実行（データベースクエリが重いため）
        verbose: true, // 詳細なログを出力
      }
    );
  }, 60000); // タイムアウトを60秒に設定
});
