/**
 * Property Price Reduction Sidebar Fix - バグ条件探索テスト（Property 1: Bug Condition）
 *
 * このテストは「未修正コードでバグを再現する」ためのものです。
 *
 * **重要**: このテストは未修正コードで必ず FAIL する。
 * テストの失敗がバグの存在を証明する。
 * 修正後にこのテストが PASS することで修正を検証する。
 *
 * バグの概要:
 * - `handleSavePrice` が `price_reduction_scheduled_date` を含むデータを保存した後、
 *   `PropertyListingsPage` の `allListings` ステートを即座に更新する仕組みが存在しない。
 * - `confirmation` フィールドには `propertyConfirmationUpdated` カスタムイベントによる
 *   即時更新の仕組みが実装されているが、`price_reduction_scheduled_date` には同様の仕組みがない。
 *
 * バグ条件 (isBugCondition):
 * - `price_reduction_scheduled_date` が null に変更されて保存されたにもかかわらず、
 *   `PropertyListingsPage` の `allListings` ステートが即座に更新されていない状態
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 対象ファイルのパス
const DETAIL_PAGE_FILE = path.resolve(
  __dirname,
  '../PropertyListingDetailPage.tsx'
);

const LISTINGS_PAGE_FILE = path.resolve(
  __dirname,
  '../PropertyListingsPage.tsx'
);

// ファイル内容を読み込む
function readDetailPageFile(): string {
  return fs.readFileSync(DETAIL_PAGE_FILE, 'utf-8');
}

function readListingsPageFile(): string {
  return fs.readFileSync(LISTINGS_PAGE_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// バグ条件テスト1: handleSavePrice に propertyPriceReductionUpdated イベント発火がないこと
// 未修正コードでは FAIL する（バグの存在を証明する）
// -----------------------------------------------------------------------
describe('Bug Condition 1: handleSavePrice に propertyPriceReductionUpdated イベント発火がないこと', () => {
  /**
   * テスト1.1: handleSavePrice 関数内に propertyPriceReductionUpdated イベント発火がないこと
   *
   * 未修正コード: handleSavePrice に dispatchEvent('propertyPriceReductionUpdated') がない
   * → このテストは FAIL する（バグの存在を証明する）
   *
   * 修正後: handleSavePrice に dispatchEvent('propertyPriceReductionUpdated') が追加される
   * → このテストは PASS する（修正を検証する）
   */
  test('handleSavePrice 関数内に propertyPriceReductionUpdated イベント発火が存在すること（未修正コードで FAIL）', () => {
    const source = readDetailPageFile();

    // handleSavePrice 関数のブロックを抽出する
    // "const handleSavePrice = async () => {" から次の "const handle" まで
    const handleSavePriceMatch = source.match(
      /const handleSavePrice\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)(?=\n  const handle|\n  \/\/ Save handlers)/
    );

    expect(handleSavePriceMatch).not.toBeNull();

    const handleSavePriceBody = handleSavePriceMatch![1];

    // 期待される動作: handleSavePrice 内に propertyPriceReductionUpdated イベント発火がある
    // 未修正コードではこれが存在しないため FAIL する
    expect(handleSavePriceBody).toContain('propertyPriceReductionUpdated');
  });

  /**
   * テスト1.2: handleSavePrice 関数内に window.dispatchEvent が存在すること
   *
   * 未修正コード: handleSavePrice に window.dispatchEvent がない
   * → このテストは FAIL する（バグの存在を証明する）
   */
  test('handleSavePrice 関数内に window.dispatchEvent が存在すること（未修正コードで FAIL）', () => {
    const source = readDetailPageFile();

    const handleSavePriceMatch = source.match(
      /const handleSavePrice\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)(?=\n  const handle|\n  \/\/ Save handlers)/
    );

    expect(handleSavePriceMatch).not.toBeNull();

    const handleSavePriceBody = handleSavePriceMatch![1];

    // 期待される動作: handleSavePrice 内に window.dispatchEvent がある
    // 未修正コードではこれが存在しないため FAIL する
    expect(handleSavePriceBody).toContain('window.dispatchEvent');
  });

  /**
   * テスト1.3: handleSavePrice 関数内に price_reduction_scheduled_date の条件分岐が存在すること
   *
   * 未修正コード: handleSavePrice に price_reduction_scheduled_date のイベント発火条件がない
   * → このテストは FAIL する（バグの存在を証明する）
   */
  test('handleSavePrice 関数内に price_reduction_scheduled_date のイベント発火条件が存在すること（未修正コードで FAIL）', () => {
    const source = readDetailPageFile();

    const handleSavePriceMatch = source.match(
      /const handleSavePrice\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)(?=\n  const handle|\n  \/\/ Save handlers)/
    );

    expect(handleSavePriceMatch).not.toBeNull();

    const handleSavePriceBody = handleSavePriceMatch![1];

    // 期待される動作: handleSavePrice 内に price_reduction_scheduled_date の条件分岐がある
    // 未修正コードではこれが存在しないため FAIL する
    expect(handleSavePriceBody).toContain('price_reduction_scheduled_date');
  });
});

