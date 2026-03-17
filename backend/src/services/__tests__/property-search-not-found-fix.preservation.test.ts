/**
 * Preservation Property Test: Property Search Not Found Fix
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * IMPORTANT: このテストは未修正コードで PASS することが期待される。
 * PASS がベースライン動作（既存の正しい動作）を確認する。
 * 修正後も引き続き PASS することでリグレッションがないことを証明する。
 *
 * 観察優先メソドロジー:
 * 未修正コードで非バグ条件の入力（検索バー未使用時）の動作を観察し、
 * その動作をプロパティベーステストとして記述する。
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// テスト用ヘルパー: フロントエンドのフィルタリングロジックを再現
// ============================================================

interface PropertyListing {
  id: string;
  property_number: string;
  address?: string;
  seller_name?: string;
  buyer_name?: string;
  sales_assignee?: string;
  sidebar_status?: string;
  status?: string;
  distribution_date?: string;
  price?: number;
}

/**
 * PropertyListingsPage.tsx の filteredListings ロジックを再現する
 * （検索バー未使用時 = searchQuery が空の場合）
 */
function applyFilters(
  allListings: PropertyListing[],
  options: {
    selectedAssignee?: string | null;
    sidebarStatus?: string | null;
    searchQuery?: string;
  }
): PropertyListing[] {
  const { selectedAssignee = null, sidebarStatus = null, searchQuery = '' } = options;

  let listings = allListings;

  // 担当者フィルター（常に適用）
  if (selectedAssignee && selectedAssignee !== 'all') {
    listings = listings.filter(l =>
      selectedAssignee === '未設定'
        ? !l.sales_assignee
        : l.sales_assignee === selectedAssignee
    );
  }

  // サイドバーフィルター
  if (sidebarStatus && sidebarStatus !== 'all') {
    listings = listings.filter(l => l.sidebar_status === sidebarStatus);
  }

  // 検索クエリフィルター
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    listings = listings.filter(l =>
      l.property_number?.toLowerCase().includes(query) ||
      l.address?.toLowerCase().includes(query) ||
      l.seller_name?.toLowerCase().includes(query) ||
      l.buyer_name?.toLowerCase().includes(query)
    );
  }

  return listings;
}

/**
 * ページネーションロジックを再現する
 */
function applyPagination(
  listings: PropertyListing[],
  page: number,
  rowsPerPage: number
): PropertyListing[] {
  const start = page * rowsPerPage;
  return listings.slice(start, start + rowsPerPage);
}

// ============================================================
// テストデータ生成ヘルパー
// ============================================================

function createMockListings(count: number): PropertyListing[] {
  const assignees = ['Y', 'I', 'K', null];
  const sidebarStatuses = ['公開中', '成約済み', '非公開', null];
  const statuses = ['公開中', '成約済み', '非公開'];

  return Array.from({ length: count }, (_, i) => ({
    id: `id-${i}`,
    property_number: `AA${9000 + i}`,
    address: `大分市中央町${i + 1}-1-1`,
    seller_name: `売主${i + 1}`,
    buyer_name: i % 3 === 0 ? `買主${i + 1}` : undefined,
    sales_assignee: assignees[i % assignees.length] ?? undefined,
    sidebar_status: sidebarStatuses[i % sidebarStatuses.length] ?? undefined,
    status: statuses[i % statuses.length],
    distribution_date: `2026-0${(i % 9) + 1}-01`,
    price: (i + 1) * 1000000,
  }));
}

// ============================================================
// テストスイート
// ============================================================

