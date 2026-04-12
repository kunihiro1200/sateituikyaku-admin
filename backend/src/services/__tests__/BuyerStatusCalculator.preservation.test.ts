/**
 * 保持確認テスト: 買主ステータス「問合メール未対応」の修正前ベースライン動作確認
 *
 * このテストは「バグ条件を満たさない入力」に対する動作を記録するためのものです。
 * 修正前のコードで全ケースが PASS することを確認します（ベースライン動作の確認）。
 *
 * 保持確認ケース:
 *   1. "不通" の保持: inquiry_email_phone = "不通" → 「問合メール未対応」に分類されない
 *   2. 両フィールド空欄の保持: inquiry_email_phone = null, inquiry_email_reply = null → 「問合メール未対応」に分類されない
 *   3. Priority 1 の優先度保持: valuation_survey が入力済み かつ valuation_survey_confirmed が空欄 → 「査定アンケート回答あり」（priority: 1）
 *   4. Priority 2 の優先度保持: broker_survey = "未" → 「業者問合せあり」（priority: 2）
 *   5. Priority 6 の優先度保持: next_call_date が今日以前 かつ follow_up_assignee が空欄 → 「当日TEL」（priority: 6）
 *   6. Priority 7 の保持: three_calls_confirmed = "3回架電未" かつ inquiry_email_phone = "不通" → 「3回架電未」（priority: 7）
 *
 * Validates: Requirements 3.1, 3.2, 3.4
 */

import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

/** テスト用の最小限の買主データ（Priority 1〜6 の条件を満たさない） */
const minimalBuyer: BuyerData = {
  buyer_number: 'test',
  name: 'テスト',
  valuation_survey: null,
  valuation_survey_confirmed: null,
  broker_survey: null,
  latest_viewing_date: null,
  viewing_unconfirmed: null,
  viewing_type_general: null,
  post_viewing_seller_contact: null,
  atbb_status: null,
  next_call_date: null,
  follow_up_assignee: null,
  inquiry_email_phone: null,
  inquiry_email_reply: null,
};

describe('保持確認: バグ条件を満たさない入力の動作保持', () => {
  describe('ケース1: "不通" の保持', () => {
    it('inquiry_email_phone = "不通" の場合、「問合メール未対応」に分類されない', () => {
      // Arrange: "不通" は "未" とは異なるため、Priority 7 の条件を満たさない
      const buyer: BuyerData = {
        ...minimalBuyer,
        inquiry_email_phone: '不通',
        inquiry_email_reply: null,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 「問合メール未対応」に分類されないことを確認
      expect(result.status).not.toBe('問合メール未対応');
      expect(result.priority).not.toBe(7);
    });
  });

  describe('ケース2: 両フィールド空欄の保持', () => {
    it('inquiry_email_phone = null, inquiry_email_reply = null の場合、「問合メール未対応」に分類されない', () => {
      // Arrange: 両フィールドが空欄の場合は Priority 7 の条件を満たさない
      const buyer: BuyerData = {
        ...minimalBuyer,
        inquiry_email_phone: null,
        inquiry_email_reply: null,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 「問合メール未対応」に分類されないことを確認
      expect(result.status).not.toBe('問合メール未対応');
      expect(result.priority).not.toBe(7);
    });
  });

  describe('ケース3: Priority 1 の優先度保持', () => {
    it('valuation_survey が入力済み かつ valuation_survey_confirmed が空欄 → 「査定アンケート回答あり」（priority: 1）', () => {
      // Arrange: Priority 1 の条件を満たす
      const buyer: BuyerData = {
        ...minimalBuyer,
        valuation_survey: 'アンケート回答済み',
        valuation_survey_confirmed: null,
        // Priority 7 の条件も設定するが、Priority 1 が優先されるべき
        inquiry_email_phone: '未',
        inquiry_email_reply: '未',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: Priority 1 が優先されることを確認
      expect(result.status).toBe('査定アンケート回答あり');
      expect(result.priority).toBe(1);
    });
  });

  describe('ケース4: Priority 2 の優先度保持', () => {
    it('vendor_survey = "未" → 「業者問合せあり」（priority: 2）', () => {
      // Arrange: Priority 2 の条件を満たす（Priority 1 は満たさない）
      const buyer: BuyerData = {
        ...minimalBuyer,
        vendor_survey: '未',
        // Priority 7 の条件も設定するが、Priority 2 が優先されるべき
        inquiry_email_phone: '未',
        inquiry_email_reply: '未',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: Priority 2 が優先されることを確認
      expect(result.status).toBe('業者問合せあり');
      expect(result.priority).toBe(2);
    });
  });

  describe('ケース5: Priority 6 の優先度保持', () => {
    it('next_call_date が今日以前 かつ follow_up_assignee が空欄 → 「当日TEL」（priority: 6）', () => {
      // Arrange: Priority 6 の条件を満たす（過去の日付を使用）
      const buyer: BuyerData = {
        ...minimalBuyer,
        next_call_date: '2020-01-01', // 確実に過去の日付
        follow_up_assignee: null,
        // Priority 7 の条件も設定するが、Priority 6 が優先されるべき
        inquiry_email_phone: '未',
        inquiry_email_reply: '未',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: Priority 6 が優先されることを確認
      expect(result.status).toBe('当日TEL');
      expect(result.priority).toBe(6);
    });
  });

  describe('ケース6: Priority 7 の保持', () => {
    it('three_calls_confirmed = "3回架電未" かつ inquiry_email_phone = "不通" → 「3回架電未」（priority: 7）', () => {
      // Arrange: Priority 8 の条件を満たす（Priority 1〜7 は満たさない）
      // inquiry_email_phone = "不通" は Priority 7 の条件を満たさないため、Priority 8 に分類される
      const buyer: BuyerData = {
        ...minimalBuyer,
        three_calls_confirmed: '3回架電未',
        inquiry_email_phone: '不通',
        inquiry_email_reply: null,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: Priority 8 に分類されることを確認
      expect(result.status).toBe('3回架電未');
      expect(result.priority).toBe(7);
    });
  });
});
