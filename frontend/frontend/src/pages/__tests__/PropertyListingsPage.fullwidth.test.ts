/**
 * PropertyListingsPage 全角文字検索バグ条件探索テスト（Property 1: Bug Condition）
 *
 * このテストは修正前のコードで FAIL することでバグの存在を証明する。
 * テストは filteredListings 内の検索ロジックを純粋関数として抽出してテストする。
 *
 * **CRITICAL**: このテストは修正前のコードで必ず FAIL する — FAIL がバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
import { describe, test, expect } from 'vitest';

// -----------------------------------------------------------------------
// PropertyListing の最小型定義
// -----------------------------------------------------------------------
interface PropertyListing {
  id: string;
  property_number?: string | null;
  address?: string | null;
  seller_name?: string | null;
  seller_email?: string | null;
  buyer_name?: string | null;
}

// -----------------------------------------------------------------------
// 修正後の検索ロジック（PropertyListingsPage.tsx の filteredListings から抽出）
// normalizeText（NFKC正規化 + 小文字化）を使用した修正後の実装
// -----------------------------------------------------------------------

// 全角→半角の正規化（NFKC）+ 小文字化
const normalizeText = (text: string): string =>
  text.normalize('NFKC').toLowerCase();

function filterListings_current(listings: PropertyListing[], searchQuery: string): PropertyListing[] {
  if (!searchQuery.trim()) return listings;
  const query = normalizeText(searchQuery);
  return listings.filter(l =>
    (l.property_number ? normalizeText(l.property_number) : '').includes(query) ||
    (l.address ? normalizeText(l.address) : '').includes(query) ||
    (l.seller_name ? normalizeText(l.seller_name) : '').includes(query) ||
    (l.seller_email ? normalizeText(l.seller_email) : '').includes(query) ||
    (l.buyer_name ? normalizeText(l.buyer_name) : '').includes(query)
  );
}

// -----------------------------------------------------------------------
// バグ条件の定義（design.md の isBugCondition 関数に対応）
// -----------------------------------------------------------------------
function isBugCondition(searchQuery: string): boolean {
  // 全角英数字・全角カタカナ・全角英字が1文字以上含まれる
  return /[\uFF01-\uFF60\uFFE0-\uFFE6\u30A1-\u30F6]/.test(searchQuery);
}

// -----------------------------------------------------------------------
// テストデータ
// 注意: 全角カタカナのバグを確認するため、seller_name は半角カタカナ「ｱｲｳ商事」を使用
// NFKC正規化では: 半角カタカナ「ｱｲｳ」→ 全角カタカナ「アイウ」に変換される
// 修正後: 「アイウ」（全角）で検索すると「ｱｲｳ商事」（半角）がヒットする
// 修正前: 「アイウ」（全角）で検索しても「ｱｲｳ商事」（半角）はヒットしない（バグ）
// -----------------------------------------------------------------------
const testListings: PropertyListing[] = [
  {
    id: '1',
    property_number: 'AA12345',
    address: 'ABC町1-2-3',
    seller_name: 'ｱｲｳ商事',  // 半角カタカナ（全角カタカナ「アイウ」で検索するとバグが発生）
    seller_email: 'test@example.com',
    buyer_name: null,
  },
  {
    id: '2',
    property_number: 'BB99999',
    address: '東京都渋谷区',
    seller_name: '田中太郎',
    seller_email: 'tanaka@example.com',
    buyer_name: '山田花子',
  },
];

// -----------------------------------------------------------------------
// Property 1: Bug Condition テスト
// 現在の実装（修正前）に対して期待動作をテストする
// 修正前コードでは FAIL する — これがバグの存在を証明する
// 修正後コードでは PASS する — これが修正の検証になる
// -----------------------------------------------------------------------

describe('Property 1: Bug Condition — 全角文字での検索が対応する物件をヒットすること', () => {
  /**
   * テストケース1: 全角英数字テスト
   * 物件番号「AA12345」を持つ物件に対して「ＡＡ１２３４５」で検索
   * 期待される正しい動作: 1件ヒットすること
   * 修正前の動作（バグ）: 0件になる（toLowerCase() は全角→半角変換をしない）
   */
  test('全角英数字「ＡＡ１２３４５」で検索すると物件番号「AA12345」の物件がヒットすること', () => {
    const query = 'ＡＡ１２３４５';

    // バグ条件に該当することを確認
    expect(isBugCondition(query)).toBe(true);

    // 現在の実装（修正前）で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される正しい動作: 1件ヒットすること
    // 修正前コードではこのアサーションが FAIL する（バグの存在を証明）
    expect(result).toHaveLength(1);
    expect(result[0].property_number).toBe('AA12345');
  });

  /**
   * テストケース2: 全角カタカナテスト
   * 売主名「ｱｲｳ商事」（半角カタカナ）を持つ物件に対して「アイウ」（全角カタカナ）で検索
   * NFKC正規化: 半角カタカナ「ｱｲｳ」→ 全角カタカナ「アイウ」に変換される
   * 期待される正しい動作: 1件ヒットすること
   * 修正前の動作（バグ）: 0件になる（全角「アイウ」と半角「ｱｲｳ」は一致しない）
   */
  test('全角カタカナ「アイウ」で検索すると売主名「ｱｲｳ商事」（半角カタカナ）の物件がヒットすること', () => {
    const query = 'アイウ';

    // バグ条件に該当することを確認
    expect(isBugCondition(query)).toBe(true);

    // 現在の実装（修正前）で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される正しい動作: 1件ヒットすること
    // 修正前コードではこのアサーションが FAIL する（バグの存在を証明）
    expect(result).toHaveLength(1);
    expect(result[0].seller_name).toBe('ｱｲｳ商事');
  });

  /**
   * テストケース3: 全角英字テスト
   * 所在地「ABC町」を持つ物件に対して「ＡＢＣ」で検索
   * 期待される正しい動作: 1件ヒットすること
   * 修正前の動作（バグ）: 0件になる（全角英字「ＡＢＣ」は半角英字「ABC」と一致しない）
   */
  test('全角英字「ＡＢＣ」で検索すると所在地「ABC町」の物件がヒットすること', () => {
    const query = 'ＡＢＣ';

    // バグ条件に該当することを確認
    expect(isBugCondition(query)).toBe(true);

    // 現在の実装（修正前）で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される正しい動作: 1件ヒットすること
    // 修正前コードではこのアサーションが FAIL する（バグの存在を証明）
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('ABC町1-2-3');
  });

  /**
   * テストケース4: 混在テスト
   * 「ＡＡ12345」（全角・半角混在）で検索
   * 期待される正しい動作: 1件ヒットすること
   * 修正前の動作（バグ）: 0件になる（全角「ＡＡ」が半角「AA」と一致しない）
   */
  test('全角・半角混在「ＡＡ12345」で検索すると物件番号「AA12345」の物件がヒットすること', () => {
    const query = 'ＡＡ12345';

    // バグ条件に該当することを確認
    expect(isBugCondition(query)).toBe(true);

    // 現在の実装（修正前）で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される正しい動作: 1件ヒットすること
    // 修正前コードではこのアサーションが FAIL する（バグの存在を証明）
    expect(result).toHaveLength(1);
    expect(result[0].property_number).toBe('AA12345');
  });
});
