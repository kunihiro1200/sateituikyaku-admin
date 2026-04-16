/**
 * バグ条件探索テスト - workTaskMap空時のunreported誤カウントバグ
 *
 * **Feature: property-sidebar-count-mismatch-fix, Property 1: Bug Condition**
 * **Validates: Requirements 2.3, 2.4**
 *
 * このテストは**未修正コードで FAIL** することが期待される。
 * FAIL = バグが存在することの証明。
 *
 * バグの根本原因（未修正）:
 * PropertySidebarStatus.tsx の statusCounts 計算において、
 * workTaskMap が空（業務依頼データ未取得）の状態で calculatePropertyStatus を呼び出すと、
 * calculatePropertyStatus の内部で `if (isPrePublish && workTaskMap)` の条件が false になり、
 * today_publish 判定がスキップされる。
 * その結果、本来「本日公開予定」になるべき物件が「公開前情報」として分類されるが、
 * workTaskMap 取得後は「本日公開予定」として正しく分類される。
 *
 * テスト対象物件:
 * - report_date = null（未設定）
 * - atbb_status = '一般・公開前'
 * - publish_scheduled_date = 今日
 *
 * 注意: report_date = 今日 の物件は calculatePropertyStatus の優先度上、
 * workTaskMap の有無に関わらず unreported が返される（unreported > today_publish）。
 * そのため、report_date = null の物件でバグを再現する。
 *
 * CRITICAL: このテストが FAIL したら、コードを修正しないこと。
 * FAIL は「バグが存在する」ことの証明であり、正しい結果。
 */

import { calculatePropertyStatus, createWorkTaskMap } from '../propertyListingStatusUtils';

// ============================================================
// テスト用ヘルパー
// ============================================================

/**
 * 今日の日付を YYYY-MM-DD 形式で返す
 */
const getTodayString = (): string => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * PropertySidebarStatus.tsx の statusCounts 計算ロジックを模倣した関数
 * workTaskMap を受け取り、「未報告林」のカウントを返す
 */
const countUnreported = (
  listings: any[],
  workTaskMap: Map<string, Date | null> | undefined
): number => {
  let count = 0;
  listings.forEach(listing => {
    // 専任・公開中は早期リターン（PropertySidebarStatus.tsx と同じ）
    if (listing.sidebar_status === '専任・公開中') return;

    const computed = calculatePropertyStatus(listing as any, workTaskMap);

    // 要値下げ
    if (computed.key === 'price_reduction_due') return;

    // 未報告
    if (computed.key === 'unreported') {
      const label = computed.label.replace(/\s+/g, '');
      if (label === '未報告林') {
        count++;
      }
      return;
    }

    // 本日公開予定
    if (workTaskMap && computed.key === 'today_publish') return;
  });
  return count;
};

/**
 * PropertyListingsPage.tsx の filteredListings 計算ロジックを模倣した関数
 * sidebarStatus === '未報告林' の場合のフィルタリング件数を返す
 */
const filterUnreported = (
  listings: any[],
  workTaskMap: Map<string, Date | null>
): number => {
  return listings.filter(l => {
    const status = calculatePropertyStatus(l as any, workTaskMap);
    const normalizedStatusLabel = status.label.replace(/\s+/g, '');
    const normalizedSidebarStatus = '未報告林';
    return normalizedStatusLabel === normalizedSidebarStatus;
  }).length;
};

// ============================================================
// バグ条件テスト
// ============================================================

