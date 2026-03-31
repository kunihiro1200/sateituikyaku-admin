// Preservation Test for Property Report "Unreported" Filter Bug Fix
// This test MUST PASS on unfixed code - confirms baseline behavior to preserve

import { calculatePropertyStatus, createWorkTaskMap } from '../utils/propertyListingStatusUtils';

describe('Property Report Unreported Filter - Preservation', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  describe('Preservation: 他のステータス判定ロジックの保存', () => {
    it('値下げ予定日が今日以前の物件は「要値下げ」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST001',
        price_reduction_scheduled_date: yesterday.toISOString().split('T')[0],
        report_date: null,
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('price_reduction_due');
    });

    it('確認が「未」の物件は「未完了」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST002',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '未',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('incomplete');
    });

    it('一般媒介非公開が「非公開予定」の物件は「非公開予定（確認後）」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST003',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: '非公開予定',
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('private_pending');
    });

    it('１社掲載が「未確認」の物件は「一般媒介の掲載確認未」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST004',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: '未確認',
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('general_listing_unconfirmed');
    });

    it('公開前で公開予定日が今日以前の物件は「本日公開予定」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST005',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開前',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
      };

      const workTaskMap = createWorkTaskMap([
        {
          property_number: 'TEST005',
          publish_scheduled_date: today.toISOString().split('T')[0],
        },
      ]);

      const status = calculatePropertyStatus(listing, workTaskMap);
      expect(status.key).toBe('today_publish');
    });

    it('公開中でSUUMO URLが空の物件は「SUUMO URL　要登録」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST006',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
      };

      const workTaskMap = createWorkTaskMap([
        {
          property_number: 'TEST006',
          publish_scheduled_date: yesterday.toISOString().split('T')[0],
        },
      ]);

      const status = calculatePropertyStatus(listing, workTaskMap);
      expect(status.key).toBe('suumo_required');
    });

    it('買付申込みの条件を満たす物件は「買付申込み（内覧なし）２」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST007',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: '一般両手',
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('offer_no_viewing');
    });

    it('公開前の物件は「公開前情報」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST008',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開前',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('pre_publish');
    });

    it('非公開（配信メールのみ）の物件は「非公開（配信メールのみ）」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST009',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '非公開（配信メールのみ）',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: null,
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('private_email_only');
    });

    it('一般公開中の物件は「一般公開中物件」ステータスを返す', () => {
      const listing = {
        property_number: 'TEST010',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '一般・公開中',
        sales_assignee: null,
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('general_public');
    });

    it('専任公開中の物件は担当者別の専任公開中ステータスを返す', () => {
      const listing = {
        property_number: 'TEST011',
        price_reduction_scheduled_date: null,
        report_date: yesterday.toISOString().split('T')[0], // 報告済み
        report_assignee: null,
        confirmation: '済',
        atbb_status: '専任・公開中',
        sales_assignee: '山本',
        general_mediation_private: null,
        single_listing: null,
        suumo_url: 'https://example.com',
        suumo_registered: null,
        offer_status: null,
      };

      const status = calculatePropertyStatus(listing);
      expect(status.key).toBe('exclusive_y');
    });
  });
});
