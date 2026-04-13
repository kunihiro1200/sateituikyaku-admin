// Bug condition exploration test: seller-sidebar-count-mismatch-fix
// Validates: Requirements 1.2, 1.3, 1.4
//
// CRITICAL: This test is EXPECTED TO FAIL on unfixed code (proves the bug exists)
// DO NOT attempt to fix the test or the code when it fails
//
// NOTE: This test encodes the EXPECTED behavior.
//       After the fix is applied, this test should PASS.
//
// GOAL: Find counterexamples that demonstrate the bug exists.
//
// Bug conditions (3 differences between count calculation and filtering):
//
//   Difference 1 (todayCallNotStarted):
//     Count calculation: does NOT check exclusion_date
//     Filtering: checks !exclusionDate (excludes sellers with exclusion_date)
//     -> Seller with exclusion_date is counted but NOT returned by filter
//
//   Difference 2 (todayCall):
//     Count calculation: checks unreachable_status, confidence_level, inquiry_date
//                        to exclude "not-started" sellers
//     Filtering: does NOT check these fields -> "not-started" sellers are included
//     -> Seller that should be in todayCallNotStarted is also returned by todayCall filter
//
//   Difference 3 (unvaluated):
//     Count calculation: isTodayCallNotStarted does NOT check exclusion_date
//     Filtering: isTodayCallNotStarted checks !exclusionDate
//     -> Seller with exclusion_date is counted in unvaluated but NOT returned by filter

// ============================================================
// Logic extraction: inline implementations of count calculation and filtering
// No DB connection - pure unit tests of the logic
// ============================================================

// ---- Count calculation logic (from SellerSidebarCountsUpdateService) ----

/**
 * filteredTodayCallSellers: base set for todayCall, todayCallNotStarted, pinrichEmpty
 * Condition: (status includes '追客中' OR status === '他決→追客') AND no visit_assignee
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
 * todayCallNotStarted count calculation (from SellerSidebarCountsUpdateService)
 * NOTE: does NOT check exclusion_date
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
    // NOTE: exclusion_date is NOT checked here (this is the count calculation)
    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  }).length;
}

/**
 * todayCall count calculation (from SellerSidebarCountsUpdateService)
 * Excludes sellers that satisfy isNotStarted condition
 * isNotStarted checks: unreachable_status, confidence_level, inquiry_date
 */
function countTodayCall(sellers: any[], todayJST: string): number {
  const filtered = getFilteredTodayCallSellers(sellers, todayJST);
  return filtered.filter(s => {
    const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                    (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                    (s.contact_method && s.contact_method.trim() !== '');
    if (hasInfo) return false;
    // Exclude sellers that satisfy isNotStarted (they belong to todayCallNotStarted)
    const status = s.status || '';
    const unreachable = s.unreachable_status || '';
    const confidence = s.confidence_level || '';
    const inquiryDate = s.inquiry_date || '';
    const isNotStarted = status === '追客中' &&
      !unreachable &&
      confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
      inquiryDate >= '2026-01-01';
    return !isNotStarted;
  }).length;
}

/**
 * unvaluated count calculation (from SellerSidebarCountsUpdateService)
 * isTodayCallNotStarted does NOT check exclusion_date
 */
function countUnvaluated(sellers: any[], todayJST: string): number {
  return sellers.filter(s => {
    // Base conditions (from DB query)
    const status = s.status || '';
    if (!status.includes('追客中')) return false;
    const inquiryDate = s.inquiry_date || '';
    if (inquiryDate < '2025-12-08') return false;
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
    if (s.valuation_amount_1 || s.valuation_amount_2 || s.valuation_amount_3) return false;

    // JS filter
    const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
    const valuationMethod = s.valuation_method || '';
    const isNotRequired = valuationMethod === '不要';
    if (!hasNoValuation || isNotRequired) return false;

    const nextCallDate = s.next_call_date || '';
    const hasInfo = (s.phone_contact_person?.trim()) ||
                    (s.preferred_contact_time?.trim()) ||
                    (s.contact_method?.trim());
    const unreachable = s.unreachable_status || '';
    const confidence = s.confidence_level || '';
    // NOTE: exclusion_date is NOT checked in isTodayCallNotStarted (count calculation)
    const isTodayCallNotStarted = (
      status === '追客中' &&
      nextCallDate && nextCallDate <= todayJST &&
      !hasInfo &&
      !unreachable &&
      confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
      inquiryDate >= '2026-01-01'
    );
    return !isTodayCallNotStarted;
  }).length;
}

// ---- Filtering logic (from SellerService.listSellers() - BUGGY current implementation) ----

/**
 * todayCallNotStarted filtering (BUGGY: checks !exclusionDate)
 * Bug: excludes sellers with exclusion_date, but count calculation does not
 */
function filterTodayCallNotStarted_buggy(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    const status = s.status || '';
    if (status !== '追客中') return false;
    if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
    const hasInfo = (s.phone_contact_person?.trim()) ||
                    (s.preferred_contact_time?.trim()) ||
                    (s.contact_method?.trim());
    if (hasInfo) return false;
    const unreachable = s.unreachable_status || '';
    if (unreachable && unreachable.trim() !== '') return false;
    const confidence = s.confidence_level || '';
    if (confidence === 'ダブり' || confidence === 'D' || confidence === 'AI査定') return false;
    // BUG: exclusion_date check is here but NOT in count calculation
    const exclusionDate = s.exclusion_date || '';
    if (exclusionDate && exclusionDate.trim() !== '') return false;
    const inquiryDate = s.inquiry_date || '';
    return inquiryDate >= '2026-01-01';
  });
}

