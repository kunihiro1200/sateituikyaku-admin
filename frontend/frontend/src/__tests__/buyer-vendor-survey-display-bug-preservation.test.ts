/**
 * 保全プロパティテスト - 買主詳細画面「業者向けアンケート」フィールド表示バグ
 *
 * **Feature: buyer-vendor-survey-display-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * ✅ このテストは未修正コードで PASS することが期待される（保全すべきベースライン動作を確認）
 * 目的: 有効な値（非null・非空文字）を持つ買主データに対して、フィールドが正しく表示されることを確認
 *
 * 保全すべき動作:
 * - vendor_survey = '確認済み' のとき、フロントエンドが「業者向けアンケート」フィールドを表示する
 * - vendor_survey = '済' のとき、フロントエンドが「業者向けアンケート」フィールドを表示する
 * - スプシに「未」が明示的に入力されている場合、DBに「未」が保存され画面に表示される
 * - 有効な値（非null・非空文字）を持つ買主データに対して、フィールドが表示される
 */

import * as fc from 'fast-check';

// ============================================================
// フロントエンドの vendor_survey 表示ロジックを再現
// BuyerDetailPage.tsx の実装に基づく（2260行目付近）
// ============================================================

/**
 * vendor_survey フィールドを非表示にすべきかどうかを判定する
 * BuyerDetailPage.tsx の実装を再現
 */
function shouldHideVendorSurveyField(buyer: { vendor_survey?: string | null }): boolean {
  // 値がない場合は非表示（スプシに入力があった場合のみ表示）
  if (!buyer?.vendor_survey || !String(buyer.vendor_survey).trim()) {
    return true; // 非表示
  }
  return false; // 表示
}

/**
 * vendor_survey フィールドを表示すべきかどうかを判定する（shouldHideの逆）
 */
function shouldShowVendorSurveyField(buyer: { vendor_survey?: string | null }): boolean {
  return !shouldHideVendorSurveyField(buyer);
}

// ============================================================
// テストスイート
// ============================================================

