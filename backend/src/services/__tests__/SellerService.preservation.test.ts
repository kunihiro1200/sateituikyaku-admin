/**
 * 保持プロパティテスト: data.site が undefined である更新リクエストの動作保持
 *
 * このテストは未修正コードでベースライン動作を確認するためのものです。
 * isBugCondition(input) が false（data.site が undefined）の更新リクエストを対象にします。
 *
 * 未修正コードでは全テストが PASS することが期待されます（ベースライン確認）。
 * 修正後も全テストが PASS することで、リグレッションがないことを確認します。
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

// Mock supabase.ts to avoid initialization errors
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

// SpreadsheetSyncService と GoogleSheetsClient をモックして非同期処理を防ぐ
jest.mock('../SpreadsheetSyncService', () => ({
  SpreadsheetSyncService: jest.fn().mockImplementation(() => ({
    syncToSpreadsheet: jest.fn().mockResolvedValue({ success: true }),
  })),
}));

jest.mock('../GoogleSheetsClient', () => ({
  GoogleSheetsClient: jest.fn().mockImplementation(() => ({
    authenticate: jest.fn().mockResolvedValue(undefined),
    findRowByColumn: jest.fn().mockResolvedValue(null),
    appendRow: jest.fn().mockResolvedValue(undefined),
    updateRowPartial: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { SellerService } from '../SellerService.supabase';

// ============================================================
// モックデータ
// ============================================================

const MOCK_SELLER_ROW = {
  id: 'preservation-seller-id-001',
  seller_number: 'AA99001',
  name: 'test',
  phone_number: '09012345678',
  email: null,
  status: '追客中',
  inquiry_site: null,
  inquiry_date: '2026-01-01',
  next_call_date: null,
  confidence: null,
  first_caller_initials: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

// ============================================================
// Supabase モック生成ヘルパー
// site フィールドが含まれていない更新は常に成功する
// ============================================================
function createSupabaseMock(capturedUpdates: { value: any }) {
  return {
    from: jest.fn().mockImplementation((_table: string) => ({
      update: jest.fn().mockImplementation((updates: any) => {
        capturedUpdates.value = updates;
        return {
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockImplementation(() => {
                // site フィールドが含まれている場合はエラーを返す（未修正コードの動作）
                if ('site' in updates) {
                  return Promise.resolve({
                    data: null,
                    error: {
                      message: 'column "site" of relation "sellers" does not exist',
                      code: '42703',
                    },
                  });
                }
                // site フィールドが含まれていない場合は成功
                return Promise.resolve({
                  data: { ...MOCK_SELLER_ROW, ...updates },
                  error: null,
                });
              }),
            }),
          }),
        };
      }),
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: MOCK_SELLER_ROW, error: null }),
          is: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: MOCK_SELLER_ROW, error: null }),
          }),
        }),
      }),
    })),
  } as any;
}

// ============================================================
// テストスイート
// ============================================================

describe('保持プロパティ: data.site が undefined である更新リクエストの動作保持', () => {
  let service: SellerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SellerService();
  });

  // ============================================================
  // テスト1: { status: '専任媒介' } のみの更新が正常に動作する
  // ============================================================
  describe('テスト1: status のみの更新（site フィールドなし）', () => {
    it('{ status: "専任媒介" } のみの更新が正常に動作すること（未修正コードでもパス）', async () => {
      // Arrange
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      // Act
      let thrownError: Error | null = null;
      let result: any = null;
      try {
        result = await service.updateSeller('preservation-seller-id-001', {
          status: '専任媒介',
        } as any);
      } catch (err: any) {
        thrownError = err;
      }

      // Assert: エラーが発生しないこと
      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();

      // updates に status が含まれること
      expect(capturedUpdates.value).toHaveProperty('status', '専任媒介');

      // updates に site フィールドが含まれないこと（バグ条件に該当しない）
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).not.toHaveProperty('inquiry_site');
    });
  });

  // ============================================================
  // テスト2: { confidence: 'A' } のみの更新が正常に動作する
  // ============================================================
  describe('テスト2: confidence のみの更新（site フィールドなし）', () => {
    it('{ confidence: "A" } のみの更新が正常に動作すること（未修正コードでもパス）', async () => {
      // Arrange
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      // Act
      let thrownError: Error | null = null;
      let result: any = null;
      try {
        result = await service.updateSeller('preservation-seller-id-001', {
          confidence: 'A',
        } as any);
      } catch (err: any) {
        thrownError = err;
      }

      // Assert: エラーが発生しないこと
      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();

      // updates に confidence が含まれること
      expect(capturedUpdates.value).toHaveProperty('confidence', 'A');

      // updates に site フィールドが含まれないこと
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).not.toHaveProperty('inquiry_site');
    });
  });

  // ============================================================
  // テスト3: { nextCallDate: '2026-04-01' } のみの更新が正常に動作する
  // ============================================================
  describe('テスト3: nextCallDate のみの更新（site フィールドなし）', () => {
    it('{ nextCallDate: "2026-04-01" } のみの更新が正常に動作すること（未修正コードでもパス）', async () => {
      // Arrange
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      // Act
      let thrownError: Error | null = null;
      let result: any = null;
      try {
        result = await service.updateSeller('preservation-seller-id-001', {
          nextCallDate: '2026-04-01',
        } as any);
      } catch (err: any) {
        thrownError = err;
      }

      // Assert: エラーが発生しないこと
      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();

      // updates に next_call_date が含まれること
      expect(capturedUpdates.value).toHaveProperty('next_call_date', '2026-04-01');

      // updates に site フィールドが含まれないこと
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).not.toHaveProperty('inquiry_site');
    });
  });

  // ============================================================
  // テスト4: site フィールドを含まない複数フィールドの更新が正常に動作する
  // ============================================================
  describe('テスト4: site フィールドを含まない複数フィールドの更新', () => {
    it('{ status, confidence, nextCallDate } の複数フィールド更新が正常に動作すること（未修正コードでもパス）', async () => {
      // Arrange
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      // Act
      let thrownError: Error | null = null;
      let result: any = null;
      try {
        result = await service.updateSeller('preservation-seller-id-001', {
          status: '追客中',
          confidence: 'B',
          nextCallDate: '2026-05-01',
        } as any);
      } catch (err: any) {
        thrownError = err;
      }

      // Assert: エラーが発生しないこと
      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();

      // updates に各フィールドが含まれること
      expect(capturedUpdates.value).toHaveProperty('status', '追客中');
      expect(capturedUpdates.value).toHaveProperty('confidence', 'B');
      expect(capturedUpdates.value).toHaveProperty('next_call_date', '2026-05-01');

      // updates に site フィールドが含まれないこと（バグ条件に該当しない）
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).not.toHaveProperty('inquiry_site');
    });

    it('{ status: "専任媒介", confidence: "A" } の更新が正常に動作すること（未修正コードでもパス）', async () => {
      // Arrange
      const capturedUpdates = { value: null as any };
      (service as any).supabase = createSupabaseMock(capturedUpdates);

      // Act
      let thrownError: Error | null = null;
      let result: any = null;
      try {
        result = await service.updateSeller('preservation-seller-id-001', {
          status: '専任媒介',
          confidence: 'A',
        } as any);
      } catch (err: any) {
        thrownError = err;
      }

      // Assert: エラーが発生しないこと
      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();

      // updates に各フィールドが含まれること
      expect(capturedUpdates.value).toHaveProperty('status', '専任媒介');
      expect(capturedUpdates.value).toHaveProperty('confidence', 'A');

      // updates に site フィールドが含まれないこと
      expect(capturedUpdates.value).not.toHaveProperty('site');
      expect(capturedUpdates.value).not.toHaveProperty('inquiry_site');
    });
  });
});
