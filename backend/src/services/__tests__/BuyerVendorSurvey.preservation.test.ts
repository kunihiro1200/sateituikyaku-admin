/**
 * 保全プロパティテスト - 買主ステータス表示の保全
 *
 * **Feature: buyer-vendor-survey-sidebar-status-issue, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで SUCCESS することが期待される（ベースライン動作を確認）
 * GOAL: 非バグ条件での買主ステータス表示が修正後も変わらないことを保証する
 *
 * 保全要件:
 * - broker_survey = "未" の買主は引き続き「業者問合せあり」カテゴリに表示される
 * - broker_survey が空欄の買主は引き続き「業者問合せあり」カテゴリに表示されない
 * - 他のサイドバーカテゴリ（「内覧日前日」「当日TEL」など）は影響を受けない
 */

import * as fc from 'fast-check';
import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

/**
 * 買主データのジェネレーター（非バグ条件のみ）
 *
 * 非バグ条件:
 * - broker_survey と vendor_survey が一致している（同期されている）
 * - または broker_survey が空欄
 */
const nonBugBuyerArbitrary = fc.record({
  buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  broker_survey: fc.oneof(
    fc.constant(null),
    fc.constant('未'),
    fc.constant('確認済み')
  ),
  vendor_survey: fc.oneof(
    fc.constant(null),
    fc.constant('未'),
    fc.constant('確認済み')
  ),
  valuation_survey: fc.constant(null),
  valuation_survey_confirmed: fc.constant(null),
}).filter((buyer) => {
  // 非バグ条件: broker_survey と vendor_survey が一致している
  // または broker_survey が空欄
  if (buyer.broker_survey === null) {
    return true;
  }
  return buyer.broker_survey === buyer.vendor_survey;
});

describe('Property 2: Preservation - 非バグ条件での買主ステータス表示', () => {
  /**
   * テストケース1: broker_survey = "未" の買主は「業者問合せあり」と表示される
   *
   * **Validates: Requirements 3.1**
   */
  it('プロパティ1: broker_survey = "未" の買主は「業者問合せあり」と表示される', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          broker_survey: fc.constant('未'),
          vendor_survey: fc.constant('未'),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);

          // broker_survey = "未" の場合、「業者問合せあり」と表示される
          expect(result.status).toBe('業者問合せあり');
          expect(result.priority).toBe(2);
          expect(result.matchedCondition).toBe('業者向けアンケート = 未');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース2: broker_survey が空欄の買主は「業者問合せあり」と表示されない
   *
   * **Validates: Requirements 3.2**
   */
  it('プロパティ2: broker_survey が空欄の買主は「業者問合せあり」と表示されない', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          broker_survey: fc.constant(null),
          vendor_survey: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('確認済み')),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);

          // broker_survey が空欄の場合、「業者問合せあり」と表示されない
          expect(result.status).not.toBe('業者問合せあり');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース3: broker_survey = "確認済み" の買主は「業者問合せあり」と表示されない
   *
   * **Validates: Requirements 2.1**
   */
  it('プロパティ3: broker_survey = "確認済み" の買主は「業者問合せあり」と表示されない', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          broker_survey: fc.constant('確認済み'),
          vendor_survey: fc.constant('確認済み'),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);

          // broker_survey = "確認済み" の場合、「業者問合せあり」と表示されない
          expect(result.status).not.toBe('業者問合せあり');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース4: 他のサイドバーカテゴリ（「査定アンケート回答あり」）は影響を受けない
   *
   * **Validates: Requirements 3.3**
   */
  it('プロパティ4: 「査定アンケート回答あり」カテゴリは影響を受けない', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          broker_survey: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('確認済み')),
          vendor_survey: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('確認済み')),
          valuation_survey: fc.constant('回答あり'),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          const result = calculateBuyerStatus(buyer);

          // valuation_survey が非空欄で valuation_survey_confirmed が空欄の場合、
          // 「査定アンケート回答あり」が最優先（Priority 1）
          expect(result.status).toBe('査定アンケート回答あり');
          expect(result.priority).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース5: 非バグ条件の買主に対して、ステータス計算が一貫している
   *
   * **Validates: Requirements 3.1, 3.2, 3.3**
   */
  it('プロパティ5: 非バグ条件の買主に対して、ステータス計算が一貫している', () => {
    fc.assert(
      fc.property(nonBugBuyerArbitrary, (buyer) => {
        const result1 = calculateBuyerStatus(buyer);
        const result2 = calculateBuyerStatus(buyer);

        // 同じ入力に対して、同じ結果が返される（冪等性）
        expect(result1.status).toBe(result2.status);
        expect(result1.priority).toBe(result2.priority);
        expect(result1.matchedCondition).toBe(result2.matchedCondition);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * テストケース6: broker_survey と vendor_survey が一致している場合、
   * ステータス計算は broker_survey の値のみに依存する
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  it('プロパティ6: broker_survey と vendor_survey が一致している場合、ステータス計算は broker_survey の値のみに依存する', () => {
    fc.assert(
      fc.property(
        fc.record({
          buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          broker_survey: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('確認済み')),
          valuation_survey: fc.constant(null),
          valuation_survey_confirmed: fc.constant(null),
        }),
        (buyer) => {
          // vendor_survey を broker_survey と同じ値に設定
          const buyerWithMatchingVendorSurvey: BuyerData = {
            ...buyer,
            vendor_survey: buyer.broker_survey,
          };

          const result = calculateBuyerStatus(buyerWithMatchingVendorSurvey);

          // broker_survey = "未" の場合のみ「業者問合せあり」
          if (buyer.broker_survey === '未') {
            expect(result.status).toBe('業者問合せあり');
            expect(result.priority).toBe(2);
          } else {
            expect(result.status).not.toBe('業者問合せあり');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
