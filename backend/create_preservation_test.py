#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
保全プロパティテストファイルを UTF-8 で作成するスクリプト
"""

content = '''/**
 * 保全プロパティテスト: 売主新規登録スプレッドシート同期バグ
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * このテストは**未修正コード**で実行し、既存フィールドが正しく同期されることを確認します。
 *
 * Property 2: Preservation - 既存フィールドの同期維持
 *   isBugCondition が false の入力（全追加フィールドが null）に対して、
 *   既存フィールド（売主番号・名前・住所・電話番号・メール・物件所在地・種別・反響日付・サイト）が
 *   正しく appendRow に渡されることを検証する。
 *
 * 期待される結果（未修正コード）:
 *   テストが**パス**する（これがベースライン動作を確認する）
 */

// supabase 設定モック
jest.mock(\'../../config/supabase\', () => ({
  supabase: {},
  supabaseClient: {},
  default: {},
}));

jest.mock(\'../../utils/cache\', () => ({
  CacheHelper: {
    del: jest.fn().mockResolvedValue(undefined),
    delPattern: jest.fn().mockResolvedValue(undefined),
    generateKey: jest.fn().mockReturnValue(\'mock-key\'),
  },
  CACHE_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

jest.mock(\'../SellerNumberService\', () => ({
  sellerNumberService: { generateWithRetry: jest.fn().mockResolvedValue(\'AA99999\') },
}));

jest.mock(\'../DuplicateDetectionService\', () => ({
  duplicateDetectionService: {
    instance: {
      checkDuplicates: jest.fn().mockResolvedValue([]),
      recordDuplicateHistory: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock(\'../SyncQueue\');

// GoogleSheetsClient のモック（appendRow に渡される引数をキャプチャするため）
const mockAppendRow = jest.fn().mockResolvedValue(undefined);
const mockAuthenticate = jest.fn().mockResolvedValue(undefined);
const mockReadRawRange = jest.fn().mockResolvedValue([[\'100\']]);
const mockWriteRawCell = jest.fn().mockResolvedValue(undefined);

jest.mock(\'../GoogleSheetsClient\', () => ({
  GoogleSheetsClient: jest.fn().mockImplementation(() => ({
    authenticate: mockAuthenticate,
    appendRow: mockAppendRow,
    readRawRange: mockReadRawRange,
    writeRawCell: mockWriteRawCell,
  })),
}));

import * as fc from \'fast-check\';
import { SellerService } from \'../SellerService.supabase\';

// ============================================================
// ヘルパー: バグ条件の判定関数（design.md と同一定義）
// ============================================================

function isBugCondition(x: any): boolean {
  return (
    x.nextCallDate != null ||
    x.visitDate != null ||
    x.visitAssignee != null ||
    x.confidence != null ||
    x.status != null ||
    x.comments != null ||
    x.valuationAmount1 != null ||
    x.valuationMethod != null ||
    x.contactMethod != null ||
    x.preferredContactTime != null ||
    x.assignedTo != null ||
    x.visitTime != null ||
    x.visitNotes != null ||
    x.valuationAssignee != null ||
    x.valuationAmount2 != null ||
    x.valuationAmount3 != null
  );
}

// ============================================================
// モック: Supabase クライアント
// ============================================================

function createMockSellerRow(overrides: Record<string, any> = {}): any {
  return {
    id: \'test-seller-id-001\',
    seller_number: \'AA99999\',
    name: \'encrypted-name\',
    address: \'大分市テスト住所1-1-1\',
    phone_number: \'encrypted-phone\',
    email: null,
    status: null,
    inquiry_source: \'suumo\',
    inquiry_year: 2026,
    inquiry_date: \'2026-05-01\',
    confidence_level: null,
    first_caller_initials: null,
    first_caller_employee_id: null,
    is_unreachable: false,
    duplicate_confirmed: false,
    exclusion_date: null,
    created_at: \'2026-05-01T00:00:00.000Z\',
    updated_at: \'2026-05-01T00:00:00.000Z\',
    ...overrides,
  };
}

function createSupabaseMock(sellerRow?: any): any {
  const row = sellerRow || createMockSellerRow();
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === \'sellers\') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: row,
                error: null,
              }),
            }),
          }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: row,
                error: null,
              }),
            }),
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === \'properties\') {
        return {
          insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      return {
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  } as any;
}

// ============================================================
// テスト用の CreateSellerRequest ベースデータ（バグ条件なし）
// ============================================================

function createBaseRequest(overrides: Record<string, any> = {}): any {
  return {
    name: \'田中太郎\',
    address: \'大分市中央町1-1-1\',
    phoneNumber: \'09012345678\',
    email: \'test@example.com\',
    property: {
      address: \'大分市物件住所1-1-1\',
      propertyType: \'detached_house\',
    },
    inquirySource: \'suumo\',
    inquiryYear: 2026,
    inquiryDate: new Date(\'2026-05-01\'),
    // 追加フィールドは全て null（isBugCondition = false）
    nextCallDate: null,
    visitDate: null,
    visitAssignee: null,
    confidence: null,
    status: null,
    comments: null,
    valuationAmount1: null,
    valuationMethod: null,
    contactMethod: null,
    preferredContactTime: null,
    assignedTo: null,
    visitTime: null,
    visitNotes: null,
    valuationAssignee: null,
    valuationAmount2: null,
    valuationAmount3: null,
    ...overrides,
  };
}

function setupService(): SellerService {
  const service = new SellerService();
  (service as any).supabase = createSupabaseMock();

  // decryptSeller をモック（テストデータをそのまま返す）
  (service as any).decryptSeller = jest.fn().mockImplementation(async (seller: any) => ({
    id: seller.id,
    sellerNumber: seller.seller_number,
    name: \'田中太郎\',
    address: seller.address,
    phoneNumber: \'09012345678\',
    email: seller.email,
    status: seller.status,
    createdAt: new Date(seller.created_at),
    updatedAt: new Date(seller.updated_at),
  }));

  // getActiveSyncQueue をモック（null を返す）
  (service as any).getActiveSyncQueue = jest.fn().mockReturnValue(null);

  return service;
}

// ============================================================
// テストスイート
// ============================================================

describe(\'保全プロパティテスト: 売主新規登録スプレッドシート同期バグ\', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ----------------------------------------------------------
  // Property 2: Preservation - 既存フィールドの同期維持
  //
  // このテストは未修正コードで PASS することが期待される。
  // パスがベースライン動作を確認する。
  // ----------------------------------------------------------
  describe(\'Property 2: Preservation - 既存フィールドの同期維持\', () => {

    /**
     * Validates: Requirements 3.1
     *
     * name: \'田中太郎\' を含む CreateSellerRequest（追加フィールドは全て null）で
     * createSeller を呼び出したとき、appendRow の引数に
     * \'名前(漢字のみ）\': \'田中太郎\' が渡されること。
     *
     * EXPECTED: PASS on unfixed code（ベースライン動作の確認）
     */
    it(\'name を含む場合、appendRow に "名前(漢字のみ）" が正しく渡されること\', async () => {
      // Arrange
      const service = setupService();
      const request = createBaseRequest({ name: \'田中太郎\' });

      // バグ条件を満たさないことを確認
      expect(isBugCondition(request)).toBe(false);

      // Act
      await service.createSeller(request, \'employee-001\');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];
      console.log(\'appendRow に渡されたオブジェクトのキー:\', Object.keys(capturedArg));

      // 既存フィールドが正しく渡されることを確認
      expect(capturedArg).toHaveProperty(\'名前(漢字のみ）\', \'田中太郎\');
    });

    /**
     * Validates: Requirements 3.1
     *
     * address: \'東京都渋谷区1-1-1\' を含む CreateSellerRequest（追加フィールドは全て null）で
     * createSeller を呼び出したとき、appendRow の引数に
     * \'依頼者住所(物件所在と異なる場合）\': \'東京都渋谷区1-1-1\' が渡されること。
     *
     * EXPECTED: PASS on unfixed code（ベースライン動作の確認）
     */
    it(\'address を含む場合、appendRow に "依頼者住所(物件所在と異なる場合）" が正しく渡されること\', async () => {
      // Arrange
      const service = setupService();
      const request = createBaseRequest({ address: \'東京都渋谷区1-1-1\' });

      // バグ条件を満たさないことを確認
      expect(isBugCondition(request)).toBe(false);

      // Act
      await service.createSeller(request, \'employee-001\');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];

      // 既存フィールドが正しく渡されることを確認
      expect(capturedArg).toHaveProperty(\'依頼者住所(物件所在と異なる場合）\', \'東京都渋谷区1-1-1\');
    });

    /**
     * Validates: Requirements 3.3
     *
     * inquiryDate: new Date(\'2026-05-01\') を含む CreateSellerRequest（追加フィールドは全て null）で
     * createSeller を呼び出したとき、appendRow の引数に
     * \'反響日付\': \'2026-05-01\' が渡されること。
     *
     * EXPECTED: PASS on unfixed code（ベースライン動作の確認）
     */
    it(\'inquiryDate を含む場合、appendRow に "反響日付" が正しく渡されること\', async () => {
      // Arrange
      const service = setupService();
      const request = createBaseRequest({ inquiryDate: new Date(\'2026-05-01\') });

      // バグ条件を満たさないことを確認
      expect(isBugCondition(request)).toBe(false);

      // Act
      await service.createSeller(request, \'employee-001\');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];

      // 既存フィールドが正しく渡されることを確認
      expect(capturedArg).toHaveProperty(\'反響日付\', \'2026-05-01\');
    });

    /**
     * Validates: Requirements 3.1, 3.2, 3.3
     *
     * プロパティベーステスト:
     * 全追加フィールドが null の任意の CreateSellerRequest に対して、
     * 既存フィールド（売主番号・名前・住所・電話番号・メール・物件所在地・種別・反響日付・サイト）が
     * 正しく appendRow に渡されることを検証する。
     *
     * EXPECTED: PASS on unfixed code（ベースライン動作の確認）
     */
    it(\'プロパティテスト: 全追加フィールドが null の場合、既存フィールドが常に正しく appendRow に渡されること\', async () => {
      // fast-check のアービトラリ定義
      const nameArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
      const addressArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
      const phoneArb = fc.string({ minLength: 10, maxLength: 11 }).filter(s => /^[0-9]+$/.test(s));
      const emailArb = fc.emailAddress();
      const propertyAddressArb = fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0);
      const propertyTypeArb = fc.constantFrom(\'detached_house\', \'apartment\', \'land\');
      const inquirySourceArb = fc.constantFrom(\'suumo\', \'athome\', \'homes\', \'direct\');
      const inquiryYearArb = fc.integer({ min: 2020, max: 2030 });
      // 日付は固定（タイムゾーン問題を避けるため）
      const inquiryDateArb = fc.constantFrom(
        new Date(\'2026-01-01\'),
        new Date(\'2026-05-01\'),
        new Date(\'2026-12-31\'),
      );

      await fc.assert(
        fc.asyncProperty(
          nameArb,
          addressArb,
          phoneArb,
          emailArb,
          propertyAddressArb,
          propertyTypeArb,
          inquirySourceArb,
          inquiryYearArb,
          inquiryDateArb,
          async (name, address, phoneNumber, email, propertyAddress, propertyType, inquirySource, inquiryYear, inquiryDate) => {
            // Arrange
            jest.clearAllMocks();
            const service = setupService();

            const request = {
              name,
              address,
              phoneNumber,
              email,
              property: {
                address: propertyAddress,
                propertyType,
              },
              inquirySource,
              inquiryYear,
              inquiryDate,
              // 追加フィールドは全て null（isBugCondition = false）
              nextCallDate: null,
              visitDate: null,
              visitAssignee: null,
              confidence: null,
              status: null,
              comments: null,
              valuationAmount1: null,
              valuationMethod: null,
              contactMethod: null,
              preferredContactTime: null,
              assignedTo: null,
              visitTime: null,
              visitNotes: null,
              valuationAssignee: null,
              valuationAmount2: null,
              valuationAmount3: null,
            };

            // バグ条件を満たさないことを確認
            expect(isBugCondition(request)).toBe(false);

            // Act
            await service.createSeller(request, \'employee-001\');

            // appendRow が呼ばれたことを確認
            expect(mockAppendRow).toHaveBeenCalled();

            // appendRow に渡されたオブジェクトを取得
            const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];

            // 既存フィールドが全て正しく渡されることを確認
            // 売主番号
            expect(capturedArg).toHaveProperty(\'売主番号\');
            expect(typeof capturedArg[\'売主番号\']).toBe(\'string\');

            // 名前
            expect(capturedArg).toHaveProperty(\'名前(漢字のみ）\', name);

            // 住所
            expect(capturedArg).toHaveProperty(\'依頼者住所(物件所在と異なる場合）\', address);

            // 電話番号
            expect(capturedArg).toHaveProperty(\'電話番号\\nハイフン不要\', phoneNumber);

            // メールアドレス
            expect(capturedArg).toHaveProperty(\'メールアドレス\', email);

            // 物件所在地
            expect(capturedArg).toHaveProperty(\'物件所在地\', propertyAddress);

            // 種別
            expect(capturedArg).toHaveProperty(\'種別\', propertyType);

            // 反響日付（ISO形式の日付文字列）
            const expectedDate = inquiryDate.toISOString().split(\'T\')[0];
            expect(capturedArg).toHaveProperty(\'反響日付\', expectedDate);

            // サイト
            expect(capturedArg).toHaveProperty(\'サイト\', inquirySource);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
'''

output_path = 'src/services/__tests__/seller-new-registration-sync-bug.preservation.test.ts'

with open(output_path, 'wb') as f:
    f.write(content.encode('utf-8'))

print(f'Created: {output_path}')

# BOM チェック
with open(output_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])}')
print('OK: No BOM' if first_bytes[:3] != b'\\xef\\xbb\\xbf' else 'WARNING: BOM detected')
