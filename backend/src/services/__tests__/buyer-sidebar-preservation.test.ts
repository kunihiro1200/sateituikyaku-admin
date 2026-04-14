/**
 * 保持プロパティテスト - 既存フィールドの監視動作と他カテゴリ判定が維持される
 *
 * **Feature: buyer-sidebar-inquiry-email-realtime-update, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * ✅ このテストは未修正コードで PASS することが期待される（ベースライン動作を確認）
 * 目的: 修正前後でリグレッションが発生しないことを保証するベースラインを確立する
 *
 * 観察優先メソドロジー:
 * - 未修正コードで現在の動作を観察・記録する
 * - 修正後も同じ動作が維持されることを検証する
 */

import * as fc from 'fast-check';
import { SidebarCountsUpdateService } from '../SidebarCountsUpdateService';

// BuyerService の shouldUpdateBuyerSidebarCounts をテストするためのヘルパー
// 未修正コードの実装を複製（ベースライン動作を確認）
class TestableBuyerService {
  shouldUpdateBuyerSidebarCounts(updateData: Partial<any>): boolean {
    // BuyerService.ts の現在の実装（未修正）
    const sidebarFields = ['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender'];
    return sidebarFields.some(field => field in updateData);
  }
}

// SidebarCountsUpdateService の determineBuyerCategories をテストするためのヘルパー
class TestableSidebarCountsUpdateService extends SidebarCountsUpdateService {
  public testDetermineBuyerCategories(buyer: any): Array<{ category: string; assignee: string | null }> {
    return (this as any).determineBuyerCategories(buyer);
  }
}

// テスト用のベース買主データ
const baseBuyer = {
  buyer_number: '1234',
  inquiry_email_phone: '済',
  inquiry_email_reply: null,
  latest_viewing_date: null,
  follow_up_assignee: null,
  initial_assignee: null,
  next_call_date: null,
  viewing_date: null,
  broker_inquiry: null,
  notification_sender: null,
};

