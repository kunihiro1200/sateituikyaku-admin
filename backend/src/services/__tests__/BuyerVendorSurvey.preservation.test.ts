/**
 * 保全プロパティテスト - 買主ステータス表示の保全
 *
 * **Feature: buyer-vendor-survey-sidebar-status-issue, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * 保全要件:
 * - vendor_survey = "未" かつ broker_inquiry ≠ "業者問合せ" の買主は「業者問合せあり」と表示される
 * - vendor_survey が空欄の買主は「業者問合せあり」と表示されない
 * - broker_inquiry = "業者問合せ" の買主は「業者問合せあり」と表示されない
 * - 他のサイドバーカテゴリ（「内覧日前日」「当日TEL」など）は影響を受けない
 */

import * as fc from 'fast-check';
import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

describe('Property 2: Preservation - 非バグ条件での買主ステータス表示', () => {
  /**
   * テストケース1: vendor_survey = "未" かつ broker_inquiry が空の買主は「業者問合せあり」と表示される
   */
  it('プロパティ1: vendor_survey = "未" かつ broker_inquiry が空の買主は「業者問合せあり」と表示される', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          vendor_survey: fc.constant('未'),
          broker_inquiry: fc.constant(null),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);
          expect(result.status).toBe('業者問合せあり');
          expect(result.priority).toBe(2);
          expect(result.matchedCondition).toBe('業者向けアンケート = 未');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース2: vendor_survey が空欄の買主は「業者問合せあり」と表示されない
   */
  it('プロパティ2: vendor_survey が空欄の買主は「業者問合せあり」と表示されない', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          vendor_survey: fc.oneof(fc.constant(null), fc.constant('確認済み')),
          broker_inquiry: fc.constant(null),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);
          expect(result.status).not.toBe('業者問合せあり');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース3: broker_inquiry = "業者問合せ" の買主は vendor_survey = "未" でも「業者問合せあり」と表示されない
   */
  it('プロパティ3: broker_inquiry = "業者問合せ" の買主は「業者問合せあり」と表示されない', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          vendor_survey: fc.constant('未'),
          broker_inquiry: fc.constant('業者問合せ'),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);
          expect(result.status).not.toBe('業者問合せあり');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース4: 「査定アンケート回答あり」カテゴリは影響を受けない（Priority 1 が優先）
   */
  it('プロパティ4: 「査定アンケート回答あり」カテゴリは影響を受けない', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          vendor_survey: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('確認済み')),
          broker_inquiry: fc.constant(null),
          valuation_survey: fc.constant('回答あり'),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);
          expect(result.status).toBe('査定アンケート回答あり');
          expect(result.priority).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース5: 同じ入力に対してステータス計算が冪等である
   */
  it('プロパティ5: ステータス計算が冪等である', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          vendor_survey: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('確認済み')),
          broker_inquiry: fc.oneof(fc.constant(null), fc.constant('業者問合せ')),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result1 = calculateBuyerStatus(buyer);
          const result2 = calculateBuyerStatus(buyer);
          expect(result1.status).toBe(result2.status);
          expect(result1.priority).toBe(result2.priority);
        }
      ),
      { numRuns: 100 }
    );
  });
});
