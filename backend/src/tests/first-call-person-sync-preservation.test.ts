/**
 * 保全プロパティテスト: 他フィールドの同期動作維持
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * このテストは未修正コードで**通過する**ことが期待される。
 * ベースライン動作を確認し、修正後もリグレッションがないことを保証する。
 *
 * 保全要件:
 *   - syncSingleSeller が phone_contact_person を row['電話担当（任意）'] から正しく保存すること
 *   - syncSingleSeller が preferred_contact_time を row['連絡取りやすい日、時間帯'] から正しく保存すること
 *   - syncSingleSeller が contact_method を row['連絡方法'] から正しく保存すること
 *   - column-mapping.json の databaseToSpreadsheet セクションで first_call_person が "一番TEL" にマッピングされていること
 *   - row['1番電話'] が空欄の場合、first_call_person が null/undefined になること
 */

import * as fc from 'fast-check';

// ============================================================
// モック定義
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

describe('保全プロパティテスト: 他フィールドの同期動作維持', () => {
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
  // テスト1: syncSingleSeller - コミュニケーションフィールドの保全
  // ----------------------------------------------------------
  describe('syncSingleSeller: コミュニケーションフィールドの保全', () => {
    it(
      'phone_contact_person が row["電話担当（任意）"] から正しく保存されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: row["電話担当（任意）"] の値が phone_contact_person として DB に保存される。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '電話担当（任意）': 'Y',
        };

        await service.syncSingleSeller('AA99999', row);

        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();
        expect(upsertData.phone_contact_person).toBe('Y');
      }
    );

    it(
      'preferred_contact_time が row["連絡取りやすい日、時間帯"] から正しく保存されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: row["連絡取りやすい日、時間帯"] の値が preferred_contact_time として DB に保存される。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '連絡取りやすい日、時間帯': '午前中',
        };

        await service.syncSingleSeller('AA99999', row);

        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();
        expect(upsertData.preferred_contact_time).toBe('午前中');
      }
    );

    it(
      'contact_method が row["連絡方法"] から正しく保存されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: row["連絡方法"] の値が contact_method として DB に保存される。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '連絡方法': 'Eメール',
        };

        await service.syncSingleSeller('AA99999', row);

        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();
        expect(upsertData.contact_method).toBe('Eメール');
      }
    );

    it(
      '3つのコミュニケーションフィールドが同時に正しく保存されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: 3つのコミュニケーションフィールドが同時に正しく保存される。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '電話担当（任意）': 'I',
          '連絡取りやすい日、時間帯': '夕方以降',
          '連絡方法': '電話',
        };

        await service.syncSingleSeller('AA99999', row);

        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();
        expect(upsertData.phone_contact_person).toBe('I');
        expect(upsertData.preferred_contact_time).toBe('夕方以降');
        expect(upsertData.contact_method).toBe('電話');
      }
    );

    it(
      'row["1番電話"] が空欄の場合、first_call_person が null/undefined になること',
      async () => {
        /**
         * Validates: Requirements 3.4
         *
         * 保全動作: row["1番電話"] が空欄の場合、first_call_person は null/undefined になる。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         *
         * 注意: 未修正コードでは row["一番TEL"] を参照するため常に undefined になる。
         * 空欄の場合も undefined になるため、このテストは通過する。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '1番電話': '',  // 空欄
        };

        await service.syncSingleSeller('AA99999', row);

        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();
        // 空欄の場合は null または undefined になること
        expect(upsertData.first_call_person == null).toBe(true);
      }
    );
  });

  // ----------------------------------------------------------
  // テスト2: updateSingleSeller - コミュニケーションフィールドの保全
  // ----------------------------------------------------------
  describe('updateSingleSeller: コミュニケーションフィールドの保全', () => {
    it(
      'phone_contact_person が row["電話担当（任意）"] から正しく更新されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: row["電話担当（任意）"] の値が phone_contact_person として DB に更新される。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '電話担当（任意）': 'S',
        };

        await service.updateSingleSeller('AA99999', row);

        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();
        expect(updateData.phone_contact_person).toBe('S');
      }
    );

    it(
      'preferred_contact_time が row["連絡取りやすい日、時間帯"] から正しく更新されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: row["連絡取りやすい日、時間帯"] の値が preferred_contact_time として DB に更新される。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '連絡取りやすい日、時間帯': '土日',
        };

        await service.updateSingleSeller('AA99999', row);

        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();
        expect(updateData.preferred_contact_time).toBe('土日');
      }
    );

    it(
      'contact_method が row["連絡方法"] から正しく更新されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: row["連絡方法"] の値が contact_method として DB に更新される。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '連絡方法': 'SMS',
        };

        await service.updateSingleSeller('AA99999', row);

        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();
        expect(updateData.contact_method).toBe('SMS');
      }
    );

    it(
      'row["1番電話"] が空欄の場合、first_call_person が null になること',
      async () => {
        /**
         * Validates: Requirements 3.4
         *
         * 保全動作: row["1番電話"] が空欄の場合、first_call_person は null になる。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         *
         * 注意: 未修正コードでは row["一番TEL"] を参照するため常に undefined になる。
         * undefined の場合、if (firstCallPerson !== undefined) が false になり、
         * first_call_person は updateData に含まれない（undefined）。
         * null または undefined のどちらでも「空」として扱われる。
         */
        const row = {
          '売主番号': 'AA99999',
          '状況（当社）': '追客中',
          '1番電話': '',  // 空欄
        };

        await service.updateSingleSeller('AA99999', row);

        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();
        // 空欄の場合は null または undefined になること（どちらも「空」）
        expect(updateData.first_call_person == null).toBe(true);
      }
    );
  });

  // ----------------------------------------------------------
  // テスト3: column-mapping.json の databaseToSpreadsheet 確認
  // ----------------------------------------------------------
  describe('column-mapping.json: databaseToSpreadsheet の保全確認', () => {
    it(
      'databaseToSpreadsheet セクションで first_call_person が "一番TEL" にマッピングされていること',
      () => {
        /**
         * Validates: Requirements 3.4
         *
         * 保全動作: databaseToSpreadsheet の first_call_person → "一番TEL" マッピングは変更しない。
         * このテストは未修正コードで通過する（ベースライン動作の確認）。
         */
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const columnMapping = require('../config/column-mapping.json');

        // DB→スプシ方向のマッピングは変更しない
        expect(columnMapping.databaseToSpreadsheet['first_call_person']).toBe('一番TEL');
      }
    );

    it(
      'databaseToSpreadsheet セクションで phone_contact_person が "電話担当（任意）" にマッピングされていること',
      () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: databaseToSpreadsheet の phone_contact_person → "電話担当（任意）" マッピングは変更しない。
         */
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const columnMapping = require('../config/column-mapping.json');

        expect(columnMapping.databaseToSpreadsheet['phone_contact_person']).toBe('電話担当（任意）');
        expect(columnMapping.databaseToSpreadsheet['preferred_contact_time']).toBe('連絡取りやすい日、時間帯');
        expect(columnMapping.databaseToSpreadsheet['contact_method']).toBe('連絡方法');
      }
    );

    it(
      'spreadsheetToDatabase セクションで電話担当・連絡方法のマッピングが存在すること',
      () => {
        /**
         * Validates: Requirements 3.3
         *
         * 保全動作: spreadsheetToDatabase の各コミュニケーションフィールドのマッピングは変更しない。
         */
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const columnMapping = require('../config/column-mapping.json');

        expect(columnMapping.spreadsheetToDatabase['電話担当（任意）']).toBe('phone_contact_person');
        expect(columnMapping.spreadsheetToDatabase['連絡取りやすい日、時間帯']).toBe('preferred_contact_time');
        expect(columnMapping.spreadsheetToDatabase['連絡方法']).toBe('contact_method');
      }
    );
  });

  // ----------------------------------------------------------
  // テスト4: プロパティベーステスト（fast-check）
  // ----------------------------------------------------------
  describe('プロパティベーステスト: コミュニケーションフィールドの保全', () => {
    it(
      '【保全 PBT】syncSingleSeller: 任意の電話担当値が phone_contact_person として保存されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * Property: row["電話担当（任意）"] に任意の非空文字列が入っている場合、
         * syncSingleSeller は phone_contact_person をその値で DB に保存しなければならない。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         */
        await fc.assert(
          fc.asyncProperty(
            // 電話担当として有効な値: 非空文字列（Y, I, S など）
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
            async (phoneContactValue) => {
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
              mockFrom.mockImplementation((_table: string) => ({
                upsert: mockUpsert,
                update: mockUpdate,
                select: mockSelect,
                insert: jest.fn().mockResolvedValue({ error: null }),
              }));

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                '電話担当（任意）': phoneContactValue,
              };

              await service.syncSingleSeller('AA99999', row);

              const upsertData = getCapturedUpsertData();
              // phone_contact_person が正しく保存されること
              return upsertData?.phone_contact_person === phoneContactValue;
            }
          ),
          { numRuns: 20 }
        );
      }
    );

    it(
      '【保全 PBT】syncSingleSeller: 任意の連絡方法値が contact_method として保存されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * Property: row["連絡方法"] に任意の非空文字列が入っている場合、
         * syncSingleSeller は contact_method をその値で DB に保存しなければならない。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         */
        const contactMethodOptions = ['電話', 'Eメール', 'SMS', 'LINE', 'その他'];

        await fc.assert(
          fc.asyncProperty(
            fc.constantFrom(...contactMethodOptions),
            async (contactMethod) => {
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
              mockFrom.mockImplementation((_table: string) => ({
                upsert: mockUpsert,
                update: mockUpdate,
                select: mockSelect,
                insert: jest.fn().mockResolvedValue({ error: null }),
              }));

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                '連絡方法': contactMethod,
              };

              await service.syncSingleSeller('AA99999', row);

              const upsertData = getCapturedUpsertData();
              return upsertData?.contact_method === contactMethod;
            }
          ),
          { numRuns: 10 }
        );
      }
    );

    it(
      '【保全 PBT】updateSingleSeller: 任意の連絡取りやすい時間帯が preferred_contact_time として更新されること',
      async () => {
        /**
         * Validates: Requirements 3.3
         *
         * Property: row["連絡取りやすい日、時間帯"] に任意の非空文字列が入っている場合、
         * updateSingleSeller は preferred_contact_time をその値で DB に更新しなければならない。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         */
        await fc.assert(
          fc.asyncProperty(
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
            async (preferredTime) => {
              jest.clearAllMocks();
              mockUpsert.mockReturnValue(mockUpsertChain);
              mockUpdate.mockReturnValue({
                eq: jest.fn().mockResolvedValue({ error: null }),
              });
              mockSelect.mockReturnValue(mockSelectChain);
              mockFrom.mockImplementation((_table: string) => ({
                upsert: mockUpsert,
                update: mockUpdate,
                select: mockSelect,
                insert: jest.fn().mockResolvedValue({ error: null }),
              }));

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                '連絡取りやすい日、時間帯': preferredTime,
              };

              await service.updateSingleSeller('AA99999', row);

              const updateData = getCapturedUpdateData();
              return updateData?.preferred_contact_time === preferredTime;
            }
          ),
          { numRuns: 20 }
        );
      }
    );

    it(
      '【保全 PBT】syncSingleSeller: 1番電話が空欄の場合、first_call_person は常に null/undefined になること',
      async () => {
        /**
         * Validates: Requirements 3.4
         *
         * Property: row["1番電話"] が空文字列または存在しない場合、
         * syncSingleSeller は first_call_person を null/undefined にする。
         *
         * このプロパティは未修正コードで成立する（保全動作の確認）。
         * 未修正コードでは row["一番TEL"] を参照するため常に undefined になり、
         * 空欄の場合も同様に null/undefined になる。
         */
        await fc.assert(
          fc.asyncProperty(
            // 空文字列または存在しないケース
            fc.oneof(
              fc.constant(''),
              fc.constant(undefined as unknown as string)
            ),
            async (emptyValue) => {
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
              mockFrom.mockImplementation((_table: string) => ({
                upsert: mockUpsert,
                update: mockUpdate,
                select: mockSelect,
                insert: jest.fn().mockResolvedValue({ error: null }),
              }));

              const row: Record<string, any> = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
              };
              if (emptyValue !== undefined) {
                row['1番電話'] = emptyValue;
              }

              await service.syncSingleSeller('AA99999', row);

              const upsertData = getCapturedUpsertData();
              // 空欄の場合は null または undefined になること
              return upsertData?.first_call_person == null;
            }
          ),
          { numRuns: 10 }
        );
      }
    );
  });
});