/**
 * todayCall filtering (BUGGY: does NOT check unreachable_status, confidence_level, inquiry_date)
 * Bug: "not-started" sellers are not excluded
 */
function filterTodayCall_buggy(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    const status = s.status || '';
    const isFollowingUp = status.includes('追客中') || status === '他決→追客';
    if (!isFollowingUp) return false;
    if (status.includes('追客不要') || status.includes('専任媒介') || status.includes('一般媒介')) return false;
    if (!s.next_call_date || s.next_call_date > todayJST) return false;
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
    const hasInfo = (s.phone_contact_person && s.phone_contact_person.trim() !== '') ||
                    (s.preferred_contact_time && s.preferred_contact_time.trim() !== '') ||
                    (s.contact_method && s.contact_method.trim() !== '');
    // BUG: isNotStarted check is missing here
    // unreachable_status, confidence_level, inquiry_date are NOT checked
    return !hasInfo;
  });
}

/**
 * unvaluated filtering (BUGGY: isTodayCallNotStarted checks !exclusionDate)
 * Bug: sellers with exclusion_date are excluded from filter but counted
 */
function filterUnvaluated_buggy(sellers: any[], todayJST: string): any[] {
  return sellers.filter(s => {
    const status = s.status || '';
    if (!status.includes('追客中')) return false;
    const inquiryDate = s.inquiry_date || '';
    if (inquiryDate < '2025-12-08') return false;
    const visitAssignee = s.visit_assignee || '';
    if (visitAssignee && visitAssignee.trim() !== '' && visitAssignee.trim() !== '外す') return false;
    if (s.valuation_amount_1 || s.valuation_amount_2 || s.valuation_amount_3) return false;

    const hasNoValuation = !s.valuation_amount_1 && !s.valuation_amount_2 && !s.valuation_amount_3;
    const valuationMethod = s.valuation_method || '';
    const isNotRequired = valuationMethod === '不要';
    if (!hasNoValuation || isNotRequired) return false;

    const nextCallDate = s.next_call_date || '';
    const hasInfo = (s.phone_contact_person?.trim()) ||
                    (s.preferred_contact_time?.trim()) ||
                    (s.contact_method?.trim());
    const unreachable = s.unreachable_status || '';
    const confidence = s.confidence_level || '';
    const exclusionDate = s.exclusion_date || '';
    // BUG: !exclusionDate is checked here but NOT in count calculation
    const isTodayCallNotStarted = (
      status === '追客中' &&
      nextCallDate && nextCallDate <= todayJST &&
      !hasInfo &&
      !unreachable &&
      confidence !== 'ダブり' && confidence !== 'D' && confidence !== 'AI査定' &&
      !exclusionDate &&  // BUG: this extra check causes mismatch
      inquiryDate >= '2026-01-01'
    );
    return !isTodayCallNotStarted;
  });
}

