/**
 * 保全プロパティテスト: null/0価格の表示維持
 *
 * **Validates: Requirements 3.1, 3.3**
 *
 * このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）。
 *
 * 保全すべき動作:
 *   - `inquiry_price = null` のとき `-` が表示される
 *   - `inquiry_price = 0` のとき `-` が表示される（falsyとして扱われる）
 *
 * 観察優先メソドロジー:
 *   未修正コードで非バグ条件の入力（inquiry_price が null または 0）の
 *   動作を観察し、これがベースラインとして保全されるべき動作であることを確認する。
 *
 * バグ条件外の入力:
 *   `isBugCondition(X)` は `inquiry_price > 0` の場合のみ true になる。
 *   null と 0 はバグ条件外であり、修正前後で動作が変わらないことを確認する。
 */

import fc from 'fast-check';

/**
 * NearbyBuyersList.tsx の価格表示ロジックを再現する関数
 * （未修正コードのロジックをそのままコピー）
 *
 * 対象コード（NearbyBuyersList.tsx 546行目）:
 *   {buyer.inquiry_price ? `${(buyer.inquiry_price / 10000).toLocaleString()}万円` : '-'}
 */
function renderPriceCell_buggy(inquiry_price: number | null | undefined): string {
  // ❌ バグあり: inquiry_price は既に万円単位なのに / 10000 している
  // ただし null/0 の場合は三項演算子の falsy チェックで '-' が返るため、バグの影響を受けない
  return inquiry_price ? `${(inquiry_price / 10000).toLocaleString()}万円` : '-';
}

describe('NearbyBuyersList - 保全プロパティテスト（null/0価格の表示維持）', () => {
  /**
   * 保全テスト 1: inquiry_price = null のとき "-" が表示されること
   *
   * 観察:
   *   未修正コードで `inquiry_price = null` を渡すと、
   *   三項演算子の falsy チェックにより `-` が返る。
   *   これは修正前後で変わらない動作。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   */
  test('inquiry_price = null のとき "-" と表示されること', () => {
    const result = renderPriceCell_buggy(null);
    expect(result).toBe('-');
  });

  /**
   * 保全テスト 2: inquiry_price = 0 のとき "-" が表示されること
   *
   * 観察:
   *   未修正コードで `inquiry_price = 0` を渡すと、
   *   0 は falsy なので三項演算子により `-` が返る。
   *   これは修正前後で変わらない動作。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   */
  test('inquiry_price = 0 のとき "-" と表示されること', () => {
    const result = renderPriceCell_buggy(0);
    expect(result).toBe('-');
  });

  /**
   * 保全テスト 3: inquiry_price = undefined のとき "-" が表示されること
   *
   * 観察:
   *   undefined も falsy なので三項演算子により `-` が返る。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   */
  test('inquiry_price = undefined のとき "-" と表示されること', () => {
    const result = renderPriceCell_buggy(undefined);
    expect(result).toBe('-');
  });

  /**
   * Property 2: Preservation - プロパティベーステスト
   *
   * **Validates: Requirements 3.1, 3.3**
   *
   * テスト内容:
   *   `inquiry_price` が `null` または `0` の任意の入力に対して、
   *   表示が `-` になることを確認する。
   *
   * fast-check を使用して null/0 の入力を生成し、
   * 未修正コードで常に `-` が返ることを検証する。
   *
   * EXPECTED: このテストは未修正コードで PASS する（ベースライン動作の確認）
   */
  test('Property 2: null または 0 の任意の入力に対して "-" が表示されること', () => {
    // null または 0 を生成するアービトラリ
    const nullOrZeroArbitrary = fc.oneof(
      fc.constant(null),
      fc.constant(0)
    );

    fc.assert(
      fc.property(nullOrZeroArbitrary, (inquiry_price) => {
        const result = renderPriceCell_buggy(inquiry_price);
        return result === '-';
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Preservation - 修正前後で動作が変わらないことの確認
   *
   * **Validates: Requirements 3.1, 3.3**
   *
   * テスト内容:
   *   修正後のコード（/ 10000 を除去）でも、
   *   null/0 の場合は同じく `-` が返ることを確認する。
   *   これにより、修正がリグレッションを引き起こさないことを保証する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   */
  test('Property 2: 修正後コードでも null/0 に対して "-" が表示されること（リグレッション防止）', () => {
    // ✅ 修正後のコード（/ 10000 を除去）
    function renderPriceCell_fixed(inquiry_price: number | null | undefined): string {
      return inquiry_price ? `${inquiry_price.toLocaleString()}万円` : '-';
    }

    // null と 0 に対して修正前後で同じ結果になることを確認
    const testCases: Array<number | null | undefined> = [null, 0, undefined];

    for (const inquiry_price of testCases) {
      const buggyResult = renderPriceCell_buggy(inquiry_price);
      const fixedResult = renderPriceCell_fixed(inquiry_price);
      expect(buggyResult).toBe('-');
      expect(fixedResult).toBe('-');
      // 修正前後で同じ結果
      expect(buggyResult).toBe(fixedResult);
    }
  });

  /**
   * Property 2: Preservation - fast-check による修正前後の等価性確認
   *
   * **Validates: Requirements 3.1, 3.3**
   *
   * テスト内容:
   *   null/0 の任意の入力に対して、修正前後のコードが同じ結果を返すことを確認する。
   *   これにより、修正が null/0 の表示に影響を与えないことをプロパティとして保証する。
   *
   * EXPECTED: このテストは未修正コードで PASS する
   */
  test('Property 2: fast-check - null/0 に対して修正前後のコードが同じ結果を返すこと', () => {
    function renderPriceCell_fixed(inquiry_price: number | null | undefined): string {
      return inquiry_price ? `${inquiry_price.toLocaleString()}万円` : '-';
    }

    const nullOrZeroArbitrary = fc.oneof(
      fc.constant(null as null),
      fc.constant(0 as number)
    );

    fc.assert(
      fc.property(nullOrZeroArbitrary, (inquiry_price) => {
        const buggyResult = renderPriceCell_buggy(inquiry_price);
        const fixedResult = renderPriceCell_fixed(inquiry_price);
        // 修正前後で同じ結果（どちらも '-'）
        return buggyResult === fixedResult && buggyResult === '-';
      }),
      { numRuns: 100 }
    );
  });
});
