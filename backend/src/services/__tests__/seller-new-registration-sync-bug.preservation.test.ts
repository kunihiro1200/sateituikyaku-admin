/**
 * 保全プロパティテスト: 売主新規登録スプレッドシート同期バグ
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * このテストは**未修正コード**で実行し、既存フィールドが正しく同期されることを確認します。
 *
 * Property 2: Preservation - 既存フィールドの同期維持
 *   isBugCondition が false の入力（全追加フィールドが null）に対して、
 *   既存フィールド（売主番号・名前・住所・電話番号・メール・物件所在地・反響日付・サイト）が
 *   正しく appendRow に渡されること。
 *
 * 期待される結果（未修正コード）:
 *   テストが**パス**する（ベースライン動作の確認）
 */

// supabase 設定モック
jest.mock('../../config/supabase', () => ({
  supabase: {},
  supabaseClient: {},
  default: {},
}));

jest.mock('../../utils/cache', () => ({
  CacheHelper: {
    del: jest.fn().mockResolvedValue(undefined),
    delPattern: jest.fn().mockResolvedValue(undefined),
    generateKey: jest.fn().mockReturnValue('mock-key'),
  },
  CACHE_TTL: { SHORT: 60, MEDIUM: 300, LONG: 3600 },
}));

jest.mock('../SellerNumberService', () => ({
  sellerNumberService: { generateWithRetry: jest.fn().mockResolvedValue('AA99999') },
}));

jest.mock('../DuplicateDetectionService', () => ({
  duplicateDetectionService: {
    instance: {
      checkDuplicates: jest.fn().mockResolvedValue([]),
      recordDuplicateHistory: jest.fn().mockResolvedValue(undefined),
    },
  },
}));

jest.mock('../SyncQueue');

// GoogleSheetsClient のモック（appendRow に渡される引数をキャプチャするため）
const mockAppendRow = jest.fn().mockResolvedValue(undefined);
const mockAuthenticate = jest.fn().mockResolvedValue(undefined);
const mockReadRawRange = jest.fn().mockResolvedValue([['100']]);
const mockWriteRawCell = jest.fn().mockResolvedValue(undefined);

jest.mock('../GoogleSheetsClient', () => ({
  GoogleSheetsClient: jest.fn().mockImplementation(() => ({
    authenticate: mockAuthenticate,
    appendRow: mockAppendRow,
    readRawRange: mockReadRawRange,
    writeRawCell: mockWriteRawCell,
  })),
}));

import { SellerService } from '../SellerService.supabase';

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

const MOCK_SELLER_ROW = {
  id: 'test-seller-id-001',
  seller_number: 'AA99999',
  name: 'encrypted-name',
  address: '大分市テスト住所1-1-1',
  phone_number: 'encrypted-phone',
  email: null,
  status: null,
  inquiry_source: 'suumo',
  inquiry_year: 2026,
  inquiry_date: '2026-05-01',
  confidence_level: null,
  first_caller_initials: null,
  first_caller_employee_id: null,
  is_unreachable: false,
  duplicate_confirmed: false,
  exclusion_date: null,
  created_at: '2026-05-01T00:00:00.000Z',
  updated_at: '2026-05-01T00:00:00.000Z',
};