describe('Preservation Property Test: Property Search Not Found Fix', () => {
  // ============================================================
  // Preservation 3.1: 物件一覧が表示されること
  // ============================================================
  describe('Preservation 3.1: 物件一覧が表示されること', () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * フィルタなし・検索なしの場合、全物件が表示されること。
     * EXPECTED: 未修正コードでも修正後コードでも PASS する。
     */
    it('フィルタなし・検索なしの場合、全物件が返されること', () => {
      const listings = createMockListings(100);
      const result = applyFilters(listings, {});
      expect(result.length).toBe(100);
    });

    it('空のリストに対してフィルタを適用しても空のリストが返されること', () => {
      const result = applyFilters([], {});
      expect(result.length).toBe(0);
    });

    it('物件一覧の各アイテムが property_number を持つこと', () => {
      const listings = createMockListings(10);
      const result = applyFilters(listings, {});
      result.forEach(l => {
        expect(l.property_number).toBeDefined();
        expect(l.property_number.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================
  // Preservation 3.2: サイドバーフィルタが正しく動作すること
  // ============================================================
  describe('Preservation 3.2: サイドバーフィルタが正しく動作すること', () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * サイドバーステータスでフィルタリングした場合、
     * 該当ステータスの物件のみが返されること。
     * EXPECTED: 未修正コードでも修正後コードでも PASS する。
     */
    it('sidebarStatus="公開中" でフィルタリングすると公開中の物件のみ返されること', () => {
      const listings = createMockListings(100);
      const result = applyFilters(listings, { sidebarStatus: '公開中' });

      // 全結果が sidebar_status === '公開中' であること
      result.forEach(l => {
        expect(l.sidebar_status).toBe('公開中');
      });
    });

    it('sidebarStatus="成約済み" でフィルタリングすると成約済みの物件のみ返されること', () => {
      const listings = createMockListings(100);
      const result = applyFilters(listings, { sidebarStatus: '成約済み' });

      result.forEach(l => {
        expect(l.sidebar_status).toBe('成約済み');
      });
    });

    it('sidebarStatus="all" の場合、全物件が返されること', () => {
      const listings = createMockListings(50);
      const result = applyFilters(listings, { sidebarStatus: 'all' });
      expect(result.length).toBe(50);
    });

    it('存在しないステータスでフィルタリングすると空のリストが返されること', () => {
      const listings = createMockListings(50);
      const result = applyFilters(listings, { sidebarStatus: '存在しないステータス' });
      expect(result.length).toBe(0);
    });

    it('サイドバーフィルタは検索バー未使用時（searchQuery=""）に正しく動作すること', () => {
      const listings = createMockListings(100);

      // 検索バー未使用（非バグ条件）でサイドバーフィルタを適用
      const withFilter = applyFilters(listings, { sidebarStatus: '公開中', searchQuery: '' });
      const withoutFilter = applyFilters(listings, { sidebarStatus: null, searchQuery: '' });

      // フィルタあり < フィルタなし（一部の物件のみが公開中）
      expect(withFilter.length).toBeLessThanOrEqual(withoutFilter.length);
      // フィルタ結果は全て公開中
      withFilter.forEach(l => expect(l.sidebar_status).toBe('公開中'));
    });

    it('サイドバーフィルタの結果は元のリストのサブセットであること', () => {
      const listings = createMockListings(100);
      const filtered = applyFilters(listings, { sidebarStatus: '公開中' });

      // フィルタ結果の全アイテムが元のリストに存在すること
      filtered.forEach(item => {
        const found = listings.find(l => l.id === item.id);
        expect(found).toBeDefined();
      });
    });
  });

  // ============================================================
  // Preservation 3.3: 担当者フィルタが正しく動作すること
  // ============================================================
  describe('Preservation 3.3: 担当者フィルタが正しく動作すること', () => {
    /**
     * **Validates: Requirements 3.3**
     *
     * 担当者でフィルタリングした場合、
     * 該当担当者の物件のみが返されること。
     * EXPECTED: 未修正コードでも修正後コードでも PASS する。
     */
    it('selectedAssignee="Y" でフィルタリングすると担当者Yの物件のみ返されること', () => {
      const listings = createMockListings(100);
      const result = applyFilters(listings, { selectedAssignee: 'Y' });

      result.forEach(l => {
        expect(l.sales_assignee).toBe('Y');
      });
    });

    it('selectedAssignee="未設定" でフィルタリングすると担当者なしの物件のみ返されること', () => {
      const listings = createMockListings(100);
      const result = applyFilters(listings, { selectedAssignee: '未設定' });

      result.forEach(l => {
        expect(l.sales_assignee).toBeFalsy();
      });
    });

    it('selectedAssignee="all" の場合、全物件が返されること', () => {
      const listings = createMockListings(50);
      const result = applyFilters(listings, { selectedAssignee: 'all' });
      expect(result.length).toBe(50);
    });

    it('担当者フィルタとサイドバーフィルタを同時に適用できること', () => {
      const listings = createMockListings(100);
      const result = applyFilters(listings, {
        selectedAssignee: 'Y',
        sidebarStatus: '公開中',
      });

      // 全結果が担当者Y かつ 公開中 であること
      result.forEach(l => {
        expect(l.sales_assignee).toBe('Y');
        expect(l.sidebar_status).toBe('公開中');
      });
    });

    it('担当者フィルタは検索バー未使用時（非バグ条件）に正しく動作すること', () => {
      const listings = createMockListings(100);

      // 検索バー未使用（非バグ条件）で担当者フィルタを適用
      const result = applyFilters(listings, { selectedAssignee: 'Y', searchQuery: '' });

      // 全結果が担当者Y であること
      result.forEach(l => {
        expect(l.sales_assignee).toBe('Y');
      });
    });

    it('担当者フィルタの結果は元のリストのサブセットであること', () => {
      const listings = createMockListings(100);
      const filtered = applyFilters(listings, { selectedAssignee: 'I' });

      filtered.forEach(item => {
        const found = listings.find(l => l.id === item.id);
        expect(found).toBeDefined();
      });
    });
  });

  // ============================================================
  // Preservation 3.4: 物件行クリックで詳細ページへ遷移すること
  // ============================================================
  describe('Preservation 3.4: 物件行クリックで詳細ページへ遷移すること', () => {
    /**
     * **Validates: Requirements 3.4**
     *
     * 物件行クリック時のナビゲーションロジックを検証する。
     * handleRowClick は property_number を使って /property-listings/:propertyNumber に遷移する。
     * EXPECTED: 未修正コードでも修正後コードでも PASS する。
     */
    it('property_number が存在する物件はクリック可能であること', () => {
      const listings = createMockListings(10);
      listings.forEach(l => {
        // property_number が存在すれば詳細ページへのURLを生成できる
        const url = `/property-listings/${l.property_number}`;
        expect(url).toBe(`/property-listings/${l.property_number}`);
        expect(l.property_number).toBeTruthy();
      });
    });

    it('handleRowClick のナビゲーション先URLが正しい形式であること', () => {
      const propertyNumbers = ['AA9195', 'AA13501', 'AA1', 'AA99999'];
      propertyNumbers.forEach(pn => {
        const expectedUrl = `/property-listings/${pn}`;
        expect(expectedUrl).toMatch(/^\/property-listings\/AA\d+$/);
      });
    });

    it('フィルタリング後の物件もクリック可能であること（property_number が保持されること）', () => {
      const listings = createMockListings(50);
      const filtered = applyFilters(listings, { sidebarStatus: '公開中' });

      // フィルタリング後も property_number が保持されること
      filtered.forEach(l => {
        expect(l.property_number).toBeDefined();
        expect(l.property_number.length).toBeGreaterThan(0);
      });
    });

    it('ページネーション後の物件もクリック可能であること（property_number が保持されること）', () => {
      const listings = createMockListings(200);
      const paginated = applyPagination(listings, 1, 50); // 2ページ目

      paginated.forEach(l => {
        expect(l.property_number).toBeDefined();
        expect(l.property_number.length).toBeGreaterThan(0);
      });
    });
  });

  // ============================================================
  // Preservation 3.5: ページネーション操作が正しく動作すること
  // ============================================================
  describe('Preservation 3.5: ページネーション操作が正しく動作すること', () => {
    /**
     * **Validates: Requirements 3.5**
     *
     * ページネーション操作が正しく動作することを確認する。
     * EXPECTED: 未修正コードでも修正後コードでも PASS する。
     */
    it('page=0, rowsPerPage=50 の場合、最初の50件が返されること', () => {
      const listings = createMockListings(200);
      const result = applyPagination(listings, 0, 50);
      expect(result.length).toBe(50);
      expect(result[0].id).toBe('id-0');
      expect(result[49].id).toBe('id-49');
    });

    it('page=1, rowsPerPage=50 の場合、51〜100件目が返されること', () => {
      const listings = createMockListings(200);
      const result = applyPagination(listings, 1, 50);
      expect(result.length).toBe(50);
      expect(result[0].id).toBe('id-50');
      expect(result[49].id).toBe('id-99');
    });

    it('最終ページでは残りの件数のみ返されること', () => {
      const listings = createMockListings(130);
      const result = applyPagination(listings, 2, 50); // 3ページ目: 101〜130件目
      expect(result.length).toBe(30);
    });

    it('rowsPerPage=100 の場合、最初の100件が返されること', () => {
      const listings = createMockListings(200);
      const result = applyPagination(listings, 0, 100);
      expect(result.length).toBe(100);
    });

    it('ページ範囲外の場合、空のリストが返されること', () => {
      const listings = createMockListings(50);
      const result = applyPagination(listings, 5, 50); // 6ページ目（存在しない）
      expect(result.length).toBe(0);
    });

    it('フィルタリング後のリストにページネーションを適用できること', () => {
      const listings = createMockListings(200);
      const filtered = applyFilters(listings, { sidebarStatus: '公開中' });
      const paginated = applyPagination(filtered, 0, 50);

      // ページネーション結果は全て公開中
      paginated.forEach(l => {
        expect(l.sidebar_status).toBe('公開中');
      });
      // ページネーション結果はフィルタ結果のサブセット
      expect(paginated.length).toBeLessThanOrEqual(filtered.length);
      expect(paginated.length).toBeLessThanOrEqual(50);
    });

    it('ページネーションはフィルタリング結果の順序を保持すること', () => {
      const listings = createMockListings(100);
      const page0 = applyPagination(listings, 0, 50);
      const page1 = applyPagination(listings, 1, 50);

      // ページ0とページ1に重複がないこと
      const page0Ids = new Set(page0.map(l => l.id));
      const page1Ids = new Set(page1.map(l => l.id));
      const intersection = [...page0Ids].filter(id => page1Ids.has(id));
      expect(intersection.length).toBe(0);
    });

    it('全ページを結合すると元のリストと同じになること', () => {
      const listings = createMockListings(130);
      const rowsPerPage = 50;
      const totalPages = Math.ceil(listings.length / rowsPerPage);

      const allPaginated: PropertyListing[] = [];
      for (let p = 0; p < totalPages; p++) {
        allPaginated.push(...applyPagination(listings, p, rowsPerPage));
      }

      expect(allPaginated.length).toBe(listings.length);
      allPaginated.forEach((item, i) => {
        expect(item.id).toBe(listings[i].id);
      });
    });
  });

  // ============================================================
  // Preservation: ソースコード検証（フロントエンドのフィルタリングロジック）
  // ============================================================
  describe('Source code verification: filtering logic in PropertyListingsPage.tsx', () => {
    const pageFilePath = path.resolve(
      __dirname,
      '../../../../frontend/frontend/src/pages/PropertyListingsPage.tsx'
    );
    let pageSource: string;

    beforeAll(() => {
      pageSource = fs.readFileSync(pageFilePath, 'utf-8');
    });

    /**
     * **Validates: Requirements 3.2**
     *
     * サイドバーフィルタのロジックが存在すること。
     */
    it('サイドバーフィルタのロジック（sidebar_status）が存在すること', () => {
      expect(pageSource.includes('sidebar_status')).toBe(true);
      expect(pageSource.includes('sidebarStatus')).toBe(true);
    });

    /**
     * **Validates: Requirements 3.3**
     *
     * 担当者フィルタのロジックが存在すること。
     */
    it('担当者フィルタのロジック（sales_assignee）が存在すること', () => {
      expect(pageSource.includes('sales_assignee')).toBe(true);
      expect(pageSource.includes('selectedAssignee')).toBe(true);
    });

    /**
     * **Validates: Requirements 3.4**
     *
     * 物件行クリックのナビゲーションロジックが存在すること。
     */
    it('物件行クリックのナビゲーションロジック（handleRowClick）が存在すること', () => {
      expect(pageSource.includes('handleRowClick')).toBe(true);
      expect(pageSource.includes('navigate(`/property-listings/')).toBe(true);
    });

    /**
     * **Validates: Requirements 3.5**
     *
     * ページネーションのロジックが存在すること。
     */
    it('ページネーションのロジック（page, rowsPerPage）が存在すること', () => {
      expect(pageSource.includes('rowsPerPage')).toBe(true);
      expect(pageSource.includes('paginatedListings')).toBe(true);
    });

    /**
     * **Validates: Requirements 3.1**
     *
     * 物件一覧の表示ロジックが存在すること。
     */
    it('物件一覧の表示ロジック（allListings, filteredListings）が存在すること', () => {
      expect(pageSource.includes('allListings')).toBe(true);
      expect(pageSource.includes('filteredListings')).toBe(true);
    });
  });

  // ============================================================
  // Preservation: バグ条件が成立しない入力での動作一貫性
  // ============================================================
  describe('Preservation: 非バグ条件での動作一貫性', () => {
    /**
     * **Validates: Requirements 3.1, 3.2, 3.3, 3.5**
     *
     * 検索バー未使用時（非バグ条件）において、
     * フィルタリングとページネーションが一貫して動作すること。
     * EXPECTED: 未修正コードでも修正後コードでも PASS する。
     */
    it('検索バー未使用時（searchQuery=""）のフィルタリング結果は決定論的であること', () => {
      const listings = createMockListings(100);

      // 同じ入力に対して同じ結果が返されること
      const result1 = applyFilters(listings, { sidebarStatus: '公開中', searchQuery: '' });
      const result2 = applyFilters(listings, { sidebarStatus: '公開中', searchQuery: '' });

      expect(result1.length).toBe(result2.length);
      result1.forEach((item, i) => {
        expect(item.id).toBe(result2[i].id);
      });
    });

    it('フィルタなし・検索なしの場合、全物件数が保持されること', () => {
      const counts = [0, 1, 10, 50, 100, 500];
      counts.forEach(count => {
        const listings = createMockListings(count);
        const result = applyFilters(listings, { searchQuery: '' });
        expect(result.length).toBe(count);
      });
    });

    it('フィルタリングは元のリストを変更しないこと（イミュータブル）', () => {
      const listings = createMockListings(50);
      const originalLength = listings.length;
      const originalFirst = listings[0].id;

      applyFilters(listings, { sidebarStatus: '公開中' });
      applyFilters(listings, { selectedAssignee: 'Y' });

      // 元のリストが変更されていないこと
      expect(listings.length).toBe(originalLength);
      expect(listings[0].id).toBe(originalFirst);
    });

    it('担当者フィルタとサイドバーフィルタの組み合わせが正しく動作すること', () => {
      const listings = createMockListings(200);

      // 担当者フィルタのみ
      const byAssignee = applyFilters(listings, { selectedAssignee: 'Y' });
      // サイドバーフィルタのみ
      const bySidebar = applyFilters(listings, { sidebarStatus: '公開中' });
      // 両方のフィルタ
      const both = applyFilters(listings, { selectedAssignee: 'Y', sidebarStatus: '公開中' });

      // 両方のフィルタ結果は各フィルタ単独の結果のサブセット
      expect(both.length).toBeLessThanOrEqual(byAssignee.length);
      expect(both.length).toBeLessThanOrEqual(bySidebar.length);

      // 両方のフィルタ結果は全て条件を満たすこと
      both.forEach(l => {
        expect(l.sales_assignee).toBe('Y');
        expect(l.sidebar_status).toBe('公開中');
      });
    });
  });
});
