/**
 * バグ条件の探索テスト: 固定資産税路線価のスプシ→DB同期欠落
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * このテストは未修正コードで**失敗する**ことが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグ条件:
 *   row['固定資産税路線価'] に値がある場合、
 *   syncSingleSeller / updateSingleSeller が
 *   fixed_asset_tax_road_price を DB に保存しない。
 */

import * as fc from 'fast-check';

// ============================================================
// モック定義
// ============================================================

// Supabase クライアントのモック
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

// upsert チェーン: .upsert(...).select().single()
const mockUpsertChain = {
  select: jest.fn().mockReturnValue({
    single: jest.fn().mockResolvedValue({
      data: { id: 'mock-seller-id', seller_number: 'AA99999' },
      error: null,
    }),
  }),
};
mockUpsert.mockReturnValue(mockUpsertChain);

// update チェーン: .update(...).eq(...)
const mockUpdateChain = {
  eq: jest.fn().mockResolvedValue({ error: null }),
};
mockUpdate.mockReturnValue(mockUpdateChain);

// select チェーン: .select(...).eq(...).single()
const mockSelectChain = {
  eq: jest.fn().mockReturnValue({
    single: jest.fn().mockResolvedValue({
      data: { id: 'mock-seller-id' },
      error: null,
    }),
  }),
};
mockSelect.mockReturnValue(mockSelectChain);

const mockFrom = jest.fn().mockImplementation((table: string) => ({
  upsert: mockUpsert,
  update: mockUpdate,
  select: mockSelect,
}));

// @supabase/supabase-js をモック
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: mockFrom,
  }),
}));

// GoogleSheetsClient をモック（初期化不要）
jest.mock('../services/GoogleSheetsClient', () => ({
  GoogleSheetsClient: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue(undefined),
    readAll: jest.fn().mockResolvedValue([]),
  })),
}));

// ColumnMapper をモック
jest.mock('../services/ColumnMapper', () => ({
  ColumnMapper: jest.fn().mockImplementation(() => ({
    mapToDatabase: jest.fn().mockImplementation((row: any) => ({
      name: row['名前(漢字のみ）'] || null,
      address: row['依頼者住所(物件所在と異なる場合）'] || null,
      phone_number: row['電話番号\nハイフン不要'] || null,
      email: row['メールアドレス'] || null,
      status: row['状況（当社）'] || '追客中',
      next_call_date: row['次電日'] || null,
      pinrich_status: row['Pinrich'] || null,
    })),
  })),
}));

