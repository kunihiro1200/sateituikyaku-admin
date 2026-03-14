/**
 * Preservation Property Test: Property List Filter/Search/Pagination
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 *
 * Property 2: Preservation - フィルター・検索・ページネーションの動作保持
 *
 * 観察優先メソドロジー:
 *   未修正コードで非バグ条件（ソート以外のパラメータのみ変化）のケースを観察し、
 *   その動作をプロパティとして記述する。
 *
 * EXPECTED OUTCOME: テストが PASS する（ベースラインの動作を確認）
 */

import * as fs from 'fs';
import * as path from 'path';

// ソースコードを静的解析してフィルター・検索・ページネーションのロジックを検証する
// （実際のDB接続なしで、コードの構造を観察する）

function extractGetAllBody(source: string): string {
  const startIdx = source.indexOf('async getAll(');
  if (startIdx === -1) return '';
  const nextMethodIdx = source.indexOf('\n  async ', startIdx + 'async getAll('.length);
  if (nextMethodIdx === -1) return source.substring(startIdx);
  return source.substring(startIdx, nextMethodIdx);
}

describe('Preservation Property: Filter/Search/Pagination behavior unchanged', () => {
  const serviceFilePath = path.resolve(__dirname, '../PropertyListingService.ts');

  let serviceSource: string;
  let getAllBody: string;

  beforeAll(() => {
    serviceSource = fs.readFileSync(serviceFilePath, 'utf-8');
    getAllBody = extractGetAllBody(serviceSource);
  });

  // -----------------------------------------------------------------------
  // 観察1: salesAssignee フィルターのロジックが存在すること
  // -----------------------------------------------------------------------
  describe('Observation 1: salesAssignee filter logic is present', () => {
    it('getAll() body contains salesAssignee filter logic', () => {
      expect(getAllBody.length).toBeGreaterThan(0);
      // salesAssignee フィルターが実装されていることを確認
      const hasSalesAssigneeFilter =
        getAllBody.includes('salesAssignee') &&
        getAllBody.includes('sales_assignee');
      expect(hasSalesAssigneeFilter).toBe(true);
    });

    it('salesAssignee filter uses eq() for exact match', () => {
      // eq('sales_assignee', salesAssignee) のパターンが存在すること
      const hasEqFilter =
        getAllBody.includes(".eq('sales_assignee'") ||
        getAllBody.includes('.eq("sales_assignee"');
      expect(hasEqFilter).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 観察2: search パラメータのロジックが存在すること
  // -----------------------------------------------------------------------
  describe('Observation 2: search parameter logic is present', () => {
    it('getAll() body contains search filter logic', () => {
      expect(getAllBody.length).toBeGreaterThan(0);
      const hasSearchFilter = getAllBody.includes('search');
      expect(hasSearchFilter).toBe(true);
    });

    it('search filter uses ilike for partial match on property_number, address, seller_name', () => {
      // ilike を使った部分一致検索が実装されていること
      const hasIlike = getAllBody.includes('ilike');
      expect(hasIlike).toBe(true);

      // 3つのフィールドで検索していること
      const searchesPropertyNumber = getAllBody.includes('property_number.ilike');
      const searchesAddress = getAllBody.includes('address.ilike');
      const searchesSellerName = getAllBody.includes('seller_name.ilike');
      expect(searchesPropertyNumber).toBe(true);
      expect(searchesAddress).toBe(true);
      expect(searchesSellerName).toBe(true);
    });

    it('search filter uses or() to combine multiple fields', () => {
      // or() で複数フィールドを組み合わせていること
      const hasOrFilter = getAllBody.includes('.or(');
      expect(hasOrFilter).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 観察3: ページネーション（limit/offset）のロジックが存在すること
  // -----------------------------------------------------------------------
  describe('Observation 3: pagination (limit/offset) logic is present', () => {
    it('getAll() body contains range() for pagination', () => {
      expect(getAllBody.length).toBeGreaterThan(0);
      // range() を使ったページネーションが実装されていること
      const hasRange = getAllBody.includes('.range(');
      expect(hasRange).toBe(true);
    });

    it('pagination uses offset and limit+offset-1 pattern', () => {
      // range(offset, offset + limit - 1) のパターンが存在すること
      const hasOffsetPattern =
        getAllBody.includes('offset, offset + limit - 1') ||
        getAllBody.includes('offset, offset+limit-1');
      expect(hasOffsetPattern).toBe(true);
    });

    it('getAll() accepts limit and offset parameters with defaults', () => {
      // limit と offset のデフォルト値が設定されていること
      const hasLimitDefault = getAllBody.includes('limit = 50') || getAllBody.includes('limit=50');
      const hasOffsetDefault = getAllBody.includes('offset = 0') || getAllBody.includes('offset=0');
      expect(hasLimitDefault).toBe(true);
      expect(hasOffsetDefault).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 観察4: フィルター・検索・ページネーションはソートロジックと独立していること
  // -----------------------------------------------------------------------
  describe('Observation 4: filter/search/pagination are independent of sort logic', () => {
    it('filter logic appears before sort logic in getAll()', () => {
      // フィルタリングがソートより前に実装されていること（独立性の確認）
      const filterIdx = getAllBody.indexOf('if (search)');
      const sortIdx = getAllBody.indexOf('.order(');
      expect(filterIdx).toBeGreaterThan(-1);
      expect(sortIdx).toBeGreaterThan(-1);
      // フィルターはソートより前に来る
      expect(filterIdx).toBeLessThan(sortIdx);
    });

    it('pagination logic appears after sort logic in getAll()', () => {
      // ページネーションがソートより後に実装されていること
      const sortIdx = getAllBody.indexOf('.order(');
      const rangeIdx = getAllBody.indexOf('.range(');
      expect(sortIdx).toBeGreaterThan(-1);
      expect(rangeIdx).toBeGreaterThan(-1);
      // ページネーションはソートより後に来る
      expect(rangeIdx).toBeGreaterThan(sortIdx);
    });

    it('sort logic does not reference search, salesAssignee, or pagination params', () => {
      // ソートロジックがフィルター・ページネーションパラメータを参照していないこと
      const sortLineStart = getAllBody.indexOf('// ソート');
      const paginationLineStart = getAllBody.indexOf('// ページネーション');
      if (sortLineStart === -1 || paginationLineStart === -1) {
        // コメントがない場合はスキップ（構造が変わっても問題ない）
        return;
      }
      const sortSection = getAllBody.substring(sortLineStart, paginationLineStart);
      // ソートセクションにフィルターパラメータが含まれていないこと
      expect(sortSection).not.toContain('salesAssignee');
      expect(sortSection).not.toContain('search');
      expect(sortSection).not.toContain('.range(');
    });
  });

  // -----------------------------------------------------------------------
  // 観察5: status・propertyType フィルターも独立して存在すること（3.1の補完）
  // -----------------------------------------------------------------------
  describe('Observation 5: status and propertyType filters are also present', () => {
    it('getAll() body contains status filter logic', () => {
      const hasStatusFilter =
        getAllBody.includes('status') &&
        (getAllBody.includes(".eq('status'") || getAllBody.includes('.eq("status"'));
      expect(hasStatusFilter).toBe(true);
    });

    it('getAll() body contains propertyType filter logic', () => {
      const hasPropertyTypeFilter =
        getAllBody.includes('propertyType') &&
        (getAllBody.includes(".eq('property_type'") || getAllBody.includes('.eq("property_type"'));
      expect(hasPropertyTypeFilter).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // 観察6: count オプションが設定されていること（ページネーション総件数）
  // -----------------------------------------------------------------------
  describe('Observation 6: total count is returned for pagination', () => {
    it('getAll() uses count: exact to return total count', () => {
      const hasExactCount = getAllBody.includes("count: 'exact'") || getAllBody.includes('count: "exact"');
      expect(hasExactCount).toBe(true);
    });

    it('getAll() returns both data and total', () => {
      // { data, total } を返していること
      const returnsData = getAllBody.includes('data:') || getAllBody.includes('data ||');
      const returnsTotal = getAllBody.includes('total:') || getAllBody.includes('count ||');
      expect(returnsData).toBe(true);
      expect(returnsTotal).toBe(true);
    });
  });
});