function createSupabaseMock(): any {
  return {
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'sellers') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: MOCK_SELLER_ROW,
                error: null,
              }),
            }),
          }),
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: MOCK_SELLER_ROW,
                error: null,
              }),
            }),
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ data: null, error: null }),
          }),
        };
      }
      if (table === 'properties') {
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
// テスト用の CreateSellerRequest ベースデータ（全追加フィールドが null）
// ============================================================

function createBaseRequest(overrides: Record<string, any> = {}): any {
  return {
    name: '田中太郎',
    address: '大分市中央町1-1-1',
    phoneNumber: '09012345678',
    email: 'test@example.com',
    property: {
      address: '大分市物件住所1-1-1',
      propertyType: 'detached_house',
    },
    inquirySource: 'suumo',
    inquiryYear: 2026,
    inquiryDate: new Date('2026-05-01'),
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

// ============================================================
// テストスイート
// ============================================================

describe('保全プロパティ: 売主新規登録スプレッドシート同期バグ', () => {
  let service: SellerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SellerService();
    (service as any).supabase = createSupabaseMock();

    // decryptSeller をモック（テストデータをそのまま返す）
    (service as any).decryptSeller = jest.fn().mockImplementation(async (seller: any) => ({
      id: seller.id,
      sellerNumber: seller.seller_number,
      name: '田中太郎',
      address: seller.address,
      phoneNumber: '09012345678',
      email: seller.email,
      status: seller.status,
      createdAt: new Date(seller.created_at),
      updatedAt: new Date(seller.updated_at),
    }));

    // getActiveSyncQueue をモック（null を返す）
    (service as any).getActiveSyncQueue = jest.fn().mockReturnValue(null);
  });

  // ----------------------------------------------------------
  // Property 2: Preservation - 既存フィールドの同期維持
  //
  // このテストは未修正コードで PASS することが期待される。
  // パスがベースライン動作を確認する。
  // ----------------------------------------------------------
  describe('Property 2: Preservation - 既存フィールドの同期維持', () => {

    /**
     * Validates: Requirements 3.1
     *
     * 全追加フィールドが null の CreateSellerRequest で createSeller を呼び出したとき、
     * appendRow の引数に名前・住所・電話番号が正しく渡されること。
     *
     * EXPECTED: PASS on unfixed code（ベースライン動作の確認）
     */
    it('名前・住所・電話番号が appendRow に正しく渡されること（未修正コードでパス）', async () => {
      // Arrange: 全追加フィールドが null（isBugCondition = false）
      const request = createBaseRequest({
        name: '田中太郎',
        address: '大分市中央町1-1-1',
        phoneNumber: '09012345678',
      });

      // バグ条件を満たさないことを確認
      expect(isBugCondition(request)).toBe(false);

      // Act
      await service.createSeller(request, 'employee-001');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];
      console.log('appendRow に渡されたオブジェクトのキー:', Object.keys(capturedArg));

      // 既存フィールドが正しく渡されることを確認
      expect(capturedArg).toHaveProperty('名前(漢字のみ）', '田中太郎');
      expect(capturedArg).toHaveProperty('依頼者住所(物件所在と異なる場合）', '大分市中央町1-1-1');
      expect(capturedArg).toHaveProperty('電話番号\nハイフン不要', '09012345678');
    });

    /**
     * Validates: Requirements 3.2, 3.3
     *
     * 全追加フィールドが null の CreateSellerRequest で createSeller を呼び出したとき、
     * appendRow の引数に物件所在地・反響日付が正しく渡されること。
     *
     * EXPECTED: PASS on unfixed code（ベースライン動作の確認）
     */
    it('物件所在地・反響日付が appendRow に正しく渡されること（未修正コードでパス）', async () => {
      // Arrange: 全追加フィールドが null（isBugCondition = false）
      const request = createBaseRequest({
        property: {
          address: '大分市物件住所2-2-2',
          propertyType: 'detached_house',
        },
        inquiryDate: new Date('2026-05-01'),
        inquirySource: 'suumo',
      });

      // バグ条件を満たさないことを確認
      expect(isBugCondition(request)).toBe(false);

      // Act
      await service.createSeller(request, 'employee-001');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];
      console.log('appendRow に渡されたオブジェクトのキー:', Object.keys(capturedArg));

      // 既存フィールドが正しく渡されることを確認
      expect(capturedArg).toHaveProperty('物件所在地', '大分市物件住所2-2-2');
      expect(capturedArg).toHaveProperty('反響日付', '2026-05-01');
      expect(capturedArg).toHaveProperty('サイト', 'suumo');
    });
  });
});