// PropertySyncHandler をモック
jest.mock('../services/PropertySyncHandler', () => ({
  PropertySyncHandler: jest.fn().mockImplementation(() => ({
    syncProperty: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ExclusionDateCalculator をモック
jest.mock('../services/ExclusionDateCalculator', () => ({
  ExclusionDateCalculator: {
    calculateExclusionDate: jest.fn().mockReturnValue(null),
  },
}));

// encryption をモック
jest.mock('../utils/encryption', () => ({
  encrypt: jest.fn().mockImplementation((v: string) => `encrypted:${v}`),
  decrypt: jest.fn().mockImplementation((v: string) => v.replace('encrypted:', '')),
}));

// ============================================================
// テスト対象のインポート（モック設定後）
// ============================================================
import { EnhancedAutoSyncService } from '../services/EnhancedAutoSyncService';

// ============================================================
// ヘルパー: upsert/update に渡されたデータを取得
// ============================================================

/**
 * syncSingleSeller 呼び出し後に upsert に渡されたデータを返す
 */
function getCapturedUpsertData(): any {
  const calls = mockUpsert.mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0]; // 最後の呼び出しの第1引数
}

/**
 * updateSingleSeller 呼び出し後に update に渡されたデータを返す
 */
function getCapturedUpdateData(): any {
  const calls = mockUpdate.mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0]; // 最後の呼び出しの第1引数
}

// ============================================================
// テストスイート
// ============================================================

describe('バグ条件の探索テスト: 固定資産税路線価のスプシ→DB同期欠落', () => {
  let service: EnhancedAutoSyncService;

  beforeEach(() => {
    jest.clearAllMocks();

    // upsert チェーンを再設定（clearAllMocks でリセットされるため）
    mockUpsertChain.select.mockReturnValue({
      single: jest.fn().mockResolvedValue({
        data: { id: 'mock-seller-id', seller_number: 'AA99999' },
        error: null,
      }),
    });
    mockUpsert.mockReturnValue(mockUpsertChain);
    mockUpdate.mockReturnValue(mockUpdateChain);
    mockSelect.mockReturnValue(mockSelectChain);

    service = new EnhancedAutoSyncService(
      'https://mock.supabase.co',
      'mock-key'
    );
  });

  // ----------------------------------------------------------
  // テスト1: syncSingleSeller - 新規売主作成時のバグ確認
  // ----------------------------------------------------------
  describe('syncSingleSeller: 新規売主作成時', () => {
    it(
      '【バグ確認】row["固定資産税路線価"] = 50000 のとき fixed_asset_tax_road_price が DB に保存されること（未修正コードでは失敗する）',
      async () => {
        // Arrange: 固定資産税路線価に値がある行データ
        const row = {
          '売主番号': 'AA99999',
          '名前(漢字のみ）': 'テスト太郎',
          '状況（当社）': '追客中',
          '固定資産税路線価': '50000',
        };

        // Act
        await service.syncSingleSeller('AA99999', row);

        // Assert: upsert に渡されたデータに fixed_asset_tax_road_price が含まれること
        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();

        // このアサーションは未修正コードで失敗する（バグの存在を証明）
        // 修正後は 50000 が保存されるべき
        expect(upsertData.fixed_asset_tax_road_price).toBe(50000);
      }
    );

    it(
      '【バグ確認】row["固定資産税路線価"] = 80000 のとき fixed_asset_tax_road_price が DB に保存されること（未修正コードでは失敗する）',
      async () => {
        const row = {
          '売主番号': 'AA99998',
          '名前(漢字のみ）': 'テスト花子',
          '状況（当社）': '追客中',
          '固定資産税路線価': '80000',
        };

        await service.syncSingleSeller('AA99998', row);

        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();

        // 未修正コードでは失敗する
        expect(upsertData.fixed_asset_tax_road_price).toBe(80000);
      }
    );
  });

  // ----------------------------------------------------------
  // テスト2: updateSingleSeller - 既存売主更新時のバグ確認
  // ----------------------------------------------------------
  describe('updateSingleSeller: 既存売主更新時', () => {
    it(
      '【バグ確認】row["固定資産税路線価"] = 80000 のとき fixed_asset_tax_road_price が DB に更新されること（未修正コードでは失敗する）',
      async () => {
        // Arrange: 固定資産税路線価に値がある行データ
        const row = {
          '売主番号': 'AA99997',
          '名前(漢字のみ）': 'テスト次郎',
          '状況（当社）': '追客中',
          '固定資産税路線価': '80000',
        };

        // Act
        await service.updateSingleSeller('AA99997', row);

        // Assert: update に渡されたデータに fixed_asset_tax_road_price が含まれること
        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();

        // このアサーションは未修正コードで失敗する（バグの存在を証明）
        // 修正後は 80000 が保存されるべき
        expect(updateData.fixed_asset_tax_road_price).toBe(80000);
      }
    );

    it(
      '【バグ確認】row["固定資産税路線価"] = 60000 のとき fixed_asset_tax_road_price が DB に更新されること（未修正コードでは失敗する）',
      async () => {
        const row = {
          '売主番号': 'AA99996',
          '状況（当社）': '追客中',
          '固定資産税路線価': '60000',
        };

        await service.updateSingleSeller('AA99996', row);

        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();

        // 未修正コードでは失敗する
        expect(updateData.fixed_asset_tax_road_price).toBe(60000);
      }
    );
  });

  // ----------------------------------------------------------
  // テスト3: プロパティベーステスト（fast-check）
  // ----------------------------------------------------------
  describe('プロパティベーステスト: 任意の路線価値で同期されること', () => {
    it(
      '【バグ確認 PBT】syncSingleSeller: 任意の正の数値が fixed_asset_tax_road_price として保存されること（未修正コードでは失敗する）',
      async () => {
        /**
         * Validates: Requirements 1.1, 1.2
         *
         * Property: row['固定資産税路線価'] に任意の正の数値が入っている場合、
         * syncSingleSeller は fixed_asset_tax_road_price をその数値で DB に保存しなければならない。
         *
         * 未修正コードではこのプロパティが成立しない（バグの存在を証明）。
         */
        await fc.assert(
          fc.asyncProperty(
            // 路線価として有効な範囲: 1〜9,999,999 円/㎡
            fc.integer({ min: 1, max: 9_999_999 }),
            async (roadPrice) => {
              jest.clearAllMocks();
              mockUpsert.mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'mock-id', seller_number: 'AA99999' },
                    error: null,
                  }),
                }),
              });
              mockUpdate.mockReturnValue(mockUpdateChain);
              mockSelect.mockReturnValue(mockSelectChain);

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                '固定資産税路線価': String(roadPrice),
              };

              await service.syncSingleSeller('AA99999', row);

              const upsertData = getCapturedUpsertData();
              // 未修正コードでは fixed_asset_tax_road_price が undefined/null のため失敗する
              return upsertData?.fixed_asset_tax_road_price === roadPrice;
            }
          ),
          { numRuns: 20 }
        );
      }
    );

    it(
      '【バグ確認 PBT】updateSingleSeller: 任意の正の数値が fixed_asset_tax_road_price として保存されること（未修正コードでは失敗する）',
      async () => {
        /**
         * Validates: Requirements 1.1, 1.2
         *
         * Property: row['固定資産税路線価'] に任意の正の数値が入っている場合、
         * updateSingleSeller は fixed_asset_tax_road_price をその数値で DB に更新しなければならない。
         *
         * 未修正コードではこのプロパティが成立しない（バグの存在を証明）。
         */
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 9_999_999 }),
            async (roadPrice) => {
              jest.clearAllMocks();
              mockUpsert.mockReturnValue(mockUpsertChain);
              mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              });
              mockSelect.mockReturnValue(mockSelectChain);

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                '固定資産税路線価': String(roadPrice),
              };

              await service.updateSingleSeller('AA99999', row);

              const updateData = getCapturedUpdateData();
              // 未修正コードでは fixed_asset_tax_road_price が undefined のため失敗する
              return updateData?.fixed_asset_tax_road_price === roadPrice;
            }
          ),
          { numRuns: 20 }
        );
      }
    );
  });
});
