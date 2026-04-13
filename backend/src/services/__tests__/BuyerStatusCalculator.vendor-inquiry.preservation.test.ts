/**
 * 保持確認プロパティテスト: vendor_survey='未' かつ broker_inquiry が '業者問合せ' 以外の場合の既存動作保持
 *
 * **Feature: buyer-vendor-inquiry-sidebar-exclusion-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）。
 *
 * 保持確認ケース:
 *   観察1: vendor_survey = '未', broker_inquiry = null → Priority 2 を返す
 *   観察2: vendor_survey = '未', broker_inquiry = '' → Priority 2 を返す
 *   観察3: vendor_survey = '未', broker_inquiry = '業者（両手）' → Priority 2 を返す
 *   観察4: vendor_survey = '済', broker_inquiry = '業者問合せ' → Priority 2 を返さない
 *   観察5: valuation_survey 入力済み かつ vendor_survey = '未' → Priority 1 が優先される
 *
 * プロパティベーステスト:
 *   vendor_survey = '未' かつ broker_inquiry が '業者問合せ' 以外の任意の値の場合、
 *   常に Priority 2 を返すことを検証（fast-check 使用）
 */

import * as fc from 'fast-check';
import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

/** テスト用の最小限の買主データ（Priority 1 の条件を満たさない） */
const minimalBuyer: BuyerData = {
  buyer_number: 'PRESERVATION_TEST',
  name: '保持確認用買主',
  valuation_survey: null,
  valuation_survey_confirmed: null,
};

describe('Property 2: Preservation - broker_inquiry が "業者問合せ" 以外の場合の既存動作保持', () => {
  /**
   * 観察1: vendor_survey = '未', broker_inquiry = null → Priority 2 を返す
   *
   * **Validates: Requirements 3.1**
   */
  describe('観察1: broker_inquiry = null の場合', () => {
    it('vendor_survey="未" かつ broker_inquiry=null → status="業者問合せあり" かつ priority=2 を返すこと', () => {
      // Arrange
      const buyer: BuyerData = {
        ...minimalBuyer,
        vendor_survey: '未',
        broker_inquiry: null,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 未修正コードでも Priority 2 を返す（正常動作）
      expect(result.status).toBe('業者問合せあり');
      expect(result.priority).toBe(2);
    });
  });

  /**
   * 観察2: vendor_survey = '未', broker_inquiry = '' → Priority 2 を返す
   *
   * **Validates: Requirements 3.1**
   */
  describe('観察2: broker_inquiry = "" の場合', () => {
    it('vendor_survey="未" かつ broker_inquiry="" → status="業者問合せあり" かつ priority=2 を返すこと', () => {
      // Arrange
      const buyer: BuyerData = {
        ...minimalBuyer,
        vendor_survey: '未',
        broker_inquiry: '',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 未修正コードでも Priority 2 を返す（正常動作）
      expect(result.status).toBe('業者問合せあり');
      expect(result.priority).toBe(2);
    });
  });

  /**
   * 観察3: vendor_survey = '未', broker_inquiry = '業者（両手）' → Priority 2 を返す
   *
   * **Validates: Requirements 3.1**
   */
  describe('観察3: broker_inquiry = "業者（両手）" の場合', () => {
    it('vendor_survey="未" かつ broker_inquiry="業者（両手）" → status="業者問合せあり" かつ priority=2 を返すこと', () => {
      // Arrange
      const buyer: BuyerData = {
        ...minimalBuyer,
        vendor_survey: '未',
        broker_inquiry: '業者（両手）',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 未修正コードでも Priority 2 を返す（正常動作）
      expect(result.status).toBe('業者問合せあり');
      expect(result.priority).toBe(2);
    });
  });

  /**
   * 観察4: vendor_survey = '済', broker_inquiry = '業者問合せ' → Priority 2 を返さない
   *
   * **Validates: Requirements 3.3**
   */
  describe('観察4: vendor_survey = "済" の場合', () => {
    it('vendor_survey="済" かつ broker_inquiry="業者問合せ" → Priority 2 を返さないこと', () => {
      // Arrange
      const buyer: BuyerData = {
        ...minimalBuyer,
        vendor_survey: '済',
        broker_inquiry: '業者問合せ',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: vendor_survey = '済' の場合は Priority 2 を返さない（正常動作）
      expect(result.status).not.toBe('業者問合せあり');
      expect(result.priority).not.toBe(2);
    });
  });

  /**
   * 観察5: valuation_survey 入力済み かつ vendor_survey = '未' → Priority 1 が優先される
   *
   * **Validates: Requirements 3.2**
   */
  describe('観察5: valuation_survey 入力済みの場合', () => {
    it('valuation_survey 入力済み かつ vendor_survey="未" → status="査定アンケート回答あり" かつ priority=1 を返すこと', () => {
      // Arrange: Priority 1 の条件を満たす（valuation_survey 入力済み、valuation_survey_confirmed 空欄）
      const buyer: BuyerData = {
        ...minimalBuyer,
        valuation_survey: '回答済み',
        valuation_survey_confirmed: null,
        vendor_survey: '未',
        broker_inquiry: null,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: Priority 1 が Priority 2 より優先される（正常動作）
      expect(result.status).toBe('査定アンケート回答あり');
      expect(result.priority).toBe(1);
    });

    it('valuation_survey 入力済み かつ vendor_survey="未" かつ broker_inquiry="業者（両手）" → Priority 1 が優先されること', () => {
      // Arrange
      const buyer: BuyerData = {
        ...minimalBuyer,
        valuation_survey: 'アンケート回答あり',
        valuation_survey_confirmed: null,
        vendor_survey: '未',
        broker_inquiry: '業者（両手）',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: Priority 1 が優先される
      expect(result.status).toBe('査定アンケート回答あり');
      expect(result.priority).toBe(1);
    });
  });

  /**
   * プロパティベーステスト:
   * vendor_survey = '未' かつ broker_inquiry が '業者問合せ' 以外の任意の値の場合、
   * 常に Priority 2 を返すことを検証
   *
   * **Validates: Requirements 3.1**
   */
  describe('プロパティベーステスト: broker_inquiry が "業者問合せ" 以外の任意の値', () => {
    it('vendor_survey="未" かつ broker_inquiry が "業者問合せ" 以外の任意の値 → 常に Priority 2 を返すこと', () => {
      // broker_inquiry が '業者問合せ' 以外の値を生成するアービトラリ
      const brokerInquiryArb = fc.oneof(
        fc.constant(null),
        fc.constant(''),
        fc.constant('業者（両手）'),
        fc.constant('業者（片手）'),
        fc.constant('一般'),
        // '業者問合せ' を除く任意の文字列
        fc.string({ minLength: 0, maxLength: 20 }).filter(s => s !== '業者問合せ')
      );

      fc.assert(
        fc.property(
          brokerInquiryArb,
          (brokerInquiry) => {
            // Arrange: Priority 1 の条件を満たさない、vendor_survey = '未'
            const buyer: BuyerData = {
              buyer_number: 'PROP_TEST',
              name: 'プロパティテスト用買主',
              valuation_survey: null,
              valuation_survey_confirmed: null,
              vendor_survey: '未',
              broker_inquiry: brokerInquiry,
            };

            // Act
            const result = calculateBuyerStatus(buyer);

            // Assert: broker_inquiry が '業者問合せ' 以外であれば Priority 2 を返す
            expect(result.status).toBe('業者問合せあり');
            expect(result.priority).toBe(2);
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
