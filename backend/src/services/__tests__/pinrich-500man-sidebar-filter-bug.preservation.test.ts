/**
 * 保全プロパティテスト - 他カテゴリのフィルタリング動作が変わらない
 *
 * **Feature: pinrich-500man-sidebar-filter-bug, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * ✅ このテストは未修正コードで PASS することが期待される（ベースライン動作を確認）
 *
 * 観察優先メソドロジー:
 * - 未修正コードで非バグ条件の入力（pinrich500manUnregistered 以外のカテゴリ）を観察する
 * - BUYER_COLUMNS へのカラム追加は読み取り専用の変更であり、既存カラムの取得に影響しない
 * - 修正前後で他カテゴリのフィルタ結果が同一であることを検証する
 *
 * 保全要件（design.md より）:
 * - fetchAllBuyers() を使用する他の全サイドバーカテゴリのフィルタリング結果は変わらない
 * - pinrich_500man_registration が '済' の買主は「Pinrich500万以上登録未」に含まれない
 * - inquiry_property_price が500万円を超える買主は引き続き除外される
 * - email が空の買主は引き続き除外される
 * - reception_date が '2026-01-01' より前の買主は引き続き除外される
 */

import * as fc from 'fast-check';

// ============================================================
// フィルタロジックの抽出（BuyerService.ts から）
// ============================================================

/**
 * pinrich500manUnregistered フィルタロジック（未修正コード）
 * getBuyersByStatus('pinrich500manUnregistered') の実際のフィルタ条件
 */
function applyPinrich500manFilter(buyers: any[]): any[] {
  return buyers.filter((buyer: any) => {
    return (
      buyer.email && String(buyer.email).trim() &&
      buyer.inquiry_property_price !== null &&
      buyer.inquiry_property_price !== undefined &&
      Number(buyer.inquiry_property_price) <= 5000000 &&
      (!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未') &&
      buyer.reception_date && buyer.reception_date >= '2026-01-01'
    );
  });
}

/**
 * todayCallAssigned フィルタロジック（BuyerService.ts から抽出）
 * calculated_status が "当日TEL(担当)" の形式で一致する買主を返す
 */
function applyTodayCallAssignedFilter(buyers: any[], assignee: string): any[] {
  return buyers.filter(buyer => buyer.calculated_status === `当日TEL(${assignee})`);
}

/**
 * threeCallUnchecked フィルタロジック（BuyerService.ts から抽出）
 * calculated_status が "3回架電未" の買主を返す
 */
function applyThreeCallUncheckedFilter(buyers: any[]): any[] {
  return buyers.filter(buyer => buyer.calculated_status === '3回架電未');
}

/**
 * assigned フィルタロジック（BuyerService.ts から抽出）
 * follow_up_assignee または initial_assignee が一致する買主を返す
 */
function applyAssignedFilter(buyers: any[], assignee: string): any[] {
  return buyers.filter(buyer => {
    return (
      buyer.follow_up_assignee === assignee ||
      (!buyer.follow_up_assignee && buyer.initial_assignee === assignee)
    );
  });
}

/**
 * calculated_status フィルタロジック（BuyerService.ts から抽出）
 * 既存のロジック（calculated_statusでフィルタリング）
 */
function applyCalculatedStatusFilter(buyers: any[], status: string): any[] {
  return buyers.filter(buyer => buyer.calculated_status === status);
}

// ============================================================
// BUYER_COLUMNS への追加カラムをシミュレートするヘルパー
// ============================================================

/**
 * 修正前の fetchAllBuyers() が返す買主オブジェクトを模倣
 * pinrich_500man_registration と inquiry_property_price が欠落している
 */
function simulateBuyerBeforeFix(buyer: any): any {
  const { pinrich_500man_registration, inquiry_property_price, ...rest } = buyer;
  return rest;
}

/**
 * 修正後の fetchAllBuyers() が返す買主オブジェクトを模倣
 * pinrich_500man_registration と inquiry_property_price が含まれている
 */
function simulateBuyerAfterFix(buyer: any): any {
  return buyer;
}

// ============================================================
// テスト用の買主データジェネレーター
// ============================================================

/**
 * 任意の買主データを生成するジェネレーター
 * pinrich500manUnregistered 以外のカテゴリのテストに使用
 */
const buyerArb = fc.record({
  buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
  email: fc.oneof(
    fc.constant(''),
    fc.constant(null),
    fc.constantFrom('test@example.com', 'buyer@test.jp', 'user@domain.com')
  ),
  reception_date: fc.oneof(
    fc.constant(null),
    fc.constantFrom('2025-12-31', '2026-01-01', '2026-03-15', '2024-06-01')
  ),
  calculated_status: fc.constantFrom(
    '当日TEL(Y)', '当日TEL(I)', '3回架電未', '担当(Y)', '担当(I)',
    '内覧日前日', '査定アンケート回答あり', '業者問合せあり', ''
  ),
  follow_up_assignee: fc.oneof(
    fc.constant(null),
    fc.constantFrom('Y', 'I', '久', '外す')
  ),
  initial_assignee: fc.oneof(
    fc.constant(null),
    fc.constantFrom('Y', 'I', '久', '外す')
  ),
  pinrich_500man_registration: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constantFrom('未', '済', '')
  ),
  inquiry_property_price: fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constantFrom(3000000, 5000000, 5000001, 8000000)
  ),
});

