/**
 * バグ条件の探索テスト: 1番電話フィールドのスプシ→DB同期欠落
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
 *
 * このテストは未修正コードで**失敗する**ことが期待される。
 * 失敗がバグの存在を証明する。
 *
 * バグ条件:
 *   実際のスプレッドシートカラム名は "1番電話" だが、
 *   コードは "一番TEL" というキーで参照するため常に undefined が返る。
 *   その結果、first_call_person の同期が機能しない。
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
  return calls[calls.length - 1][0];
}

/**
 * updateSingleSeller 呼び出し後に update に渡されたデータを返す
 */
function getCapturedUpdateData(): any {
  const calls = mockUpdate.mock.calls;
  if (calls.length === 0) return null;
  return calls[calls.length - 1][0];
}

// ============================================================
// テストスイート
// ============================================================

describe('バグ条件の探索テスト: 1番電話フィールドのスプシ→DB同期欠落', () => {
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
  // テスト1: カラム名の不一致確認
  // ----------------------------------------------------------
  describe('カラム名の不一致: row["一番TEL"] は常に undefined', () => {
    it(
      '【バグ確認】スプシ行に "1番電話" キーがある場合、row["一番TEL"] は undefined を返す',
      () => {
        // Arrange: 実際のスプレッドシートカラム名 "1番電話" で値を設定
        const row: Record<string, string> = {
          '売主番号': 'AA99999',
          '1番電話': 'Y',
          '状況（当社）': '追客中',
        };

        // Act & Assert
        // 実際のカラム名は "1番電話" なので "一番TEL" は undefined
        // このテストは現在のバグを証明する（常に通過する - バグの存在を示す）
        expect(row['一番TEL']).toBeUndefined();
        expect(row['1番電話']).toBe('Y');
      }
    );
  });

  // ----------------------------------------------------------
  // テスト2: syncSingleSeller - 新規売主作成時のバグ確認
  // ----------------------------------------------------------
  describe('syncSingleSeller: 新規売主作成時', () => {
    it(
      '【バグ確認】row["1番電話"] = "Y" のとき first_call_person が "Y" として DB に保存されること（未修正コードでは失敗する）',
      async () => {
        /**
         * Validates: Requirements 1.2
         *
         * バグ条件: row["1番電話"] = "Y" のとき、
         * コードは row["一番TEL"] を参照するため undefined が返り、
         * first_call_person が DB に保存されない。
         *
         * 期待される正しい動作: first_call_person = "Y" が保存される。
         * 未修正コードではこのアサーションが失敗する。
         */

        // Arrange: 実際のスプレッドシートカラム名 "1番電話" で値を設定
        const row = {
          '売主番号': 'AA99999',
          '名前(漢字のみ）': 'テスト太郎',
          '状況（当社）': '追客中',
          '1番電話': 'Y',  // 実際のカラム名
        };

        // Act
        await service.syncSingleSeller('AA99999', row);

        // Assert: upsert に渡されたデータに first_call_person = "Y" が含まれること
        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();

        // このアサーションは未修正コードで失敗する（バグの存在を証明）
        // コードが row["一番TEL"] を参照するため undefined → first_call_person は null/undefined になる
        expect(upsertData.first_call_person).toBe('Y');
      }
    );

    it(
      '【バグ確認】row["1番電話"] = "I" のとき first_call_person が "I" として DB に保存されること（未修正コードでは失敗する）',
      async () => {
        const row = {
          '売主番号': 'AA99998',
          '名前(漢字のみ）': 'テスト花子',
          '状況（当社）': '追客中',
          '1番電話': 'I',
        };

        await service.syncSingleSeller('AA99998', row);

        const upsertData = getCapturedUpsertData();
        expect(upsertData).not.toBeNull();

        // 未修正コードでは失敗する
        expect(upsertData.first_call_person).toBe('I');
      }
    );
  });

  // ----------------------------------------------------------
  // テスト3: updateSingleSeller - 既存売主更新時のバグ確認
  // ----------------------------------------------------------
  describe('updateSingleSeller: 既存売主更新時', () => {
    it(
      '【バグ確認】row["1番電話"] = "Y" のとき first_call_person が "Y" として DB に更新されること（未修正コードでは失敗する）',
      async () => {
        /**
         * Validates: Requirements 1.3
         *
         * バグ条件: row["1番電話"] = "Y" のとき、
         * コードは row["一番TEL"] を参照するため undefined が返り、
         * first_call_person が DB に更新されない。
         */

        // Arrange
        const row = {
          '売主番号': 'AA99997',
          '状況（当社）': '追客中',
          '1番電話': 'Y',
        };

        // Act
        await service.updateSingleSeller('AA99997', row);

        // Assert
        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();

        // このアサーションは未修正コードで失敗する
        expect(updateData.first_call_person).toBe('Y');
      }
    );

    it(
      '【バグ確認】row["1番電話"] = "I" のとき first_call_person が "I" として DB に更新されること（未修正コードでは失敗する）',
      async () => {
        const row = {
          '売主番号': 'AA99996',
          '状況（当社）': '追客中',
          '1番電話': 'I',
        };

        await service.updateSingleSeller('AA99996', row);

        const updateData = getCapturedUpdateData();
        expect(updateData).not.toBeNull();

        // 未修正コードでは失敗する
        expect(updateData.first_call_person).toBe('I');
      }
    );
  });

  // ----------------------------------------------------------
  // テスト4: detectUpdatedSellers - 差分検出のバグ確認
  // ----------------------------------------------------------
  describe('detectUpdatedSellers: 差分検出のバグ確認', () => {
    it(
      '【バグ確認】DB に first_call_person = "Y" があり、スプシの "1番電話" = "I" に変更されても差分が検出されないこと（未修正コードでは失敗する）',
      async () => {
        /**
         * Validates: Requirements 1.4
         *
         * バグ条件: detectUpdatedSellers が sheetRow["一番TEL"] を参照するため、
         * 常に "" と評価され、DB の first_call_person との差分が検出されない。
         *
         * 期待される正しい動作: "Y" → "I" の変更が差分として検出される。
         * 未修正コードではこのアサーションが失敗する。
         */

        // Arrange: スプシに "1番電話" = "I" の売主データを用意
        const sheetRows = [
          {
            '売主番号': 'AA99995',
            '状況（当社）': '追客中',
            '1番電話': 'I',  // スプシでは "I" に変更済み
            '次電日': null,
            '不通': '',
            '電話担当（任意）': '',
            '連絡取りやすい日、時間帯': '',
            '連絡方法': '',
            'コメント': '',
            '一番TEL': undefined,  // 実際のスプシには "一番TEL" キーは存在しない
          },
        ];

        // DB には first_call_person = "Y" が保存されている
        const dbSellers = [
          {
            seller_number: 'AA99995',
            status: '追客中',
            first_call_person: 'Y',  // DB には "Y" が保存されている
            contract_year_month: null,
            visit_assignee: null,
            phone_contact_person: '',
            preferred_contact_time: '',
            contact_method: '',
            next_call_date: null,
            unreachable_status: '',
            inquiry_date: null,
            comments: '',
            valuation_amount_1: null,
            valuation_amount_2: null,
            valuation_amount_3: null,
            valuation_reason: '',
            valuation_method: '',
            name: null,
            address: null,
            phone_number: null,
            email: null,
            property_address: '',
            current_status: '',
            updated_at: null,
            visit_reminder_assignee: '',
            mailing_status: null,
          },
        ];

        // Supabase の select モックを設定
        // detectUpdatedSellers は sellers テーブルから全データを取得する
        const mockSelectForDetect = jest.fn().mockReturnValue({
          range: jest.fn().mockResolvedValue({
            data: dbSellers,
            error: null,
          }),
        });

        mockFrom.mockImplementation((_table: string) => ({
          upsert: mockUpsert,
          update: mockUpdate,
          select: mockSelectForDetect,
        }));

        // GoogleSheetsClient の readAll をモック（スプシデータを返す）
        const mockReadAll = jest.fn().mockResolvedValue(sheetRows);
        const { GoogleSheetsClient } = require('../services/GoogleSheetsClient');
        GoogleSheetsClient.mockImplementation(() => ({
          authenticate: jest.fn().mockResolvedValue(undefined),
          readAll: mockReadAll,
        }));

        // サービスを再初期化（モック更新後）
        service = new EnhancedAutoSyncService(
          'https://mock.supabase.co',
          'mock-key'
        );
        // isInitialized を true に設定してスキップ
        (service as any).isInitialized = true;
        (service as any).sheetsClient = { readAll: mockReadAll };
        // キャッシュをクリア
        (service as any).spreadsheetCache = null;
        (service as any).spreadsheetCacheExpiry = 0;

        // Act
        const updatedSellers = await service.detectUpdatedSellers();

        // Assert: AA99995 が差分として検出されること
        // 未修正コードでは sheetRow["一番TEL"] が undefined → "" と評価され、
        // DB の "Y" との差分が検出されない → updatedSellers に AA99995 が含まれない
        // このアサーションは未修正コードで失敗する
        expect(updatedSellers).toContain('AA99995');
      }
    );
  });

  // ----------------------------------------------------------
  // テスト5: プロパティベーステスト（fast-check）
  // ----------------------------------------------------------
  describe('プロパティベーステスト: 任意の1番電話値で同期されること', () => {
    it(
      '【バグ確認 PBT】syncSingleSeller: 任意の非空文字列が first_call_person として保存されること（未修正コードでは失敗する）',
      async () => {
        /**
         * Validates: Requirements 1.1, 1.2
         *
         * Property: row["1番電話"] に任意の非空文字列が入っている場合、
         * syncSingleSeller は first_call_person をその値で DB に保存しなければならない。
         *
         * 未修正コードではこのプロパティが成立しない（バグの存在を証明）。
         */
        await fc.assert(
          fc.asyncProperty(
            // 1番電話として有効な値: 非空文字列（Y, I, S など）
            fc.string({ minLength: 1, maxLength: 10 }).filter(s => s.trim().length > 0),
            async (firstCallValue) => {
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
              }));

              const row = {
                '売主番号': 'AA99999',
                '状況（当社）': '追客中',
                '1番電話': firstCallValue,  // 実際のカラム名
              };

              await service.syncSingleSeller('AA99999', row);

              const upsertData = getCapturedUpsertData();
              // 未修正コードでは first_call_person が null/undefined のため失敗する
              return upsertData?.first_call_person === firstCallValue;
            }
          ),
          { numRuns: 20 }
        );
      }
    );
  });
});
