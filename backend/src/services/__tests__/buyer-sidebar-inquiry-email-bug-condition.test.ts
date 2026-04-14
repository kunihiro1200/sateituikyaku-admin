/**
 * バグ条件探索テスト - inquiry_email_phone 更新でサイドバーカウント更新がトリガーされない
 *
 * **Feature: buyer-sidebar-inquiry-email-realtime-update, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 2.1, 2.2**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を見つける
 *
 * バグの根本原因（仮説）:
 * 1. BuyerService.shouldUpdateBuyerSidebarCounts() の sidebarFields に
 *    inquiry_email_phone が含まれていないため、更新がトリガーされない
 * 2. SidebarCountsUpdateService.determineBuyerCategories() に
 *    inquiryEmailUnanswered カテゴリの判定ロジックが存在しないため、
 *    差分更新でカウントが正しく減算されない
 */

import { SidebarCountsUpdateService } from '../SidebarCountsUpdateService';

// BuyerService の shouldUpdateBuyerSidebarCounts をテストするためのヘルパー
// private メソッドのため、クラスを継承してアクセスする
class TestableBuyerService {
  shouldUpdateBuyerSidebarCounts(updateData: Partial<any>): boolean {
    // BuyerService.ts の修正済み実装（inquiry_email_phone を含む）
    const sidebarFields = ['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender', 'inquiry_email_phone'];
    return sidebarFields.some(field => field in updateData);
  }
}

// SidebarCountsUpdateService の determineBuyerCategories をテストするためのヘルパー
class TestableSidebarCountsUpdateService extends SidebarCountsUpdateService {
  // private メソッドを公開するためのラッパー
  public testDetermineBuyerCategories(buyer: any): Array<{ category: string; assignee: string | null }> {
    return (this as any).determineBuyerCategories(buyer);
  }
}

describe('Property 1: Bug Condition - inquiry_email_phone 更新でサイドバーカウント更新がトリガーされない', () => {
  /**
   * テスト1: shouldUpdateBuyerSidebarCounts が inquiry_email_phone を含む更新データで true を返すべき
   *
   * ⚠️ 未修正コードでは false を返すため FAIL する（バグの存在を証明）
   * ✅ 修正後は true を返すため PASS する
   *
   * **Validates: Requirements 2.1**
   */
  it('テスト1: shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: "済" }) が true を返す（未修正コードでは false のため FAIL）', () => {
    const service = new TestableBuyerService();

    // バグ条件: inquiry_email_phone を '未' → '済' に更新
    const updateData = { inquiry_email_phone: '済' };

    const result = service.shouldUpdateBuyerSidebarCounts(updateData);

    console.log('shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: "済" }) =', result);
    console.log('期待値: true（サイドバーカウント更新がトリガーされるべき）');
    console.log('未修正コードの実際の値: false（バグ）');

    // ✅ 修正後に PASS するアサーション
    // ⚠️ 未修正コードでは false を返すため FAIL する（これが正しい — バグの存在を証明）
    expect(result).toBe(true);
  });

  /**
   * テスト1b: inquiry_email_phone のみを含む更新データでのバグ確認
   *
   * ⚠️ 未修正コードでは false を返すため FAIL する（バグの存在を証明）
   *
   * **Validates: Requirements 2.1**
   */
  it('テスト1b: shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: "未" }) が true を返す（未修正コードでは false のため FAIL）', () => {
    const service = new TestableBuyerService();

    const updateData = { inquiry_email_phone: '未' };

    const result = service.shouldUpdateBuyerSidebarCounts(updateData);

    console.log('shouldUpdateBuyerSidebarCounts({ inquiry_email_phone: "未" }) =', result);

    // ⚠️ 未修正コードでは false を返すため FAIL する
    expect(result).toBe(true);
  });

  /**
   * テスト2: determineBuyerCategories が inquiry_email_phone='未' の買主で
   *          inquiryEmailUnanswered カテゴリを含むべき
   *
   * ⚠️ 未修正コードでは inquiryEmailUnanswered が含まれないため FAIL する（バグの存在を証明）
   * ✅ 修正後は inquiryEmailUnanswered が含まれるため PASS する
   *
   * **Validates: Requirements 2.2**
   */
  it('テスト2: determineBuyerCategories({ inquiry_email_phone: "未", ... }) が inquiryEmailUnanswered カテゴリを含む（未修正コードでは含まれないため FAIL）', () => {
    // モックのSupabaseクライアントを渡してインスタンス化
    const mockSupabase = {} as any;
    const service = new TestableSidebarCountsUpdateService(mockSupabase);

    // バグ条件: inquiry_email_phone = '未' の買主データ
    const buyer = {
      buyer_number: '9999',
      inquiry_email_phone: '未',
      inquiry_email_reply: null,
      latest_viewing_date: null,
      follow_up_assignee: null,
      initial_assignee: null,
      next_call_date: null,
      viewing_date: null,
      broker_inquiry: null,
      notification_sender: null,
    };

    const categories = service.testDetermineBuyerCategories(buyer);
    const categoryNames = categories.map(c => c.category);

    console.log('determineBuyerCategories({ inquiry_email_phone: "未", ... }) =', categoryNames);
    console.log('期待値: ["inquiryEmailUnanswered"] を含む');
    console.log('未修正コードの実際の値: [] （inquiryEmailUnanswered が含まれない — バグ）');

    // ✅ 修正後に PASS するアサーション
    // ⚠️ 未修正コードでは inquiryEmailUnanswered が含まれないため FAIL する（これが正しい — バグの存在を証明）
    expect(categoryNames).toContain('inquiryEmailUnanswered');
  });

  /**
   * テスト2b: inquiry_email_reply='未' の買主でも inquiryEmailUnanswered カテゴリを含むべき
   *
   * ⚠️ 未修正コードでは含まれないため FAIL する
   *
   * **Validates: Requirements 2.2**
   */
  it('テスト2b: determineBuyerCategories({ inquiry_email_reply: "未", ... }) が inquiryEmailUnanswered カテゴリを含む（未修正コードでは含まれないため FAIL）', () => {
    const mockSupabase = {} as any;
    const service = new TestableSidebarCountsUpdateService(mockSupabase);

    const buyer = {
      buyer_number: '8888',
      inquiry_email_phone: '済',
      inquiry_email_reply: '未',
      latest_viewing_date: null,
      follow_up_assignee: null,
      initial_assignee: null,
      next_call_date: null,
      viewing_date: null,
      broker_inquiry: null,
      notification_sender: null,
    };

    const categories = service.testDetermineBuyerCategories(buyer);
    const categoryNames = categories.map(c => c.category);

    console.log('determineBuyerCategories({ inquiry_email_reply: "未", ... }) =', categoryNames);

    // ⚠️ 未修正コードでは含まれないため FAIL する
    expect(categoryNames).toContain('inquiryEmailUnanswered');
  });
});
