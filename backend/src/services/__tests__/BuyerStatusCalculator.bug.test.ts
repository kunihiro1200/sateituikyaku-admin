/**
 * バグ条件探索テスト: 買主ステータス「問合メール未対応」の分類バグ
 *
 * このテストは未修正コードでバグを再現し、根本原因を確認するためのものです。
 *
 * バグ条件:
 *   Priority 7 の判定が `and(equals(inquiry_email_phone, '未'), equals(inquiry_email_reply, '未'))` と
 *   なっており、両方が "未" の場合のみ「問合メール未対応」に分類される。
 *   スプレッドシートのIFS式では「どちらか一方が "未"」であれば分類されるべき。
 *   また、3番目の条件（内覧日空欄 + 電話対応 "不要" + メール返信 "未" または空欄）が未実装。
 *
 * 未修正コードでは:
 *   - ケース1〜4 は FAIL する（「問合メール未対応」に分類されないため）
 *   - これがバグの存在を証明する
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */

import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

/** テスト用の最小限の買主データ（Priority 1〜6 の条件を満たさない） */
const minimalBuyer: BuyerData = {
  buyer_number: '7192',
  name: 'テスト',
  // Priority 1〜6 の条件を満たさないよう全て null/undefined
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
};

describe('バグ条件探索: 問合メール未対応の分類バグ', () => {
  describe('ケース1: inquiry_email_phone = "未", inquiry_email_reply = null（空欄）', () => {
    it('「問合メール未対応」（priority: 7）に分類されるべきである（未修正コードでは FAIL）', () => {
      // Arrange
      const buyer: BuyerData = {
        ...minimalBuyer,
        inquiry_email_phone: '未',
        inquiry_email_reply: null,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 未修正コードでは and 条件のため FAIL する → バグの存在を証明
      expect(result.status).toBe('問合メール未対応');
      expect(result.priority).toBe(5);
    });
  });

  describe('ケース2: inquiry_email_phone = null（空欄）, inquiry_email_reply = "未"', () => {
    it('「問合メール未対応」（priority: 7）に分類されるべきである（未修正コードでは FAIL）', () => {
      // Arrange
      const buyer: BuyerData = {
        ...minimalBuyer,
        inquiry_email_phone: null,
        inquiry_email_reply: '未',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 未修正コードでは and 条件のため FAIL する → バグの存在を証明
      expect(result.status).toBe('問合メール未対応');
      expect(result.priority).toBe(5);
    });
  });

  describe('ケース3: latest_viewing_date = null, inquiry_email_phone = "不要", inquiry_email_reply = "未"', () => {
    it('「問合メール未対応」（priority: 7）に分類されるべきである（未修正コードでは FAIL）', () => {
      // Arrange: IFS式の3番目の条件
      const buyer: BuyerData = {
        ...minimalBuyer,
        latest_viewing_date: null,
        inquiry_email_phone: '不要',
        inquiry_email_reply: '未',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 未修正コードでは3番目の条件が未実装のため FAIL する → バグの存在を証明
      expect(result.status).toBe('問合メール未対応');
      expect(result.priority).toBe(5);
    });
  });

  describe('ケース4: latest_viewing_date = null, inquiry_email_phone = "不要", inquiry_email_reply = null（空欄）', () => {
    it('「問合メール未対応」（priority: 7）に分類されるべきである（未修正コードでは FAIL）', () => {
      // Arrange: IFS式の3番目の条件（メール返信が空欄のパターン）
      const buyer: BuyerData = {
        ...minimalBuyer,
        latest_viewing_date: null,
        inquiry_email_phone: '不要',
        inquiry_email_reply: null,
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 未修正コードでは3番目の条件が未実装のため FAIL する → バグの存在を証明
      expect(result.status).toBe('問合メール未対応');
      expect(result.priority).toBe(5);
    });
  });

  describe('正常動作確認（変更なし）: inquiry_email_phone = "未", inquiry_email_reply = "未"', () => {
    it('「問合メール未対応」（priority: 7）に分類される（修正前後ともに PASS）', () => {
      // Arrange: 両方 "未" の場合は修正前後ともに正常動作
      const buyer: BuyerData = {
        ...minimalBuyer,
        inquiry_email_phone: '未',
        inquiry_email_reply: '未',
      };

      // Act
      const result = calculateBuyerStatus(buyer);

      // Assert: 修正前後ともに PASS する
      expect(result.status).toBe('問合メール未対応');
      expect(result.priority).toBe(5);
    });
  });
});