// -----------------------------------------------------------------------
// バグ条件テスト2: PropertyListingsPage に propertyPriceReductionUpdated リスナーがないこと
// 未修正コードでは FAIL する（バグの存在を証明する）
// -----------------------------------------------------------------------
describe('Bug Condition 2: PropertyListingsPage に propertyPriceReductionUpdated リスナーがないこと', () => {
  /**
   * テスト2.1: PropertyListingsPage に propertyPriceReductionUpdated イベントリスナーが存在すること
   *
   * 未修正コード: PropertyListingsPage に propertyPriceReductionUpdated リスナーがない
   * → このテストは FAIL する（バグの存在を証明する）
   *
   * 修正後: PropertyListingsPage に propertyPriceReductionUpdated リスナーが追加される
   * → このテストは PASS する（修正を検証する）
   */
  test('PropertyListingsPage に propertyPriceReductionUpdated イベントリスナーが存在すること（未修正コードで FAIL）', () => {
    const source = readListingsPageFile();

    // 期待される動作: PropertyListingsPage に propertyPriceReductionUpdated リスナーがある
    // 未修正コードではこれが存在しないため FAIL する
    expect(source).toContain('propertyPriceReductionUpdated');
  });

  /**
   * テスト2.2: PropertyListingsPage に handlePriceReductionUpdate 関数が存在すること
   *
   * 未修正コード: PropertyListingsPage に handlePriceReductionUpdate がない
   * → このテストは FAIL する（バグの存在を証明する）
   */
  test('PropertyListingsPage に handlePriceReductionUpdate 関数が存在すること（未修正コードで FAIL）', () => {
    const source = readListingsPageFile();

    // 期待される動作: PropertyListingsPage に handlePriceReductionUpdate がある
    // 未修正コードではこれが存在しないため FAIL する
    expect(source).toContain('handlePriceReductionUpdate');
  });

  /**
   * テスト2.3: PropertyListingsPage の propertyPriceReductionUpdated リスナーが
   *            price_reduction_scheduled_date を更新すること
   *
   * 未修正コード: PropertyListingsPage に price_reduction_scheduled_date の更新処理がない
   * → このテストは FAIL する（バグの存在を証明する）
   */
  test('PropertyListingsPage のイベントリスナーが price_reduction_scheduled_date を更新すること（未修正コードで FAIL）', () => {
    const source = readListingsPageFile();

    // propertyPriceReductionUpdated を含む useEffect ブロック全体を探す
    // handlePriceReductionUpdate 関数の定義から addEventListener まで
    const listenerMatch = source.match(
      /const handlePriceReductionUpdate[\s\S]+?window\.addEventListener\s*\(\s*['"]propertyPriceReductionUpdated['"]/
    );

    // 未修正コードではリスナー自体が存在しないため FAIL する
    expect(listenerMatch).not.toBeNull();

    const listenerBody = listenerMatch![0];

    // リスナー内で price_reduction_scheduled_date が更新されること
    expect(listenerBody).toContain('price_reduction_scheduled_date');
  });

  /**
   * テスト2.4: PropertyListingsPage の propertyPriceReductionUpdated リスナーが
   *            setAllListings を呼び出すこと
   *
   * 未修正コード: PropertyListingsPage に setAllListings の更新処理がない
   * → このテストは FAIL する（バグの存在を証明する）
   */
  test('PropertyListingsPage のイベントリスナーが setAllListings を呼び出すこと（未修正コードで FAIL）', () => {
    const source = readListingsPageFile();

    const listenerMatch = source.match(
      /const handlePriceReductionUpdate[\s\S]+?window\.addEventListener\s*\(\s*['"]propertyPriceReductionUpdated['"]/
    );

    // 未修正コードではリスナー自体が存在しないため FAIL する
    expect(listenerMatch).not.toBeNull();

    const listenerBody = listenerMatch![0];

    // リスナー内で setAllListings が呼ばれること
    expect(listenerBody).toContain('setAllListings');
  });
});

// -----------------------------------------------------------------------
// バグ条件テスト3: 対称性の確認
// confirmation と price_reduction_scheduled_date の実装パターンが対称であること
// -----------------------------------------------------------------------
describe('Bug Condition 3: confirmation と price_reduction_scheduled_date の実装パターンの対称性', () => {
  /**
   * テスト3.1: PropertyListingDetailPage に propertyConfirmationUpdated と
   *            propertyPriceReductionUpdated の両方が存在すること
   *
   * 未修正コード: propertyPriceReductionUpdated が存在しないため FAIL する
   */
  test('PropertyListingDetailPage に propertyConfirmationUpdated と propertyPriceReductionUpdated の両方が存在すること（未修正コードで FAIL）', () => {
    const source = readDetailPageFile();

    // confirmation の実装は存在する（これは PASS する）
    expect(source).toContain('propertyConfirmationUpdated');

    // price_reduction_scheduled_date の実装は存在しない（未修正コードでは FAIL する）
    expect(source).toContain('propertyPriceReductionUpdated');
  });

  /**
   * テスト3.2: PropertyListingsPage に propertyConfirmationUpdated と
   *            propertyPriceReductionUpdated の両方のリスナーが存在すること
   *
   * 未修正コード: propertyPriceReductionUpdated リスナーが存在しないため FAIL する
   */
  test('PropertyListingsPage に propertyConfirmationUpdated と propertyPriceReductionUpdated の両方のリスナーが存在すること（未修正コードで FAIL）', () => {
    const source = readListingsPageFile();

    // confirmation のリスナーは存在する（これは PASS する）
    expect(source).toContain('propertyConfirmationUpdated');

    // price_reduction_scheduled_date のリスナーは存在しない（未修正コードでは FAIL する）
    expect(source).toContain('propertyPriceReductionUpdated');
  });
});
