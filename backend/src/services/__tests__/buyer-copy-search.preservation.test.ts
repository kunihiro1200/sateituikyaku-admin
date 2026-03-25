// 売主新規登録 買主コピー修正 - 保存プロパティテスト
// Property 2: Preservation - 数字以外のクエリでの既存動作が維持される
// **Validates: Requirements 3.1, 3.2, 3.4**
//
// このテストは修正前のコードで PASS することが期待される（ベースライン動作の確認）
// 観察対象:
//   - search("田中") → ilike 検索が実行され、結果が返ること
//   - search("田中123") → ilike 検索が実行され、結果が返ること
//   - 文字列を含む任意のクエリ（2文字以上）で ilike 検索が実行されること
//
// Preservation: isBugCondition(input) が false の入力（文字列を含む、または2文字未満）では
//   修正前後で同じ動作をすること

// ============================================================
// モック設定（importより前に定義する必要がある）
// ============================================================

// supabase.ts の初期化エラーを回避するためにモック
jest.mock('../../config/supabase', () => ({
  supabase: {},
  supabaseClient: {},
  default: {},
}));

// AuditLogService のモック
jest.mock('../AuditLogService', () => ({
  AuditLogService: {
    logFieldUpdate: jest.fn().mockResolvedValue(undefined),
  },
}));

// BuyerWriteService のモック
jest.mock('../BuyerWriteService', () => ({
  BuyerWriteService: jest.fn().mockImplementation(() => ({})),
}));

// ConflictResolver のモック
jest.mock('../ConflictResolver', () => ({
  ConflictResolver: jest.fn().mockImplementation(() => ({})),
}));

// RetryHandler のモック
jest.mock('../RetryHandler', () => ({
  RetryHandler: jest.fn().mockImplementation(() => ({})),
}));

// BuyerColumnMapper のモック
jest.mock('../BuyerColumnMapper', () => ({
  BuyerColumnMapper: jest.fn().mockImplementation(() => ({})),
}));

// GoogleSheetsClient のモック
jest.mock('../GoogleSheetsClient', () => ({
  GoogleSheetsClient: jest.fn().mockImplementation(() => ({})),
}));

// BuyerNumberSpreadsheetClient のモック
jest.mock('../BuyerNumberSpreadsheetClient', () => ({
  BuyerNumberSpreadsheetClient: jest.fn().mockImplementation(() => ({})),
}));

// BuyerStatusCalculator のモック
jest.mock('../BuyerStatusCalculator', () => ({
  calculateBuyerStatus: jest.fn().mockReturnValue('追客中'),
}));

// buyer-status-definitions のモック
jest.mock('../../config/buyer-status-definitions', () => ({
  STATUS_DEFINITIONS: [],
}));

// Supabase クライアントのモック
const mockLimit = jest.fn();
const mockOr = jest.fn().mockReturnValue({ limit: mockLimit });
const mockSelect = jest.fn().mockReturnValue({ or: mockOr });
const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// ============================================================
// テスト本体
// ============================================================

import { BuyerService } from '../BuyerService';

// isBugCondition: バグ条件の判定関数（テスト用）
// 数字のみかつ2文字以上の場合にバグが発生する
function isBugCondition(input: string): boolean {
  return /^\d+$/.test(input) && input.length >= 2;
}