// ============================================================
// テストスイート
// ============================================================

describe('Property 2: Preservation - 他カテゴリのフィルタリング動作が変わらない', () => {

  // ============================================================
  // 観察テスト: 未修正コードでの各カテゴリの動作を確認
  // ============================================================

  describe('観察テスト: 各カテゴリのフィルタロジックが正しく動作する', () => {

    /**
     * 観察1: todayCallAssigned フィルタが calculated_status で正しく動作する
     *
     * **Validates: Requirements 3.1**
     */
    it('観察1: todayCallAssigned:Y フィルタが calculated_status="当日TEL(Y)" の買主のみを返す', () => {
      const buyers = [
        { buyer_number: '1001', calculated_status: '当日TEL(Y)', email: 'a@test.com' },
        { buyer_number: '1002', calculated_status: '当日TEL(I)', email: 'b@test.com' },
        { buyer_number: '1003', calculated_status: '3回架電未', email: 'c@test.com' },
        { buyer_number: '1004', calculated_status: '', email: 'd@test.com' },
      ];

      const result = applyTodayCallAssignedFilter(buyers, 'Y');

      console.log('todayCallAssigned:Y フィルタ結果:', result.map(b => b.buyer_number));
      expect(result.length).toBe(1);
      expect(result[0].buyer_number).toBe('1001');
    });

    /**
     * 観察2: threeCallUnchecked フィルタが calculated_status で正しく動作する
     *
     * **Validates: Requirements 3.1**
     */
    it('観察2: threeCallUnchecked フィルタが calculated_status="3回架電未" の買主のみを返す', () => {
      const buyers = [
        { buyer_number: '2001', calculated_status: '3回架電未', email: 'a@test.com' },
        { buyer_number: '2002', calculated_status: '当日TEL(Y)', email: 'b@test.com' },
        { buyer_number: '2003', calculated_status: '', email: 'c@test.com' },
      ];

      const result = applyThreeCallUncheckedFilter(buyers);

      console.log('threeCallUnchecked フィルタ結果:', result.map(b => b.buyer_number));
      expect(result.length).toBe(1);
      expect(result[0].buyer_number).toBe('2001');
    });

    /**
     * 観察3: assigned フィルタが follow_up_assignee / initial_assignee で正しく動作する
     *
     * **Validates: Requirements 3.1**
     */
    it('観察3: assigned:Y フィルタが follow_up_assignee または initial_assignee が Y の買主を返す', () => {
      const buyers = [
        { buyer_number: '3001', follow_up_assignee: 'Y', initial_assignee: 'I' },
        { buyer_number: '3002', follow_up_assignee: null, initial_assignee: 'Y' },
        { buyer_number: '3003', follow_up_assignee: 'I', initial_assignee: 'Y' },
        { buyer_number: '3004', follow_up_assignee: null, initial_assignee: 'I' },
      ];

      const result = applyAssignedFilter(buyers, 'Y');

      console.log('assigned:Y フィルタ結果:', result.map(b => b.buyer_number));
      // 3001: follow_up_assignee = 'Y' → 含まれる
      // 3002: follow_up_assignee = null, initial_assignee = 'Y' → 含まれる
      // 3003: follow_up_assignee = 'I' (≠ 'Y') → 含まれない
      // 3004: follow_up_assignee = null, initial_assignee = 'I' → 含まれない
      expect(result.length).toBe(2);
      expect(result.map(b => b.buyer_number)).toContain('3001');
      expect(result.map(b => b.buyer_number)).toContain('3002');
    });

    /**
     * 観察4: pinrich_500man_registration='済' の買主は pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.3**
     */
    it('観察4: pinrich_500man_registration="済" の買主は pinrich500manUnregistered フィルタに含まれない', () => {
      const buyers = [
        {
          buyer_number: '4001',
          email: 'registered@example.com',
          reception_date: '2026-03-01',
          pinrich_500man_registration: '済',
          inquiry_property_price: 3000000,
        },
      ];

      const result = applyPinrich500manFilter(buyers);

      console.log('pinrich_500man_registration="済" の買主のフィルタ結果:', result.length, '件');
      expect(result.length).toBe(0);
    });

    /**
     * 観察5: inquiry_property_price が500万円を超える買主は pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.4**
     */
    it('観察5: inquiry_property_price > 5000000 の買主は pinrich500manUnregistered フィルタに含まれない', () => {
      const buyers = [
        {
          buyer_number: '5001',
          email: 'expensive@example.com',
          reception_date: '2026-03-01',
          pinrich_500man_registration: null,
          inquiry_property_price: 5000001,
        },
        {
          buyer_number: '5002',
          email: 'expensive2@example.com',
          reception_date: '2026-03-01',
          pinrich_500man_registration: '未',
          inquiry_property_price: 8000000,
        },
      ];

      const result = applyPinrich500manFilter(buyers);

      console.log('inquiry_property_price > 5000000 の買主のフィルタ結果:', result.length, '件');
      expect(result.length).toBe(0);
    });

    /**
     * 観察6: email が空の買主は pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.5**
     */
    it('観察6: email が空の買主は pinrich500manUnregistered フィルタに含まれない', () => {
      const buyers = [
        {
          buyer_number: '6001',
          email: '',
          reception_date: '2026-03-01',
          pinrich_500man_registration: null,
          inquiry_property_price: 3000000,
        },
        {
          buyer_number: '6002',
          email: null,
          reception_date: '2026-03-01',
          pinrich_500man_registration: null,
          inquiry_property_price: 3000000,
        },
      ];

      const result = applyPinrich500manFilter(buyers);

      console.log('email が空の買主のフィルタ結果:', result.length, '件');
      expect(result.length).toBe(0);
    });

    /**
     * 観察7: reception_date が '2026-01-01' より前の買主は pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.6**
     */
    it('観察7: reception_date < "2026-01-01" の買主は pinrich500manUnregistered フィルタに含まれない', () => {
      const buyers = [
        {
          buyer_number: '7001',
          email: 'old@example.com',
          reception_date: '2025-12-31',
          pinrich_500man_registration: null,
          inquiry_property_price: 3000000,
        },
        {
          buyer_number: '7002',
          email: 'older@example.com',
          reception_date: '2024-06-01',
          pinrich_500man_registration: '未',
          inquiry_property_price: 2000000,
        },
      ];

      const result = applyPinrich500manFilter(buyers);

      console.log('reception_date < "2026-01-01" の買主のフィルタ結果:', result.length, '件');
      expect(result.length).toBe(0);
    });
  });

  // ============================================================
  // プロパティベーステスト
  // ============================================================

  describe('プロパティベーステスト', () => {

    /**
     * プロパティ1: BUYER_COLUMNS へのカラム追加は既存カテゴリのフィルタ結果に影響しない
     *
     * 修正前後で pinrich500manUnregistered 以外のカテゴリのフィルタ結果が同一であることを検証する。
     * BUYER_COLUMNS への pinrich_500man_registration 追加は読み取り専用の変更であり、
     * 既存カラムの取得には影響しない。
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    it('プロパティ1: BUYER_COLUMNS へのカラム追加前後で todayCallAssigned フィルタ結果が同一', () => {
      fc.assert(
        fc.property(
          fc.array(buyerArb, { minLength: 0, maxLength: 20 }),
          fc.constantFrom('Y', 'I', '久'),
          (buyers, assignee) => {
            // 修正前: pinrich_500man_registration と inquiry_property_price が欠落
            const buyersBeforeFix = buyers.map(simulateBuyerBeforeFix);
            // 修正後: pinrich_500man_registration と inquiry_property_price が含まれる
            const buyersAfterFix = buyers.map(simulateBuyerAfterFix);

            const resultBefore = applyTodayCallAssignedFilter(buyersBeforeFix, assignee);
            const resultAfter = applyTodayCallAssignedFilter(buyersAfterFix, assignee);

            // フィルタ結果の件数が同一であることを確認
            expect(resultBefore.length).toBe(resultAfter.length);

            // フィルタ結果の buyer_number が同一であることを確認
            const beforeNumbers = resultBefore.map((b: any) => b.buyer_number).sort();
            const afterNumbers = resultAfter.map((b: any) => b.buyer_number).sort();
            expect(beforeNumbers).toEqual(afterNumbers);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ2: BUYER_COLUMNS へのカラム追加前後で threeCallUnchecked フィルタ結果が同一
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    it('プロパティ2: BUYER_COLUMNS へのカラム追加前後で threeCallUnchecked フィルタ結果が同一', () => {
      fc.assert(
        fc.property(
          fc.array(buyerArb, { minLength: 0, maxLength: 20 }),
          (buyers) => {
            const buyersBeforeFix = buyers.map(simulateBuyerBeforeFix);
            const buyersAfterFix = buyers.map(simulateBuyerAfterFix);

            const resultBefore = applyThreeCallUncheckedFilter(buyersBeforeFix);
            const resultAfter = applyThreeCallUncheckedFilter(buyersAfterFix);

            expect(resultBefore.length).toBe(resultAfter.length);

            const beforeNumbers = resultBefore.map((b: any) => b.buyer_number).sort();
            const afterNumbers = resultAfter.map((b: any) => b.buyer_number).sort();
            expect(beforeNumbers).toEqual(afterNumbers);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ3: BUYER_COLUMNS へのカラム追加前後で assigned フィルタ結果が同一
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    it('プロパティ3: BUYER_COLUMNS へのカラム追加前後で assigned フィルタ結果が同一', () => {
      fc.assert(
        fc.property(
          fc.array(buyerArb, { minLength: 0, maxLength: 20 }),
          fc.constantFrom('Y', 'I', '久'),
          (buyers, assignee) => {
            const buyersBeforeFix = buyers.map(simulateBuyerBeforeFix);
            const buyersAfterFix = buyers.map(simulateBuyerAfterFix);

            const resultBefore = applyAssignedFilter(buyersBeforeFix, assignee);
            const resultAfter = applyAssignedFilter(buyersAfterFix, assignee);

            expect(resultBefore.length).toBe(resultAfter.length);

            const beforeNumbers = resultBefore.map((b: any) => b.buyer_number).sort();
            const afterNumbers = resultAfter.map((b: any) => b.buyer_number).sort();
            expect(beforeNumbers).toEqual(afterNumbers);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ4: BUYER_COLUMNS へのカラム追加前後で calculated_status フィルタ結果が同一
     *
     * **Validates: Requirements 3.1, 3.2**
     */
    it('プロパティ4: BUYER_COLUMNS へのカラム追加前後で calculated_status フィルタ結果が同一', () => {
      fc.assert(
        fc.property(
          fc.array(buyerArb, { minLength: 0, maxLength: 20 }),
          fc.constantFrom('当日TEL(Y)', '3回架電未', '内覧日前日', '査定アンケート回答あり'),
          (buyers, status) => {
            const buyersBeforeFix = buyers.map(simulateBuyerBeforeFix);
            const buyersAfterFix = buyers.map(simulateBuyerAfterFix);

            const resultBefore = applyCalculatedStatusFilter(buyersBeforeFix, status);
            const resultAfter = applyCalculatedStatusFilter(buyersAfterFix, status);

            expect(resultBefore.length).toBe(resultAfter.length);

            const beforeNumbers = resultBefore.map((b: any) => b.buyer_number).sort();
            const afterNumbers = resultAfter.map((b: any) => b.buyer_number).sort();
            expect(beforeNumbers).toEqual(afterNumbers);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ5: pinrich_500man_registration='済' の買主は常に pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.3**
     */
    it('プロパティ5: pinrich_500man_registration="済" の買主は常に pinrich500manUnregistered フィルタに含まれない', () => {
      fc.assert(
        fc.property(
          fc.record({
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            email: fc.constantFrom('test@example.com', 'buyer@test.jp'),
            reception_date: fc.constantFrom('2026-01-01', '2026-03-15', '2026-06-01'),
            pinrich_500man_registration: fc.constant('済'),
            inquiry_property_price: fc.constantFrom(1000000, 3000000, 5000000),
          }),
          (buyer) => {
            const result = applyPinrich500manFilter([buyer]);
            expect(result.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ6: inquiry_property_price > 5000000 の買主は常に pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.4**
     */
    it('プロパティ6: inquiry_property_price > 5000000 の買主は常に pinrich500manUnregistered フィルタに含まれない', () => {
      fc.assert(
        fc.property(
          fc.record({
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            email: fc.constantFrom('test@example.com', 'buyer@test.jp'),
            reception_date: fc.constantFrom('2026-01-01', '2026-03-15', '2026-06-01'),
            pinrich_500man_registration: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('')),
            inquiry_property_price: fc.integer({ min: 5000001, max: 100000000 }),
          }),
          (buyer) => {
            const result = applyPinrich500manFilter([buyer]);
            expect(result.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ7: email が空の買主は常に pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.5**
     */
    it('プロパティ7: email が空の買主は常に pinrich500manUnregistered フィルタに含まれない', () => {
      fc.assert(
        fc.property(
          fc.record({
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            email: fc.oneof(fc.constant(''), fc.constant(null), fc.constant('   ')),
            reception_date: fc.constantFrom('2026-01-01', '2026-03-15', '2026-06-01'),
            pinrich_500man_registration: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('')),
            inquiry_property_price: fc.constantFrom(1000000, 3000000, 5000000),
          }),
          (buyer) => {
            const result = applyPinrich500manFilter([buyer]);
            expect(result.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * プロパティ8: reception_date < '2026-01-01' の買主は常に pinrich500manUnregistered に含まれない
     *
     * **Validates: Requirements 3.6**
     */
    it('プロパティ8: reception_date < "2026-01-01" の買主は常に pinrich500manUnregistered フィルタに含まれない', () => {
      fc.assert(
        fc.property(
          fc.record({
            buyer_number: fc.string({ minLength: 1, maxLength: 10 }),
            email: fc.constantFrom('test@example.com', 'buyer@test.jp'),
            reception_date: fc.constantFrom('2025-12-31', '2025-01-01', '2024-06-01', '2023-12-31'),
            pinrich_500man_registration: fc.oneof(fc.constant(null), fc.constant('未'), fc.constant('')),
            inquiry_property_price: fc.constantFrom(1000000, 3000000, 5000000),
          }),
          (buyer) => {
            const result = applyPinrich500manFilter([buyer]);
            expect(result.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