describe('Property 1: Bug Condition - workTaskMap空時のunreported誤カウントバグ', () => {
  const today = getTodayString();
  const propertyNumber = 'TEST-001';

  /**
   * テスト対象物件（バグ物件）:
   * - report_date = null（未設定）→ unreported にはならない
   * - atbb_status = '一般・公開前' → isPrePublish = true
   * - publish_scheduled_date = 今日 → workTaskMap があれば today_publish を返す
   *
   * バグの発現:
   * - workTaskMap = undefined の場合: today_publish 判定スキップ → '公開前情報' として分類
   *   → countUnreported では未報告としてカウントされない（正しい）
   * - workTaskMap = 取得済みの場合: today_publish 判定実行 → 'today_publish' として分類
   *   → filterUnreported では未報告としてフィルタリングされない（正しい）
   *
   * 注意: report_date = 今日 の物件は calculatePropertyStatus の優先度上、
   * workTaskMap の有無に関わらず unreported が返される（unreported > today_publish）。
   * そのため、report_date = null の物件でバグを再現する。
   *
   * バグの本質:
   * PropertySidebarStatus.tsx では workTaskMap が空の Map（undefined ではなく空の Map）で
   * 渡される場合、workTaskMap は truthy だが Map.get() が undefined を返すため
   * today_publish 判定が false になる。
   * しかし PropertyListingsPage.tsx では workTaskMap が揃った後にフィルタリングするため、
   * today_publish が正しく判定される。
   * この「空の Map vs 揃った Map」の差異がカウント不一致を引き起こす。
   */
  const bugListing = {
    property_number: propertyNumber,
    sales_assignee: '林',
    atbb_status: '一般・公開前',
    confirmation: null,
    general_mediation_private: null,
    single_listing: null,
    suumo_url: null,
    suumo_registered: null,
    offer_status: null,
    report_date: null,  // null: unreported にはならない
    report_assignee: '林',
    price_reduction_scheduled_date: null,
    sidebar_status: null,
  };

  /**
   * workTaskMap（空の Map）: PropertySidebarStatus.tsx の初期状態を模倣
   * workTasks が未取得の場合、createWorkTaskMap([]) → 空の Map
   */
  const workTaskMapEmpty = createWorkTaskMap([]);

  /**
   * workTaskMap（取得済み）: publish_scheduled_date = 今日
   */
  const workTaskMapFull = createWorkTaskMap([
    {
      property_number: propertyNumber,
      publish_scheduled_date: today,
    },
  ]);

  /**
   * テスト1: calculatePropertyStatus(listing, undefined) → pre_publish を返す
   *
   * workTaskMap が undefined の場合、today_publish 判定がスキップされ、
   * atbb_status = '一般・公開前' なので pre_publish が返される。
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト1: calculatePropertyStatus(listing, undefined) は pre_publish を返す（workTaskMap未取得時）', () => {
    const result = calculatePropertyStatus(bugListing as any, undefined);
    // workTaskMap が undefined → today_publish 判定スキップ → atbb_status='一般・公開前' → pre_publish
    expect(result.key).toBe('pre_publish');
  });

  /**
   * テスト2: calculatePropertyStatus(listing, 空のMap) → pre_publish を返す
   *
   * workTaskMap が空の Map の場合、workTaskMap は truthy だが
   * Map.get(propertyNumber) が undefined を返すため today_publish 判定が false になる。
   * → pre_publish が返される（バグ状態）
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト2: calculatePropertyStatus(listing, 空のMap) は pre_publish を返す（workTaskMap空の場合）', () => {
    const result = calculatePropertyStatus(bugListing as any, workTaskMapEmpty);
    // workTaskMap は truthy だが Map.get() が undefined → today_publish 判定 false → pre_publish
    expect(result.key).toBe('pre_publish');
  });

  /**
   * テスト3: calculatePropertyStatus(listing, workTaskMap) → today_publish を返す
   *
   * workTaskMap が取得済みの場合、today_publish 判定が実行され、
   * publish_scheduled_date = 今日なので today_publish が返される。
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト3: calculatePropertyStatus(listing, workTaskMap) は today_publish を返す（workTaskMap取得後）', () => {
    const result = calculatePropertyStatus(bugListing as any, workTaskMapFull);
    // workTaskMap あり → today_publish 判定実行 → publish_scheduled_date = 今日 → today_publish
    expect(result.key).toBe('today_publish');
  });

  /**
   * テスト4: サイドバーカウントとフィルタリング件数が一致することを確認（バグの証明）
   *
   * このテストは未修正コードで FAIL することが期待される。
   *
   * バグシナリオ:
   * - PropertySidebarStatus.tsx: workTaskMap が空の Map で statusCounts を計算
   *   → bugListing は pre_publish → 未報告としてカウントされない（0件）
   * - PropertyListingsPage.tsx: workTaskMap が揃った後にフィルタリング
   *   → bugListing は today_publish → 未報告としてフィルタリングされない（0件）
   *
   * 実際のバグシナリオ（report_date が設定されている物件）:
   * - PropertySidebarStatus.tsx: workTaskMap が空の Map
   *   → report_date <= today の物件が unreported としてカウントされる（1件）
   * - PropertyListingsPage.tsx: workTaskMap が揃った後
   *   → 同じ物件が today_publish としてフィルタリングされる（0件）
   * - 結果: 1 !== 0 → 不一致（バグ）
   *
   * このテストでは report_date = 今日 の物件を使ってバグを再現する。
   *
   * **Validates: Requirements 2.3, 2.4**
   */
  it('テスト4: サイドバーカウント（workTaskMap=空のMap）とフィルタリング件数（workTaskMap取得後）が一致する', () => {
    // report_date = 今日 の物件（バグが発現する物件）
    const bugListingWithReportDate = {
      ...bugListing,
      report_date: today,  // 今日 → workTaskMap なしでは unreported
    };

    const listings = [bugListingWithReportDate];

    // サイドバーカウント（workTaskMap = 空の Map = PropertySidebarStatus.tsx の初期状態）
    const sidebarCount = countUnreported(listings, workTaskMapEmpty);

    // フィルタリング件数（workTaskMap = 取得済み = PropertyListingsPage.tsx のフィルタリング時）
    const filterCount = filterUnreported(listings, workTaskMapFull);

    // バグ条件: sidebarCount（1件）!== filterCount（0件）
    // 修正後: sidebarCount（0件）=== filterCount（0件）
    expect(sidebarCount).toBe(filterCount);
  });

  /**
   * テスト5: 複数物件を含むリストでのカウント不一致確認
   *
   * バグ物件1件（report_date=今日、atbb_status='一般・公開前'、publish_scheduled_date=今日）
   * + 正常な未報告物件1件（report_date=今日、atbb_status='一般・公開中'）のリストで、
   * サイドバーカウントとフィルタリング件数が一致しないことを確認。
   *
   * **Validates: Requirements 2.3, 2.4**
   */
  it('テスト5: 複数物件リストでサイドバーカウントとフィルタリング件数が一致する', () => {
    // バグ物件（report_date=今日、atbb_status='一般・公開前'、publish_scheduled_date=今日）
    const bugListingWithReportDate = {
      ...bugListing,
      report_date: today,
    };

    // 正常な未報告物件（report_date=今日、atbb_status='一般・公開中' → today_publish にならない）
    const normalUnreportedListing = {
      property_number: 'TEST-002',
      sales_assignee: '林',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: today,
      report_assignee: '林',
      price_reduction_scheduled_date: null,
      sidebar_status: null,
    };

    const workTaskMapWithBoth = createWorkTaskMap([
      { property_number: propertyNumber, publish_scheduled_date: today },
      { property_number: 'TEST-002', publish_scheduled_date: null },
    ]);

    const listings = [bugListingWithReportDate, normalUnreportedListing];

    // サイドバーカウント（workTaskMap = 空の Map）
    const sidebarCount = countUnreported(listings, workTaskMapEmpty);

    // フィルタリング件数（workTaskMap = 取得済み）
    const filterCount = filterUnreported(listings, workTaskMapWithBoth);

    // バグ条件: sidebarCount（2件）!== filterCount（1件）
    // 修正後: sidebarCount（1件）=== filterCount（1件）
    expect(sidebarCount).toBe(filterCount);
  });
});