describe('Property 2: Preservation - 有効な値の表示動作の保全', () => {

  // ============================================================
  // テスト1: 具体的な有効値での表示確認
  // ============================================================
  describe('具体的な有効値での表示確認', () => {

    it('テスト1-1: vendor_survey = "確認済み" のとき、フィールドが表示される', () => {
      const buyer = { vendor_survey: '確認済み' };

      const isShown = shouldShowVendorSurveyField(buyer);

      console.log('vendor_survey = "確認済み" のとき表示されるか:', isShown);
      // ✅ 保全: 有効な値があれば表示される
      expect(isShown).toBe(true);
    });

    it('テスト1-2: vendor_survey = "済" のとき、フィールドが表示される', () => {
      const buyer = { vendor_survey: '済' };

      const isShown = shouldShowVendorSurveyField(buyer);

      console.log('vendor_survey = "済" のとき表示されるか:', isShown);
      // ✅ 保全: 有効な値があれば表示される
      expect(isShown).toBe(true);
    });

    it('テスト1-3: スプシに「未」が明示的に入力されている場合、DBに「未」が保存され画面に表示される', () => {
      // スプシに「未」が明示的に入力 → DBに「未」が保存 → 画面に表示される（正常ケース）
      const buyer = { vendor_survey: '未' };

      const isShown = shouldShowVendorSurveyField(buyer);

      console.log('vendor_survey = "未"（明示的入力）のとき表示されるか:', isShown);
      // ✅ 保全: スプシに「未」が明示的に入力された場合は表示される
      // （バグ条件とは異なり、スプシに値が入力されている正常ケース）
      expect(isShown).toBe(true);
    });

    it('テスト1-4: vendor_survey = null のとき、フィールドが非表示になる（既存の正常動作）', () => {
      const buyer = { vendor_survey: null };

      const isShown = shouldShowVendorSurveyField(buyer);

      console.log('vendor_survey = null のとき表示されるか:', isShown);
      // ✅ 保全: null の場合は非表示（既存の正常動作）
      expect(isShown).toBe(false);
    });

    it('テスト1-5: vendor_survey = "" のとき、フィールドが非表示になる（既存の正常動作）', () => {
      const buyer = { vendor_survey: '' };

      const isShown = shouldShowVendorSurveyField(buyer);

      console.log('vendor_survey = "" のとき表示されるか:', isShown);
      // ✅ 保全: 空文字の場合は非表示（既存の正常動作）
      expect(isShown).toBe(false);
    });

    it('テスト1-6: vendor_survey = "  " （空白のみ）のとき、フィールドが非表示になる（既存の正常動作）', () => {
      const buyer = { vendor_survey: '  ' };

      const isShown = shouldShowVendorSurveyField(buyer);

      console.log('vendor_survey = "  " のとき表示されるか:', isShown);
      // ✅ 保全: 空白のみの場合は非表示（既存の正常動作）
      expect(isShown).toBe(false);
    });
  });

  // ============================================================
  // テスト2: プロパティベーステスト
  //          有効な値（非null・非空文字）を持つ買主データに対して、フィールドが表示される
  // ============================================================
  describe('プロパティベーステスト: 有効な値を持つ買主データのフィールド表示', () => {

    /**
     * **Validates: Requirements 3.1, 3.2, 3.3**
     *
     * Property 2: Preservation
     * FOR ALL buyer WHERE vendor_survey is NOT null AND NOT empty string
     * ASSERT shouldShowVendorSurveyField(buyer) = true
     */
    it('PBT: 有効な値（非null・非空文字）を持つ買主データに対して、フィールドが表示される', () => {
      // 有効な値のジェネレーター（非null・非空文字・空白のみでない文字列）
      const validVendorSurveyArb = fc.string({ minLength: 1 }).filter(
        (s) => s.trim().length > 0
      );

      fc.assert(
        fc.property(validVendorSurveyArb, (vendorSurveyValue) => {
          const buyer = { vendor_survey: vendorSurveyValue };

          const isShown = shouldShowVendorSurveyField(buyer);

          // ✅ 保全: 有効な値があれば必ず表示される
          return isShown === true;
        }),
        { numRuns: 100 }
      );
    });

    /**
     * **Validates: Requirements 3.1, 3.2**
     *
     * Property 2: Preservation - 既知の有効値での表示確認
     * 実際に使用される値（'確認済み', '済', '未'）で表示されることを確認
     */
    it('PBT: 実際に使用される有効値（確認済み・済・未）で常にフィールドが表示される', () => {
      const knownValidValues = ['確認済み', '済', '未'];
      const knownValidArb = fc.constantFrom(...knownValidValues);

      fc.assert(
        fc.property(knownValidArb, (vendorSurveyValue) => {
          const buyer = { vendor_survey: vendorSurveyValue };

          const isShown = shouldShowVendorSurveyField(buyer);

          // ✅ 保全: 既知の有効値は必ず表示される
          return isShown === true;
        }),
        { numRuns: 50 }
      );
    });

    /**
     * **Validates: Requirements 3.3**
     *
     * Property 2: Preservation - null/空文字の場合は非表示（既存の正常動作）
     */
    it('PBT: null または空文字の vendor_survey を持つ買主データに対して、フィールドが非表示になる', () => {
      // null または空文字のジェネレーター
      const nullOrEmptyArb = fc.oneof(
        fc.constant(null),
        fc.constant(''),
        fc.constant(undefined),
        // 空白のみの文字列
        fc.string({ maxLength: 10 }).map((s) => s.replace(/[^\s]/g, ' '))
          .filter((s) => s.trim().length === 0 && s.length > 0)
      );

      fc.assert(
        fc.property(nullOrEmptyArb, (vendorSurveyValue) => {
          const buyer = { vendor_survey: vendorSurveyValue as string | null | undefined };

          const isShown = shouldShowVendorSurveyField(buyer);

          // ✅ 保全: null/空文字の場合は非表示（既存の正常動作）
          return isShown === false;
        }),
        { numRuns: 50 }
      );
    });
  });

  // ============================================================
  // テスト3: 表示ロジックの一貫性確認
  // ============================================================
  describe('表示ロジックの一貫性確認', () => {

    it('テスト3-1: shouldShowVendorSurveyField は shouldHideVendorSurveyField の逆であること', () => {
      const testCases = [
        { vendor_survey: '確認済み' },
        { vendor_survey: '済' },
        { vendor_survey: '未' },
        { vendor_survey: null },
        { vendor_survey: '' },
      ];

      for (const buyer of testCases) {
        const isShown = shouldShowVendorSurveyField(buyer);
        const isHidden = shouldHideVendorSurveyField(buyer);

        // ✅ 保全: show と hide は常に逆の関係
        expect(isShown).toBe(!isHidden);
      }
    });

    it('テスト3-2: 有効な値を持つ買主データに対して、表示ロジックが一貫している', () => {
      // 有効な値のジェネレーター
      const validVendorSurveyArb = fc.string({ minLength: 1 }).filter(
        (s) => s.trim().length > 0
      );

      fc.assert(
        fc.property(validVendorSurveyArb, (vendorSurveyValue) => {
          const buyer = { vendor_survey: vendorSurveyValue };

          const isShown = shouldShowVendorSurveyField(buyer);
          const isHidden = shouldHideVendorSurveyField(buyer);

          // ✅ 保全: show と hide は常に逆の関係
          return isShown === !isHidden;
        }),
        { numRuns: 100 }
      );
    });
  });
});
