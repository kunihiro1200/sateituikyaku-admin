/**
 * Property Price Reduction Sidebar Fix - 保全プロパティテスト（Property 2: Preservation）
 *
 * このテストは「未修正コードで既存動作が保持されていること」を確認するためのものです。
 *
 * **重要**: このテストは未修正コードで PASS する必要がある。
 * これがベースライン動作の確認であり、修正後もこのテストが PASS し続けることで
 * リグレッションがないことを確認する。
 *
 * 観察した動作パターン（未修正コードで確認済み）:
 * - 観察1: `confirmation` フィールドを更新すると `propertyConfirmationUpdated` イベントが発火し、
 *          `allListings` が即座に更新される
 * - 観察2: `price_reduction_scheduled_date` を変更しない保存操作では
 *          `propertyPriceReductionUpdated` イベントが発火しない
 * - 観察3: 価格情報以外のフィールドを保存しても他のサイドバーカテゴリーのカウントが変わらない
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  calculatePropertyStatus,
  calculateStatusCounts,
  type PropertyListing,
} from '../../utils/propertyListingStatusUtils';

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
// テストデータ生成ヘルパー
// -----------------------------------------------------------------------

/** 基本的な物件データを生成する */
function makeBaseListing(overrides: Partial<PropertyListing> = {}): PropertyListing {
  return {
    property_number: 'AA0001',
    sales_assignee: null,
    atbb_status: null,
    confirmation: '済',
    general_mediation_private: null,
    single_listing: null,
    suumo_url: null,
    suumo_registered: null,
    offer_status: null,
    report_date: null,
    report_assignee: null,
    price_reduction_scheduled_date: null,
    ...overrides,
  };
}

/** 今日以前の日付文字列を返す（YYYY-MM-DD形式） */
function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

/** 未来の日付文字列を返す（YYYY-MM-DD形式） */
function getFutureDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

