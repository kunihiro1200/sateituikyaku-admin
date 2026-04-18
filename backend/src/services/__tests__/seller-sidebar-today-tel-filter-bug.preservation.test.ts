/**
 * 保全プロパティテスト: seller-sidebar-today-tel-filter-bug
 *
 * **Feature: seller-sidebar-today-tel-filter-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * ✅ このテストは修正前のコードで PASS することが期待される（ベースライン動作を確認）
 *
 * 観察優先メソドロジー:
 * - 修正前のコードで「追客不要」を含まない売主の動作を観察する
 * - 「追客不要」を含まない売主は修正前後ともに filteredTodayCallSellers に含まれることを確認する
 * - 修正前後で「追客不要」を含まない全ステータスの売主の包含状態が変化しないことを検証する
 *
 * 保全要件（design.md より）:
 * - 状況（当社）が「追客不要」を含まない通常ステータスの売主は、引き続き「当日TEL分」に表示されること
 * - 「当日TEL分」以外のサイドバーカテゴリーの件数は変化しないこと
 * - 「追客不要」を含む売主の「当日TEL分」以外のカテゴリーへの表示には影響しないこと
 */

import * as fc from 'fast-check';

// ============================================================
// ロジック抽出: SellerSidebarCountsUpdateService の
// filteredTodayCallSellers 生成ロジックをインライン実装
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
// テストデータ（観察テスト用）
// ============================================================

/**
 * 正常ケース1: status = '追客中'
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

/**
 * 正常ケース2: status = '他決→追客'
 * - next_call_date = 今日以前
 * - visit_assignee = null
 * → 修正前後ともに filteredTodayCallSellers に含まれる（正しい動作）
 */
