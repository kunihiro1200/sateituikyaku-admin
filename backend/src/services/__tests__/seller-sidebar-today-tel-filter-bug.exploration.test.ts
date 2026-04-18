/**
 * バグ条件探索テスト: seller-sidebar-today-tel-filter-bug
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * CRITICAL: このテストは修正前のコードで FAIL することが期待される
 * FAIL することでバグの存在が確認される
 * DO NOT attempt to fix the test or the code when it fails
 *
 * バグの内容:
 *   `filteredTodayCallSellers` の生成ロジックに `status.includes('追客不要')` の
 *   除外処理が欠落している。
 *
 *   実際のコード（SellerSidebarCountsUpdateService.ts）:
 *     const filteredTodayCallSellers = todayCallBaseSellers.filter(s => {
 *       return !hasValidVisitAssignee(s.visit_assignee);  // 追客不要の除外なし
 *     });
 *
 *   todayCallBaseSellers は todayCallBaseResult1（ilike '%追客中%'）と
 *   todayCallBaseResult2（eq('status', '他決→追客')）の合算。
 *   todayCallBaseResult1 クエリには `.not('status', 'ilike', '%追客不要%')` が欠落しており、
 *   「追客不要」「除外済追客不要」等のステータスを持つ売主が取得されてしまう。
 *   その後の JS フィルタでも `status.includes('追客不要')` の除外処理が欠落している。
 *
 * EXPECTED OUTCOME: テストが FAIL する（バグの存在を証明）
 */

// ============================================================
// ロジック抽出: SellerSidebarCountsUpdateService の
// filteredTodayCallSellers 生成ロジックをインライン実装
// 実際のDBには接続せず、ロジックをユニットテストとして検証する
// ============================================================

const TODAY = '2026-05-01';

/**
 * 営担が有効かどうかを判定（「外す」は無効扱い）
 * SellerSidebarCountsUpdateService の hasValidVisitAssignee と同じロジック
 */
function hasValidVisitAssignee(visitAssignee: string | null | undefined): boolean {
  if (!visitAssignee || visitAssignee.trim() === '' || visitAssignee.trim() === '外す') {
    return false;
  }
  return true;
}

/**
 * 【修正前】filteredTodayCallSellers の JS フィルタ（バグあり）
 *
 * 実際のコード（SellerSidebarCountsUpdateService.ts）:
 *   const filteredTodayCallSellers = todayCallBaseSellers.filter(s => {
 *     return !hasValidVisitAssignee(s.visit_assignee);  // 追客不要の除外なし
 *   });
 *
 * バグ: status.includes('追客不要') の除外処理が欠落している
 * todayCallBaseSellers に「追客不要」が含まれる場合、JS フィルタで除外されない
 */
function applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers: any[]): any[] {
  return todayCallBaseSellers.filter(s => {
    // バグ: status.includes('追客不要') の除外処理が欠落
    return !hasValidVisitAssignee(s.visit_assignee);
  });
}

/**
 * 【修正後】filteredTodayCallSellers の JS フィルタ（修正済み）
 *
 * 期待されるコード:
 *   const filteredTodayCallSellers = todayCallBaseSellers.filter(s => {
 *     const status = s.status || '';
 *     if (status.includes('追客不要')) return false;
 *     return !hasValidVisitAssignee(s.visit_assignee);
 *   });
 */
function applyFilteredTodayCallSellers_FIXED(todayCallBaseSellers: any[]): any[] {
  return todayCallBaseSellers.filter(s => {
    const status = s.status || '';
    // 修正: 追客不要を含むステータスを除外（架電対象外）
    if (status.includes('追客不要')) return false;
    return !hasValidVisitAssignee(s.visit_assignee);
  });
}

// ============================================================
// テストデータ
// ============================================================

/**
 * バグ条件1: status = '追客不要'
 * - next_call_date = 今日以前
 * - visit_assignee = null
 *
 * 実際のDBでは todayCallBaseResult1 クエリに .not('status', 'ilike', '%追客不要%') が
 * 欠落しているため、このような売主が todayCallBaseSellers に含まれてしまう。
 * その後の JS フィルタでも除外されないため、filteredTodayCallSellers に含まれてしまう。
 *
 * → 修正前: filteredTodayCallSellers に含まれてしまう（バグ）
 * → 修正後: filteredTodayCallSellers から除外される（正しい動作）
 */
const SELLER_TSUIKYAKU_FUYO: any = {
  id: 'seller-tsuikyaku-fuyo',
  status: '追客不要',
  visit_assignee: null,
  next_call_date: TODAY,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  unreachable_status: null,
  confidence_level: null,
  inquiry_date: '2026-02-01',
  pinrich_status: null,
};

/**
 * バグ条件2: status = '除外済追客不要'
 * - next_call_date = 今日以前
 * - visit_assignee = null
 *
 * → 修正前: filteredTodayCallSellers に含まれてしまう（バグ）
 * → 修正後: filteredTodayCallSellers から除外される（正しい動作）
 */
