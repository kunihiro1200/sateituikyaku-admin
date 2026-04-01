/**
 * タスク1: バグ条件探索テスト - 専任・一般・訪問後他決カテゴリのカウント数不一致
 *
 * このテストは修正前のコードでバグの存在を証明するためのものです。
 * テストが失敗することが期待される結果です（バグの存在を確認）。
 *
 * バグ: isExclusive(), isGeneral(), isVisitOtherDecision() が
 * isTodayOrBefore(nextCallDate) を否定しているため、次電日が今日の売主を含んでしまう。
 *
 * 根本原因:
 * - GAS: nextCallDate !== todayStr（次電日が今日ではない）
 * - バックエンド: .gt('next_call_date', todayJST)（次電日が今日より大きい = 今日を除外）
 * - フロントエンド: !isTodayOrBefore(nextCallDate)（次電日が今日以前ではない = 今日を含む）← 間違い
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import {
  isExclusive,
  isGeneral,
  isVisitOtherDecision,
  getCategoryCounts,
  filterSellersByCategory,
} from '../utils/sellerStatusFilters';

// 今日の日付を生成するヘルパー（YYYY-MM-DD形式）
const getTodayStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 昨日の日付を生成するヘルパー
const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 明日の日付を生成するヘルパー
const getTomorrowStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('Property 1: Bug Condition - 専任・一般・訪問後他決カテゴリのカウント数不一致', () => {
  /**
   * テストケース1: 専任カテゴリ - 次電日が今日の売主
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 今日
   * - status = "専任媒介"
   *
   * 期待される動作（修正後）:
   * - isExclusive() = false（次電日が今日の売主は除外される）
   *
   * バグ（修正前）:
   * - isExclusive() = false（isTodayOrBeforeで今日以前を除外しているため、今日も除外される）
   * - しかし、GASとバックエンドは「次電日が今日ではない」という条件なので、
   *   フロントエンドは「次電日が今日の場合のみ除外」すべき
   *
   * このテストは修正前のコードでPASSしてしまうが、実際にはバグが存在する。
   * バグを検出するには、次電日が昨日の売主をテストする必要がある。
   */
  test('専任カテゴリ: 次電日が今日の売主は除外されるべき', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getTodayStr(),
      next_call_date: getTodayStr(),
      status: '専任媒介',
    };

    // 期待される動作（修正後）: false（次電日が今日の売主は除外される）
    // 修正前のコード: false（isTodayOrBeforeで今日以前を除外しているため、今日も除外される）
    // このテストは修正前のコードでもPASSしてしまう
    expect(isExclusive(seller)).toBe(false);
  });

  /**
   * テストケース1-2: 専任カテゴリ - 次電日が昨日の売主（バグ検出用）
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 昨日
   * - status = "専任媒介"
   *
   * 期待される動作（修正後）:
   * - isExclusive() = true（次電日が昨日の売主は含まれる）
   * - GASとバックエンドは「次電日が今日ではない」という条件なので、昨日は含まれる
   *
   * バグ（修正前）:
   * - isExclusive() = false（isTodayOrBeforeで今日以前を除外しているため、昨日も除外される）
   *
   * このテストは修正前のコードでFAILすることでバグを証明する。
   */
  test('専任カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出）', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getYesterdayStr(),
      next_call_date: getYesterdayStr(),
      status: '専任媒介',
    };

    // 期待される動作（修正後）: true（次電日が昨日の売主は含まれる）
    // バグ（修正前）: false（isTodayOrBeforeで今日以前を除外しているため、昨日も除外される）
    expect(isExclusive(seller)).toBe(true);
  });

  /**
   * テストケース2: 専任カテゴリ - 次電日が明日の売主
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 明日
   * - status = "専任媒介"
   *
   * 期待される動作:
   * - isExclusive() = true（次電日が明日の売主は含まれる）
   */
  test('専任カテゴリ: 次電日が明日の売主は含まれるべき', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getTomorrowStr(),
      next_call_date: getTomorrowStr(),
      status: '専任媒介',
    };

    // 期待される動作: true（次電日が明日の売主は含まれる）
    expect(isExclusive(seller)).toBe(true);
  });

  /**
   * テストケース3: 一般カテゴリ - 次電日が今日の売主
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 今日
   * - status = "一般媒介"
   * - contract_year_month >= "2025-06-23"
   *
   * 期待される動作（修正後）:
   * - isGeneral() = false（次電日が今日の売主は除外される）
   *
   * バグ（修正前）:
   * - isGeneral() = true（次電日が今日の売主を含んでしまう）
   */
  test('一般カテゴリ: 次電日が今日の売主は除外されるべき', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getTodayStr(),
      next_call_date: getTodayStr(),
      status: '一般媒介',
      contractYearMonth: '2025-07-01',
      contract_year_month: '2025-07-01',
    };

    // 期待される動作（修正後）: false（次電日が今日の売主は除外される）
    // バグ（修正前）: true（次電日が今日の売主を含んでしまう）
    expect(isGeneral(seller)).toBe(false);
  });

  /**
   * テストケース3-2: 一般カテゴリ - 次電日が昨日の売主（バグ検出用）
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 昨日
   * - status = "一般媒介"
   * - contract_year_month >= "2025-06-23"
   *
   * 期待される動作（修正後）:
   * - isGeneral() = true（次電日が昨日の売主は含まれる）
   *
   * バグ（修正前）:
   * - isGeneral() = false（isTodayOrBeforeで今日以前を除外しているため、昨日も除外される）
   */
  test('一般カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出）', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getYesterdayStr(),
      next_call_date: getYesterdayStr(),
      status: '一般媒介',
      contractYearMonth: '2025-07-01',
      contract_year_month: '2025-07-01',
    };

    // 期待される動作（修正後）: true（次電日が昨日の売主は含まれる）
    // バグ（修正前）: false（isTodayOrBeforeで今日以前を除外しているため、昨日も除外される）
    expect(isGeneral(seller)).toBe(true);
  });

  /**
   * テストケース4: 一般カテゴリ - 次電日が明日の売主
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 明日
   * - status = "一般媒介"
   * - contract_year_month >= "2025-06-23"
   *
   * 期待される動作:
   * - isGeneral() = true（次電日が明日の売主は含まれる）
   */
  test('一般カテゴリ: 次電日が明日の売主は含まれるべき', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getTomorrowStr(),
      next_call_date: getTomorrowStr(),
      status: '一般媒介',
      contractYearMonth: '2025-07-01',
      contract_year_month: '2025-07-01',
    };

    // 期待される動作: true（次電日が明日の売主は含まれる）
    expect(isGeneral(seller)).toBe(true);
  });

  /**
   * テストケース5: 訪問後他決カテゴリ - 次電日が今日の売主
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 今日
   * - status = "他決→追客"
   * - visit_assignee ≠ ""
   *
   * 期待される動作（修正後）:
   * - isVisitOtherDecision() = false（次電日が今日の売主は除外される）
   *
   * バグ（修正前）:
   * - isVisitOtherDecision() = true（次電日が今日の売主を含んでしまう）
   */
  test('訪問後他決カテゴリ: 次電日が今日の売主は除外されるべき', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getTodayStr(),
      next_call_date: getTodayStr(),
      status: '他決→追客',
      visitAssigneeInitials: 'Y',
      visit_assignee: 'Y',
      visitAssignee: 'Y',
    };

    // 期待される動作（修正後）: false（次電日が今日の売主は除外される）
    // バグ（修正前）: true（次電日が今日の売主を含んでしまう）
    expect(isVisitOtherDecision(seller)).toBe(false);
  });

  /**
   * テストケース5-2: 訪問後他決カテゴリ - 次電日が昨日の売主（バグ検出用）
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 昨日
   * - status = "他決→追客"
   * - visit_assignee ≠ ""
   *
   * 期待される動作（修正後）:
   * - isVisitOtherDecision() = true（次電日が昨日の売主は含まれる）
   *
   * バグ（修正前）:
   * - isVisitOtherDecision() = false（isTodayOrBeforeで今日以前を除外しているため、昨日も除外される）
   */
  test('訪問後他決カテゴリ: 次電日が昨日の売主は含まれるべき（バグ検出）', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getYesterdayStr(),
      next_call_date: getYesterdayStr(),
      status: '他決→追客',
      visitAssigneeInitials: 'Y',
      visit_assignee: 'Y',
      visitAssignee: 'Y',
    };

    // 期待される動作（修正後）: true（次電日が昨日の売主は含まれる）
    // バグ（修正前）: false（isTodayOrBeforeで今日以前を除外しているため、昨日も除外される）
    expect(isVisitOtherDecision(seller)).toBe(true);
  });

  /**
   * テストケース6: 訪問後他決カテゴリ - 次電日が明日の売主
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date = 明日
   * - status = "他決→追客"
   * - visit_assignee ≠ ""
   *
   * 期待される動作:
   * - isVisitOtherDecision() = true（次電日が明日の売主は含まれる）
   */
  test('訪問後他決カテゴリ: 次電日が明日の売主は含まれるべき', () => {
    const seller = {
      exclusiveOtherDecisionMeeting: '',
      exclusive_other_decision_meeting: '',
      nextCallDate: getTomorrowStr(),
      next_call_date: getTomorrowStr(),
      status: '他決→追客',
      visitAssigneeInitials: 'Y',
      visit_assignee: 'Y',
      visitAssignee: 'Y',
    };

    // 期待される動作: true（次電日が明日の売主は含まれる）
    expect(isVisitOtherDecision(seller)).toBe(true);
  });

  /**
   * テストケース7: カウント数とフィルタリング結果の一致
   *
   * 条件:
   * - 次電日が今日の売主と明日の売主が混在
   *
   * 期待される動作（修正後）:
   * - サイドバーのカウント数 = フィルタリング結果の件数
   * - 次電日が今日の売主は除外される
   *
   * バグ（修正前）:
   * - サイドバーのカウント数 > フィルタリング結果の件数
   * - 次電日が今日の売主がカウントに含まれるが、フィルタリング結果には含まれない
   */
  test('カウント数とフィルタリング結果が一致すべき', () => {
    const sellers = [
      // 専任カテゴリ: 次電日が今日（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTodayStr(),
        next_call_date: getTodayStr(),
        status: '専任媒介',
      },
      // 専任カテゴリ: 次電日が明日（含まれるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '専任媒介',
      },
      // 一般カテゴリ: 次電日が今日（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTodayStr(),
        next_call_date: getTodayStr(),
        status: '一般媒介',
        contractYearMonth: '2025-07-01',
        contract_year_month: '2025-07-01',
      },
      // 一般カテゴリ: 次電日が明日（含まれるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般媒介',
        contractYearMonth: '2025-07-01',
        contract_year_month: '2025-07-01',
      },
      // 訪問後他決カテゴリ: 次電日が今日（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTodayStr(),
        next_call_date: getTodayStr(),
        status: '他決→追客',
        visitAssigneeInitials: 'Y',
        visit_assignee: 'Y',
        visitAssignee: 'Y',
      },
      // 訪問後他決カテゴリ: 次電日が明日（含まれるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他決→追客',
        visitAssigneeInitials: 'Y',
        visit_assignee: 'Y',
        visitAssignee: 'Y',
      },
    ];

    // カウント数を取得
    const counts = getCategoryCounts(sellers);

    // フィルタリング結果を取得
    const exclusiveFiltered = filterSellersByCategory(sellers, 'exclusive');
    const generalFiltered = filterSellersByCategory(sellers, 'general');
    const visitOtherDecisionFiltered = filterSellersByCategory(sellers, 'visitOtherDecision');

    // 期待される動作（修正後）:
    // - 専任カテゴリ: 1件（次電日が明日の売主のみ）
    // - 一般カテゴリ: 1件（次電日が明日の売主のみ）
    // - 訪問後他決カテゴリ: 1件（次電日が明日の売主のみ）
    //
    // バグ（修正前）:
    // - 専任カテゴリ: 2件（次電日が今日と明日の両方を含む）
    // - 一般カテゴリ: 2件（次電日が今日と明日の両方を含む）
    // - 訪問後他決カテゴリ: 2件（次電日が今日と明日の両方を含む）

    // カウント数とフィルタリング結果が一致すること
    expect(counts.exclusive).toBe(exclusiveFiltered.length);
    expect(counts.general).toBe(generalFiltered.length);
    expect(counts.visitOtherDecision).toBe(visitOtherDecisionFiltered.length);

    // 次電日が今日の売主は除外されること
    expect(counts.exclusive).toBe(1);
    expect(counts.general).toBe(1);
    expect(counts.visitOtherDecision).toBe(1);
  });
});