// -----------------------------------------------------------------------
// 観察1: confirmation フィールドの即時更新パターンが実装されていること
// -----------------------------------------------------------------------
describe('観察1: confirmation フィールドの即時更新パターン（propertyConfirmationUpdated イベント）', () => {
  /**
   * テスト1.1: PropertyListingDetailPage に propertyConfirmationUpdated イベント発火が存在すること
   *
   * 未修正コードで PASS する（confirmation の即時更新は実装済み）
   */
  test('PropertyListingDetailPage に propertyConfirmationUpdated イベント発火が存在すること', () => {
    const source = readDetailPageFile();

    // confirmation の即時更新イベントが実装されていること
    expect(source).toContain('propertyConfirmationUpdated');
    expect(source).toContain('window.dispatchEvent');
  });

  /**
   * テスト1.2: PropertyListingsPage に propertyConfirmationUpdated イベントリスナーが存在すること
   *
   * 未修正コードで PASS する（confirmation のリスナーは実装済み）
   */
  test('PropertyListingsPage に propertyConfirmationUpdated イベントリスナーが存在すること', () => {
    const source = readListingsPageFile();

    // confirmation のリスナーが実装されていること
    expect(source).toContain('propertyConfirmationUpdated');
    expect(source).toContain('addEventListener');
    expect(source).toContain('removeEventListener');
  });

  /**
   * テスト1.3: PropertyListingsPage の confirmation リスナーが setAllListings を呼び出すこと
   *
   * 未修正コードで PASS する（setAllListings による即時更新は実装済み）
   */
  test('PropertyListingsPage の confirmation リスナーが setAllListings を呼び出すこと', () => {
    const source = readListingsPageFile();

    // handleConfirmationUpdate 関数のブロックを抽出する
    // useEffect 内の handleConfirmationUpdate 関数定義から addEventListener まで
    const listenerMatch = source.match(
      /const handleConfirmationUpdate\s*=\s*\(event:\s*CustomEvent\)\s*=>\s*\{([\s\S]*?)\};\s*\n\s*window\.addEventListener\s*\(\s*['"]propertyConfirmationUpdated['"]/
    );

    expect(listenerMatch).not.toBeNull();

    const listenerBody = listenerMatch![1];

    // リスナー内で setAllListings が呼ばれること
    expect(listenerBody).toContain('setAllListings');
    // リスナー内で confirmation が更新されること
    expect(listenerBody).toContain('confirmation');
  });

  /**
   * テスト1.4: PropertyListingsPage の confirmation リスナーがキャッシュを無効化すること
   *
   * 未修正コードで PASS する（キャッシュ無効化は実装済み）
   */
  test('PropertyListingsPage の confirmation リスナーがキャッシュを無効化すること', () => {
    const source = readListingsPageFile();

    // handleConfirmationUpdate 関数のブロックを抽出する
    const listenerMatch = source.match(
      /const handleConfirmationUpdate\s*=\s*\(event:\s*CustomEvent\)\s*=>\s*\{([\s\S]*?)\};\s*\n\s*window\.addEventListener\s*\(\s*['"]propertyConfirmationUpdated['"]/
    );

    expect(listenerMatch).not.toBeNull();

    const listenerBody = listenerMatch![1];

    // リスナー内でキャッシュが無効化されること
    expect(listenerBody).toContain('pageDataCache.invalidate');
  });
});

// -----------------------------------------------------------------------
// 観察2: price_reduction_scheduled_date を変更しない保存では
//         propertyPriceReductionUpdated イベントが発火しないこと
// -----------------------------------------------------------------------
describe('観察2: price_reduction_scheduled_date を変更しない保存では propertyPriceReductionUpdated イベントが発火しないこと', () => {
  /**
   * テスト2.1: handleSavePrice に price_reduction_scheduled_date の条件分岐がある場合、
   *            editedData に price_reduction_scheduled_date が含まれない場合はイベントを発火しないこと
   *
   * 未修正コードで PASS する（イベント発火処理自体が存在しないため、発火しない）
   * 修正後も PASS する（条件分岐により price_reduction_scheduled_date が含まれない場合は発火しない）
   *
   * このテストは「price_reduction_scheduled_date を変更しない保存では
   * propertyPriceReductionUpdated イベントが発火しない」という動作を保持する。
   */
  test('handleSavePrice の実装において price_reduction_scheduled_date の条件分岐が適切であること', () => {
    const source = readDetailPageFile();

    // handleSavePrice 関数のブロックを抽出する
    const handleSavePriceMatch = source.match(
      /const handleSavePrice\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)(?=\n  const handle|\n  \/\/ Save handlers)/
    );

    // handleSavePrice 関数が存在すること
    expect(handleSavePriceMatch).not.toBeNull();

    const handleSavePriceBody = handleSavePriceMatch![1];

    // handleSavePrice 内に price_reduction_scheduled_date の条件分岐がある場合、
    // それは「editedData に price_reduction_scheduled_date が含まれる場合のみ」発火する形であること
    // （未修正コードでは条件分岐自体がないため、このテストは常に PASS する）
    if (handleSavePriceBody.includes('propertyPriceReductionUpdated')) {
      // 修正後: 条件分岐が存在する場合、price_reduction_scheduled_date の条件チェックがあること
      expect(handleSavePriceBody).toContain('price_reduction_scheduled_date');
      // 条件分岐（if文）が存在すること
      expect(handleSavePriceBody).toMatch(/if\s*\(.*price_reduction_scheduled_date/);
    }
    // 未修正コードでは propertyPriceReductionUpdated が存在しないため、
    // 上記の if ブロックに入らず PASS する
  });

  /**
   * テスト2.2: handleSavePrice の実装において price_reduction_scheduled_date を
   *            変更しない場合（editedData に含まれない場合）はイベントが発火しないこと
   *
   * このテストは「price_reduction_scheduled_date を変更しない保存では
   * propertyPriceReductionUpdated イベントが発火しない」という動作を保持する。
   * 未修正コードで PASS する（イベント発火処理自体が存在しないため）
   * 修正後も PASS する（条件分岐により price_reduction_scheduled_date が含まれない場合は発火しない）
   */
  test('price_reduction_scheduled_date を変更しない保存では propertyPriceReductionUpdated イベントが発火しないこと（イベント発火の条件分岐確認）', () => {
    const source = readDetailPageFile();

    // handleSavePrice 関数のブロックを抽出する
    const handleSavePriceMatch = source.match(
      /const handleSavePrice\s*=\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)(?=\n  const handle|\n  \/\/ Save handlers)/
    );

    expect(handleSavePriceMatch).not.toBeNull();

    const handleSavePriceBody = handleSavePriceMatch![1];

    // propertyPriceReductionUpdated イベント発火が存在する場合（修正後）、
    // 必ず条件分岐（if文）で囲まれていること
    if (handleSavePriceBody.includes('propertyPriceReductionUpdated')) {
      // 無条件に発火していないこと（if文で囲まれていること）
      const unconditionalDispatch = /(?<!if\s*\([^)]*\)\s*\{[^}]*)\bdispatchEvent\s*\(\s*new\s*CustomEvent\s*\(\s*['"]propertyPriceReductionUpdated['"]/;
      // 条件分岐の中にあること
      const conditionalDispatch = /if\s*\([^)]*price_reduction_scheduled_date[^)]*\)[^{]*\{[^}]*propertyPriceReductionUpdated/s;
      expect(handleSavePriceBody).toMatch(conditionalDispatch);
    }
    // 未修正コードでは propertyPriceReductionUpdated が存在しないため PASS する
  });
});

// -----------------------------------------------------------------------
// 観察3: calculatePropertyStatus による各カテゴリーの判定ロジックが正しいこと
// -----------------------------------------------------------------------
describe('観察3: calculatePropertyStatus による各カテゴリーの判定ロジック（他カテゴリーへの影響なし）', () => {
  /**
   * テスト3.1: price_reduction_scheduled_date が null の物件は price_reduction_due にならないこと
   *
   * 未修正コードで PASS する（calculatePropertyStatus の実装は正しい）
   * Requirement 3.2 に対応
   */
  test('price_reduction_scheduled_date が null の物件は price_reduction_due にならないこと', () => {
    const listing = makeBaseListing({
      property_number: 'AA0001',
      price_reduction_scheduled_date: null,
      atbb_status: '一般・公開中',
    });

    const status = calculatePropertyStatus(listing);

    // price_reduction_due にならないこと
    expect(status.key).not.toBe('price_reduction_due');
  });

  /**
   * テスト3.2: price_reduction_scheduled_date が今日以前の物件は price_reduction_due になること
   *
   * 未修正コードで PASS する（calculatePropertyStatus の実装は正しい）
   * Requirement 3.1 に対応
   */
  test('price_reduction_scheduled_date が今日以前の物件は price_reduction_due になること', () => {
    const listing = makeBaseListing({
      property_number: 'AA0002',
      price_reduction_scheduled_date: getYesterdayStr(),
    });

    const status = calculatePropertyStatus(listing);

    // price_reduction_due になること
    expect(status.key).toBe('price_reduction_due');
  });

  /**
   * テスト3.3: price_reduction_scheduled_date が未来の物件は price_reduction_due にならないこと
   *
   * 未修正コードで PASS する（calculatePropertyStatus の実装は正しい）
   */
  test('price_reduction_scheduled_date が未来の物件は price_reduction_due にならないこと', () => {
    const listing = makeBaseListing({
      property_number: 'AA0003',
      price_reduction_scheduled_date: getFutureDateStr(),
      atbb_status: '一般・公開中',
    });

    const status = calculatePropertyStatus(listing);

    // price_reduction_due にならないこと
    expect(status.key).not.toBe('price_reduction_due');
  });

  /**
   * テスト3.4: confirmation が「未」の物件は incomplete になること（price_reduction_due でないとき）
   *
   * 未修正コードで PASS する（calculatePropertyStatus の実装は正しい）
   * Requirement 3.4 に対応（他のサイドバーカテゴリーへの影響なし）
   */
  test('confirmation が「未」の物件は incomplete になること（price_reduction_due でないとき）', () => {
    const listing = makeBaseListing({
      property_number: 'AA0004',
      confirmation: '未',
      price_reduction_scheduled_date: null, // price_reduction_due でない
    });

    const status = calculatePropertyStatus(listing);

    // incomplete になること
    expect(status.key).toBe('incomplete');
  });

  /**
   * テスト3.5: price_reduction_scheduled_date を null に変更しても
   *            他の物件のカテゴリーカウントが変わらないこと
   *
   * 未修正コードで PASS する（calculateStatusCounts の実装は正しい）
   * Requirement 3.4 に対応
   */
  test('price_reduction_scheduled_date を null に変更しても他の物件のカテゴリーカウントが変わらないこと', () => {
    // 複数の物件を含むリスト
    const listings: PropertyListing[] = [
      makeBaseListing({
        property_number: 'AA0010',
        price_reduction_scheduled_date: getYesterdayStr(), // 要値下げ
      }),
      makeBaseListing({
        property_number: 'AA0011',
        confirmation: '未', // 未完了
        price_reduction_scheduled_date: null,
      }),
      makeBaseListing({
        property_number: 'AA0012',
        atbb_status: '一般・公開中', // 一般公開中
        price_reduction_scheduled_date: null,
      }),
    ];

    // 変更前のカウント
    const countsBefore = calculateStatusCounts(listings);

    // AA0010 の price_reduction_scheduled_date を null に変更（バグ修正後の期待動作）
    const updatedListings = listings.map(l =>
      l.property_number === 'AA0010'
        ? { ...l, price_reduction_scheduled_date: null }
        : l
    );

    // 変更後のカウント
    const countsAfter = calculateStatusCounts(updatedListings);

    // AA0010 が price_reduction_due から外れること
    expect(countsBefore['price_reduction_due']).toBe(1);
    expect(countsAfter['price_reduction_due'] ?? 0).toBe(0);

    // 他の物件のカテゴリーカウントが変わらないこと
    // AA0011 は incomplete のまま
    expect(countsBefore['incomplete']).toBe(1);
    expect(countsAfter['incomplete']).toBe(1);

    // AA0012 は general_public のまま
    expect(countsBefore['general_public']).toBe(1);
    expect(countsAfter['general_public']).toBe(1);
  });

  /**
   * テスト3.6: allListings の特定物件のみを更新しても他の物件が変わらないこと
   *
   * 未修正コードで PASS する（setAllListings の map 処理は正しい）
   * Requirement 3.4 に対応
   */
  test('allListings の特定物件のみを更新しても他の物件が変わらないこと', () => {
    const listings: PropertyListing[] = [
      makeBaseListing({ property_number: 'AA0020', price_reduction_scheduled_date: getYesterdayStr() }),
      makeBaseListing({ property_number: 'AA0021', confirmation: '未' }),
      makeBaseListing({ property_number: 'AA0022', atbb_status: '一般・公開中' }),
    ];

    // PropertyListingsPage の setAllListings の map 処理をシミュレート
    const targetPropertyNumber = 'AA0020';
    const newPriceReductionDate = null;

    const updatedListings = listings.map(listing =>
      listing.property_number === targetPropertyNumber
        ? { ...listing, price_reduction_scheduled_date: newPriceReductionDate }
        : listing
    );

    // 対象物件のみが更新されること
    expect(updatedListings[0].price_reduction_scheduled_date).toBeNull();

    // 他の物件は変わらないこと
    expect(updatedListings[1].property_number).toBe('AA0021');
    expect(updatedListings[1].confirmation).toBe('未');
    expect(updatedListings[1].price_reduction_scheduled_date).toBeNull();

    expect(updatedListings[2].property_number).toBe('AA0022');
    expect(updatedListings[2].atbb_status).toBe('一般・公開中');
    expect(updatedListings[2].price_reduction_scheduled_date).toBeNull();
  });
});

// -----------------------------------------------------------------------
// 観察1の追加: confirmation 更新後の allListings 即時更新シミュレーション
// -----------------------------------------------------------------------
describe('観察1の追加: confirmation 更新後の allListings 即時更新シミュレーション', () => {
  /**
   * テスト4.1: confirmation を「未」→「済」に変更すると incomplete から外れること
   *
   * 未修正コードで PASS する（calculatePropertyStatus の実装は正しい）
   * Requirement 3.3 に対応
   */
  test('confirmation を「未」→「済」に変更すると incomplete から外れること', () => {
    const listingBefore = makeBaseListing({
      property_number: 'AA0030',
      confirmation: '未',
      price_reduction_scheduled_date: null,
    });

    // confirmation 更新前
    const statusBefore = calculatePropertyStatus(listingBefore);
    expect(statusBefore.key).toBe('incomplete');

    // confirmation 更新後（propertyConfirmationUpdated イベントによる即時更新をシミュレート）
    const listingAfter = { ...listingBefore, confirmation: '済' };
    const statusAfter = calculatePropertyStatus(listingAfter);

    // incomplete から外れること
    expect(statusAfter.key).not.toBe('incomplete');
  });

  /**
   * テスト4.2: confirmation 更新が他の物件のカテゴリーに影響しないこと
   *
   * 未修正コードで PASS する（calculateStatusCounts の実装は正しい）
   * Requirement 3.3, 3.4 に対応
   */
  test('confirmation 更新が他の物件のカテゴリーに影響しないこと', () => {
    const listings: PropertyListing[] = [
      makeBaseListing({ property_number: 'AA0040', confirmation: '未' }),
      makeBaseListing({ property_number: 'AA0041', price_reduction_scheduled_date: getYesterdayStr() }),
      makeBaseListing({ property_number: 'AA0042', atbb_status: '一般・公開中' }),
    ];

    // 変更前のカウント
    const countsBefore = calculateStatusCounts(listings);
    expect(countsBefore['incomplete']).toBe(1);
    expect(countsBefore['price_reduction_due']).toBe(1);
    expect(countsBefore['general_public']).toBe(1);

    // AA0040 の confirmation を「未」→「済」に変更（propertyConfirmationUpdated イベントをシミュレート）
    const updatedListings = listings.map(l =>
      l.property_number === 'AA0040'
        ? { ...l, confirmation: '済' }
        : l
    );

    // 変更後のカウント
    const countsAfter = calculateStatusCounts(updatedListings);

    // incomplete が減ること
    expect(countsAfter['incomplete'] ?? 0).toBe(0);

    // 他のカテゴリーは変わらないこと
    expect(countsAfter['price_reduction_due']).toBe(1);
    expect(countsAfter['general_public']).toBe(1);
  });
});
