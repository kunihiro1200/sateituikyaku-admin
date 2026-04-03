/**
 * 買主サイドバー「内覧済み」「担当」カテゴリフィルタ不具合 - 保存プロパティテスト
 * 
 * Property 2: Preservation - 優先度の高いステータスの判定
 * 
 * 目的: 修正前のコードで優先度の高いステータス（Priority 1-15）の動作を観察し、
 *       修正後も同じ動作が保存されることを検証する
 * 
 * 期待される結果: 修正前のコードでテストがPASSする（ベースライン動作の確認）
 */

import { calculateBuyerStatus, BuyerData } from '../services/BuyerStatusCalculator';

describe('Preservation Property Tests - 優先度の高いステータスの判定', () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  describe('Priority 1: 査定アンケート回答あり', () => {
    it('valuation_surveyが非空、valuation_survey_confirmedが空の場合、「査定アンケート回答あり」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST001',
        name: 'テスト買主1',
        valuation_survey: '回答済み',
        valuation_survey_confirmed: null,
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('査定アンケート回答あり');
      expect(result.priority).toBe(1);
    });

    it('valuation_surveyが空の場合、「査定アンケート回答あり」を返さない', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST002',
        name: 'テスト買主2',
        valuation_survey: null,
        valuation_survey_confirmed: null,
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).not.toBe('査定アンケート回答あり');
    });
  });

  describe('Priority 2: 業者問合せあり', () => {
    it('vendor_survey = "未"の場合、「業者問合せあり」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST003',
        name: 'テスト買主3',
        vendor_survey: '未',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('業者問合せあり');
      expect(result.priority).toBe(2);
    });

    it('vendor_survey != "未"の場合、「業者問合せあり」を返さない', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST004',
        name: 'テスト買主4',
        vendor_survey: '済',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).not.toBe('業者問合せあり');
    });
  });

  describe('Priority 3: 内覧日前日', () => {
    it('内覧日が明日（月曜日）の場合、「内覧日前日」を返す', () => {
      // 明日が月曜日になるように日付を調整
      const nextMonday = new Date(today);
      const daysUntilMonday = (1 - today.getDay() + 7) % 7 || 7;
      nextMonday.setDate(today.getDate() + daysUntilMonday);

      const buyer: BuyerData = {
        buyer_number: 'TEST005',
        name: 'テスト買主5',
        viewing_date: nextMonday.toISOString(),
        broker_inquiry: null,
        notification_sender: null,
      };

      const result = calculateBuyerStatus(buyer);

      // 明日が月曜日の場合のみ「内覧日前日」を返す
      if (daysUntilMonday === 1) {
        expect(result.status).toBe('内覧日前日');
        expect(result.priority).toBe(3);
      } else {
        // 明日が月曜日でない場合はスキップ
        expect(result.status).not.toBe('内覧日前日');
      }
    });

    it('内覧日が木曜日で2日後の場合、「内覧日前日」を返す', () => {
      // 2日後が木曜日になるように日付を調整
      const nextThursday = new Date(today);
      const daysUntilThursday = (4 - today.getDay() + 7) % 7 || 7;
      nextThursday.setDate(today.getDate() + daysUntilThursday);

      const buyer: BuyerData = {
        buyer_number: 'TEST006',
        name: 'テスト買主6',
        viewing_date: nextThursday.toISOString(),
        broker_inquiry: null,
        notification_sender: null,
      };

      const result = calculateBuyerStatus(buyer);

      // 2日後が木曜日の場合のみ「内覧日前日」を返す
      if (daysUntilThursday === 2) {
        expect(result.status).toBe('内覧日前日');
        expect(result.priority).toBe(3);
      }
    });

    it('broker_inquiry = "業者問合せ"の場合、「内覧日前日」を返さない', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST007',
        name: 'テスト買主7',
        viewing_date: tomorrow.toISOString(),
        broker_inquiry: '業者問合せ',
        notification_sender: null,
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).not.toBe('内覧日前日');
    });

    it('notification_senderが入力済みの場合、「内覧日前日」を返さない', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST008',
        name: 'テスト買主8',
        viewing_date: tomorrow.toISOString(),
        broker_inquiry: null,
        notification_sender: 'Y',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).not.toBe('内覧日前日');
    });
  });

  describe('Priority 4: 内覧未確定', () => {
    it('viewing_unconfirmed = "未確定"の場合、「内覧未確定」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST009',
        name: 'テスト買主9',
        viewing_unconfirmed: '未確定',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('内覧未確定');
      expect(result.priority).toBe(4);
    });
  });

  describe('Priority 5: 問合メール未対応', () => {
    it('inquiry_email_phone = "未"の場合、「問合メール未対応」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST010',
        name: 'テスト買主10',
        inquiry_email_phone: '未',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('問合メール未対応');
      expect(result.priority).toBe(5);
    });

    it('inquiry_email_reply = "未"の場合、「問合メール未対応」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST011',
        name: 'テスト買主11',
        inquiry_email_reply: '未',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('問合メール未対応');
      expect(result.priority).toBe(5);
    });
  });

  describe('Priority 6: 当日TEL', () => {
    it('next_call_dateが今日以前、follow_up_assigneeが空の場合、「当日TEL」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST012',
        name: 'テスト買主12',
        next_call_date: yesterday.toISOString(),
        follow_up_assignee: null,
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('当日TEL');
      expect(result.priority).toBe(6);
    });

    it('follow_up_assigneeが存在する場合、「当日TEL」を返さない（担当者別カテゴリになる）', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST013',
        name: 'テスト買主13',
        next_call_date: yesterday.toISOString(),
        follow_up_assignee: 'Y',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).not.toBe('当日TEL');
      // 担当者別カテゴリ（Priority 23以降）になる
      expect(result.status).toBe('当日TEL(Y)');
    });
  });

  describe('Priority 7: 3回架電未', () => {
    it('three_calls_confirmed = "3回架電未" かつ inquiry_email_phone = "不通"の場合、「3回架電未」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST014',
        name: 'テスト買主14',
        three_calls_confirmed: '3回架電未',
        inquiry_email_phone: '不通',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('3回架電未');
      expect(result.priority).toBe(7);
    });
  });

  describe('Priority 8: 一般媒介_内覧後売主連絡未', () => {
    it('条件Aを満たす場合、「一般媒介_内覧後売主連絡未」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST015',
        name: 'テスト買主15',
        viewing_type_general: '一般媒介',
        latest_viewing_date: '2025-09-01',
        post_viewing_seller_contact: null,
        atbb_status: '公開中',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });

    it('条件Bを満たす場合、「一般媒介_内覧後売主連絡未」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST016',
        name: 'テスト買主16',
        post_viewing_seller_contact: '未',
        atbb_status: '公開中',
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('一般媒介_内覧後売主連絡未');
      expect(result.priority).toBe(8);
    });
  });

  describe('Priority 9-15: 担当者別内覧後未入力', () => {
    it('担当Y: 内覧後の入力が未完了の場合、「Y_内覧後未入力」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST017',
        name: 'テスト買主17',
        follow_up_assignee: 'Y',
        latest_viewing_date: yesterday.toISOString(),
        viewing_result_follow_up: null,
        atbb_status: '公開中',
        broker_inquiry: null,
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('Y_内覧後未入力');
      expect(result.priority).toBe(9);
    });

    it('担当生: 内覧後の入力が未完了の場合、「生_内覧後未入力」を返す', () => {
      const buyer: BuyerData = {
        buyer_number: 'TEST018',
        name: 'テスト買主18',
        follow_up_assignee: '生',
        latest_viewing_date: yesterday.toISOString(),
        viewing_result_follow_up: null,
        atbb_status: '公開中',
        broker_inquiry: null,
      };

      const result = calculateBuyerStatus(buyer);

      expect(result.status).toBe('生_内覧後未入力');
      expect(result.priority).toBe(10);
    });
  });

  describe('既存のフィルタリング・検索機能の保存', () => {
    it('複数の買主データで、優先度の高いステータスが正しく判定される', () => {
      const buyers: BuyerData[] = [
        {
          buyer_number: 'TEST019',
          name: 'テスト買主19',
          valuation_survey: '回答済み',
          valuation_survey_confirmed: null,
        },
        {
          buyer_number: 'TEST020',
          name: 'テスト買主20',
          vendor_survey: '未',
        },
        {
          buyer_number: 'TEST021',
          name: 'テスト買主21',
          next_call_date: yesterday.toISOString(),
          follow_up_assignee: null,
        },
      ];

      const results = buyers.map(buyer => calculateBuyerStatus(buyer));

      expect(results[0].status).toBe('査定アンケート回答あり');
      expect(results[1].status).toBe('業者問合せあり');
      expect(results[2].status).toBe('当日TEL');
    });
  });
});
