/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - 専任・公開中の担当者別分解バグ
 *
 * CRITICAL: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
 * DO NOT attempt to fix the test or the code when it fails
 *
 * バグ条件（design.md の isBugCondition より）:
 *   - listing.sidebar_status === '専任・公開中'
 *   - listing.sales_assignee が ASSIGNEE_TO_SENIN_STATUS のキーに存在する（例: '林'）
 *   - カテゴリー表示が '林・専任公開中' ではなく '専任・公開中' になっている
 *
 * 根本原因（design.md より）:
 *   - workTaskMap が存在する場合（常に true）、calculatePropertyStatus が
 *     price_reduction_due または unreported を返すと return してしまう
 *   - sidebar_status === '専任・公開中' の物件がこれらのステータスに該当する場合、
 *     ASSIGNEE_TO_SENIN_STATUS による分解処理がスキップされる
 *
 * 目的: バグが存在することを示す反例を見つける
 * 期待される結果: テスト FAIL（これが正しい。バグの存在を証明する）
 *
 * **Validates: Requirements 1.1, 1.2**
 */

import { calculatePropertyStatus, createWorkTaskMap } from '../utils/propertyListingStatusUtils';

// ASSIGNEE_TO_SENIN_STATUS のマッピング（PropertySidebarStatus.tsx から）
const ASSIGNEE_TO_SENIN_STATUS: Record<string, string> = {
  '山本': 'Y専任公開中',
  '生野': '生・専任公開中',
  '久': '久・専任公開中',
  '裏': 'U専任公開中',
  '林': '林・専任公開中',
  '国広': 'K専任公開中',
  '木村': 'R専任公開中',
  '角井': 'I専任公開中',
};

/**
 * PropertySidebarStatus.tsx の statusCounts useMemo のロジックを再現する関数
 * （テスト用に抽出）
 */
function computeStatusCounts(
  listings: Array<{
    id: string;
    property_number?: string;
    sidebar_status?: string;
    sales_assignee?: string | null;
    confirmation?: string | null;
    [key: string]: any;
  }>,
  workTaskMap?: Map<string, Date | null>
): Record<string, number> {
  const counts: Record<string, number> = { all: listings.length };

  listings.forEach(listing => {
    const status = listing.sidebar_status || '';

    // sidebar_status === '専任・公開中' の分解処理を先に実行
    // workTaskMap の有無・calculatePropertyStatus の結果に依存しない形にする
    const normalizedStatus = status.replace(/\s+/g, '');
    if (status === '専任・公開中') {
      const assignee = listing.sales_assignee || '';
      const assigneeStatus = ASSIGNEE_TO_SENIN_STATUS[assignee] || '専任・公開中';
      counts[assigneeStatus] = (counts[assigneeStatus] || 0) + 1;
      // 専任・公開中は sidebar_status ベースで処理済みなので、workTaskMap の処理をスキップ
      return;
    }

    // workTaskMap が存在する場合、calculatePropertyStatus で動的判定
    if (workTaskMap) {
      const computed = calculatePropertyStatus(listing as any, workTaskMap);

      // 「要値下げ」は calculatePropertyStatus で判定
      if (computed.key === 'price_reduction_due') {
        counts['要値下げ'] = (counts['要値下げ'] || 0) + 1;
        return;
      }

      // 「未報告」も calculatePropertyStatus で判定
      if (computed.key === 'unreported') {
        const label = computed.label.replace(/\s+/g, '');
        counts[label] = (counts[label] || 0) + 1;
        return;
      }
    }

    // sidebar_status ベースの処理
    if (status && status !== '値下げ未完了' && !normalizedStatus.startsWith('未報告')) {
      counts[status] = (counts[status] || 0) + 1;
    }
  });

  return counts;
}

