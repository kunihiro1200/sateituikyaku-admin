/**
 * 保存プロパティテスト: 一般媒介_内覧後売主連絡未カテゴリーのatbb_statusフィルタ修正
 *
 * Property 2: Preservation - 他のカテゴリーのフィルタリング維持
 *
 * このテストは修正前のコードでパスする必要があります（ベースライン動作を確認）。
 * 修正後も同じ結果が得られることを検証します。
 *
 * 期待される結果: テスト成功（ベースライン動作を確認）
 */

import { calculateBuyerStatus, BuyerData } from '../BuyerStatusCalculator';

describe('Preservation: 一般媒介_内覧後売主連絡未 atbb_statusフィルタ修正', () => {
  describe('Priority 1-7のカテゴリーは変更されない', () => {
    it('Priority 1: 査定アンケート回答あり', () => {
      const buyer: BuyerData = {
        buyer_number: 'P001',
        name: 'テスト買主P001',
        valuation_survey: '回答済み',
        valuation_survey_confirmed: '', // 空欄
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('査定アンケート回答あり');
      expect(result.priority).toBe(1);
    });

    it('Priority 2: 業者問合せあり', () => {
      const buyer: BuyerData = {
        buyer_number: 'P002',
        name: 'テスト買主P002',
        vendor_survey: '未',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('業者問合せあり');
      expect(result.priority).toBe(2);
    });

    it('Priority 3: 内覧日前日', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const buyer: BuyerData = {
        buyer_number: 'P003',
        name: 'テスト買主P003',
        latest_viewing_date: tomorrowStr,
        broker_inquiry: '', // 業者問合せでない
        notification_sender: '', // 空欄
      };

      const result = calculateBuyerStatus(buyer);

      // 木曜日でない場合は「内覧日前日」に分類される
      if (tomorrow.getDay() !== 4) {
        expect(result.status).toBe('内覧日前日');
        expect(result.priority).toBe(3);
      }
    });

    it('Priority 4: 内覧未確定', () => {
      const buyer: BuyerData = {
        buyer_number: 'P004',
        name: 'テスト買主P004',
        viewing_unconfirmed: '未確定',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('内覧未確定');
      expect(result.priority).toBe(4);
    });

    it('Priority 6: 当日TEL（担当なし）', () => {
      const today = new Date().toISOString().split('T')[0];

      const buyer: BuyerData = {
        buyer_number: 'P006',
        name: 'テスト買主P006',
        next_call_date: today,
        follow_up_assignee: '', // 担当なし
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('当日TEL');
      expect(result.priority).toBe(6);
    });
  });

  describe('Priority 9-15の内覧後未入力カテゴリーは変更されない（既にatbb_status条件あり）', () => {
    it('Priority 9: Y_内覧後未入力（atbb_statusに"公開中"が含まれる）', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const buyer: BuyerData = {
        buyer_number: 'P009',
        name: 'テスト買主P009',
        follow_up_assignee: 'Y',
        latest_viewing_date: yesterdayStr,
        viewing_result_follow_up: '', // 空欄
        atbb_status: '一般・公開中', // "公開中"が含まれる
        broker_inquiry: '', // 業者問合せでない
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('Y_内覧後未入力');
      expect(result.priority).toBe(9);
    });

    it('Priority 9: Y_内覧後未入力（atbb_statusに"公開中"が含まれない場合は除外）', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const buyer: BuyerData = {
        buyer_number: 'P009B',
        name: 'テスト買主P009B',
        follow_up_assignee: 'Y',
        latest_viewing_date: yesterdayStr,
        viewing_result_follow_up: '', // 空欄
        atbb_status: '非公開', // "公開中"が含まれない
        broker_inquiry: '', // 業者問合せでない
      };

      const result = calculateBuyerStatus(buyer);

      // atbb_statusに"公開中"が含まれないため、Y_内覧後未入力には分類されない
      expect(result.status).not.toBe('Y_内覧後未入力');
      expect(result.priority).not.toBe(9);
    });
  });

  describe('Priority 23-30の担当者別カテゴリーは変更されない', () => {
    it('Priority 23: 担当(Y)', () => {
      const buyer: BuyerData = {
        buyer_number: 'P023',
        name: 'テスト買主P023',
        follow_up_assignee: 'Y',
        next_call_date: '', // 空欄または未来の日付
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('担当(Y)');
      expect(result.priority).toBe(23);
    });

    it('Priority 23: 当日TEL(Y)（次電日が今日以前）', () => {
      const today = new Date().toISOString().split('T')[0];

      const buyer: BuyerData = {
        buyer_number: 'P023B',
        name: 'テスト買主P023B',
        follow_up_assignee: 'Y',
        next_call_date: today,
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('当日TEL(Y)');
      expect(result.priority).toBe(23);
    });
  });

  describe('「一般媒介_内覧後売主連絡未」カテゴリーで、atbb_statusに"公開中"が含まれる買主は正しく分類される', () => {
    it('条件A満たす + atbb_status="一般・公開中"', () => {
      const buyer: BuyerData = {
        buyer_number: 'P008A',
        name: 'テスト買主P008A',
        viewing_type_general: '一般',
        latest_viewing_date: '2025-09-15', // 過去
        post_viewing_seller_contact: '', // 空欄
        atbb_status: '一般・公開中', // "公開中"が含まれる
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });

    it('条件B満たす + atbb_status="一般・公開中"', () => {
      const buyer: BuyerData = {
        buyer_number: 'P008B',
        name: 'テスト買主P008B',
        post_viewing_seller_contact: '未',
        atbb_status: '一般・公開中', // "公開中"が含まれる
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });
  });
});
