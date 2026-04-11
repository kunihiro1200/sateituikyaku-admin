// Bug condition exploration test: seller-sidebar-count-mismatch
// Validates: Requirements 1.2, 1.3, 1.4
//
// CRITICAL: This test is EXPECTED TO FAIL on unfixed code (proves the bug exists)
// DO NOT attempt to fix the test or the code when it fails
//
// Bug conditions:
//   1. todayCallAssigned: count includes only status ILIKE "%追客中%",
//      but filter has NO status check -> sellers with status="査定中" etc. are included in filter but not in count
//      -> filterCount > sidebarCount
//   2. todayCallNotStarted: count uses status === "追客中" only (same as filter),
//      so no mismatch for this category in practice
//   3. pinrichEmpty: count includes "他決→追客" (via filteredTodayCallSellers),
//      but filter uses ILIKE "%追客中%" only -> "他決→追客" sellers are in count but not in filter
//      -> filterCount < sidebarCount
//
// Expected outcome on unfixed code:
//   - todayCallAssigned: filter count > sidebar count (extra sellers included)
//   - pinrichEmpty: filter count < sidebar count (他決→追客 excluded from filter)

// ============================================================
// ロジック抽出: カウント計算とフィルタリングのロジックをインライン実装
// 実際のDBには接続せず、ロジックをユニットテストとして検証する
// ============================================================

// ---- カウント計算ロジック (SellerSidebarCountsUpdateService より) ----

/**
 * todayCallAssigned のカウント計算条件
 * クエリ3: .ilike('status', '%追客中%') を含む
 */
function countTodayCallAssigned(sellers: any[], todayJST: string): number {
  return sellers.filter(s => {
    if (!s.visit_assignee || s.visit_assignee.trim() === '' || s.visit_assignee.trim() === '外す') return false;
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const status = s.status || '';
    // ilike '%追客中%' チェック
    if (!status.includes('追客中')) return false;
    if (status.includes('追客不要')) return false;
    if (status.includes('専任媒介')) return false;
    if (status.includes('一般媒介')) return false;
    if (status.includes('他社買取')) return false;
    return true;
  }).length;
}

/**
 * todayCallAssigned のフィルタリング条件（現在のバグあり実装）
 * case 'todayCallAssigned': status の ilike '%追客中%' チェックがない
 */
function filterTodayCallAssigned_buggy(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    if (!s.visit_assignee || s.visit_assignee.trim() === '' || s.visit_assignee.trim() === '外す') return false;
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const status = s.status || '';
    // バグ: status の ilike '%追客中%' チェックがない
    if (status.includes('追客不要')) return false;
    if (status.includes('専任媒介')) return false;
    if (status.includes('一般媒介')) return false;
    // バグ: 他社買取の除外もない
    return true;
  });
}

/**
 * filteredTodayCallSellers の計算（カウント計算の中間集合）
 * 追客中 OR 他決→追客 かつ 営担なし
 */
function getFilteredTodayCallSellers(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const status = s.status || '';
    const isFollowingUp = status.includes('追客中') || status === '他決→追客';
    if (!isFollowingUp) return false;
    if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
    return true;
  });
}

/**
 * todayCallNotStarted のカウント計算条件
 * filteredTodayCallSellers から派生するが、status === '追客中' のみカウント
 */
