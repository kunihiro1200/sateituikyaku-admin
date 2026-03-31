/**
 * Bug Condition Exploration Test
 * 
 * Property 1: Bug Condition - Suumo URL入力済み物件の除外
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * DO NOT attempt to fix the test or the code when it fails
 * 
 * Goal: Surface counterexamples that demonstrate the bug exists
 * Expected Outcome: Test FAILS (this is correct - it proves the bug exists)
 */

import { calculatePropertyStatus, createWorkTaskMap } from '../utils/propertyListingStatusUtils';

describe('Property Listing Suumo URL Filter Bug - Exploration', () => {
  it('should NOT categorize AA12497 (with Suumo URL) as reins_suumo_required when workTaskMap is undefined', () => {
    // AA12497の実際のデータ
    const listing = {
      property_number: 'AA12497',
      suumo_url: 'https://suumo.jp/chukoikkodate/oita/sc_oita/nc_20541403/',
      atbb_status: '専任・公開中',
      suumo_registered: null, // S不要ではない
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: '裏',
    };

    // workTaskMapがundefinedの場合（バグ条件）
    const result = calculatePropertyStatus(listing as any, undefined);

    // 期待: Suumo URLが入力されているので、reins_suumo_requiredではない
    // 実際: workTaskMapがundefinedなので、条件6がスキップされ、reins_suumo_requiredになる可能性
    expect(result.key).not.toBe('reins_suumo_required');
    expect(result.key).not.toBe('suumo_required');
  });

  it('should NOT categorize properties with Suumo URL as reins_suumo_required when workTaskMap is provided', () => {
    const listing = {
      property_number: 'AA12497',
      suumo_url: 'https://suumo.jp/chukoikkodate/oita/sc_oita/nc_20541403/',
      atbb_status: '専任・公開中',
      suumo_registered: null,
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: '裏',
    };

    // 公開予定日が昨日以前のworkTaskMapを作成
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const workTasks = [
      {
        property_number: 'AA12497',
        publish_scheduled_date: yesterday.toISOString(),
      },
    ];
    const workTaskMap = createWorkTaskMap(workTasks);

    const result = calculatePropertyStatus(listing as any, workTaskMap);

    // 期待: Suumo URLが入力されているので、reins_suumo_requiredではない
    expect(result.key).not.toBe('reins_suumo_required');
    expect(result.key).not.toBe('suumo_required');
  });

  it('should categorize properties WITHOUT Suumo URL as reins_suumo_required (preservation)', () => {
    const listing = {
      property_number: 'TEST001',
      suumo_url: null, // Suumo URLが空
      atbb_status: '専任・公開中',
      suumo_registered: null,
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: '裏',
    };

    // 公開予定日が昨日以前のworkTaskMapを作成
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const workTasks = [
      {
        property_number: 'TEST001',
        publish_scheduled_date: yesterday.toISOString(),
      },
    ];
    const workTaskMap = createWorkTaskMap(workTasks);

    const result = calculatePropertyStatus(listing as any, workTaskMap);

    // 期待: Suumo URLが空なので、reins_suumo_requiredになる
    expect(result.key).toBe('reins_suumo_required');
  });

  it('should NOT categorize properties with suumo_registered = "S不要" as reins_suumo_required (preservation)', () => {
    const listing = {
      property_number: 'TEST002',
      suumo_url: null,
      atbb_status: '専任・公開中',
      suumo_registered: 'S不要', // S不要
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: '裏',
    };

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 2);
    const workTasks = [
      {
        property_number: 'TEST002',
        publish_scheduled_date: yesterday.toISOString(),
      },
    ];
    const workTaskMap = createWorkTaskMap(workTasks);

    const result = calculatePropertyStatus(listing as any, workTaskMap);

    // 期待: S不要なので、reins_suumo_requiredではない
    expect(result.key).not.toBe('reins_suumo_required');
    expect(result.key).not.toBe('suumo_required');
  });
});
