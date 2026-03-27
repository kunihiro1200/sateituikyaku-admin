/**
 * 保全プロパティテスト: 固定資産税路線価以外のフィールドの同期動作維持
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは未修正コードで**通過する**ことが期待される。
 * ベースライン動作を確認し、修正後もリグレッションがないことを保証する。
 *
 * 保全要件:
 *   - valuation_amount_1/2/3（査定額）の同期処理が正しく動作すること
 *   - status（状況）、next_call_date（次電日）、comments（コメント）が正しく同期されること
 *   - 暗号化フィールド（name, phone_number, email, address）の同期が変わらないこと
 *   - fixed_asset_tax_road_price 以外のフィールドは修正前後で同一の結果になること
 */

import * as fc from 'fast-check';

// ============================================================
// モック定義（road-price-sync-bug.test.ts と同様の構成）
// ============================================================

// Supabase クライアントのモック
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockSelect = jest.fn();

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

const mockFrom = jest.fn().mockImplementation((_table: string) => ({
  upsert: mockUpsert,
  update: mockUpdate,
  select: mockSelect,
  insert: jest.fn().mockResolvedValue({ error: null }),
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

function getCapturedUpsertData(): any {
  const calls = mockUpsert.mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0];
}

function getCapturedUpdateData(): any {
  const calls = mockUpdate.mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0];
}

// ============================================================
// テストスイート
// ============================================================

describe('保全プロパティテスト: 固定資産税路線価以外のフィールドの同期動作維持', () => {
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
    mockFrom.mockImplementation((_table: string) => ({
      upsert: mockUpsert,
      update: mockUpdate,
      select: mockSelect,
      insert: jest.fn().mockResolvedValue({ error: null }),
    }));

    service = new EnhancedAutoSyncService(
      'https://mock.supabase.co',
      'mock-key'
    );
  });

  // ----------------------------------------------------------
  // テスト1: syncSingleSeller - 査定額の同期保全
  // ----------------------------------------------------------
  describe('syncSingleSeller: 査定額の同期保全', () => {
    it('査定額1（手動入力）が正しく万円→円変換されて保存されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '査定額1': '1200',  // 手動入力: 1200万円
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      // 1200万円 → 12,000,000円
      expect(upsertData.valuation_amount_1).toBe(12000000);
    });

    it('査定額1（自動計算）がフォールバックとして使用されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '査定額1（自動計算）v': '5580',  // 自動計算: 5580万円
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      // 5580万円 → 55,800,000円
      expect(upsertData.valuation_amount_1).toBe(55800000);
    });

    it('手動入力査定額が自動計算より優先されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '査定額1': '1200',              // 手動入力: 1200万円（優先）
        '査定額1（自動計算）v': '5580', // 自動計算: 5580万円（フォールバック）
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      // 手動入力の1200万円が優先される
      expect(upsertData.valuation_amount_1).toBe(12000000);
    });

    it('状況（当社）が正しく保存されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '商談中',
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      expect(upsertData.status).toBe('商談中');
    });

    it('次電日が正しく保存されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '次電日': '2026/4/1',
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      expect(upsertData.next_call_date).toBe('2026/4/1');
    });

    it('コメントが正しく保存されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        'コメント': 'テストコメント',
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      expect(upsertData.comments).toBe('テストコメント');
    });

    it('名前が暗号化されて保存されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '名前(漢字のみ）': 'テスト太郎',
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      // 暗号化されていること（モックでは "encrypted:" プレフィックスが付く）
      expect(upsertData.name).toBe('encrypted:テスト太郎');
    });

    it('電話番号が暗号化されて保存されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '電話番号\nハイフン不要': '09012345678',
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      expect(upsertData.phone_number).toBe('encrypted:09012345678');
    });

    it('固定資産税路線価がない行でも他のフィールドが正しく保存されること', async () => {
      // 固定資産税路線価が存在しない行（非バグ条件）
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '次電日': '2026/4/1',
        'コメント': 'テストコメント',
        '査定額1': '1200',
        // '固定資産税路線価' は存在しない
      };

      await service.syncSingleSeller('AA99999', row);

      const upsertData = getCapturedUpsertData();
      expect(upsertData).not.toBeNull();
      expect(upsertData.status).toBe('追客中');
      expect(upsertData.next_call_date).toBe('2026/4/1');
      expect(upsertData.comments).toBe('テストコメント');
      expect(upsertData.valuation_amount_1).toBe(12000000);
      // fixed_asset_tax_road_price は設定されないこと（未修正コードでは）
      expect(upsertData.fixed_asset_tax_road_price).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // テスト2: updateSingleSeller - 査定額の同期保全
  // ----------------------------------------------------------
  describe('updateSingleSeller: 査定額の同期保全', () => {
    it('査定額1/2/3が正しく万円→円変換されて更新されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '査定額1': '1200',
        '査定額2': '1300',
        '査定額3': '1500',
      };

      await service.updateSingleSeller('AA99999', row);

      const updateData = getCapturedUpdateData();
      expect(updateData).not.toBeNull();
      expect(updateData.valuation_amount_1).toBe(12000000);
      expect(updateData.valuation_amount_2).toBe(13000000);
      expect(updateData.valuation_amount_3).toBe(15000000);
    });

    it('状況（当社）が正しく更新されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '商談中',
      };

      await service.updateSingleSeller('AA99999', row);

      const updateData = getCapturedUpdateData();
      expect(updateData).not.toBeNull();
      expect(updateData.status).toBe('商談中');
    });

    it('次電日が正しく更新されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '次電日': '2026/5/1',
      };

      await service.updateSingleSeller('AA99999', row);

      const updateData = getCapturedUpdateData();
      expect(updateData).not.toBeNull();
      expect(updateData.next_call_date).toBe('2026/5/1');
    });

    it('コメントが正しく更新されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        'コメント': '更新コメント',
      };

      await service.updateSingleSeller('AA99999', row);

      const updateData = getCapturedUpdateData();
      expect(updateData).not.toBeNull();
      expect(updateData.comments).toBe('更新コメント');
    });

    it('コメントが空欄の場合はnullになること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        // コメントなし
      };

      await service.updateSingleSeller('AA99999', row);

      const updateData = getCapturedUpdateData();
      expect(updateData).not.toBeNull();
      expect(updateData.comments).toBeNull();
    });

    it('コミュニケーションフィールドが正しく更新されること', async () => {
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '電話担当（任意）': 'Y',
        '連絡取りやすい日、時間帯': '午前中',
        '連絡方法': 'Eメール',
      };

      await service.updateSingleSeller('AA99999', row);

      const updateData = getCapturedUpdateData();
      expect(updateData).not.toBeNull();
      expect(updateData.phone_contact_person).toBe('Y');
      expect(updateData.preferred_contact_time).toBe('午前中');
      expect(updateData.contact_method).toBe('Eメール');
    });

    it('固定資産税路線価がない行でも他のフィールドが正しく更新されること', async () => {
      // 固定資産税路線価が存在しない行（非バグ条件）
      const row = {
        '売主番号': 'AA99999',
        '状況（当社）': '追客中',
        '次電日': '2026/4/1',
        'コメント': 'テストコメント',
        '査定額1': '1200',
        // '固定資産税路線価' は存在しない
      };

      await service.updateSingleSeller('AA99999', row);

      const updateData = getCapturedUpdateData();
      expect(updateData).not.toBeNull();
      expect(updateData.status).toBe('追客中');
      expect(updateData.next_call_date).toBe('2026/4/1');
      expect(updateData.comments).toBe('テストコメント');
      expect(updateData.valuation_amount_1).toBe(12000000);
      // fixed_asset_tax_road_price は null になること（修正後: 空欄時はnullでクリア）
      expect(updateData.fixed_asset_tax_road_price).toBeNull();
    });
  });

  // ----------------------------------------------------------
  // テスト3: プロパティベーステスト（fast-check）
  // ----------------------------------------------------------
  describe('プロパティベーステスト: 固定資産税路線価以外のフィールドの保全', () => {
    it(
      '【保全 PBT】syncSingleSeller: 任意の査定額が正しく万円→円変換されること',
      async () => {
        /**
         * Validates: Requirements 3.1, 3.2
         *
         * Property: row['査定額1'] に任意の正の数値が入っている場合、
         * syncSingleSeller は valuation_amount_1 をその数値×10000で DB に保存しなければならない。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         */
        await fc.assert(
          fc.asyncProperty(
            // 査定額として有効な範囲: 1〜99999万円
            fc.integer({ min: 1, max: 99999 }),
            async (valuationManYen) => {
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
                '査定額1': String(valuationManYen),
                // 固定資産税路線価は存在しない（非バグ条件）
              };

              await service.syncSingleSeller('AA99999', row);

              const upsertData = getCapturedUpsertData();
              // 万円→円変換が正しく行われること
              return upsertData?.valuation_amount_1 === valuationManYen * 10000;
            }
          ),
          { numRuns: 20 }
        );
      }
    );

    it(
      '【保全 PBT】updateSingleSeller: 任意の査定額が正しく万円→円変換されること',
      async () => {
        /**
         * Validates: Requirements 3.1, 3.2
         *
         * Property: row['査定額1'] に任意の正の数値が入っている場合、
         * updateSingleSeller は valuation_amount_1 をその数値×10000で DB に更新しなければならない。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         */
        await fc.assert(
          fc.asyncProperty(
            fc.integer({ min: 1, max: 99999 }),
            async (valuationManYen) => {
              jest.clearAllMocks();
              mockUpsert.mockReturnValue(mockUpsertChain);
              mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              });
              mockSelect.mockReturnValue(mockSelectChain);

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                '査定額1': String(valuationManYen),
                // 固定資産税路線価は存在しない（非バグ条件）
              };

              await service.updateSingleSeller('AA99999', row);

              const updateData = getCapturedUpdateData();
              return updateData?.valuation_amount_1 === valuationManYen * 10000;
            }
          ),
          { numRuns: 20 }
        );
      }
    );

    it(
      '【保全 PBT】syncSingleSeller: 任意のステータスが正しく保存されること',
      async () => {
        /**
         * Validates: Requirements 3.2
         *
         * Property: row['状況（当社）'] に任意の文字列が入っている場合、
         * syncSingleSeller は status をその文字列で DB に保存しなければならない。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         */
        const statusOptions = ['追客中', '商談中', '専任取得', '他決', '除外'];

        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...statusOptions),
            async (status) => {
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
                '状況（当社）': status,
                // 固定資産税路線価は存在しない（非バグ条件）
              };

              await service.syncSingleSeller('AA99999', row);

              const upsertData = getCapturedUpsertData();
              return upsertData?.status === status;
            }
          ),
          { numRuns: 10 }
        );
      }
    );

    it(
      '【保全 PBT】updateSingleSeller: 任意のコメントが正しく保存されること',
      async () => {
        /**
         * Validates: Requirements 3.2
         *
         * Property: row['コメント'] に任意の文字列が入っている場合、
         * updateSingleSeller は comments をその文字列で DB に更新しなければならない。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         */
        await fc.assert(
          fc.asyncProperty(
            // 日本語を含む任意の文字列（空でない）
            fc.string({ minLength: 1, maxLength: 100 }),
            async (comment) => {
              jest.clearAllMocks();
              mockUpsert.mockReturnValue(mockUpsertChain);
              mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              });
              mockSelect.mockReturnValue(mockSelectChain);

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                'コメント': comment,
                // 固定資産税路線価は存在しない（非バグ条件）
              };

              await service.updateSingleSeller('AA99999', row);

              const updateData = getCapturedUpdateData();
              return updateData?.comments === comment;
            }
          ),
          { numRuns: 20 }
        );
      }
    );
  });

  // ----------------------------------------------------------
  // テスト4: column-mapping.json の既存マッピング確認
  // ----------------------------------------------------------
  describe('column-mapping.json: 既存マッピングの確認', () => {
    it('column-mapping.json に査定額のマッピングが存在すること', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const columnMapping = require('../config/column-mapping.json');

      // 手動入力査定額のマッピングが存在すること
      expect(columnMapping.spreadsheetToDatabase['査定額1']).toBe('valuation_amount_1');
      expect(columnMapping.spreadsheetToDatabase['査定額2']).toBe('valuation_amount_2');
      expect(columnMapping.spreadsheetToDatabase['査定額3']).toBe('valuation_amount_3');

      // 自動計算査定額のマッピングが存在すること（_auto カラムにマッピング）
      expect(columnMapping.spreadsheetToDatabase['査定額1（自動計算）v']).toBe('valuation_amount_1_auto');
      expect(columnMapping.spreadsheetToDatabase['査定額2（自動計算）v']).toBe('valuation_amount_2_auto');
      expect(columnMapping.spreadsheetToDatabase['査定額3（自動計算）v']).toBe('valuation_amount_3_auto');
    });

    it('column-mapping.json に状況・次電日・コメントのマッピングが存在すること', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const columnMapping = require('../config/column-mapping.json');

      expect(columnMapping.spreadsheetToDatabase['状況（当社）']).toBe('status');
      expect(columnMapping.spreadsheetToDatabase['次電日']).toBe('next_call_date');
      expect(columnMapping.spreadsheetToDatabase['コメント']).toBe('comments');
    });

    it('column-mapping.json に暗号化フィールドのマッピングが存在すること', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const columnMapping = require('../config/column-mapping.json');

      expect(columnMapping.spreadsheetToDatabase['名前(漢字のみ）']).toBe('name');
      expect(columnMapping.spreadsheetToDatabase['電話番号\nハイフン不要']).toBe('phone_number');
      expect(columnMapping.spreadsheetToDatabase['メールアドレス']).toBe('email');
      expect(columnMapping.spreadsheetToDatabase['依頼者住所(物件所在と異なる場合）']).toBe('address');
    });

    it('column-mapping.json に固定資産税路線価のマッピングが存在すること（修正後の確認）', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const columnMapping = require('../config/column-mapping.json');

      // 修正後は固定資産税路線価のマッピングが存在すること
      expect(columnMapping.spreadsheetToDatabase['固定資産税路線価']).toBe('fixed_asset_tax_road_price');
      expect(columnMapping.databaseToSpreadsheet['fixed_asset_tax_road_price']).toBe('固定資産税路線価');
      expect(columnMapping.typeConversions['fixed_asset_tax_road_price']).toBe('number');
    });
  });
});