function countTodayCallNotStarted(sellers: any[], todayJST: string): number {
  const filtered = getFilteredTodayCallSellers(sellers, todayJST);
  return filtered.filter(s => {
    const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                    (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                    (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;
    const status = s.status || '';
    if (status !== '追客中') return false;
    const unreachable = s.unreachable_status || '';
    if (unreachable && unreachable.trim() !== '') return false;
    const confidence = s.confidence_level || '';
    if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
    const exclusionDate = s.exclusion_date || '';
    if (exclusionDate && exclusionDate.trim() !== '') return false;
    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  }).length;
}

/**
 * todayCallNotStarted のフィルタリング条件（現在の実装）
 * .ilike('status', '%追客中%') のみ
 * 注意: todayCallNotStartedCount も status === '追客中' のみカウントするため、
 * 実際にはカウントとフィルタは一致している（バグなし）
 */
function filterTodayCallNotStarted_current(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    const status = s.status || '';
    if (!status.includes('追客中')) return false;
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
    const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                    (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                    (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;
    const unreachable = s.unreachable_status || '';
    if (unreachable && unreachable.trim() !== '') return false;
    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  });
}

/**
 * pinrichEmpty のカウント計算条件
 * filteredTodayCallSellers から派生（他決→追客を含む）
 */
function countPinrichEmpty(sellers: any[], todayJST: string): number {
  const filtered = getFilteredTodayCallSellers(sellers, todayJST);
  return filtered.filter(s => {
    const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                    (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                    (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;
    const pinrich = s.pinrich_status || '';
    return !pinrich || pinrich.trim() === '';
  }).length;
}

/**
 * pinrichEmpty のフィルタリング条件（現在のバグあり実装）
 * .ilike('status', '%追客中%') のみ → 他決→追客 を含まない
 */
function filterPinrichEmpty_buggy(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    const status = s.status || '';
    // バグ: ilike '%追客中%' のみ → '他決→追客' は '%追客中%' にマッチしない
    if (!status.includes('追客中')) return false;
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
    const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                    (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                    (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;
    const pinrich = s.pinrich_status || '';
    return !pinrich || pinrich.trim() === '';
  });
}

// ============================================================
// テストデータ
// ============================================================

const TODAY = '2026-04-15';

/**
 * todayCallAssigned バグ用テストデータ
 * 売主X: status='査定中'（追客中でも専任媒介でも一般媒介でも追客不要でもない）
 *   - カウント: 除外される（ilike '%追客中%' にマッチしない）
 *   - フィルタ（バグあり）: 含まれてしまう（status チェックなし）
 */
const SELLERS_TODAY_CALL_ASSIGNED_BUG = [
  // 売主A: 正常ケース（追客中 → カウントにもフィルタにも含まれる）
  {
    id: 'seller-a',
    status: '追客中',
    visit_assignee: 'TK',
    next_call_date: TODAY,
    phone_contact_person: null,
    preferred_contact_time: null,
    contact_method: null,
  },
  // 売主X: 査定中（バグの核心）
  //   カウント: 除外される（ilike '%追客中%' にマッチしない）
  //   フィルタ（バグあり）: 含まれてしまう（status の追客中チェックがない）
  {
    id: 'seller-x',
    status: '査定中',
    visit_assignee: 'TK',
    next_call_date: TODAY,
    phone_contact_person: null,
    preferred_contact_time: null,
    contact_method: null,
  },
];

/**
 * pinrichEmpty バグ用テストデータ
 * 売主F: status='他決→追客', pinrich_status=null
 *   - カウント: 含まれる（filteredTodayCallSellers は 他決→追客 を含む）
 *   - フィルタ（バグあり）: 除外される（ilike '%追客中%' のみ）
 */
const SELLERS_PINRICH_EMPTY_BUG = [
  // 売主F: 他決→追客 かつ pinrich_status=null（バグの核心）
  {
    id: 'seller-f',
    status: '他決→追客',
    visit_assignee: null,
    next_call_date: TODAY,
    phone_contact_person: null,
    preferred_contact_time: null,
    contact_method: null,
    pinrich_status: null,
    unreachable_status: null,
    confidence_level: null,
    exclusion_date: null,
    inquiry_date: '2026-03-01',
  },
  // 売主G: 追客中 かつ pinrich_status=null（正常ケース）
  {
    id: 'seller-g',
    status: '追客中',
    visit_assignee: null,
    next_call_date: TODAY,
    phone_contact_person: null,
    preferred_contact_time: null,
    contact_method: null,
    pinrich_status: null,
    unreachable_status: null,
    confidence_level: null,
    exclusion_date: null,
    inquiry_date: '2026-03-01',
  },
];

/**
 * todayCallNotStarted 確認用テストデータ
 * todayCallNotStartedCount は status === '追客中' のみカウントするため、
 * フィルタ（ilike '%追客中%'）と一致する
 */
const SELLERS_TODAY_CALL_NOT_STARTED = [
  // 売主D: 他決→追客（filteredTodayCallSellers には含まれるが todayCallNotStartedCount には含まれない）
  {
    id: 'seller-d',
    status: '他決→追客',
    visit_assignee: null,
    next_call_date: TODAY,
    phone_contact_person: null,
    preferred_contact_time: null,
    contact_method: null,
    pinrich_status: null,
    unreachable_status: null,
    confidence_level: null,
    exclusion_date: null,
    inquiry_date: '2026-03-01',
  },
  // 売主E: 追客中（カウントにもフィルタにも含まれる）
  {
    id: 'seller-e',
    status: '追客中',
    visit_assignee: null,
    next_call_date: TODAY,
    phone_contact_person: null,
    preferred_contact_time: null,
    contact_method: null,
    pinrich_status: null,
    unreachable_status: null,
    confidence_level: null,
    exclusion_date: null,
    inquiry_date: '2026-03-01',
  },
];

// ============================================================
// テスト本体
// ============================================================

describe('Bug Condition Exploration: seller-sidebar-count-mismatch', () => {

  // ----------------------------------------------------------
  // todayCallAssigned: カウントとフィルタの不一致
  // ----------------------------------------------------------
  describe('todayCallAssigned: カウントとフィルタの不一致', () => {
    /**
     * Validates: Requirements 1.2
     *
     * バグ条件:
     *   countCondition includes '.ilike(status, %追客中%)'
     *   filterCondition does NOT include '.ilike(status, %追客中%)'
     *
     * 期待される反例:
     *   status='査定中' の売主がフィルタに含まれるがカウントには含まれない
     *   → filterCount > sidebarCount
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('追客中以外のステータス（例: 査定中）はカウントに含まれないがフィルタに含まれてしまう（バグの存在を証明）', () => {
      // 売主Xがカウントに含まれないことを確認
      const sellerX = SELLERS_TODAY_CALL_ASSIGNED_BUG.find(s => s.id === 'seller-x')!;
      const sellerXInCount = countTodayCallAssigned([sellerX], TODAY);
      expect(sellerXInCount).toBe(0); // カウントには含まれない（追客中でない）

      // 売主Xがフィルタに含まれないことを確認（修正後の期待動作）
      // バグあり実装では含まれてしまう → このアサーションが FAIL する
      const sellerXInFilter = filterTodayCallAssigned_buggy([sellerX], TODAY);
      expect(sellerXInFilter.length).toBe(0); // FAILS on unfixed code: 査定中が含まれてしまう
    });

    it('フィルタ件数がカウントより多い（バグの存在を証明）', () => {
      const sidebarCount = countTodayCallAssigned(SELLERS_TODAY_CALL_ASSIGNED_BUG, TODAY);
      const filterCount = filterTodayCallAssigned_buggy(SELLERS_TODAY_CALL_ASSIGNED_BUG, TODAY).length;

      // 修正後の期待動作: filterCount === sidebarCount
      // バグあり実装では: filterCount > sidebarCount（査定中が混入）
      expect(filterCount).toBe(sidebarCount); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // todayCallNotStarted: カウントとフィルタの確認
  // ----------------------------------------------------------
  describe('todayCallNotStarted: カウントとフィルタの確認', () => {
    /**
     * Validates: Requirements 1.3
     *
     * 注意: todayCallNotStartedCount は status === '追客中' のみカウントするため、
     * フィルタ（ilike '%追客中%'）と実質的に一致している。
     * 他決→追客 は filteredTodayCallSellers には含まれるが、
     * todayCallNotStartedCount のフィルタで除外されるため、カウントには含まれない。
     *
     * EXPECTED: PASS on unfixed code (no mismatch for this category)
     */
    it('他決→追客 は filteredTodayCallSellers に含まれるが todayCallNotStartedCount には含まれない', () => {
      // filteredTodayCallSellers には 他決→追客 が含まれる
      const filtered = getFilteredTodayCallSellers(SELLERS_TODAY_CALL_NOT_STARTED, TODAY);
      const sellerD = filtered.find(s => s.id === 'seller-d');
      expect(sellerD).toBeDefined(); // 他決→追客 は filteredTodayCallSellers に含まれる

      // しかし todayCallNotStartedCount は status === '追客中' のみ
      const count = countTodayCallNotStarted(SELLERS_TODAY_CALL_NOT_STARTED, TODAY);
      expect(count).toBe(1); // 売主E（追客中）のみ

      // フィルタ（現在の実装）も 1 件（売主E）
      const filterCount = filterTodayCallNotStarted_current(SELLERS_TODAY_CALL_NOT_STARTED, TODAY).length;
      expect(filterCount).toBe(count); // PASSES: both are 1
    });

    it('他決→追客 は ilike "%追客中%" にマッチしない', () => {
      const status = '他決→追客';
      const matchesIlike = status.includes('追客中');
      expect(matchesIlike).toBe(false); // 他決→追客 は 追客中 を含まない
    });
  });

  // ----------------------------------------------------------
  // pinrichEmpty: カウントとフィルタの不一致
  // ----------------------------------------------------------
  describe('pinrichEmpty: カウントとフィルタの不一致', () => {
    /**
     * Validates: Requirements 1.4
     *
     * バグ条件:
     *   countCondition includes sellers WHERE status = '他決→追客'
     *   filterCondition does NOT include sellers WHERE status = '他決→追客'
     *
     * 期待される反例:
     *   status='他決→追客' かつ pinrich_status=null の売主がカウントに含まれるがフィルタには含まれない
     *   → filterCount < sidebarCount
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('他決→追客かつpinrich_status=nullの売主はカウントに含まれるがフィルタに含まれない（バグの存在を証明）', () => {
      // 売主Fがカウントに含まれることを確認
      const sellerF = SELLERS_PINRICH_EMPTY_BUG.find(s => s.id === 'seller-f')!;
      const sellerFInCount = countPinrichEmpty([sellerF], TODAY);
      expect(sellerFInCount).toBe(1); // 他決→追客 は filteredTodayCallSellers に含まれる

      // 売主Fがフィルタに含まれないことを確認（バグあり実装）
      const sellerFInFilter = filterPinrichEmpty_buggy([sellerF], TODAY);
      expect(sellerFInFilter.length).toBe(0); // 他決→追客 は '%追客中%' にマッチしない

      // カウントとフィルタ件数が一致することを確認（修正後の期待動作）
      // バグあり実装では不一致 → このアサーションが FAIL する
      const sidebarCount = countPinrichEmpty(SELLERS_PINRICH_EMPTY_BUG, TODAY);
      const filterCount = filterPinrichEmpty_buggy(SELLERS_PINRICH_EMPTY_BUG, TODAY).length;
      expect(filterCount).toBe(sidebarCount); // FAILS on unfixed code: filterCount < sidebarCount
    });

    it('フィルタ件数がカウントより少ない（バグの存在を証明）', () => {
      const sidebarCount = countPinrichEmpty(SELLERS_PINRICH_EMPTY_BUG, TODAY);
      const filterCount = filterPinrichEmpty_buggy(SELLERS_PINRICH_EMPTY_BUG, TODAY).length;

      // 修正後の期待動作: filterCount === sidebarCount
      // バグあり実装では: filterCount < sidebarCount（他決→追客 が除外される）
      expect(filterCount).toBe(sidebarCount); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // 補足: バグ条件の詳細確認
  // ----------------------------------------------------------
  describe('バグ条件の詳細確認', () => {
    it('todayCallAssigned: 追客中はカウントにもフィルタにも含まれる（正常ケース）', () => {
      const sellerA = SELLERS_TODAY_CALL_ASSIGNED_BUG.find(s => s.id === 'seller-a')!;
      expect(countTodayCallAssigned([sellerA], TODAY)).toBe(1);
      expect(filterTodayCallAssigned_buggy([sellerA], TODAY).length).toBe(1);
    });

    it('todayCallAssigned: 査定中はカウントに含まれない', () => {
      const sellerX = SELLERS_TODAY_CALL_ASSIGNED_BUG.find(s => s.id === 'seller-x')!;
      expect(countTodayCallAssigned([sellerX], TODAY)).toBe(0);
    });

    it('filteredTodayCallSellers には 他決→追客 が含まれる', () => {
      const sellerF = SELLERS_PINRICH_EMPTY_BUG.find(s => s.id === 'seller-f')!;
      const filtered = getFilteredTodayCallSellers([sellerF], TODAY);
      expect(filtered.length).toBe(1); // 他決→追客 は filteredTodayCallSellers に含まれる
    });

    it('pinrichEmpty: 追客中かつpinrich_status=nullはカウントにもフィルタにも含まれる（正常ケース）', () => {
      const sellerG = SELLERS_PINRICH_EMPTY_BUG.find(s => s.id === 'seller-g')!;
      expect(countPinrichEmpty([sellerG], TODAY)).toBe(1);
      expect(filterPinrichEmpty_buggy([sellerG], TODAY).length).toBe(1);
    });
  });
});
