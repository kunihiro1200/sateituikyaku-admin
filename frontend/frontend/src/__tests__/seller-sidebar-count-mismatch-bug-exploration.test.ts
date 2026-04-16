// Bug Condition Exploration Test: 売主サイドバーカウント不一致バグ
// このテストは未修正コードでFAILすることが正しい動作です
// FAILすることでバグの存在を証明します
//
// Validates: Requirements 1.1, 1.2, 1.3

import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';

// getAssigneeInitialはエクスポートされていないため、calculatePropertyStatusを通じてテスト
// ただし、直接テストするためにモジュールの内部実装を確認する方法として
// calculatePropertyStatusの結果からgetAssigneeInitialの動作を推測する

describe('売主サイドバーカウント不一致バグ - バグ条件探索テスト', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayStr = yesterday.toISOString().split('T')[0];

  describe('Bug Condition: getAssigneeInitial("林田") のイニシャル変換', () => {
    it('report_assignee="林田"、report_date=昨日 の物件で calculatePropertyStatus が label.replace(/\\s+/g, "") === "未報告林" を返すこと', () => {
      // バグ条件: report_assignee = '林田' かつ report_date が今日以前
      const listing = {
        property_number: 'AA9999',
        report_date: yesterdayStr,
        report_assignee: '林田',
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      // 期待: getAssigneeInitial('林田') が '林' を返し、ラベルが '未報告林' となる
      // 未修正コード: getAssigneeInitial('林田') が '林田' を返し、ラベルが '未報告林田' となるためFAIL
      expect(status.key).toBe('unreported');
      expect(status.label.replace(/\s+/g, '')).toBe('未報告林');
    });

    it('report_assignee="林田"、report_date=昨日 の物件で calculatePropertyStatus が "未報告林田" ではなく "未報告林" を返すこと', () => {
      const listing = {
        property_number: 'AA9729',
        report_date: yesterdayStr,
        report_assignee: '林田',
        confirmation: '済',
        atbb_status: '専任・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      // 未修正コード: ラベルが '未報告林田' となるためFAIL
      expect(status.label.replace(/\s+/g, '')).not.toBe('未報告林田');
      expect(status.label.replace(/\s+/g, '')).toBe('未報告林');
    });
  });
});
