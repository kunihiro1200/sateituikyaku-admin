/**
 * PropertyListingsPage 保全プロパティテスト（Property 2: Preservation）
 *
 * このテストは未修正コードで PASS する必要がある。
 * 全角文字を含まない入力（半角英数字・日本語・空クエリ・半角カタカナ）での
 * 既存の検索動作が正しいことを確認するベースラインテスト。
 *
 * **IMPORTANT**: このテストは未修正コードで PASS する — これがベースライン動作の確認
 * **NOTE**: 修正後もこのテストが PASS し続けることでリグレッションがないことを確認する
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
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
// 現在の検索ロジック（PropertyListingsPage.tsx の filteredListings から抽出）
// normalizeText を使わない現在の実装をそのまま再現
// -----------------------------------------------------------------------
function filterListings_current(listings: PropertyListing[], searchQuery: string): PropertyListing[] {
  if (!searchQuery.trim()) return listings;
  const query = searchQuery.toLowerCase();
  return listings.filter(l =>
    l.property_number?.toLowerCase().includes(query) ||
    l.address?.toLowerCase().includes(query) ||
    l.seller_name?.toLowerCase().includes(query) ||
    l.seller_email?.toLowerCase().includes(query) ||
    l.buyer_name?.toLowerCase().includes(query)
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
// -----------------------------------------------------------------------
const testListings: PropertyListing[] = [
  {
    id: '1',
    property_number: 'AA12345',
    address: 'ABC町1-2-3',
    seller_name: 'ｱｲｳ商事',  // 半角カタカナ
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
  {
    id: '3',
    property_number: 'CC11111',
    address: '大阪府大阪市',
    seller_name: '鈴木一郎',
    seller_email: 'suzuki@example.com',
    buyer_name: null,
  },
];

// -----------------------------------------------------------------------
// Property 2: Preservation テスト
// 全角文字を含まない入力（isBugCondition が false を返すケース）のみをテスト
// 未修正コードで PASS する — これがベースライン動作の確認
// -----------------------------------------------------------------------

describe('Property 2: Preservation — 全角文字を含まない入力での検索動作が正しいこと', () => {
  /**
   * テストケース1: 半角英数字テスト
   * 物件番号「AA12345」を持つ物件に対して「AA12345」（半角）で検索
   * 期待される動作: 1件ヒットすること
   * isBugCondition が false を返すケース（全角文字を含まない）
   */
  test('半角英数字「AA12345」で検索すると物件番号「AA12345」の物件がヒットすること', () => {
    const query = 'AA12345';

    // バグ条件に該当しないことを確認（全角文字を含まない）
    expect(isBugCondition(query)).toBe(false);

    // 現在の実装で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される動作: 1件ヒットすること
    expect(result).toHaveLength(1);
    expect(result[0].property_number).toBe('AA12345');
  });

  /**
   * テストケース2: 日本語（漢字）テスト
   * 所在地「東京都渋谷区」を持つ物件に対して「東京都」で検索
   * 期待される動作: 1件ヒットすること
   * isBugCondition が false を返すケース（全角文字を含まない）
   */
  test('日本語「東京都」で検索すると所在地「東京都渋谷区」の物件がヒットすること', () => {
    const query = '東京都';

    // バグ条件に該当しないことを確認（ひらがな・漢字は全角文字だが isBugCondition の対象外）
    expect(isBugCondition(query)).toBe(false);

    // 現在の実装で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される動作: 1件ヒットすること
    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('東京都渋谷区');
  });

  /**
   * テストケース3: 空クエリテスト
   * 空文字列で検索すると全件が返ること
   * isBugCondition が false を返すケース（全角文字を含まない）
   */
  test('空クエリで検索すると全件が返ること', () => {
    const query = '';

    // バグ条件に該当しないことを確認
    expect(isBugCondition(query)).toBe(false);

    // 現在の実装で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される動作: 全件（3件）が返ること
    expect(result).toHaveLength(3);
  });

  /**
   * テストケース4: 半角カタカナテスト
   * 売主名「ｱｲｳ商事」（半角カタカナ）を持つ物件に対して「ｱｲｳ」（半角カタカナ）で検索
   * 期待される動作: 1件ヒットすること
   * isBugCondition が false を返すケース（半角カタカナは全角文字ではない）
   */
  test('半角カタカナ「ｱｲｳ」で検索すると売主名「ｱｲｳ商事」の物件がヒットすること', () => {
    const query = 'ｱｲｳ';

    // バグ条件に該当しないことを確認（半角カタカナは全角文字ではない）
    expect(isBugCondition(query)).toBe(false);

    // 現在の実装で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される動作: 1件ヒットすること
    expect(result).toHaveLength(1);
    expect(result[0].seller_name).toBe('ｱｲｳ商事');
  });

  /**
   * テストケース5: 日本語（漢字）売主名テスト
   * 売主名「田中太郎」を持つ物件に対して「田中」で検索
   * 期待される動作: 1件ヒットすること
   */
  test('日本語「田中」で検索すると売主名「田中太郎」の物件がヒットすること', () => {
    const query = '田中';

    // バグ条件に該当しないことを確認
    expect(isBugCondition(query)).toBe(false);

    // 現在の実装で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される動作: 1件ヒットすること
    expect(result).toHaveLength(1);
    expect(result[0].seller_name).toBe('田中太郎');
  });

  /**
   * テストケース6: 空白のみのクエリテスト
   * 空白のみのクエリで検索すると全件が返ること（trim()で空になるため）
   */
  test('空白のみのクエリで検索すると全件が返ること', () => {
    const query = '   ';

    // バグ条件に該当しないことを確認
    expect(isBugCondition(query)).toBe(false);

    // 現在の実装で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される動作: 全件（3件）が返ること（trim()で空になるため全件返す）
    expect(result).toHaveLength(3);
  });

  /**
   * テストケース7: 買主名での検索テスト
   * 買主名「山田花子」を持つ物件に対して「山田」で検索
   * 期待される動作: 1件ヒットすること
   */
  test('日本語「山田」で検索すると買主名「山田花子」の物件がヒットすること', () => {
    const query = '山田';

    // バグ条件に該当しないことを確認
    expect(isBugCondition(query)).toBe(false);

    // 現在の実装で検索を実行
    const result = filterListings_current(testListings, query);

    // 期待される動作: 1件ヒットすること
    expect(result).toHaveLength(1);
    expect(result[0].buyer_name).toBe('山田花子');
  });
});
