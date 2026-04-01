/**
 * タスク2: 保存プロパティテスト - 他のカテゴリと基本条件の保存
 *
 * このテストは修正前のコードで非バグ入力の動作を観察し、
 * 保存要件から観察された動作パターンをキャプチャします。
 *
 * 修正前のコードで実行し、成功することを確認します（ベースライン動作）。
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import {
  isExclusive,
  isGeneral,
  isVisitOtherDecision,
  isUnvisitedOtherDecision,
  isTodayCall,
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

// 明日の日付を生成するヘルパー
const getTomorrowStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('Property 2: Preservation - 他のカテゴリと基本条件の保存', () => {
  /**
   * テストケース1: 他のカテゴリ（当日TEL分）のカウントとフィルタリング結果が一致
   *
   * 条件:
   * - status に「追客中」が含まれる
   * - next_call_date が今日以前
   * - コミュニケーション情報が全て空
   * - 営担が空
   *
   * 期待される動作:
   * - isTodayCall() = true
   * - カウント数 = フィルタリング結果の件数
   */
  test('当日TEL分カテゴリ: カウント数とフィルタリング結果が一致すること', () => {
    const sellers = [
      // 当日TEL分: 次電日が今日
      {
        status: '追客中',
        nextCallDate: getTodayStr(),
        next_call_date: getTodayStr(),
        contactMethod: '',
        contact_method: '',
        preferredContactTime: '',
        preferred_contact_time: '',
        phoneContactPerson: '',
        phone_contact_person: '',
        visitAssigneeInitials: '',
        visit_assignee: '',
        visitAssignee: '',
      },
      // 当日TEL分: 次電日が昨日
      {
        status: '追客中',
        nextCallDate: '2025-01-01',
        next_call_date: '2025-01-01',
        contactMethod: '',
        contact_method: '',
        preferredContactTime: '',
        preferred_contact_time: '',
        phoneContactPerson: '',
        phone_contact_person: '',
        visitAssigneeInitials: '',
        visit_assignee: '',
        visitAssignee: '',
      },
    ];

    // カウント数を取得
    const counts = getCategoryCounts(sellers);

    // フィルタリング結果を取得
    const filtered = filterSellersByCategory(sellers, 'todayCall');

    // カウント数とフィルタリング結果が一致すること
    expect(counts.todayCall).toBe(filtered.length);
    expect(counts.todayCall).toBe(2);
  });

  /**
   * テストケース2: 未訪問他決カテゴリのカウントとフィルタリング結果が一致
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date > 今日
   * - status IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
   * - visit_assignee = ""
   *
   * 期待される動作:
   * - isUnvisitedOtherDecision() = true
   * - カウント数 = フィルタリング結果の件数
   */
  test('未訪問他決カテゴリ: カウント数とフィルタリング結果が一致すること', () => {
    // 明後日の日付を生成
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const dayAfterTomorrowStr = `${dayAfterTomorrow.getFullYear()}-${String(dayAfterTomorrow.getMonth() + 1).padStart(2, '0')}-${String(dayAfterTomorrow.getDate()).padStart(2, '0')}`;

    const sellers = [
      // 未訪問他決: 次電日が明日
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他決→追客',
        visitAssigneeInitials: '',
        visit_assignee: '',
        visitAssignee: '',
      },
      // 未訪問他決: 次電日が明後日
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: dayAfterTomorrowStr,
        next_call_date: dayAfterTomorrowStr,
        status: '他決→追客不要',
        visitAssigneeInitials: '',
        visit_assignee: '',
        visitAssignee: '',
      },
    ];

    // カウント数を取得
    const counts = getCategoryCounts(sellers);

    // フィルタリング結果を取得
    const filtered = filterSellersByCategory(sellers, 'unvisitedOtherDecision');

    // カウント数とフィルタリング結果が一致すること
    expect(counts.unvisitedOtherDecision).toBe(filtered.length);
    expect(counts.unvisitedOtherDecision).toBe(2);
  });

  /**
   * テストケース3: 専任カテゴリの基本条件が保持される
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date ≠ 今日（次電日が空 OR 次電日が今日でない）
   * - status IN ("専任媒介", "他決→専任", "リースバック（専任）")
   *
   * 期待される動作:
   * - isExclusive() = true（基本条件を満たす売主は含まれる）
   */
  test('専任カテゴリ: 基本条件が保持されること', () => {
    const sellers = [
      // 専任媒介: 次電日が明日
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '専任媒介',
      },
      // 他決→専任: 次電日が明日
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他決→専任',
      },
      // リースバック（専任）: 次電日が明日
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: 'リースバック（専任）',
      },
      // 専任媒介: 専任他決打合せが「完了」（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '完了',
        exclusive_other_decision_meeting: '完了',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '専任媒介',
      },
      // 専任媒介: 状況が異なる（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般媒介',
      },
    ];

    // 基本条件を満たす売主のみが含まれること
    const exclusiveSellers = sellers.filter(isExclusive);
    expect(exclusiveSellers.length).toBe(3);

    // 各売主が基本条件を満たすこと
    exclusiveSellers.forEach(seller => {
      expect(seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting).not.toBe('完了');
      expect(['専任媒介', '他決→専任', 'リースバック（専任）']).toContain(seller.status);
    });
  });

  /**
   * テストケース4: 一般カテゴリの基本条件が保持される
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date ≠ 今日（次電日が空 OR 次電日が今日でない）
   * - status = "一般媒介"
   * - contract_year_month >= "2025-06-23"
   *
   * 期待される動作:
   * - isGeneral() = true（基本条件を満たす売主は含まれる）
   */
  test('一般カテゴリ: 基本条件が保持されること', () => {
    const sellers = [
      // 一般媒介: 次電日が明日、契約年月が2025-07-01
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般媒介',
        contractYearMonth: '2025-07-01',
        contract_year_month: '2025-07-01',
      },
      // 一般媒介: 次電日が明日、契約年月が2025-06-23（境界値）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般媒介',
        contractYearMonth: '2025-06-23',
        contract_year_month: '2025-06-23',
      },
      // 一般媒介: 専任他決打合せが「完了」（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '完了',
        exclusive_other_decision_meeting: '完了',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般媒介',
        contractYearMonth: '2025-07-01',
        contract_year_month: '2025-07-01',
      },
      // 一般媒介: 契約年月が2025-06-22（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般媒介',
        contractYearMonth: '2025-06-22',
        contract_year_month: '2025-06-22',
      },
      // 一般媒介: 状況が異なる（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '専任媒介',
        contractYearMonth: '2025-07-01',
        contract_year_month: '2025-07-01',
      },
    ];

    // 基本条件を満たす売主のみが含まれること
    const generalSellers = sellers.filter(isGeneral);
    expect(generalSellers.length).toBe(2);

    // 各売主が基本条件を満たすこと
    generalSellers.forEach(seller => {
      expect(seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting).not.toBe('完了');
      expect(seller.status).toBe('一般媒介');
      const contractYearMonth = seller.contractYearMonth || seller.contract_year_month;
      expect(contractYearMonth).toBeDefined();
      expect(contractYearMonth! >= '2025-06-23').toBe(true);
    });
  });

  /**
   * テストケース5: 訪問後他決カテゴリの基本条件が保持される
   *
   * 条件:
   * - exclusive_other_decision_meeting ≠ "完了"
   * - next_call_date ≠ 今日（次電日が空 OR 次電日が今日でない）
   * - status IN ("他決→追客", "他決→追客不要", "一般→他決", "他社買取")
   * - visit_assignee ≠ ""（「外す」を含む）
   *
   * 期待される動作:
   * - isVisitOtherDecision() = true（基本条件を満たす売主は含まれる）
   */
  test('訪問後他決カテゴリ: 基本条件が保持されること', () => {
    const sellers = [
      // 他決→追客: 次電日が明日、営担あり
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
      // 他決→追客不要: 次電日が明日、営担あり
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他決→追客不要',
        visitAssigneeInitials: 'I',
        visit_assignee: 'I',
        visitAssignee: 'I',
      },
      // 一般→他決: 次電日が明日、営担あり
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般→他決',
        visitAssigneeInitials: 'K',
        visit_assignee: 'K',
        visitAssignee: 'K',
      },
      // 他社買取: 次電日が明日、営担あり
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他社買取',
        visitAssigneeInitials: 'M',
        visit_assignee: 'M',
        visitAssignee: 'M',
      },
      // 他決→追客: 専任他決打合せが「完了」（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '完了',
        exclusive_other_decision_meeting: '完了',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他決→追客',
        visitAssigneeInitials: 'Y',
        visit_assignee: 'Y',
        visitAssignee: 'Y',
      },
      // 他決→追客: 営担が空（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他決→追客',
        visitAssigneeInitials: '',
        visit_assignee: '',
        visitAssignee: '',
      },
      // 他決→追客: 状況が異なる（除外されるべき）
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '専任媒介',
        visitAssigneeInitials: 'Y',
        visit_assignee: 'Y',
        visitAssignee: 'Y',
      },
    ];

    // 基本条件を満たす売主のみが含まれること
    const visitOtherDecisionSellers = sellers.filter(isVisitOtherDecision);
    expect(visitOtherDecisionSellers.length).toBe(4);

    // 各売主が基本条件を満たすこと
    visitOtherDecisionSellers.forEach(seller => {
      expect(seller.exclusiveOtherDecisionMeeting || seller.exclusive_other_decision_meeting).not.toBe('完了');
      expect(['他決→追客', '他決→追客不要', '一般→他決', '他社買取']).toContain(seller.status);
      const visitAssignee = seller.visitAssigneeInitials || seller.visit_assignee || seller.visitAssignee;
      expect(visitAssignee).toBeTruthy();
      expect(visitAssignee).not.toBe('');
    });
  });

  /**
   * テストケース6: 複数カテゴリの統合テスト
   *
   * 条件:
   * - 専任、一般、訪問後他決、当日TEL分、未訪問他決の売主が混在
   *
   * 期待される動作:
   * - 各カテゴリのカウント数とフィルタリング結果が一致
   * - 各カテゴリの基本条件が保持される
   */
  test('複数カテゴリ: カウント数とフィルタリング結果が一致し、基本条件が保持されること', () => {
    const sellers = [
      // 専任カテゴリ
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '専任媒介',
      },
      // 一般カテゴリ
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '一般媒介',
        contractYearMonth: '2025-07-01',
        contract_year_month: '2025-07-01',
      },
      // 訪問後他決カテゴリ
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
      // 当日TEL分カテゴリ
      {
        status: '追客中',
        nextCallDate: getTodayStr(),
        next_call_date: getTodayStr(),
        contactMethod: '',
        contact_method: '',
        preferredContactTime: '',
        preferred_contact_time: '',
        phoneContactPerson: '',
        phone_contact_person: '',
        visitAssigneeInitials: '',
        visit_assignee: '',
        visitAssignee: '',
      },
      // 未訪問他決カテゴリ
      {
        exclusiveOtherDecisionMeeting: '',
        exclusive_other_decision_meeting: '',
        nextCallDate: getTomorrowStr(),
        next_call_date: getTomorrowStr(),
        status: '他決→追客',
        visitAssigneeInitials: '',
        visit_assignee: '',
        visitAssignee: '',
      },
    ];

    // カウント数を取得
    const counts = getCategoryCounts(sellers);

    // フィルタリング結果を取得
    const exclusiveFiltered = filterSellersByCategory(sellers, 'exclusive');
    const generalFiltered = filterSellersByCategory(sellers, 'general');
    const visitOtherDecisionFiltered = filterSellersByCategory(sellers, 'visitOtherDecision');
    const todayCallFiltered = filterSellersByCategory(sellers, 'todayCall');
    const unvisitedOtherDecisionFiltered = filterSellersByCategory(sellers, 'unvisitedOtherDecision');

    // カウント数とフィルタリング結果が一致すること
    expect(counts.exclusive).toBe(exclusiveFiltered.length);
    expect(counts.general).toBe(generalFiltered.length);
    expect(counts.visitOtherDecision).toBe(visitOtherDecisionFiltered.length);
    expect(counts.todayCall).toBe(todayCallFiltered.length);
    expect(counts.unvisitedOtherDecision).toBe(unvisitedOtherDecisionFiltered.length);

    // 各カテゴリの件数が正しいこと
    expect(counts.exclusive).toBe(1);
    expect(counts.general).toBe(1);
    expect(counts.visitOtherDecision).toBe(1);
    expect(counts.todayCall).toBe(1);
    expect(counts.unvisitedOtherDecision).toBe(1);
  });
});
