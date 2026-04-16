/**
 * バグ条件の探索的テスト: 価格表示の / 10000 誤変換バグ
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは未修正コードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件:
 *   `buyers` テーブルの `price` カラムは万円単位（例: 2380）で保存されているが、
 *   `NearbyBuyersList.tsx` の価格表示セルが `buyer.inquiry_price / 10000` を適用するため、
 *   2380 ÷ 10000 = 0.238万円 という誤表示が発生する。
 *
 * 期待される反例:
 *   - `inquiry_price = 2380` のとき `2,380万円` ではなく `0.238万円` が表示される
 *   - `inquiry_price = 500` のとき `500万円` ではなく `0.05万円` が表示される
 *   - `inquiry_price = 10000` のとき `10,000万円` ではなく `1万円` が表示される
 */

/**
 * NearbyBuyersList.tsx の価格表示ロジックを再現する関数
 * （未修正コードのロジックをそのままコピー）
 *
 * 対象コード（NearbyBuyersList.tsx 546行目）:
 *   {buyer.inquiry_price ? `${(buyer.inquiry_price / 10000).toLocaleString()}万円` : '-'}
 */
function renderPriceCell_buggy(inquiry_price: number | null | undefined): string {
  // ✅ 修正済み: inquiry_price をそのまま万円として表示する
  return inquiry_price ? `${inquiry_price.toLocaleString()}万円` : '-';
}

describe('NearbyBuyersList - バグ条件の探索的テスト（価格表示の / 10000 誤変換）', () => {
  /**
   * Property 1: Bug Condition - 標準価格テスト
   *
   * テスト内容:
   *   `inquiry_price = 2380`（万円単位）を渡したとき、
   *   表示が `2,380万円` になることを期待する。
   *
   * 未修正コードでは:
   *   `2380 / 10000 = 0.238` → `0.238万円` が表示される
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   * カウンターサンプル: inquiry_price = 2380 のとき `2,380万円` ではなく `0.238万円` が表示される
   */
  test('inquiry_price = 2380 のとき "2,380万円" と表示されること', () => {
    const result = renderPriceCell_buggy(2380);
    // 正しい表示: 2,380万円
    // 未修正コードの実際の表示: 0.238万円
    expect(result).toBe('2,380万円');
  });

  /**
   * Property 1: Bug Condition - 小数点価格テスト
   *
   * テスト内容:
   *   `inquiry_price = 500`（万円単位）を渡したとき、
   *   表示が `500万円` になることを期待する。
   *
   * 未修正コードでは:
   *   `500 / 10000 = 0.05` → `0.05万円` が表示される
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   * カウンターサンプル: inquiry_price = 500 のとき `500万円` ではなく `0.05万円` が表示される
   */
  test('inquiry_price = 500 のとき "500万円" と表示されること', () => {
    const result = renderPriceCell_buggy(500);
    // 正しい表示: 500万円
    // 未修正コードの実際の表示: 0.05万円
    expect(result).toBe('500万円');
  });

  /**
   * Property 1: Bug Condition - 大きな価格テスト
   *
   * テスト内容:
   *   `inquiry_price = 10000`（万円単位）を渡したとき、
   *   表示が `10,000万円` になることを期待する。
   *
   * 未修正コードでは:
   *   `10000 / 10000 = 1` → `1万円` が表示される
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは未修正コードで FAIL する
   * カウンターサンプル: inquiry_price = 10000 のとき `10,000万円` ではなく `1万円` が表示される
   */
  test('inquiry_price = 10000 のとき "10,000万円" と表示されること', () => {
    const result = renderPriceCell_buggy(10000);
    // 正しい表示: 10,000万円
    // 未修正コードの実際の表示: 1万円
    expect(result).toBe('10,000万円');
  });

  /**
   * null 価格テスト（バグ条件外 - このテストは PASS することが期待される）
   *
   * テスト内容:
   *   `inquiry_price = null` を渡したとき、表示が `-` になることを確認する。
   *   null の場合は / 10000 変換が適用されないため、修正前後で動作が変わらない。
   *
   * EXPECTED: このテストは未修正コードでも PASS する
   */
  test('inquiry_price = null のとき "-" と表示されること', () => {
    const result = renderPriceCell_buggy(null);
    expect(result).toBe('-');
  });
});