describe('保存プロパティ: 売主新規登録 買主コピー検索 - 非バグ条件の動作維持', () => {
  let buyerService: BuyerService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Supabase チェーンのモックをリセット
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockOr.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ or: mockOr });
    mockFrom.mockReturnValue({ select: mockSelect });

    // 環境変数を設定
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    buyerService = new BuyerService();
  });

  // ============================================================
  // Preservation 1: 文字列クエリで ilike 検索が実行される
  // ============================================================
  describe('Preservation 1: 文字列クエリ（非バグ条件）で ilike 検索が実行される', () => {
    it('Preservation: search("田中") が ilike 検索を実行し、結果を返すこと', async () => {
      // 非バグ条件の確認
      expect(isBugCondition('田中')).toBe(false);

      const mockBuyers = [
        {
          id: 'test-uuid-1',
          buyer_number: '7100',
          name: '田中太郎',
          phone_number: '090-1111-2222',
          email: 'tanaka@example.com',
          property_number: 'AA11111',
          latest_status: '追客中',
          initial_assignee: 'Y',
        },
        {
          id: 'test-uuid-2',
          buyer_number: '7200',
          name: '田中花子',
          phone_number: '090-3333-4444',
          email: 'tanaka2@example.com',
          property_number: 'AA22222',
          latest_status: '追客中',
          initial_assignee: 'I',
        },
      ];

      mockLimit.mockResolvedValue({ data: mockBuyers, error: null });

      const result = await buyerService.search('田中');

      // ilike 検索が実行されること
      expect(mockOr).toHaveBeenCalled();
      const orCallArg = mockOr.mock.calls[0][0] as string;
      expect(orCallArg).toContain('buyer_number.ilike.%田中%');

      // 結果が配列として返されること
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });

    it('Preservation: search("田中123") が ilike 検索を実行し、結果を返すこと', async () => {
      // 非バグ条件の確認（文字列を含むため isBugCondition = false）
      expect(isBugCondition('田中123')).toBe(false);

      const mockBuyers = [
        {
          id: 'test-uuid-3',
          buyer_number: '7300',
          name: '田中123',
          phone_number: '090-5555-6666',
          email: 'tanaka3@example.com',
          property_number: 'AA33333',
          latest_status: '追客中',
          initial_assignee: 'Y',
        },
      ];

      mockLimit.mockResolvedValue({ data: mockBuyers, error: null });

      const result = await buyerService.search('田中123');

      // ilike 検索が実行されること
      expect(mockOr).toHaveBeenCalled();
      const orCallArg = mockOr.mock.calls[0][0] as string;
      expect(orCallArg).toContain('buyer_number.ilike.%田中123%');

      // 結果が配列として返されること
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('Preservation: 文字列クエリでエラーが発生しないこと', async () => {
      // 非バグ条件の確認
      expect(isBugCondition('山田')).toBe(false);

      mockLimit.mockResolvedValue({ data: [], error: null });

      let thrownError: Error | null = null;
      let result: any[] | null = null;

      try {
        result = await buyerService.search('山田');
      } catch (e) {
        thrownError = e as Error;
      }

      // エラーが発生しないこと
      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================
  // Preservation 2: 様々な文字列クエリで ilike 検索が実行される
  // ============================================================
  describe('Preservation 2: 様々な文字列クエリ（非バグ条件）で ilike 検索が実行される', () => {
    const stringQueries = [
      '田中',
      '山田',
      '佐藤太郎',
      'abc',
      'テスト',
      '田中123',
      '123abc',
      'AA123',
      '090-',
    ];

    stringQueries.forEach((query) => {
      it(`Preservation: search("${query}") が ilike 検索を実行すること（非バグ条件）`, async () => {
        // 非バグ条件の確認
        expect(isBugCondition(query)).toBe(false);

        mockLimit.mockResolvedValue({ data: [], error: null });

        let thrownError: Error | null = null;
        let result: any[] | null = null;

        try {
          result = await buyerService.search(query);
        } catch (e) {
          thrownError = e as Error;
        }

        // エラーが発生しないこと
        expect(thrownError).toBeNull();
        expect(result).not.toBeNull();
        expect(Array.isArray(result)).toBe(true);

        // ilike 検索が実行されること
        expect(mockOr).toHaveBeenCalled();
        const orCallArg = mockOr.mock.calls[0][0] as string;
        expect(orCallArg).toContain(`buyer_number.ilike.%${query}%`);
      });
    });
  });

  // ============================================================
  // Preservation 3: 1文字クエリでも ilike 検索が実行される（バックエンドは制限なし）
  // ============================================================
  describe('Preservation 3: 1文字クエリでもバックエンドは検索を実行する', () => {
    it('Preservation: search("田") が ilike 検索を実行すること（1文字は非バグ条件）', async () => {
      // 1文字は非バグ条件（数字のみでも length < 2 のため）
      expect(isBugCondition('田')).toBe(false);
      expect(isBugCondition('1')).toBe(false);

      mockLimit.mockResolvedValue({ data: [], error: null });

      let thrownError: Error | null = null;
      let result: any[] | null = null;

      try {
        result = await buyerService.search('田');
      } catch (e) {
        thrownError = e as Error;
      }

      // バックエンドはエラーなく処理すること
      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ============================================================
  // Preservation 4: isBugCondition の境界値確認
  // ============================================================
  describe('Preservation 4: isBugCondition の境界値確認', () => {
    it('isBugCondition: 数字のみ2文字以上 → true（バグ条件）', () => {
      expect(isBugCondition('12')).toBe(true);
      expect(isBugCondition('7211')).toBe(true);
      expect(isBugCondition('12345')).toBe(true);
    });

    it('isBugCondition: 文字列を含む → false（非バグ条件）', () => {
      expect(isBugCondition('田中')).toBe(false);
      expect(isBugCondition('田中123')).toBe(false);
      expect(isBugCondition('123abc')).toBe(false);
      expect(isBugCondition('AA123')).toBe(false);
    });

    it('isBugCondition: 1文字の数字 → false（非バグ条件）', () => {
      expect(isBugCondition('1')).toBe(false);
      expect(isBugCondition('9')).toBe(false);
    });

    it('isBugCondition: 空文字 → false（非バグ条件）', () => {
      expect(isBugCondition('')).toBe(false);
    });
  });

  // ============================================================
  // Preservation 5: 検索結果の構造確認
  // ============================================================
  describe('Preservation 5: 文字列クエリの検索結果構造が正しいこと', () => {
    it('Preservation: search("田中") の結果に buyer_number フィールドが含まれること', async () => {
      const mockBuyers = [
        {
          id: 'test-uuid-1',
          buyer_number: '7100',
          name: '田中太郎',
          phone_number: '090-1111-2222',
          email: 'tanaka@example.com',
          property_number: 'AA11111',
          latest_status: '追客中',
          initial_assignee: 'Y',
        },
      ];

      mockLimit.mockResolvedValue({ data: mockBuyers, error: null });

      const result = await buyerService.search('田中');

      expect(result).toHaveLength(1);
      // buyer_number フィールドが文字列として存在すること
      expect(result[0].buyer_number).toBeDefined();
      expect(typeof result[0].buyer_number).toBe('string');
      // name フィールドが存在すること
      expect(result[0].name).toBeDefined();
    });
  });
});
