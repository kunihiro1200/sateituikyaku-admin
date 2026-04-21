/**
 * 保全プロパティテスト - 他カテゴリーの動作保全
 *
 * **Feature: property-list-sidebar-category-sync-fix, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * このテストは未修正コードでも修正後コードでも**成功する**ことが期待される。
 * 修正によって他カテゴリーの動作が変わらないことを保証する。
 *
 * 観察優先メソドロジー:
 * 未修正コードで非バグ条件の入力の動作を観察・記録し、
 * 修正後も同じ動作が維持されることを検証する。
 */

import { calculatePropertyStatus } from '../propertyListingStatusUtils';

// ============================================================
// テスト用ヘルパー
// ============================================================

const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getYesterdayString = (): string => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const year = yesterday.getFullYear();
  const month = String(yesterday.getMonth() + 1).padStart(2, '0');
  const day = String(yesterday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTomorrowString = (): string => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const year = tomorrow.getFullYear();
  const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const day = String(tomorrow.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ============================================================
// 保全テスト
// ============================================================

describe('Property 2: Preservation - 他カテゴリーの動作保全', () => {
  const today = getTodayString();
  const yesterday = getYesterdayString();
  const tomorrow = getTomorrowString();

  /**
   * 観察1: calculatePropertyStatus() が private_pending を返す物件（正常ケース）
   * general_mediation_private === '非公開予定' かつ他の優先度高条件に該当しない物件
   *
   * **Validates: Requirements 3.1**
   */
  it('観察1: 正常な非公開予定物件は private_pending を返す', () => {
    const listing = {
      property_number: 'PRES-001',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: '非公開予定',
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,          // null → unreported にならない
      report_assignee: null,
      price_reduction_scheduled_date: null,  // null → price_reduction_due にならない
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('private_pending');
    expect(status.label).toBe('非公開予定（確認後）');
  });

  /**
   * 観察2: report_date が今日以前の物件は unreported を返す
   * バグ条件に該当するが、calculatePropertyStatus() は unreported を返す
   *
   * **Validates: Requirements 3.2**
   */
  it('観察2: report_date が今日の物件は unreported を返す', () => {
    const listing = {
      property_number: 'PRES-002',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: today,         // 今日 → unreported
      report_assignee: '山本',
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('unreported');
  });

  it('観察2b: report_date が昨日の物件は unreported を返す', () => {
    const listing = {
      property_number: 'PRES-002b',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: yesterday,     // 昨日 → unreported
      report_assignee: '山本',
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('unreported');
  });

  it('観察2c: report_date が明日の物件は unreported を返さない', () => {
    const listing = {
      property_number: 'PRES-002c',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: tomorrow,      // 明日 → unreported にならない
      report_assignee: '山本',
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).not.toBe('unreported');
  });

  /**
   * 観察3: confirmation === '未' の物件は incomplete を返す
   *
   * **Validates: Requirements 3.3**
   */
  it('観察3: confirmation === 未 の物件は incomplete を返す', () => {
    const listing = {
      property_number: 'PRES-003',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: '未',         // 未完了
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('incomplete');
    expect(status.label).toBe('未完了');
  });

  /**
   * 観察4: price_reduction_scheduled_date が今日以前の物件は price_reduction_due を返す
   *
   * **Validates: Requirements 3.6**
   */
  it('観察4: price_reduction_scheduled_date が昨日の物件は price_reduction_due を返す', () => {
    const listing = {
      property_number: 'PRES-004',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      price_reduction_scheduled_date: yesterday,  // 昨日 → price_reduction_due
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('price_reduction_due');
    expect(status.label).toBe('要値下げ');
  });

  it('観察4b: price_reduction_scheduled_date が今日の物件は price_reduction_due を返す', () => {
    const listing = {
      property_number: 'PRES-004b',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      price_reduction_scheduled_date: today,      // 今日 → price_reduction_due
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('price_reduction_due');
  });

  /**
   * 観察5: 優先度順の確認
   * price_reduction_due > unreported > incomplete > private_pending
   *
   * **Validates: Requirements 3.7**
   */
  it('観察5a: price_reduction_due は unreported より優先度が高い', () => {
    const listing = {
      property_number: 'PRES-005a',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: today,         // unreported 条件
      report_assignee: '山本',
      price_reduction_scheduled_date: yesterday,  // price_reduction_due 条件（優先）
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('price_reduction_due');  // price_reduction_due が優先
  });

  it('観察5b: unreported は incomplete より優先度が高い', () => {
    const listing = {
      property_number: 'PRES-005b',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: '未',         // incomplete 条件
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: today,         // unreported 条件（優先）
      report_assignee: '山本',
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('unreported');  // unreported が優先
  });

  it('観察5c: incomplete は private_pending より優先度が高い', () => {
    const listing = {
      property_number: 'PRES-005c',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: '未',         // incomplete 条件（優先）
      general_mediation_private: '非公開予定',  // private_pending 条件
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('incomplete');  // incomplete が優先
  });

  it('観察5d: unreported は private_pending より優先度が高い', () => {
    const listing = {
      property_number: 'PRES-005d',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: '非公開予定',  // private_pending 条件
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: today,         // unreported 条件（優先）
      report_assignee: '山本',
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('unreported');  // unreported が優先
  });

  /**
   * 観察6: 専任公開中（担当者別）の動作
   *
   * **Validates: Requirements 3.4**
   */
  it('観察6: 山本担当の専任公開中物件は exclusive_y を返す', () => {
    const listing = {
      property_number: 'PRES-006',
      sales_assignee: '山本',
      atbb_status: '専任・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: 'https://suumo.jp/test',  // suumo_url あり
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).toBe('exclusive_y');
    expect(status.label).toBe('Y専任公開中');
  });

  /**
   * 観察7: report_date が null の物件は unreported にならない
   *
   * **Validates: Requirements 3.1**
   */
  it('観察7: report_date が null の物件は unreported にならない', () => {
    const listing = {
      property_number: 'PRES-007',
      sales_assignee: '山本',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,          // null → unreported にならない
      report_assignee: null,
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const status = calculatePropertyStatus(listing as any);
    expect(status.key).not.toBe('unreported');
  });
});