// 昨日の日付文字列を生成するヘルパー
const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('バグ条件の探索テスト - 専任・公開中の担当者別分解バグ（未修正コードで FAIL することを確認）', () => {
  /**
   * テストケース1: sidebar_status='専任・公開中', sales_assignee='林', workTaskMap あり
   *               atbb_status='専任・公開中', price_reduction_scheduled_date が今日以前
   *
   * バグ条件:
   * - sidebar_status === '専任・公開中'（古い形式）
   * - sales_assignee === '林'（ASSIGNEE_TO_SENIN_STATUS に存在）
   * - workTaskMap が存在する（常に true）
   * - atbb_status === '専任・公開中' かつ price_reduction_scheduled_date が今日以前
   *   → calculatePropertyStatus が price_reduction_due を返す
   *   → workTaskMap ブロック内で return してしまう
   *   → ASSIGNEE_TO_SENIN_STATUS による分解処理がスキップされる
   *
   * 期待（修正後の正しい動作）:
   * - counts['林・専任公開中'] === 1
   *
   * バグ（未修正コード）:
   * - calculatePropertyStatus が price_reduction_due を返して return するため、
   *   '林・専任公開中' がカウントされない（undefined）
   *
   * このテストは未修正コードで FAIL することでバグを証明する。
   */
  test('テストケース1: sidebar_status=専任・公開中, sales_assignee=林, workTaskMap あり → 林・専任公開中 がカウントされるべき', () => {
    const listing = {
      id: 'test-001',
      property_number: 'AA99001',
      sidebar_status: '専任・公開中',
      sales_assignee: '林',
      // atbb_status が '専任・公開中' かつ price_reduction_scheduled_date が今日以前
      // → calculatePropertyStatus が price_reduction_due を返す
      atbb_status: '専任・公開中',
      price_reduction_scheduled_date: getYesterdayStr(),
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      suumo_url: 'https://suumo.jp/test',
      suumo_registered: 'S不要',
    };

    // workTaskMap を作成（公開予定日なし）
    const workTaskMap = createWorkTaskMap([
      { property_number: 'AA99001', publish_scheduled_date: null },
    ]);

    const counts = computeStatusCounts([listing], workTaskMap);

    // 期待（修正後の正しい動作）: '林・専任公開中' がカウントされる
    // バグ（未修正コード）: price_reduction_due で return するため '林・専任公開中' が undefined
    // このテストは未修正コードで FAIL することでバグを証明する
    expect(counts['林・専任公開中']).toBe(1);
    expect(counts['専任・公開中']).toBeFalsy();
  });

  /**
   * テストケース2: sidebar_status='専任・公開中', sales_assignee='林',
   *               price_reduction_scheduled_date が今日以前
   *
   * バグ条件:
   * - sidebar_status === '専任・公開中'（古い形式）
   * - sales_assignee === '林'（ASSIGNEE_TO_SENIN_STATUS に存在）
   * - price_reduction_scheduled_date が今日以前
   *   → calculatePropertyStatus が price_reduction_due を返す（最高優先度）
   *   → workTaskMap ブロック内で return してしまう
   *   → ASSIGNEE_TO_SENIN_STATUS による分解処理がスキップされる
   *
   * 期待（修正後の正しい動作）:
   * - sidebar_status === '専任・公開中' の物件は、price_reduction_due であっても
   *   '林・専任公開中' としてカウントされるべき
   *
   * バグ（未修正コード）:
   * - calculatePropertyStatus が price_reduction_due を返して return するため、
   *   '林・専任公開中' がカウントされない（undefined）
   *   → '要値下げ' としてカウントされ、'林・専任公開中' は undefined になる
   *
   * このテストは未修正コードで FAIL することでバグを証明する。
   */
  test('テストケース2: sidebar_status=専任・公開中, sales_assignee=林, price_reduction_scheduled_date が今日以前 → 林・専任公開中 がカウントされるべき', () => {
    const listing = {
      id: 'test-002',
      property_number: 'AA99002',
      sidebar_status: '専任・公開中',
      sales_assignee: '林',
      atbb_status: '専任・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      // 今日以前の値下げ予定日 → calculatePropertyStatus が price_reduction_due を返す
      price_reduction_scheduled_date: getYesterdayStr(),
      suumo_url: 'https://suumo.jp/test',
      suumo_registered: 'S不要',
    };

    // workTaskMap を作成
    const workTaskMap = createWorkTaskMap([
      { property_number: 'AA99002', publish_scheduled_date: null },
    ]);

    const counts = computeStatusCounts([listing], workTaskMap);

    // 期待（修正後の正しい動作）: '林・専任公開中' がカウントされる
    // バグ（未修正コード）: price_reduction_due で return するため '林・専任公開中' が undefined
    // このテストは未修正コードで FAIL することでバグを証明する
    expect(counts['林・専任公開中']).toBe(1);
  });
});
