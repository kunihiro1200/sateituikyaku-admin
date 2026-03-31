// Bug Condition Exploration Test for Property Report "Unreported" Filter Bug
// This test MUST FAIL on unfixed code - failure confirms the bug exists

import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';

describe('Property Report Unreported Filter - Bug Exploration', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  describe('Bug Condition: 報告日設定済み物件が「未報告」に誤表示', () => {
    it('報告日が今日以前の物件は「未報告」と判定されない（報告済み）', () => {
      // AA12636のケース: 報告日が4/14（今日以前）
      const listing = {
        property_number: 'AA12636',
        report_date: yesterday.toISOString().split('T')[0], // 昨日
        report_assignee: 'Y',
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      // 期待: 報告日が設定されているので「未報告」ではない
      // 実際（未修正）: 「未報告」と判定される（バグ）
      expect(status.key).not.toBe('unreported');
    });

    it('報告日が今日の物件は「未報告」と判定されない（報告済み）', () => {
      const listing = {
        property_number: 'AA12639',
        report_date: today.toISOString().split('T')[0], // 今日
        report_assignee: 'I',
        confirmation: '済',
        atbb_status: '専任・公開中',
        sales_assignee: '山本',
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: 'S不要',
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      // 期待: 報告日が今日なので「未報告」ではない
      expect(status.key).not.toBe('unreported');
    });

    it('報告日が未設定の物件は「未報告」と判定される', () => {
      // AA12637のケース: 報告日が未設定
      const listing = {
        property_number: 'AA12637',
        report_date: null, // 未設定
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      // 期待: 報告日が未設定なので「未報告」
      // 実際（未修正）: 「未報告」と判定されない（バグ）
      expect(status.key).toBe('unreported');
    });

    it('報告日が未来の物件は「未報告」と判定される', () => {
      // AA12636のケース: 報告日を未来（4/14）に変更した場合
      // 実際のデータに近い条件でテスト
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 14); // 14日後（4/14相当）
      
      const listing = {
        property_number: 'AA12636',
        report_date: futureDate.toISOString().split('T')[0], // 14日後
        report_assignee: 'Y',
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      // 期待: 報告日が未来なので「未報告」
      // 実際: 「一般公開中物件」と判定される（バグ）
      expect(status.key).toBe('unreported');
      expect(status.label).toBe('未報告Y');
    });

    it('報告担当者が設定されている場合、ラベルに担当者名が含まれる', () => {
      const listing = {
        property_number: 'AA12640',
        report_date: null, // 未設定
        report_assignee: 'Y',
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
        price_reduction_scheduled_date: null,
      };

      const status = calculatePropertyStatus(listing);

      // 期待: 「未報告Y」のラベル
      expect(status.key).toBe('unreported');
      expect(status.label).toBe('未報告Y');
    });
  });
});