// ============================================================
// Test data
// ============================================================

const TODAY = '2026-04-15';

/**
 * 差異2の再現用テストデータ
 * status='追客中', next_call_date=today, unreachable_status='', confidence_level='',
 * inquiry_date='2026-02-01', コミュニケーション情報なし, 営担なし
 *
 * Count calculation: isNotStarted=true -> counted in todayCallNotStarted, excluded from todayCall
 * Filtering (buggy): isNotStarted check missing -> included in todayCall filter
 */
const SELLER_DIFF2 = {
  id: 'seller-diff2',
  status: '追客中',
  next_call_date: TODAY,
  unreachable_status: '',
  confidence_level: '',
  inquiry_date: '2026-02-01',
  exclusion_date: null,
  visit_assignee: null,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  valuation_amount_1: null,
  valuation_amount_2: null,
  valuation_amount_3: null,
  valuation_method: null,
};

/**
 * 差異1の再現用テストデータ
 * status='追客中', next_call_date=today, exclusion_date='2026-03-01',
 * inquiry_date='2026-02-01', コミュニケーション情報なし, 営担なし
 *
 * Count calculation: exclusion_date NOT checked -> counted in todayCallNotStarted
 * Filtering (buggy): exclusion_date checked -> excluded from todayCallNotStarted filter
 */
const SELLER_DIFF1 = {
  id: 'seller-diff1',
  status: '追客中',
  next_call_date: TODAY,
  exclusion_date: '2026-03-01',
  inquiry_date: '2026-02-01',
  unreachable_status: '',
  confidence_level: '',
  visit_assignee: null,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  valuation_amount_1: null,
  valuation_amount_2: null,
  valuation_amount_3: null,
  valuation_method: null,
};

/**
 * 差異3の再現用テストデータ
 * status='追客中', inquiry_date='2026-02-01', exclusion_date='2026-03-01',
 * 査定額なし, 営担なし
 *
 * Count calculation: isTodayCallNotStarted does NOT check exclusion_date
 *   -> isTodayCallNotStarted=true -> excluded from unvaluated count
 *   Wait: if isTodayCallNotStarted=true, seller is excluded from unvaluated
 *   But the bug is: filter checks !exclusionDate in isTodayCallNotStarted
 *   -> filter: isTodayCallNotStarted=false (because exclusionDate exists) -> included in unvaluated
 *   -> count: isTodayCallNotStarted=true (no exclusionDate check) -> excluded from unvaluated
 *   -> count=0, filter=1 (mismatch)
 */
const SELLER_DIFF3 = {
  id: 'seller-diff3',
  status: '追客中',
  next_call_date: TODAY,
  inquiry_date: '2026-02-01',
  exclusion_date: '2026-03-01',
  unreachable_status: '',
  confidence_level: '',
  visit_assignee: null,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  valuation_amount_1: null,
  valuation_amount_2: null,
  valuation_amount_3: null,
  valuation_method: null,
};

// ============================================================
// Tests
// ============================================================

