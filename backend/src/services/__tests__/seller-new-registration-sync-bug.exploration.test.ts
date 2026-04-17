/**
 * バグ条件探索テスト: 売主新規登録スプレッドシート同期バグ
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10**
 *
 * このテストは**未修正コード**で実行し、バグが存在することを確認します。
 *
 * バグ条件 (isBugCondition):
 *   createSeller() の appendRow 呼び出しで渡されるオブジェクトに、
 *   次電日・訪問日・営担・確度・状況（当社）・コメント・査定情報・追客情報などの
 *   フィールドが含まれていない。
 *
 * 期待される結果（未修正コード）:
 *   テストが**失敗**する（これが正しい。バグの存在を証明する）
 *
 * カウンターサンプル:
 *   appendRow に渡されるオブジェクトに追加フィールドのキーが存在しない
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
  status: '追客中',
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
// テスト用の CreateSellerRequest ベースデータ
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
    ...overrides,
  };
}

// ============================================================
// テストスイート
// ============================================================

describe('バグ条件探索: 売主新規登録スプレッドシート同期バグ', () => {
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
  // Property 1: Bug Condition - 欠落フィールドのスプレッドシート非同期バグ
  //
  // このテストは未修正コードで FAIL することが期待される。
  // 失敗がバグの存在を証明する。
  // ----------------------------------------------------------
  describe('Property 1: Bug Condition - 欠落フィールドのスプレッドシート非同期バグ', () => {

    /**
     * Validates: Requirements 1.1
     *
     * nextCallDate: '2026-05-01' を含む CreateSellerRequest で createSeller を呼び出したとき、
     * appendRow の引数に '次電日': '2026-05-01' が含まれること。
     *
     * EXPECTED: FAIL on unfixed code（バグの存在を証明）
     */
    it('nextCallDate を含む場合、appendRow に "次電日" が含まれること（未修正コードで失敗）', async () => {
      // Arrange
      const request = createBaseRequest({ nextCallDate: '2026-05-01' });

      // バグ条件を満たすことを確認
      expect(isBugCondition(request)).toBe(true);

      // Act
      await service.createSeller(request, 'employee-001');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];
      console.log('appendRow に渡されたオブジェクトのキー:', Object.keys(capturedArg));
      console.log('次電日の値:', capturedArg['次電日']);

      // 未修正コードではこのアサーションが失敗する（バグの証明）
      // appendRow に '次電日' キーが存在しないため
      expect(capturedArg).toHaveProperty('次電日', '2026-05-01');
    });

    /**
     * Validates: Requirements 1.3
     *
     * visitAssignee: 'Y' を含む CreateSellerRequest で createSeller を呼び出したとき、
     * appendRow の引数に '営担': 'Y' が含まれること。
     *
     * EXPECTED: FAIL on unfixed code（バグの存在を証明）
     */
    it('visitAssignee を含む場合、appendRow に "営担" が含まれること（未修正コードで失敗）', async () => {
      // Arrange
      const request = createBaseRequest({ visitAssignee: 'Y' });

      // バグ条件を満たすことを確認
      expect(isBugCondition(request)).toBe(true);

      // Act
      await service.createSeller(request, 'employee-001');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];
      console.log('appendRow に渡されたオブジェクトのキー:', Object.keys(capturedArg));
      console.log('営担の値:', capturedArg['営担']);

      // 未修正コードではこのアサーションが失敗する（バグの証明）
      // appendRow に '営担' キーが存在しないため
      expect(capturedArg).toHaveProperty('営担', 'Y');
    });

    /**
     * Validates: Requirements 1.5
     *
     * status: '追客中' を含む CreateSellerRequest で createSeller を呼び出したとき、
     * appendRow の引数に '状況（当社）': '追客中' が含まれること。
     *
     * EXPECTED: FAIL on unfixed code（バグの存在を証明）
     */
    it('status を含む場合、appendRow に "状況（当社）" が含まれること（未修正コードで失敗）', async () => {
      // Arrange
      const request = createBaseRequest({ status: '追客中' });

      // バグ条件を満たすことを確認
      expect(isBugCondition(request)).toBe(true);

      // Act
      await service.createSeller(request, 'employee-001');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];
      console.log('appendRow に渡されたオブジェクトのキー:', Object.keys(capturedArg));
      console.log('状況（当社）の値:', capturedArg['状況（当社）']);

      // 未修正コードではこのアサーションが失敗する（バグの証明）
      // appendRow に '状況（当社）' キーが存在しないため
      expect(capturedArg).toHaveProperty('状況（当社）', '追客中');
    });

    /**
     * Validates: Requirements 1.7
     *
     * valuationAmount1: 1500 を含む CreateSellerRequest で createSeller を呼び出したとき、
     * appendRow の引数に '査定額1': '1500' が含まれること。
     *
     * EXPECTED: FAIL on unfixed code（バグの存在を証明）
     */
    it('valuationAmount1 を含む場合、appendRow に "査定額1" が含まれること（未修正コードで失敗）', async () => {
      // Arrange
      const request = createBaseRequest({ valuationAmount1: 1500 });

      // バグ条件を満たすことを確認
      expect(isBugCondition(request)).toBe(true);

      // Act
      await service.createSeller(request, 'employee-001');

      // appendRow が呼ばれたことを確認
      expect(mockAppendRow).toHaveBeenCalled();

      // appendRow に渡されたオブジェクトを取得
      const capturedArg = mockAppendRow.mock.calls[mockAppendRow.mock.calls.length - 1][0];
      console.log('appendRow に渡されたオブジェクトのキー:', Object.keys(capturedArg));
      console.log('査定額1の値:', capturedArg['査定額1']);

      // 未修正コードではこのアサーションが失敗する（バグの証明）
      // appendRow に '査定額1' キーが存在しないため
      expect(capturedArg).toHaveProperty('査定額1', '1500');
    });
  });
});