const SELLER_TAKETSU_TSUIKYAKU: any = {
  id: 'seller-taketsu-tsuikyaku',
  status: '他決→追客',
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
 * 正常ケース3: status = '除外後追客中'
 * - next_call_date = 今日以前
 * - visit_assignee = null
 * → 修正前後ともに filteredTodayCallSellers に含まれる（正しい動作）
 */
const SELLER_JOGAIGO_TSUIKYAKUCHU: any = {
  id: 'seller-jogaigo-tsuikyakuchu',
  status: '除外後追客中',
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
 * バグ条件（参照用）: status = '追客不要'
 * - next_call_date = 今日以前
 * - visit_assignee = null
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

// ============================================================
// テスト本体
// ============================================================

describe('Property 2: Preservation - 通常ステータスの売主への影響なし', () => {

  // ----------------------------------------------------------
  // 観察テスト: 修正前のコードで通常ステータスの動作を確認
  // ----------------------------------------------------------
  describe('観察テスト: 修正前のコードで通常ステータスの売主の動作を確認', () => {

    /**
     * 観察1: status = '追客中' の売主が filteredTodayCallSellers に含まれる
     *
     * **Validates: Requirements 3.1**
     */
    it('観察1: status=追客中、next_call_date=今日以前、visit_assignee=null → filteredTodayCallSellers に含まれる', () => {
      const todayCallBaseSellers = [SELLER_TSUIKYAKUCHU];

      // 修正前の JS フィルタ
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      console.log('観察1 - 追客中 フィルタ結果:', filteredBuggy.map((s: any) => s.id));
      expect(filteredBuggy.length).toBe(1);
      expect(filteredBuggy[0].id).toBe('seller-tsuikyakuchu');
    });

    /**
     * 観察2: status = '他決→追客' の売主が filteredTodayCallSellers に含まれる
     *
     * **Validates: Requirements 3.1**
     */
    it('観察2: status=他決→追客、next_call_date=今日以前、visit_assignee=null → filteredTodayCallSellers に含まれる', () => {
      const todayCallBaseSellers = [SELLER_TAKETSU_TSUIKYAKU];

      // 修正前の JS フィルタ
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      console.log('観察2 - 他決→追客 フィルタ結果:', filteredBuggy.map((s: any) => s.id));
      expect(filteredBuggy.length).toBe(1);
      expect(filteredBuggy[0].id).toBe('seller-taketsu-tsuikyaku');
    });

    /**
     * 観察3: status = '除外後追客中' の売主が filteredTodayCallSellers に含まれる
     *
     * **Validates: Requirements 3.1**
     */
    it('観察3: status=除外後追客中、next_call_date=今日以前、visit_assignee=null → filteredTodayCallSellers に含まれる', () => {
      const todayCallBaseSellers = [SELLER_JOGAIGO_TSUIKYAKUCHU];

      // 修正前の JS フィルタ
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      console.log('観察3 - 除外後追客中 フィルタ結果:', filteredBuggy.map((s: any) => s.id));
      expect(filteredBuggy.length).toBe(1);
      expect(filteredBuggy[0].id).toBe('seller-jogaigo-tsuikyakuchu');
    });

    /**
     * 観察4: 通常ステータスの売主が混在する場合、全員が filteredTodayCallSellers に含まれる
     *
     * **Validates: Requirements 3.1**
     */
    it('観察4: 追客中・他決→追客・除外後追客中 が混在する場合、全員が filteredTodayCallSellers に含まれる', () => {
      const todayCallBaseSellers = [
        SELLER_TSUIKYAKUCHU,
        SELLER_TAKETSU_TSUIKYAKU,
        SELLER_JOGAIGO_TSUIKYAKUCHU,
      ];

      // 修正前の JS フィルタ
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      console.log('観察4 - 通常ステータス混在 フィルタ結果:', filteredBuggy.map((s: any) => s.id));
      expect(filteredBuggy.length).toBe(3);
      expect(filteredBuggy.map((s: any) => s.id)).toContain('seller-tsuikyakuchu');
      expect(filteredBuggy.map((s: any) => s.id)).toContain('seller-taketsu-tsuikyaku');
      expect(filteredBuggy.map((s: any) => s.id)).toContain('seller-jogaigo-tsuikyakuchu');
    });

    /**
     * 観察5: 通常ステータスの売主と「追客不要」が混在する場合、通常ステータスの売主は含まれる
     *
     * **Validates: Requirements 3.1**
     */
    it('観察5: 追客中 と 追客不要 が混在する場合、追客中 は filteredTodayCallSellers に含まれる', () => {
      const todayCallBaseSellers = [
        SELLER_TSUIKYAKUCHU,
        SELLER_TSUIKYAKU_FUYO,
      ];

      // 修正前の JS フィルタ
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      console.log('観察5 - 追客中+追客不要 フィルタ結果:', filteredBuggy.map((s: any) => s.id));
      // 修正前: 追客中 も 追客不要 も含まれる（2件）
      // 追客中 が含まれることを確認（保全の観点）
      expect(filteredBuggy.some((s: any) => s.id === 'seller-tsuikyakuchu')).toBe(true);
    });

    /**
     * 観察6: visit_assignee がある売主は filteredTodayCallSellers に含まれない
     *
     * **Validates: Requirements 3.1**
     */
    it('観察6: status=追客中 でも visit_assignee がある場合は filteredTodayCallSellers に含まれない', () => {
      const sellerWithAssignee = {
        ...SELLER_TSUIKYAKUCHU,
        id: 'seller-with-assignee',
        visit_assignee: 'Y',
      };
      const todayCallBaseSellers = [sellerWithAssignee];

      // 修正前の JS フィルタ
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      console.log('観察6 - visit_assignee あり フィルタ結果:', filteredBuggy.map((s: any) => s.id));
      expect(filteredBuggy.length).toBe(0);
    });

    /**
     * 観察7: visit_assignee = '外す' の売主は filteredTodayCallSellers に含まれる
     *
     * **Validates: Requirements 3.1**
     */
    it('観察7: status=追客中 で visit_assignee="外す" の場合は filteredTodayCallSellers に含まれる', () => {
      const sellerWithSotosu = {
        ...SELLER_TSUIKYAKUCHU,
        id: 'seller-with-sotosu',
        visit_assignee: '外す',
      };
      const todayCallBaseSellers = [sellerWithSotosu];

      // 修正前の JS フィルタ（「外す」は無効扱い）
      const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(todayCallBaseSellers);

      console.log('観察7 - visit_assignee="外す" フィルタ結果:', filteredBuggy.map((s: any) => s.id));
      expect(filteredBuggy.length).toBe(1);
      expect(filteredBuggy[0].id).toBe('seller-with-sotosu');
    });
  });

  // ----------------------------------------------------------
  // プロパティベーステスト
  // ----------------------------------------------------------
  describe('プロパティベーステスト: 修正前後で通常ステータスの包含状態が変化しない', () => {

    /**
     * 「追客不要」を含まないステータスのジェネレーター
     * 通常の追客ステータスを生成する
     */
    const normalStatusArb = fc.constantFrom(
      '追客中',
      '他決→追客',
      '除外後追客中',
      '追客中（専任）',
      '追客中（一般）',
    );

    /**
     * 通常ステータスの売主データジェネレーター（IDなし）
     * 「追客不要」を含まないステータスを持つ売主を生成する
     * ※ IDは配列生成後に一意なものを付与する
     */
    const normalSellerBaseArb = fc.record({
      status: normalStatusArb,
      visit_assignee: fc.oneof(
        fc.constant(null),
        fc.constant(''),
        fc.constant('外す'),
        fc.constantFrom('Y', 'I', '久', 'K')
      ),
      next_call_date: fc.constantFrom(TODAY, '2026-04-30', '2026-01-01'),
      phone_contact_person: fc.oneof(fc.constant(null), fc.constantFrom('Y', 'I', '')),
      preferred_contact_time: fc.oneof(fc.constant(null), fc.constantFrom('午前中', '午後', '')),
      contact_method: fc.oneof(fc.constant(null), fc.constantFrom('Eメール', '電話', '')),
      unreachable_status: fc.oneof(fc.constant(null), fc.constantFrom('不通', '')),
      confidence_level: fc.oneof(fc.constant(null), fc.constantFrom('高', '中', '低', '')),
      inquiry_date: fc.constantFrom('2026-02-01', '2026-01-15', '2025-12-01'),
      pinrich_status: fc.oneof(fc.constant(null), fc.constantFrom('済', '未', '')),
    });

    /**
     * プロパティ1: 「追客不要」を含まない全ステータスの売主に対して、
     * filteredTodayCallSellers への包含状態が修正前後で変化しない
     *
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    it('プロパティ1: 「追客不要」を含まない全ステータスの売主の filteredTodayCallSellers への包含状態が修正前後で変化しない', () => {
      fc.assert(
        fc.property(
          fc.array(normalSellerBaseArb, { minLength: 0, maxLength: 20 }),
          (sellersBase) => {
            // 一意なIDを付与
            const sellers = sellersBase.map((s, i) => ({ ...s, id: `seller-${i}` }));

            // 前提条件: 全ての売主が「追客不要」を含まないことを確認
            sellers.forEach(s => {
              const status = s.status || '';
              expect(status.includes('追客不要')).toBe(false);
            });

            // 修正前の JS フィルタ（バグあり）
            const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(sellers);
            // 修正後の JS フィルタ（修正済み）
            const filteredFixed = applyFilteredTodayCallSellers_FIXED(sellers);

            // 保全: 「追客不要」を含まない売主の包含状態は修正前後で変化しない
            expect(filteredBuggy.length).toBe(filteredFixed.length);

            // 各売主の包含状態が同一であることを確認
            const buggyIds = filteredBuggy.map((s: any) => s.id).sort();
            const fixedIds = filteredFixed.map((s: any) => s.id).sort();
            expect(buggyIds).toEqual(fixedIds);
          }
        ),
        { numRuns: 200 }
      );
    });

    /**
     * プロパティ2: 「追客不要」を含まない売主は、visit_assignee が空の場合に
     * 修正前後ともに filteredTodayCallSellers に含まれる
     *
     * **Validates: Requirements 3.1**
     */
    it('プロパティ2: 「追客不要」を含まない売主で visit_assignee が空の場合、修正前後ともに filteredTodayCallSellers に含まれる', () => {
      fc.assert(
        fc.property(
          fc.record({
            status: normalStatusArb,
            visit_assignee: fc.oneof(
              fc.constant(null),
              fc.constant(''),
              fc.constant('外す')
            ),
            next_call_date: fc.constant(TODAY),
            phone_contact_person: fc.constant(null),
            preferred_contact_time: fc.constant(null),
            contact_method: fc.constant(null),
            unreachable_status: fc.constant(null),
            confidence_level: fc.constant(null),
            inquiry_date: fc.constant('2026-02-01'),
            pinrich_status: fc.constant(null),
          }),
          fc.nat(),
          (sellerBase, idx) => {
            const seller = { ...sellerBase, id: `seller-${idx}` };

            // 前提条件: 「追客不要」を含まないことを確認
            const status = seller.status || '';
            expect(status.includes('追客不要')).toBe(false);

            const filteredBuggy = applyFilteredTodayCallSellers_BUGGY([seller]);
            const filteredFixed = applyFilteredTodayCallSellers_FIXED([seller]);

            // 保全: visit_assignee が空の通常ステータス売主は修正前後ともに含まれる
            expect(filteredBuggy.length).toBe(1);
            expect(filteredFixed.length).toBe(1);
            expect(filteredBuggy[0].id).toBe(seller.id);
            expect(filteredFixed[0].id).toBe(seller.id);
          }
        ),
        { numRuns: 200 }
      );
    });

    /**
     * プロパティ3: 「追客不要」を含まない売主は、visit_assignee がある場合に
     * 修正前後ともに filteredTodayCallSellers に含まれない
     *
     * **Validates: Requirements 3.1**
     */
    it('プロパティ3: 「追客不要」を含まない売主で visit_assignee がある場合、修正前後ともに filteredTodayCallSellers に含まれない', () => {
      fc.assert(
        fc.property(
          fc.record({
            status: normalStatusArb,
            visit_assignee: fc.constantFrom('Y', 'I', '久', 'K'),
            next_call_date: fc.constant(TODAY),
            phone_contact_person: fc.constant(null),
            preferred_contact_time: fc.constant(null),
            contact_method: fc.constant(null),
            unreachable_status: fc.constant(null),
            confidence_level: fc.constant(null),
            inquiry_date: fc.constant('2026-02-01'),
            pinrich_status: fc.constant(null),
          }),
          fc.nat(),
          (sellerBase, idx) => {
            const seller = { ...sellerBase, id: `seller-${idx}` };

            // 前提条件: 「追客不要」を含まないことを確認
            const status = seller.status || '';
            expect(status.includes('追客不要')).toBe(false);

            const filteredBuggy = applyFilteredTodayCallSellers_BUGGY([seller]);
            const filteredFixed = applyFilteredTodayCallSellers_FIXED([seller]);

            // 保全: visit_assignee がある通常ステータス売主は修正前後ともに含まれない
            expect(filteredBuggy.length).toBe(0);
            expect(filteredFixed.length).toBe(0);
          }
        ),
        { numRuns: 200 }
      );
    });

    /**
     * プロパティ4: 「追客不要」を含まない売主と「追客不要」を含む売主が混在する場合、
     * 「追客不要」を含まない売主の包含状態は修正前後で変化しない
     *
     * **Validates: Requirements 3.1, 3.2, 3.3**
     */
    it('プロパティ4: 「追客不要」を含まない売主と「追客不要」を含む売主が混在する場合、通常ステータス売主の包含状態は変化しない', () => {
      fc.assert(
        fc.property(
          // 通常ステータス売主: 一意なIDを持つ（prefix "normal-" + index）
          fc.array(
            fc.record({
              status: normalStatusArb,
              visit_assignee: fc.oneof(
                fc.constant(null),
                fc.constant(''),
                fc.constant('外す'),
                fc.constantFrom('Y', 'I', '久', 'K')
              ),
              next_call_date: fc.constant(TODAY),
              phone_contact_person: fc.oneof(fc.constant(null), fc.constantFrom('Y', 'I', '')),
              preferred_contact_time: fc.oneof(fc.constant(null), fc.constantFrom('午前中', '午後', '')),
              contact_method: fc.oneof(fc.constant(null), fc.constantFrom('Eメール', '電話', '')),
              unreachable_status: fc.oneof(fc.constant(null), fc.constantFrom('不通', '')),
              confidence_level: fc.oneof(fc.constant(null), fc.constantFrom('高', '中', '低', '')),
              inquiry_date: fc.constant('2026-02-01'),
              pinrich_status: fc.oneof(fc.constant(null), fc.constantFrom('済', '未', '')),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          // 追客不要売主: 一意なIDを持つ（prefix "fuyo-" + index）
          fc.array(
            fc.record({
              status: fc.constantFrom('追客不要', '除外済追客不要'),
              visit_assignee: fc.constant(null),
              next_call_date: fc.constant(TODAY),
              phone_contact_person: fc.constant(null),
              preferred_contact_time: fc.constant(null),
              contact_method: fc.constant(null),
              unreachable_status: fc.constant(null),
              confidence_level: fc.constant(null),
              inquiry_date: fc.constant('2026-02-01'),
              pinrich_status: fc.constant(null),
            }),
            { minLength: 0, maxLength: 5 }
          ),
          (normalSellersBase, fuyoSellersBase) => {
            // 一意なIDを付与（IDの衝突を防ぐ）
            const normalSellers = normalSellersBase.map((s, i) => ({ ...s, id: `normal-${i}` }));
            const fuyoSellers = fuyoSellersBase.map((s, i) => ({ ...s, id: `fuyo-${i}` }));

            // 全売主を混在させる
            const allSellers = [...normalSellers, ...fuyoSellers];

            // 修正前の JS フィルタ（バグあり）
            const filteredBuggy = applyFilteredTodayCallSellers_BUGGY(allSellers);
            // 修正後の JS フィルタ（修正済み）
            const filteredFixed = applyFilteredTodayCallSellers_FIXED(allSellers);

            // 通常ステータス売主のIDセット
            const normalSellerIds = new Set(normalSellers.map(s => s.id));

            // 通常ステータス売主の包含状態が修正前後で変化しないことを確認
            const buggyNormalIds = filteredBuggy
              .filter((s: any) => normalSellerIds.has(s.id))
              .map((s: any) => s.id)
              .sort();
            const fixedNormalIds = filteredFixed
              .filter((s: any) => normalSellerIds.has(s.id))
              .map((s: any) => s.id)
              .sort();

            expect(buggyNormalIds).toEqual(fixedNormalIds);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