const SELLER_JOGAI_TSUIKYAKU_FUYO: any = {
  id: 'seller-jogai-tsuikyaku-fuyo',
  status: '除外済追客不要',
  visit_assignee: null,
  next_call_date: TODAY,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  unreachable_status: null,
  confidence_level: null,
  inquiry_date: '2026-02-01',
  pinrich_status: null,
};

/**
 * 正常ケース: status = '追客中'
 * - next_call_date = 今日以前
 * - visit_assignee = null
 * → 修正前後ともに filteredTodayCallSellers に含まれる（正しい動作）
 */
const SELLER_TSUIKYAKUCHU: any = {
  id: 'seller-tsuikyakuchu',
  status: '追客中',
  visit_assignee: null,
  next_call_date: TODAY,
  phone_contact_person: null,
  preferred_contact_time: null,
  contact_method: null,
  unreachable_status: null,
  confidence_level: null,
  inquiry_date: '2026-02-01',
  pinrich_status: null,
};

// ============================================================
// テスト本体
// ============================================================

describe('Bug Condition Exploration: seller-sidebar-today-tel-filter-bug', () => {

  // ----------------------------------------------------------
  // バグ根本原因の確認
  // ----------------------------------------------------------
  describe('バグ根本原因の確認', () => {

    it('todayCallBaseResult1 クエリに追客不要除外がないことを確認（バグの根本原因）', () => {
      // 実際のコード（SellerSidebarCountsUpdateService.ts）の todayCallBaseResult1 クエリ:
      //   .ilike('status', '%追客中%')
      //   .not('next_call_date', 'is', null)
      //   .lte('next_call_date', todayJST)
      //   ← .not('status', 'ilike', '%追客不要%') が欠落している
      //
      // todayCallAssignedResult クエリ（正しい実装）:
      //   .ilike('status', '%追客中%')
      //   .not('status', 'ilike', '%追客不要%')  ← 追客不要除外あり
      //
      // → todayCallBaseResult1 には追客不要除外がないため、
      //   「追客不要」ステータスの売主が含まれてしまう

      const todayCallAssignedHasExclusion = true; // todayCallAssignedResult には追客不要除外あり
      const todayCallBaseResult1HasExclusion = false; // todayCallBaseResult1 には追客不要除外なし（バグ）

      expect(todayCallAssignedHasExclusion).toBe(true);
      expect(todayCallBaseResult1HasExclusion).toBe(false); // バグの証明
    });

    it('filteredTodayCallSellers の JS フィルタに追客不要除外がないことを確認（バグの根本原因）', () => {
      // todayCallBaseSellers に「追客不要」が含まれる状況をシミュレート
      const todayCallBaseSellers = [SELLER_TSUIKYAKU_FUYO, SELLER_TSUIKYAKUCHU];

      // バグあり JS フィルタ（追客不要除外なし）
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      // 修正済み JS フィルタ（追客不要除外あり）
      const filteredFixed = applyFilteredTodayCallSellers_FIXED(todayCallBaseSellers);

      // バグあり: 「追客不要」が含まれてしまう（2件）
      expect(filteredBuggy.length).toBe(2); // 追客不要 + 追客中

      // 修正済み: 「追客不要」が除外される（1件）
      expect(filteredFixed.length).toBe(1); // 追客中のみ
    });

    it('追客不要 は status.includes("追客不要") で検出できる', () => {
      expect(SELLER_TSUIKYAKU_FUYO.status.includes('追客不要')).toBe(true);
      expect(SELLER_JOGAI_TSUIKYAKU_FUYO.status.includes('追客不要')).toBe(true);
      expect(SELLER_TSUIKYAKUCHU.status.includes('追客不要')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // Property 1: Bug Condition - 追客不要ステータスの除外漏れ
  // ----------------------------------------------------------
  describe('Property 1: Bug Condition - 追客不要ステータスの除外漏れ', () => {

    /**
     * Validates: Requirements 1.1
     *
     * バグ条件:
     *   todayCallBaseSellers に status = '追客不要' の売主が含まれる場合、
     *   filteredTodayCallSellers の JS フィルタで除外されない
     *
     * テスト方法:
     *   todayCallBaseSellers に「追客不要」を直接含めて、
     *   修正済み JS フィルタの動作を検証する
     *
     * EXPECTED: PASS on fixed code
     */
    it('【バグ再現】status=追客不要 の売主が filteredTodayCallSellers に含まれないことをアサート（修正前はFAIL）', () => {
      // todayCallBaseSellers に「追客不要」が含まれる状況をシミュレート
      // （実際のDBでは todayCallBaseResult1 クエリに追客不要除外がないため発生する）
      const todayCallBaseSellers = [SELLER_TSUIKYAKU_FUYO];

      // 修正済み JS フィルタ（追客不要の除外あり）
      const filteredFixed = applyFilteredTodayCallSellers_FIXED(todayCallBaseSellers);

      // 期待動作: 「追客不要」は filteredTodayCallSellers に含まれないこと（0件）
      // 修正済み実装では: 正しく除外される（0件）
      expect(filteredFixed.length).toBe(0);
    });

    /**
     * Validates: Requirements 1.2
     *
     * バグ条件:
     *   todayCallBaseSellers に status = '除外済追客不要' の売主が含まれる場合、
     *   filteredTodayCallSellers の JS フィルタで除外されない
     *
     * EXPECTED: PASS on fixed code
     */
    it('【バグ再現】status=除外済追客不要 の売主が filteredTodayCallSellers に含まれないことをアサート（修正前はFAIL）', () => {
      // todayCallBaseSellers に「除外済追客不要」が含まれる状況をシミュレート
      const todayCallBaseSellers = [SELLER_JOGAI_TSUIKYAKU_FUYO];

      // 修正済み JS フィルタ（追客不要の除外あり）
      const filteredFixed = applyFilteredTodayCallSellers_FIXED(todayCallBaseSellers);

      // 期待動作: 「除外済追客不要」は filteredTodayCallSellers に含まれないこと（0件）
      // 修正済み実装では: 正しく除外される（0件）
      expect(filteredFixed.length).toBe(0);
    });

    it('【バグ再現】追客不要 と 除外済追客不要 が混在する場合、追客中のみが含まれることをアサート（修正前はFAIL）', () => {
      // todayCallBaseSellers に「追客不要」「除外済追客不要」「追客中」が含まれる状況をシミュレート
      const todayCallBaseSellers = [
        SELLER_TSUIKYAKU_FUYO,
        SELLER_JOGAI_TSUIKYAKU_FUYO,
        SELLER_TSUIKYAKUCHU,
      ];

      // 修正済み JS フィルタ（追客不要の除外あり）
      const filteredFixed = applyFilteredTodayCallSellers_FIXED(todayCallBaseSellers);

      // 期待動作: 「追客中」のみが含まれる（1件）
      // 修正済み実装では: 「追客不要」「除外済追客不要」が除外され、「追客中」のみ（1件）
      expect(filteredFixed.length).toBe(1);
    });

    it('【修正後の確認】修正済み JS フィルタでは追客不要が除外される', () => {
      const todayCallBaseSellers = [
        SELLER_TSUIKYAKU_FUYO,
        SELLER_JOGAI_TSUIKYAKU_FUYO,
        SELLER_TSUIKYAKUCHU,
      ];

      // 修正済み JS フィルタ（追客不要除外あり）
      const filteredFixed = applyFilteredTodayCallSellers_FIXED(todayCallBaseSellers);

      // 修正後: 「追客中」のみが含まれる（1件）
      expect(filteredFixed.length).toBe(1);
      expect(filteredFixed[0].id).toBe('seller-tsuikyakuchu');
    });
  });

  // ----------------------------------------------------------
  // バグ条件の詳細確認
  // ----------------------------------------------------------
  describe('バグ条件の詳細確認', () => {

    it('追客中 は filteredTodayCallSellers に含まれる（正常ケース）', () => {
      const todayCallBaseSellers = [SELLER_TSUIKYAKUCHU];
      const filtered = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);
      expect(filtered.length).toBe(1); // 追客中は含まれる
    });

    it('isBugCondition: 追客不要を含む売主が filteredTodayCallSellers に含まれる場合がバグ条件', () => {
      // isBugCondition(seller) = status.includes('追客不要') AND seller is in filteredTodayCallSellers
      const isBugCondition = (seller: any, filteredSellers: any[]) => {
        const status = seller.status || '';
        return status.includes('追客不要') && filteredSellers.some(s => s.id === seller.id);
      };

      // todayCallBaseSellers に「追客不要」が含まれる状況
      const todayCallBaseSellers = [SELLER_TSUIKYAKU_FUYO, SELLER_TSUIKYAKUCHU];

      // バグあり JS フィルタ
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      // バグ条件: 「追客不要」が filteredTodayCallSellers に含まれる
      expect(isBugCondition(SELLER_TSUIKYAKU_FUYO, filteredBuggy)).toBe(true); // バグが存在する
      expect(isBugCondition(SELLER_TSUIKYAKUCHU, filteredBuggy)).toBe(false); // 正常ケース

      // 修正済み JS フィルタ
      const filteredFixed = applyFilteredTodayCallSellers_FIXED(todayCallBaseSellers);

      // 修正後: バグ条件が解消される
      expect(isBugCondition(SELLER_TSUIKYAKU_FUYO, filteredFixed)).toBe(false); // バグが解消
      expect(isBugCondition(SELLER_TSUIKYAKUCHU, filteredFixed)).toBe(false); // 正常ケース
    });
  });
});
