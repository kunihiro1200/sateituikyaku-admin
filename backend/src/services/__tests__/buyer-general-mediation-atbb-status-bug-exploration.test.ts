/**
 * バグ条件探索テスト: 一般媒介_内覧後売主連絡未カテゴリーのatbb_statusフィルタ欠如
 *
 * Property 1: Bug Condition - atbb_statusフィルタ欠如による誤表示
 *
 * このテストは修正前のコードで必ず失敗する必要があります。
 * 失敗によりバグの存在が確認されます。
 *
 * 期待される結果: テスト失敗（これは正しい - バグの存在を証明）
 */

import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

describe('Bug Exploration: 一般媒介_内覧後売主連絡未 atbb_statusフィルタ欠如', () => {
  describe('条件A: 内覧日が2025/8/1以降かつ過去 + 内覧形態_一般媒介が非空 + 内覧後売主連絡が未入力', () => {
    it('atbb_status="非公開"の買主は「一般媒介_内覧後売主連絡未」に分類されるべきではない（バグ）', () => {
      const buyer: BuyerData = {
        buyer_number: '7145',
        name: 'テスト買主7145',
        viewing_type_general: '一般',
        latest_viewing_date: '2025-09-15', // 過去
        post_viewing_seller_contact: '', // 空欄
        atbb_status: '非公開', // ← バグ: "公開中"が含まれない
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれないため、このカテゴリーに分類されるべきではない
      // 現在の動作（バグ）: 「一般媒介_内覧後売主連絡未」に分類される
      expect(result.status).not.toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).not.toBe(8);
    });

    it('atbb_status=空欄の買主は「一般媒介_内覧後売主連絡未」に分類されるべきではない（バグ）', () => {
      const buyer: BuyerData = {
        buyer_number: '7146',
        name: 'テスト買主7146',
        viewing_type_general: '一般',
        latest_viewing_date: '2025-09-15', // 過去
        post_viewing_seller_contact: '', // 空欄
        atbb_status: '', // ← バグ: "公開中"が含まれない
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれないため、このカテゴリーに分類されるべきではない
      expect(result.status).not.toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).not.toBe(8);
    });

    it('atbb_status="一般・公開中"の買主は「一般媒介_内覧後売主連絡未」に分類される（正常）', () => {
      const buyer: BuyerData = {
        buyer_number: '7148',
        name: 'テスト買主7148',
        viewing_type_general: '一般',
        latest_viewing_date: '2025-09-20', // 過去
        post_viewing_seller_contact: '', // 空欄
        atbb_status: '一般・公開中', // ← 正常: "公開中"が含まれる
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれるため、このカテゴリーに分類される
      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });
  });

  describe('条件B: 内覧後売主連絡 = "未"', () => {
    it('atbb_status="専任・公開中"の買主は「一般媒介_内覧後売主連絡未」に分類される（"公開中"が含まれるため）', () => {
      const buyer: BuyerData = {
        buyer_number: '7150',
        name: 'テスト買主7150',
        post_viewing_seller_contact: '未',
        atbb_status: '専任・公開中', // "公開中"が含まれる
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれるため、このカテゴリーに分類される
      // ユーザーの要求は「atbb_statusに"公開中"が含まれる場合のみ表示」
      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });

    it('atbb_status="非公開"の買主は「一般媒介_内覧後売主連絡未」に分類されるべきではない（バグ）', () => {
      const buyer: BuyerData = {
        buyer_number: '7151',
        name: 'テスト買主7151',
        post_viewing_seller_contact: '未',
        atbb_status: '非公開', // ← バグ: "公開中"が含まれない
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれないため、このカテゴリーに分類されるべきではない
      expect(result.status).not.toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).not.toBe(8);
    });

    it('atbb_status="一般・公開中"の買主は「一般媒介_内覧後売主連絡未」に分類される（正常）', () => {
      const buyer: BuyerData = {
        buyer_number: '7152',
        name: 'テスト買主7152',
        post_viewing_seller_contact: '未',
        atbb_status: '一般・公開中', // ← 正常: "公開中"が含まれる
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれるため、このカテゴリーに分類される
      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });
  });

  describe('エッジケース', () => {
    it('atbb_status="公開中"（"一般・"なし）の買主は「一般媒介_内覧後売主連絡未」に分類される', () => {
      const buyer: BuyerData = {
        buyer_number: '7153',
        name: 'テスト買主7153',
        post_viewing_seller_contact: '未',
        atbb_status: '公開中', // ← "公開中"が含まれる（"一般・"なし）
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれるため、このカテゴリーに分類される
      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });

    it('atbb_status="一般・非公開"の買主は「一般媒介_内覧後売主連絡未」に分類されるべきではない', () => {
      const buyer: BuyerData = {
        buyer_number: '7154',
        name: 'テスト買主7154',
        post_viewing_seller_contact: '未',
        atbb_status: '一般・非公開', // ← "公開中"が含まれない
      };

      const result = calculateBuyerStatus(buyer);

      // 期待される動作: atbb_statusに"公開中"が含まれないため、このカテゴリーに分類されるべきではない
      expect(result.status).not.toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).not.toBe(8);
    });
  });
});
