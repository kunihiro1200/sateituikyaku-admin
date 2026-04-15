/**
 * 保全プロパティテスト: 価格以外のカラムのソート動作保全
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは修正前のコードで PASS することが期待される。
 * PASS がベースライン動作（修正によって変わってはいけない動作）を確認する。
 *
 * 保全すべき動作:
 *   - buyer_number でのソートは文字列比較で正しく動作する
 *   - name でのソートは localeCompare で正しく動作する
 *   - viewing_date でのソートは日付比較で正しく動作する
 *   - inquiry_price: null の買主は末尾に配置される
 *
 * 観察優先メソドロジー:
 *   未修正コードで非バグ条件の入力（inquiry_price 以外のカラムのソート）の
 *   動作を観察し、これがベースラインとして保全されるべき動作であることを確認する。
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
    // ここがバグの核心: typeof aValue === 'number' が文字列型に対して false になる
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
function makeBuyer(
  buyerNumber: string,
  name: string,
  viewingDate: string,
  inquiryPrice: number | null = null
): NearbyBuyer {
  return {
    buyer_number: buyerNumber,
    name,
    distribution_areas: [],
    latest_status: '検討中',
    viewing_date: viewingDate,
    inquiry_price: inquiryPrice,
  };
}

describe('NearbyBuyersList - 保全プロパティテスト（価格以外のカラムのソート動作保全）', () => {
  // ===== buyer_number ソートの保全 =====

  /**
   * Property 2: Preservation - buyer_number 昇順ソート
   *
   * テスト内容:
   *   buyer_number カラムで昇順ソートした場合、文字列比較で正しく動作することを確認する。
   *   これは非バグ条件（inquiry_price 以外のカラムのソート）であり、
   *   修正前後で同一の結果が返ることを保全する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('buyer_number 昇順ソート: 文字列比較で正しく動作すること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B003', '田中三郎', '2025-03-01'),
      makeBuyer('B001', '田中一郎', '2025-01-01'),
      makeBuyer('B002', '田中二郎', '2025-02-01'),
    ];

    const result = sortBuyers(buyers, { key: 'buyer_number', direction: 'asc' });

    expect(result[0].buyer_number).toBe('B001');
    expect(result[1].buyer_number).toBe('B002');
    expect(result[2].buyer_number).toBe('B003');
  });

  /**
   * Property 2: Preservation - buyer_number 降順ソート
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('buyer_number 降順ソート: 文字列比較で正しく動作すること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '田中一郎', '2025-01-01'),
      makeBuyer('B003', '田中三郎', '2025-03-01'),
      makeBuyer('B002', '田中二郎', '2025-02-01'),
    ];

    const result = sortBuyers(buyers, { key: 'buyer_number', direction: 'desc' });

    expect(result[0].buyer_number).toBe('B003');
    expect(result[1].buyer_number).toBe('B002');
    expect(result[2].buyer_number).toBe('B001');
  });

  // ===== name ソートの保全 =====

  /**
   * Property 2: Preservation - name 昇順ソート
   *
   * テスト内容:
   *   name カラムで昇順ソートした場合、localeCompare で正しく動作することを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('name 昇順ソート: localeCompare で正しく動作すること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '山田太郎', '2025-01-01'),
      makeBuyer('B002', '鈴木花子', '2025-02-01'),
      makeBuyer('B003', '田中一郎', '2025-03-01'),
    ];

    const result = sortBuyers(buyers, { key: 'name', direction: 'asc' });

    // localeCompare('ja') による昇順: 鈴木 < 田中 < 山田
    const sortedNames = result.map(b => b.name);
    // 昇順で並んでいることを確認（各要素が次の要素以下）
    for (let i = 0; i < sortedNames.length - 1; i++) {
      expect(
        sortedNames[i].localeCompare(sortedNames[i + 1], 'ja')
      ).toBeLessThanOrEqual(0);
    }
  });

  /**
   * Property 2: Preservation - name 降順ソート
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('name 降順ソート: localeCompare で正しく動作すること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '山田太郎', '2025-01-01'),
      makeBuyer('B002', '鈴木花子', '2025-02-01'),
      makeBuyer('B003', '田中一郎', '2025-03-01'),
    ];

    const result = sortBuyers(buyers, { key: 'name', direction: 'desc' });

    // 降順で並んでいることを確認（各要素が次の要素以上）
    const sortedNames = result.map(b => b.name);
    for (let i = 0; i < sortedNames.length - 1; i++) {
      expect(
        sortedNames[i].localeCompare(sortedNames[i + 1], 'ja')
      ).toBeGreaterThanOrEqual(0);
    }
  });

  // ===== viewing_date ソートの保全 =====

  /**
   * Property 2: Preservation - viewing_date 昇順ソート
   *
   * テスト内容:
   *   viewing_date カラムで昇順ソートした場合、日付比較で正しく動作することを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('viewing_date 昇順ソート: 日付比較で正しく動作すること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '田中一郎', '2025-03-15'),
      makeBuyer('B002', '田中二郎', '2025-01-10'),
      makeBuyer('B003', '田中三郎', '2025-06-20'),
    ];

    const result = sortBuyers(buyers, { key: 'viewing_date', direction: 'asc' });

    expect(result[0].viewing_date).toBe('2025-01-10');
    expect(result[1].viewing_date).toBe('2025-03-15');
    expect(result[2].viewing_date).toBe('2025-06-20');
  });

  /**
   * Property 2: Preservation - viewing_date 降順ソート
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('viewing_date 降順ソート: 日付比較で正しく動作すること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B001', '田中一郎', '2025-03-15'),
      makeBuyer('B002', '田中二郎', '2025-01-10'),
      makeBuyer('B003', '田中三郎', '2025-06-20'),
    ];

    const result = sortBuyers(buyers, { key: 'viewing_date', direction: 'desc' });

    expect(result[0].viewing_date).toBe('2025-06-20');
    expect(result[1].viewing_date).toBe('2025-03-15');
    expect(result[2].viewing_date).toBe('2025-01-10');
  });

  // ===== inquiry_price: null の末尾配置の保全 =====

  /**
   * Property 2: Preservation - inquiry_price: null の買主は末尾に配置される
   *
   * テスト内容:
   *   inquiry_price: null の買主が存在する場合、
   *   inquiry_price カラムでソートしたとき null の買主が末尾に配置されることを確認する。
   *   これは修正前後で変わってはいけない動作。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('inquiry_price: null の買主は末尾に配置されること（昇順）', () => {
    const buyers: NearbyBuyer[] = [
      { ...makeBuyer('B001', '田中一郎', '2025-01-01'), inquiry_price: null },
      { ...makeBuyer('B002', '田中二郎', '2025-02-01'), inquiry_price: 5000000 },
      { ...makeBuyer('B003', '田中三郎', '2025-03-01'), inquiry_price: null },
      { ...makeBuyer('B004', '田中四郎', '2025-04-01'), inquiry_price: 3000000 },
    ];

    const result = sortBuyers(buyers, { key: 'inquiry_price', direction: 'asc' });

    // null の買主は末尾に配置される
    expect(result[result.length - 1].inquiry_price).toBeNull();
    expect(result[result.length - 2].inquiry_price).toBeNull();
    // null でない買主は先頭側に配置される
    expect(result[0].inquiry_price).not.toBeNull();
    expect(result[1].inquiry_price).not.toBeNull();
  });

  /**
   * Property 2: Preservation - inquiry_price: null の買主は末尾に配置される（降順）
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('inquiry_price: null の買主は末尾に配置されること（降順）', () => {
    const buyers: NearbyBuyer[] = [
      { ...makeBuyer('B001', '田中一郎', '2025-01-01'), inquiry_price: null },
      { ...makeBuyer('B002', '田中二郎', '2025-02-01'), inquiry_price: 5000000 },
      { ...makeBuyer('B003', '田中三郎', '2025-03-01'), inquiry_price: 3000000 },
    ];

    const result = sortBuyers(buyers, { key: 'inquiry_price', direction: 'desc' });

    // null の買主は末尾に配置される
    expect(result[result.length - 1].inquiry_price).toBeNull();
    // null でない買主は先頭側に配置される
    expect(result[0].inquiry_price).not.toBeNull();
    expect(result[1].inquiry_price).not.toBeNull();
  });

  /**
   * Property 2: Preservation - 全員 inquiry_price: null の場合は順序が変わらない
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('全員 inquiry_price: null の場合は相対順序が変わらないこと', () => {
    const buyers: NearbyBuyer[] = [
      { ...makeBuyer('B001', '田中一郎', '2025-01-01'), inquiry_price: null },
      { ...makeBuyer('B002', '田中二郎', '2025-02-01'), inquiry_price: null },
      { ...makeBuyer('B003', '田中三郎', '2025-03-01'), inquiry_price: null },
    ];

    const result = sortBuyers(buyers, { key: 'inquiry_price', direction: 'asc' });

    // 全員 null なので全員末尾扱い → 相対順序は変わらない
    expect(result.map(b => b.buyer_number)).toEqual(['B001', 'B002', 'B003']);
  });

  // ===== ソートなし（key: null）の保全 =====

  /**
   * Property 2: Preservation - ソートなしの場合は元の順序を維持する
   *
   * テスト内容:
   *   sortConfig.key が null の場合、元の配列の順序をそのまま返すことを確認する。
   *
   * EXPECTED: このテストは修正前のコードで PASS する
   */
  test('ソートなし（key: null）の場合は元の順序を維持すること', () => {
    const buyers: NearbyBuyer[] = [
      makeBuyer('B003', '田中三郎', '2025-03-01'),
      makeBuyer('B001', '田中一郎', '2025-01-01'),
      makeBuyer('B002', '田中二郎', '2025-02-01'),
    ];

    const result = sortBuyers(buyers, { key: null, direction: 'asc' });

    // 元の順序を維持
    expect(result[0].buyer_number).toBe('B003');
    expect(result[1].buyer_number).toBe('B001');
    expect(result[2].buyer_number).toBe('B002');
  });
});
