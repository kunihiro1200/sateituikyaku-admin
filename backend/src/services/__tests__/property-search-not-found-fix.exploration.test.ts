/**
 * Bug Condition Exploration Test: Property Search Not Found Fix
 * Validates: Requirements 1.1, 1.2, 1.3
 *
 * CRITICAL: このテストは未修正コードで FAIL することが期待される。
 * FAIL がバグの存在を証明する。テストが FAIL しても修正しないこと。
 *
 * GOAL: バグが存在することを示すカウンターエグザンプルを発見する
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// バグ1テスト: fetchAllData のページネーション終了条件
// ============================================================

function extractFetchAllDataBody(source: string): string {
  const startIdx = source.indexOf('const fetchAllData = async');
  if (startIdx === -1) return '';
  const endMarkers = [
    '\n  const fetchBuyerCounts',
    '\n  const fetchHighConfidenceProperties',
    '\n  // 担当者別カウント',
    '\n  const assigneeCounts',
  ];
  let endIdx = source.length;
  for (const marker of endMarkers) {
    const idx = source.indexOf(marker, startIdx);
    if (idx !== -1 && idx < endIdx) {
      endIdx = idx;
    }
  }
  return source.substring(startIdx, endIdx);
}

/**
 * バグのある終了条件をシミュレートする（pageData で各ページの件数を指定可能）
 *
 * 現在のコード:
 *   if (fetchedData.length < limit || allListingsData.length >= listingsRes.data.total) {
 *     hasMore = false;
 *   }
 *
 * バグが発現するシナリオ:
 * APIが返す total が実際のデータ件数より少ない（過小評価）場合、
 * OR 条件の右辺 allListingsData.length >= total が true になり早期終了する。
 */
