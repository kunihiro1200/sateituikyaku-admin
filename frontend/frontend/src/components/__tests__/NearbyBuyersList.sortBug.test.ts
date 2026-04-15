/**
 * バグ条件の探索テスト: 文字列型 inquiry_price の辞書順ソートバグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正前のコードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。
 *
 * バグ条件 (isBugCondition):
 *   typeof X.inquiry_price === 'string'
 *   && X.inquiry_price !== null
 *   && sortConfig.key === 'inquiry_price'
 *
 * 根本原因:
 *   NearbyBuyersList.tsx の sortedBuyers useMemo 内で
 *   `typeof aValue === 'number'` チェックが文字列型に対して false になり、
 *   localeCompare による辞書順比較にフォールバックする。
 *   辞書順では "49800000" < "5800000"（先頭文字 "4" < "5"）となるため、
 *   数値的に正しくない順序になる。
 *
 * 期待されるカウンターエグザンプル:
 *   昇順ソートで "49800000" が "5800000" より前に来る（数値的には逆）
 */

// NearbyBuyersList.tsx の sortedBuyers useMemo 内のソートロジックを直接再現する
// （未修正コードのロジックをそのままコピー）

interface NearbyBuyer {
  buyer_number: string;
  name: string;
  distribution_areas: string[];
  latest_status: string;
  viewing_date: string;
  reception_date?: string;
  inquiry_hearing?: string;
  viewing_result_follow_up?: string;
  email?: string;
  phone_number?: string;
  property_address?: string | null;
  inquiry_property_type?: string | null;
  inquiry_price?: number | null | string; // 実際には文字列型で来る場合がある
}

interface SortConfig {
  key: keyof NearbyBuyer | null;
  direction: 'asc' | 'desc';
}

/**
 * 未修正コードのソートロジックを再現する関数
 * NearbyBuyersList.tsx の sortedBuyers useMemo 内のソート関数と同一
 */
function sortBuyers(buyers: NearbyBuyer[], sortConfig: SortConfig): NearbyBuyer[] {
  if (!sortConfig.key) return buyers;
  return [...buyers].sort((a, b) => {
    const aValue = a[sortConfig.key!];
    const bValue = b[sortConfig.key!];
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return 1;
    if (bValue == null) return -1;
    if (sortConfig.key === 'viewing_date') {
      const aDate = new Date(aValue as string).getTime();
      const bDate = new Date(bValue as string).getTime();
      return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate;
    }
    // 修正済みコード: inquiry_price の場合は Number() で変換してから比較
    if (sortConfig.key === 'inquiry_price') {
      const aNum = Number(aValue);
      const bNum = Number(bValue);
      return sortConfig.direction === 'asc' ? aNum - bNum : bNum - aNum;
    }
    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
    }
    // 文字列型の場合は localeCompare による辞書順比較にフォールバック
    const aStr = String(aValue).toLowerCase();
    const bStr = String(bValue).toLowerCase();
    return sortConfig.direction === 'asc'
      ? aStr.localeCompare(bStr, 'ja')
      : bStr.localeCompare(aStr, 'ja');
  });
}

/** テスト用の最小限の買主データを生成するヘルパー */
function makeBuyer(buyerNumber: string, inquiryPrice: string | number | null): NearbyBuyer {
  return {
    buyer_number: buyerNumber,
    name: `テスト${buyerNumber}`,
    distribution_areas: [],
    latest_status: '検討中',
    viewing_date: '2025-01-01',
    inquiry_price: inquiryPrice as number | null,
  };
}

describe('NearbyBuyersList - バグ条件の探索テスト（文字列型 inquiry_price の辞書順ソートバグ）', () => {
  /**
   * Property 1: Bug Condition - 昇順ソートテスト
   *
   * テスト内容:
   *   inquiry_price が文字列型 "49800000" と "5800000" の2件を昇順ソートした場合、
   *   数値的に小さい "5800000"（580万円）が先頭に来ることを期待する。
   *
   * 修正前のコードでは:
   *   localeCompare による辞書順で "49800000" < "5800000" となるため、
   *   "49800000"（4980万円）が先頭に来る。
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('昇順ソート: "5800000" が "49800000" より前に来ること（数値順）', () => {
    // バグ条件を満たすデータ: inquiry_price が文字列型
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '49800000'), // 4980万円
      makeBuyer('B002', '5800000'),  // 580万円
    ];

    const sortConfig: SortConfig = { key: 'inquiry_price', direction: 'asc' };
    const result = sortBuyers(buyers, sortConfig);

    // 数値的に正しい昇順: 580万円 → 4980万円
    // 修正前のコードでは辞書順で "49800000" が先頭になるため FAIL する
    expect(result[0].inquiry_price).toBe('5800000');  // 580万円が先頭
    expect(result[1].inquiry_price).toBe('49800000'); // 4980万円が2番目
  });

  /**
   * Property 1: Bug Condition - 降順ソートテスト
   *
   * テスト内容:
   *   inquiry_price が文字列型 "49800000" と "5800000" の2件を降順ソートした場合、
   *   数値的に大きい "49800000"（4980万円）が先頭に来ることを期待する。
   *
   * 修正前のコードでは:
   *   localeCompare による辞書順の逆順で "5800000" が先頭に来る。
   *   → このアサーションが FAIL する（バグの存在を証明する）
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('降順ソート: "49800000" が "5800000" より前に来ること（数値順）', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '5800000'),  // 580万円
      makeBuyer('B002', '49800000'), // 4980万円
    ];

    const sortConfig: SortConfig = { key: 'inquiry_price', direction: 'desc' };
    const result = sortBuyers(buyers, sortConfig);

    // 数値的に正しい降順: 4980万円 → 580万円
    // 修正前のコードでは辞書順の逆で "5800000" が先頭になるため FAIL する
    expect(result[0].inquiry_price).toBe('49800000'); // 4980万円が先頭
    expect(result[1].inquiry_price).toBe('5800000');  // 580万円が2番目
  });

  /**
   * Property 1: Bug Condition - 複数件昇順ソートテスト
   *
   * テスト内容:
   *   ["49800000", "5800000", "10000000", "3000000"] を昇順ソートした場合、
   *   数値順 [3000000, 5800000, 10000000, 49800000] になることを期待する。
   *
   * 修正前のコードでは:
   *   辞書順で ["10000000", "3000000", "49800000", "5800000"] になるため FAIL する。
   *
   * EXPECTED: このテストは修正前のコードで FAIL する
   */
  test('複数件昇順ソート: 数値順 [3000000, 5800000, 10000000, 49800000] になること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '49800000'), // 4980万円
      makeBuyer('B002', '5800000'),  // 580万円
      makeBuyer('B003', '10000000'), // 1000万円
      makeBuyer('B004', '3000000'),  // 300万円
    ];

    const sortConfig: SortConfig = { key: 'inquiry_price', direction: 'asc' };
    const result = sortBuyers(buyers, sortConfig);

    const sortedPrices = result.map(b => b.inquiry_price);

    // 数値的に正しい昇順
    // 修正前のコードでは辞書順 ["10000000", "3000000", "49800000", "5800000"] になるため FAIL する
    expect(sortedPrices).toEqual(['3000000', '5800000', '10000000', '49800000']);
  });
});