describe('Property 2: Preservation - 既存フィールドの監視動作と他カテゴリ判定が維持される', () => {
  // ============================================================
  // 観察テスト: 未修正コードでの既存フィールドの動作を確認
  // ============================================================

  describe('観察テスト: shouldUpdateBuyerSidebarCounts の既存フィールド動作', () => {
    /**
     * 観察1: next_call_date を含む更新データで true を返す
     *
     * **Validates: Requirements 3.1**
     */
    it('観察1: shouldUpdateBuyerSidebarCounts({ next_call_date: "2026-01-01" }) が true を返す', () => {
      const service = new TestableBuyerService();
      const result = service.shouldUpdateBuyerSidebarCounts({ next_call_date: '2026-01-01' });
      console.log('shouldUpdateBuyerSidebarCounts({ next_call_date: "2026-01-01" }) =', result);
      expect(result).toBe(true);
    });

    /**
     * 観察2: follow_up_assignee を含む更新データで true を返す
     *
     * **Validates: Requirements 3.1**
     */
    it('観察2: shouldUpdateBuyerSidebarCounts({ follow_up_assignee: "担当者" }) が true を返す', () => {
      const service = new TestableBuyerService();
      const result = service.shouldUpdateBuyerSidebarCounts({ follow_up_assignee: '担当者' });
      console.log('shouldUpdateBuyerSidebarCounts({ follow_up_assignee: "担当者" }) =', result);
      expect(result).toBe(true);
    });

    /**
     * 観察3: viewing_date を含む更新データで true を返す
     *
     * **Validates: Requirements 3.1**
     */
    it('観察3: shouldUpdateBuyerSidebarCounts({ viewing_date: "2026-01-01" }) が true を返す', () => {
      const service = new TestableBuyerService();
      const result = service.shouldUpdateBuyerSidebarCounts({ viewing_date: '2026-01-01' });
      console.log('shouldUpdateBuyerSidebarCounts({ viewing_date: "2026-01-01" }) =', result);
      expect(result).toBe(true);
    });

    /**
     * 観察4: notification_sender を含む更新データで true を返す
     *
     * **Validates: Requirements 3.1**
     */
    it('観察4: shouldUpdateBuyerSidebarCounts({ notification_sender: "送信者" }) が true を返す', () => {
      const service = new TestableBuyerService();
      const result = service.shouldUpdateBuyerSidebarCounts({ notification_sender: '送信者' });
      console.log('shouldUpdateBuyerSidebarCounts({ notification_sender: "送信者" }) =', result);
      expect(result).toBe(true);
    });

    /**
     * 観察5: inquiry_email_phone が '済' の買主で inquiryEmailUnanswered を含まない
     *
     * **Validates: Requirements 3.2**
     */
    it('観察5: determineBuyerCategories({ inquiry_email_phone: "済", ... }) が inquiryEmailUnanswered を含まない', () => {
      const mockSupabase = {} as any;
      const service = new TestableSidebarCountsUpdateService(mockSupabase);

      const buyer = {
        ...baseBuyer,
        inquiry_email_phone: '済',
      };

      const categories = service.testDetermineBuyerCategories(buyer);
      const categoryNames = categories.map(c => c.category);

      console.log('determineBuyerCategories({ inquiry_email_phone: "済", ... }) =', categoryNames);
      console.log('期待値: inquiryEmailUnanswered を含まない');

      expect(categoryNames).not.toContain('inquiryEmailUnanswered');
    });
  });

  // ============================================================
  // プロパティベーステスト
  // ============================================================

  describe('プロパティベーステスト', () => {
    /**
     * プロパティ1: inquiry_email_phone を含まない任意の更新データで
     *              shouldUpdateBuyerSidebarCounts() の動作が変わらない
     *
     * 既存フィールド（next_call_date, follow_up_assignee, viewing_date, notification_sender）
     * を含む場合は true、含まない場合は false を返すことを検証する
     *
     * **Validates: Requirements 3.1**
     */
    it('プロパティ1: inquiry_email_phone を含まない更新データで shouldUpdateBuyerSidebarCounts() の動作が変わらない', () => {
      const service = new TestableBuyerService();

      // inquiry_email_phone を含まないフィールドのジェネレーター
      // サイドバーフィールドを含む場合と含まない場合の両方を生成
      const nonInquiryFieldArb = fc.record({
        // サイドバーフィールド（オプション）
        next_call_date: fc.option(fc.constantFrom('2026-01-01', '2026-06-15', '2025-12-31'), { nil: undefined }),
        follow_up_assignee: fc.option(fc.constantFrom('担当A', '担当B', '担当C'), { nil: undefined }),
        viewing_date: fc.option(fc.constantFrom('2026-02-01', '2026-07-20', '2026-03-10'), { nil: undefined }),
        notification_sender: fc.option(fc.constantFrom('送信者X', '送信者Y'), { nil: undefined }),
        // 非サイドバーフィールド（オプション）
        name: fc.option(fc.string(), { nil: undefined }),
        phone_number: fc.option(fc.string(), { nil: undefined }),
        latest_status: fc.option(fc.string(), { nil: undefined }),
      });

      fc.assert(
        fc.property(nonInquiryFieldArb, (updateData) => {
          // undefined のフィールドを除去
          const cleanData: Record<string, any> = {};
          for (const [key, value] of Object.entries(updateData)) {
            if (value !== undefined) {
              cleanData[key] = value;
            }
          }

          // inquiry_email_phone が含まれていないことを確認
          expect('inquiry_email_phone' in cleanData).toBe(false);

          const result = service.shouldUpdateBuyerSidebarCounts(cleanData);

          // 期待値: サイドバーフィールドが含まれる場合は true、含まれない場合は false
          const sidebarFields = ['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender'];
          const hasSidebarField = sidebarFields.some(field => field in cleanData);
          expect(result).toBe(hasSidebarField);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ2: inquiryEmailUnanswered 条件を満たさない買主データで
     *              determineBuyerCategories() が inquiryEmailUnanswered を返さない
     *
     * inquiryEmailUnanswered の判定条件（OR）:
     *   - inquiry_email_phone === '未'
     *   - inquiry_email_reply === '未'
     *   - !latest_viewing_date && inquiry_email_phone === '不要' && (inquiry_email_reply === '未' || !inquiry_email_reply)
     *
     * このテストは上記条件を全て満たさない買主データを生成して検証する。
     *
     * **Validates: Requirements 3.2**
     */
    it('プロパティ2: inquiryEmailUnanswered 条件を満たさない買主データで determineBuyerCategories() が inquiryEmailUnanswered を返さない', () => {
      const mockSupabase = {} as any;
      const service = new TestableSidebarCountsUpdateService(mockSupabase);

      // inquiryEmailUnanswered 条件を満たさないデータのジェネレーター
      // 条件1: inquiry_email_phone !== '未'
      // 条件2: inquiry_email_reply !== '未'
      // 条件3: inquiry_email_phone === '不要' の場合は latest_viewing_date が存在する（または inquiry_email_reply が '済'/'不通'）
      const safeEmailPhoneArb = fc.constantFrom('済', '不通', null, '');
      const safeEmailReplyArb = fc.constantFrom('済', '不通', null);

      // '不要' の場合は latest_viewing_date を必ず設定する（条件3を回避）
      const buyerWithFuyoArb = fc.record({
        buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
        inquiry_email_phone: fc.constant('不要'),
        inquiry_email_reply: safeEmailReplyArb,
        latest_viewing_date: fc.constantFrom('2026-01-01', '2025-12-01'), // 必ず存在する
        follow_up_assignee: fc.option(fc.constantFrom('担当A', '担当B', null), { nil: null }),
        initial_assignee: fc.option(fc.constantFrom('担当C', '担当D', null), { nil: null }),
        next_call_date: fc.option(fc.constantFrom(null), { nil: null }),
        viewing_date: fc.option(fc.constantFrom(null), { nil: null }),
        broker_inquiry: fc.option(fc.constantFrom(null, '業者問合せ'), { nil: null }),
        notification_sender: fc.option(fc.constantFrom(null, '送信者'), { nil: null }),
      });

      // '不要' 以外の場合
      const buyerWithoutFuyoArb = fc.record({
        buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
        inquiry_email_phone: safeEmailPhoneArb,
        inquiry_email_reply: safeEmailReplyArb,
        latest_viewing_date: fc.option(fc.constantFrom('2026-01-01', '2025-12-01', null), { nil: null }),
        follow_up_assignee: fc.option(fc.constantFrom('担当A', '担当B', null), { nil: null }),
        initial_assignee: fc.option(fc.constantFrom('担当C', '担当D', null), { nil: null }),
        next_call_date: fc.option(fc.constantFrom(null), { nil: null }),
        viewing_date: fc.option(fc.constantFrom(null), { nil: null }),
        broker_inquiry: fc.option(fc.constantFrom(null, '業者問合せ'), { nil: null }),
        notification_sender: fc.option(fc.constantFrom(null, '送信者'), { nil: null }),
      });

      const buyerArb = fc.oneof(buyerWithFuyoArb, buyerWithoutFuyoArb);

      fc.assert(
        fc.property(buyerArb, (buyer) => {
          // 事前条件: inquiryEmailUnanswered 条件を満たさないことを確認
          const isUnanswered =
            buyer.inquiry_email_phone === '未' ||
            buyer.inquiry_email_reply === '未' ||
            (
              !buyer.latest_viewing_date &&
              buyer.inquiry_email_phone === '不要' &&
              (buyer.inquiry_email_reply === '未' || !buyer.inquiry_email_reply)
            );
          expect(isUnanswered).toBe(false);

          const categories = service.testDetermineBuyerCategories(buyer);
          const categoryNames = categories.map(c => c.category);

          // inquiryEmailUnanswered が含まれないことを検証
          expect(categoryNames).not.toContain('inquiryEmailUnanswered');
        }),
        { numRuns: 100 }
      );
    });
  });
});