function simulateFetchAllDataBuggy(
  reportedTotal: number,
  limit: number,
  pageData?: number[]
): number {
  const allListingsData: any[] = [];
  let offset = 0;
  let hasMore = true;
  let pageIndex = 0;
  const MAX_ITERATIONS = 100;

  while (hasMore && pageIndex < MAX_ITERATIONS) {
    let fetchCount: number;
    if (pageData && pageIndex < pageData.length) {
      fetchCount = pageData[pageIndex];
    } else {
      const remaining = reportedTotal - offset;
      fetchCount = Math.min(limit, Math.max(0, remaining));
    }

    const fetchedData = new Array(fetchCount).fill({ id: `item-${offset}` });
    allListingsData.push(...fetchedData);
    pageIndex++;

    // 現在のバグのある終了条件（OR 条件）
    if (fetchedData.length < limit || allListingsData.length >= reportedTotal) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allListingsData.length;
}

/**
 * 修正後の正しい終了条件をシミュレートする
 *
 * 修正後のコード:
 *   if (fetchedData.length < limit) {
 *     hasMore = false;
 *   }
 */
function simulateFetchAllDataFixed(
  reportedTotal: number,
  limit: number,
  pageData?: number[]
): number {
  const allListingsData: any[] = [];
  let offset = 0;
  let hasMore = true;
  let pageIndex = 0;
  const MAX_ITERATIONS = 100;

  while (hasMore && pageIndex < MAX_ITERATIONS) {
    let fetchCount: number;
    if (pageData && pageIndex < pageData.length) {
      fetchCount = pageData[pageIndex];
    } else {
      const remaining = reportedTotal - offset;
      fetchCount = Math.min(limit, Math.max(0, remaining));
    }

    const fetchedData = new Array(fetchCount).fill({ id: `item-${offset}` });
    allListingsData.push(...fetchedData);
    pageIndex++;

    // 修正後の正しい終了条件（fetchedData.length < limit のみ）
    if (fetchedData.length < limit) {
      hasMore = false;
    } else {
      offset += limit;
    }
  }

  return allListingsData.length;
}

// ============================================================
// バグ2テスト: getAll の SELECT 文に buyer_name が含まれているか
// ============================================================

function extractGetAllSelectClause(source: string): string {
  const startIdx = source.indexOf('async getAll(');
  if (startIdx === -1) return '';
  const nextMethodIdx = source.indexOf('\n  async getByPropertyNumber', startIdx);
  if (nextMethodIdx === -1) return source.substring(startIdx);
  return source.substring(startIdx, nextMethodIdx);
}

// ============================================================
// テストスイート
// ============================================================

describe('Bug Condition Exploration: Property Search Not Found Fix', () => {
  // ============================================================
  // バグ1: fetchAllData のページネーション打ち切りバグ
  // ============================================================
  describe('Bug 1: fetchAllData pagination truncation bug', () => {
    describe('Source code verification: termination condition in PropertyListingsPage.tsx', () => {
      const pageFilePath = path.resolve(
        __dirname,
        '../../../../frontend/frontend/src/pages/PropertyListingsPage.tsx'
      );
      let pageSource: string;
      let fetchAllDataBody: string;

      beforeAll(() => {
        pageSource = fs.readFileSync(pageFilePath, 'utf-8');
        fetchAllDataBody = extractFetchAllDataBody(pageSource);
      });

      it('fetchAllData 関数が存在すること', () => {
        expect(fetchAllDataBody.length).toBeGreaterThan(0);
      });

      it('fetchAllData に limit 変数が定義されていること', () => {
        const hasLimit =
          fetchAllDataBody.includes('const limit = 1000') ||
          fetchAllDataBody.includes('const limit=1000');
        expect(hasLimit).toBe(true);
      });

      it('fetchAllData に hasMore フラグが使用されていること', () => {
        expect(fetchAllDataBody.includes('hasMore')).toBe(true);
      });

      /**
       * **Validates: Requirements 1.2**
       *
       * 現在のコードに OR 条件（バグ）が含まれていることを確認する。
       * EXPECTED: このテストは未修正コードで PASS する（バグが存在することを確認）
       */
      it('fetchAllData に OR 条件（バグ）が含まれていること（未修正コードでPASS）', () => {
        expect(fetchAllDataBody.length).toBeGreaterThan(0);
        const hasBuggyOrCondition =
          fetchAllDataBody.includes('fetchedData.length < limit || allListingsData.length >= listingsRes.data.total') ||
          fetchAllDataBody.includes('fetchedData.length < limit || allListingsData.length >=');
        expect(hasBuggyOrCondition).toBe(true);
      });

      /**
       * **Validates: Requirements 2.2**
       *
       * 修正後のコードには OR 条件が含まれていないことを確認する。
       * EXPECTED: このテストは未修正コードで FAIL する（バグが存在するため）
       */
      it('fetchAllData に OR 条件（バグ）が含まれていないこと（未修正コードでFAIL）', () => {
        expect(fetchAllDataBody.length).toBeGreaterThan(0);
        const hasBuggyOrCondition =
          fetchAllDataBody.includes('fetchedData.length < limit || allListingsData.length >= listingsRes.data.total') ||
          fetchAllDataBody.includes('fetchedData.length < limit || allListingsData.length >=');
        // 修正後の期待動作: OR 条件が存在しない
        expect(hasBuggyOrCondition).toBe(false);
      });
    });

    describe('Simulation: OR condition causes early termination when total is underestimated', () => {
      /**
       * **Validates: Requirements 1.2**
       *
       * total=1000（過小評価）、実際のデータ=1500件の場合、
       * バグのある実装は1000件で止まることを確認する（カウンターエグザンプル）。
       *
       * EXPECTED: このテストは未修正コードで PASS する（バグの実際の動作を記録）
       */
      it('total=1000（過小評価）の場合、バグのある実装は1000件で止まること（カウンターエグザンプル）', () => {
        const reportedTotal = 1000; // APIが返す total（過小評価）
        const limit = 1000;
        const actualPageData = [1000, 500]; // 実際は1500件（2ページ目に500件ある）

        const buggyCount = simulateFetchAllDataBuggy(reportedTotal, limit, actualPageData);

        // バグのある実装: 1ページ目で allListingsData.length(1000) >= total(1000) → 終了
        // 2ページ目の500件が取得されない
        expect(buggyCount).toBe(1000);
        expect(buggyCount).not.toBe(1500);
      });

      /**
       * **Validates: Requirements 2.2**
       *
       * 修正後の実装では total が過小評価されても全ページを取得することを確認する。
       * EXPECTED: このテストは未修正コードで PASS する（修正後の期待動作を確認）
       */
      it('修正後の実装では total が過小評価されても全ページを取得すること', () => {
        const reportedTotal = 1000;
        const limit = 1000;
        const actualPageData = [1000, 500];

        const fixedCount = simulateFetchAllDataFixed(reportedTotal, limit, actualPageData);

        // 修正後: fetchedData.length < limit のみで判定
        // 1ページ目: 1000 < 1000 = false → 継続
        // 2ページ目: 500 < 1000 = true → 終了
        // 全1500件取得
        expect(fixedCount).toBe(1500);
      });

      it('バグのある実装と修正後の実装の動作の違いを証明すること', () => {
        const reportedTotal = 1000;
        const limit = 1000;
        const actualPageData = [1000, 500];

        const buggyCount = simulateFetchAllDataBuggy(reportedTotal, limit, actualPageData);
        const fixedCount = simulateFetchAllDataFixed(reportedTotal, limit, actualPageData);

        expect(buggyCount).toBe(1000);
        expect(fixedCount).toBe(1500);
        expect(buggyCount).not.toBe(fixedCount);
      });
    });

    describe('Normal cases: bug does not manifest when total is accurate', () => {
      it('total=1500, limit=1000 の場合（total が正確）、バグのある実装でも全件取得できること', () => {
        const buggyCount = simulateFetchAllDataBuggy(1500, 1000);
        expect(buggyCount).toBe(1500);
      });

      it('total=500, limit=1000 の場合（1ページ未満）、バグのある実装でも全件取得できること', () => {
        const buggyCount = simulateFetchAllDataBuggy(500, 1000);
        expect(buggyCount).toBe(500);
      });
    });
  });

  // ============================================================
  // バグ2: getAll の SELECT 文に buyer_name が含まれていないバグ
  // ============================================================
  describe('Bug 2: buyer_name missing from getAll SELECT clause', () => {
    const serviceFilePath = path.resolve(__dirname, '../PropertyListingService.ts');
    let serviceSource: string;
    let getAllBody: string;

    beforeAll(() => {
      serviceSource = fs.readFileSync(serviceFilePath, 'utf-8');
      getAllBody = extractGetAllSelectClause(serviceSource);
    });

    it('getAll メソッドが存在すること', () => {
      expect(getAllBody.length).toBeGreaterThan(0);
    });

    it('getAll の SELECT 文に seller_name が含まれていること（参照用）', () => {
      expect(getAllBody.includes('seller_name')).toBe(true);
    });

    it('getAll の SELECT 文に sales_assignee が含まれていること（参照用）', () => {
      expect(getAllBody.includes('sales_assignee')).toBe(true);
    });

    /**
     * **Validates: Requirements 1.3**
     *
     * getAll の SELECT 文に buyer_name が含まれていないことを確認する。
     * EXPECTED: このテストは未修正コードで PASS する（バグが存在することを確認）
     */
    it('getAll の SELECT 文に buyer_name が含まれていないこと（未修正コードでPASS）', () => {
      expect(getAllBody.length).toBeGreaterThan(0);
      const hasBuyerName = getAllBody.includes('buyer_name');
      expect(hasBuyerName).toBe(false);
    });

    /**
     * **Validates: Requirements 2.3**
     *
     * 修正後は getAll の SELECT 文に buyer_name が含まれることを確認する。
     * EXPECTED: このテストは未修正コードで FAIL する（バグが存在するため）
     */
    it('getAll の SELECT 文に buyer_name が含まれていること（未修正コードでFAIL）', () => {
      expect(getAllBody.length).toBeGreaterThan(0);
      const hasBuyerName = getAllBody.includes('buyer_name');
      // 修正後の期待動作: buyer_name が SELECT 文に含まれる
      expect(hasBuyerName).toBe(true);
    });

    /**
     * **Validates: Requirements 1.3**
     *
     * buyer_name が undefined になることで買主名検索が機能しないことを確認する。
     * カウンターエグザンプル
     */
    it('buyer_name が SELECT に含まれない場合、フィルタリングが機能しないこと（カウンターエグザンプル）', () => {
      const mockListingWithoutBuyerName = {
        id: 'test-id',
        property_number: 'AA9195',
        seller_name: '田中太郎',
        // buyer_name は含まれない（バグ）
      };

      const searchQuery = '田中花子';

      const matchesBuyerName = (listing: any, query: string): boolean => {
        return listing.buyer_name?.toLowerCase().includes(query.toLowerCase()) ?? false;
      };

      const result = matchesBuyerName(mockListingWithoutBuyerName, searchQuery);

      // buyer_name が undefined のため検索が機能しない
      expect(result).toBe(false);
      expect(mockListingWithoutBuyerName.hasOwnProperty('buyer_name')).toBe(false);
    });
  });
});