describe('Bug Condition Exploration: seller-sidebar-count-mismatch-fix', () => {

  // ----------------------------------------------------------
  // 差異2: todayCall - 未着手売主の除外漏れ
  // ----------------------------------------------------------
  describe('差異2: todayCall フィルタが未着手売主を除外しない', () => {
    /**
     * Validates: Requirements 1.3
     *
     * Bug condition:
     *   Count calculation: isNotStarted=true -> seller excluded from todayCall
     *   Filtering (buggy): isNotStarted check missing -> seller included in todayCall
     *
     * Expected counterexample:
     *   SELLER_DIFF2 is counted in todayCallNotStarted (not todayCall)
     *   but the buggy filter includes it in todayCall
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('差異2: 未着手売主はカウント計算ではtodayCallから除外されるが、フィルタでは含まれてしまう（バグの存在を証明）', () => {
      // カウント計算: SELLER_DIFF2 は todayCallNotStarted にカウントされる
      const notStartedCount = countTodayCallNotStarted([SELLER_DIFF2], TODAY);
      expect(notStartedCount).toBe(1); // todayCallNotStarted にカウントされる

      // カウント計算: SELLER_DIFF2 は todayCall から除外される（isNotStarted=true）
      const todayCallCount = countTodayCall([SELLER_DIFF2], TODAY);
      expect(todayCallCount).toBe(0); // todayCall にはカウントされない

      // フィルタリング（バグあり）: SELLER_DIFF2 は todayCall に含まれてしまう
      const todayCallFiltered = filterTodayCall_buggy([SELLER_DIFF2], TODAY);

      // 修正後の期待動作: フィルタ件数 === カウント件数 (0)
      // バグあり実装では: フィルタ件数 > カウント件数 (1 > 0)
      expect(todayCallFiltered.length).toBe(todayCallCount); // FAILS on unfixed code: 1 !== 0
    });

    it('差異2: カウント計算とフィルタリングの結果が一致しない（バグの存在を証明）', () => {
      const countResult = countTodayCall([SELLER_DIFF2], TODAY);
      const filterResult = filterTodayCall_buggy([SELLER_DIFF2], TODAY).length;

      // 修正後の期待動作: countResult === filterResult
      // バグあり実装では: filterResult > countResult
      expect(filterResult).toBe(countResult); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // 差異1: todayCallNotStarted - exclusion_date チェックの非対称性
  // ----------------------------------------------------------
  describe('差異1: todayCallNotStarted フィルタが exclusion_date ありの売主を除外してしまう', () => {
    /**
     * Validates: Requirements 1.2
     *
     * Bug condition:
     *   Count calculation: exclusion_date NOT checked -> seller counted in todayCallNotStarted
     *   Filtering (buggy): exclusion_date checked -> seller excluded from todayCallNotStarted
     *
     * Expected counterexample:
     *   SELLER_DIFF1 (exclusion_date='2026-03-01') is counted but not returned by filter
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('差異1: exclusion_dateありの売主はカウント計算では含まれるが、フィルタでは除外されてしまう（バグの存在を証明）', () => {
      // カウント計算: SELLER_DIFF1 は todayCallNotStarted にカウントされる（exclusion_date チェックなし）
      const countResult = countTodayCallNotStarted([SELLER_DIFF1], TODAY);
      expect(countResult).toBe(1); // カウントには含まれる

      // フィルタリング（バグあり）: SELLER_DIFF1 は除外される（exclusion_date チェックあり）
      const filterResult = filterTodayCallNotStarted_buggy([SELLER_DIFF1], TODAY);

      // 修正後の期待動作: フィルタ件数 === カウント件数 (1)
      // バグあり実装では: フィルタ件数 < カウント件数 (0 < 1)
      expect(filterResult.length).toBe(countResult); // FAILS on unfixed code: 0 !== 1
    });

    it('差異1: カウント計算とフィルタリングの結果が一致しない（バグの存在を証明）', () => {
      const countResult = countTodayCallNotStarted([SELLER_DIFF1], TODAY);
      const filterResult = filterTodayCallNotStarted_buggy([SELLER_DIFF1], TODAY).length;

      // 修正後の期待動作: countResult === filterResult
      // バグあり実装では: filterResult < countResult
      expect(filterResult).toBe(countResult); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // 差異3: unvaluated - isTodayCallNotStarted 判定の非対称性
  // ----------------------------------------------------------
  describe('差異3: unvaluated フィルタが exclusion_date ありの売主を除外してしまう', () => {
    /**
     * Validates: Requirements 1.4
     *
     * Bug condition:
     *   Count calculation: isTodayCallNotStarted does NOT check exclusion_date
     *     -> isTodayCallNotStarted=true -> seller excluded from unvaluated count
     *   Filtering (buggy): isTodayCallNotStarted checks !exclusionDate
     *     -> isTodayCallNotStarted=false (exclusionDate exists) -> seller included in unvaluated filter
     *
     * Expected counterexample:
     *   SELLER_DIFF3 (exclusion_date='2026-03-01'):
     *     count: isTodayCallNotStarted=true -> excluded from unvaluated (count=0)
     *     filter: isTodayCallNotStarted=false -> included in unvaluated (filter=1)
     *     -> count=0, filter=1 (mismatch)
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('差異3: exclusion_dateありの売主はカウント計算では除外されるが、フィルタでは含まれてしまう（バグの存在を証明）', () => {
      // カウント計算: SELLER_DIFF3 は isTodayCallNotStarted=true なので unvaluated から除外される
      const countResult = countUnvaluated([SELLER_DIFF3], TODAY);
      expect(countResult).toBe(0); // カウントには含まれない（isTodayCallNotStarted=true で除外）

      // フィルタリング（バグあり）: SELLER_DIFF3 は isTodayCallNotStarted=false（!exclusionDate が false）
      // なので unvaluated に含まれてしまう
      const filterResult = filterUnvaluated_buggy([SELLER_DIFF3], TODAY);

      // 修正後の期待動作: フィルタ件数 === カウント件数 (0)
      // バグあり実装では: フィルタ件数 > カウント件数 (1 > 0)
      expect(filterResult.length).toBe(countResult); // FAILS on unfixed code: 1 !== 0
    });

    it('差異3: カウント計算とフィルタリングの結果が一致しない（バグの存在を証明）', () => {
      const countResult = countUnvaluated([SELLER_DIFF3], TODAY);
      const filterResult = filterUnvaluated_buggy([SELLER_DIFF3], TODAY).length;

      // 修正後の期待動作: countResult === filterResult
      // バグあり実装では: filterResult > countResult
      expect(filterResult).toBe(countResult); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // 補足: 各差異の詳細確認
  // ----------------------------------------------------------
  describe('バグ条件の詳細確認', () => {
    it('差異2: SELLER_DIFF2 は isNotStarted=true（unreachable_status空 + confidence空 + inquiry_date>=2026-01-01）', () => {
      // isNotStarted の各条件を確認
      expect(SELLER_DIFF2.status).toBe('追客中');
      expect(SELLER_DIFF2.unreachable_status).toBe('');
      expect(SELLER_DIFF2.confidence_level).toBe('');
      expect(SELLER_DIFF2.inquiry_date >= '2026-01-01').toBe(true);
      expect(SELLER_DIFF2.phone_contact_person).toBeNull();
      expect(SELLER_DIFF2.preferred_contact_time).toBeNull();
      expect(SELLER_DIFF2.contact_method).toBeNull();

      // todayCallNotStarted にカウントされる
      expect(countTodayCallNotStarted([SELLER_DIFF2], TODAY)).toBe(1);
      // todayCall にはカウントされない
      expect(countTodayCall([SELLER_DIFF2], TODAY)).toBe(0);
    });

    it('差異1: SELLER_DIFF1 は exclusion_date あり（カウント計算では無視、フィルタでは除外）', () => {
      expect(SELLER_DIFF1.exclusion_date).toBe('2026-03-01');
      // カウント計算: exclusion_date を無視 -> todayCallNotStarted にカウントされる
      expect(countTodayCallNotStarted([SELLER_DIFF1], TODAY)).toBe(1);
      // フィルタ（バグあり）: exclusion_date を確認 -> 除外される
      expect(filterTodayCallNotStarted_buggy([SELLER_DIFF1], TODAY).length).toBe(0);
    });

    it('差異3: SELLER_DIFF3 は exclusion_date あり（カウント計算では isTodayCallNotStarted=true、フィルタでは false）', () => {
      expect(SELLER_DIFF3.exclusion_date).toBe('2026-03-01');
      // カウント計算: isTodayCallNotStarted=true（exclusion_date チェックなし）-> unvaluated から除外
      expect(countUnvaluated([SELLER_DIFF3], TODAY)).toBe(0);
      // フィルタ（バグあり）: isTodayCallNotStarted=false（!exclusionDate が false）-> unvaluated に含まれる
      expect(filterUnvaluated_buggy([SELLER_DIFF3], TODAY).length).toBe(1);
    });

    it('正常ケース: exclusion_date なし + unreachable_status なし の売主は todayCallNotStarted に一致', () => {
      const normalSeller = {
        ...SELLER_DIFF2,
        id: 'seller-normal',
        exclusion_date: null,
      };
      // カウント計算: todayCallNotStarted にカウントされる
      expect(countTodayCallNotStarted([normalSeller], TODAY)).toBe(1);
      // フィルタ（バグあり）: exclusion_date なし -> 除外されない
      expect(filterTodayCallNotStarted_buggy([normalSeller], TODAY).length).toBe(1);
      // 一致する（正常ケース）
    });
  });
});
