// 売主新規登録 買主コピー修正 - バグ条件探索テスト
// Property 1: Bug Condition - 数字のみの買主番号で500エラーが発生する
// **Validates: Requirements 1.1, 1.2, 1.3**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示すカウンターサンプルを発見する
//
// Bug Condition: /^\d+$/.test(input) && input.length >= 2
// 根本原因: BuyerService.search() が数字のみのクエリに対して
//   buyer_number.eq.7211（数値）でSupabaseクエリを発行するが、
//   buyer_number カラムはTEXT型のため型不一致で500エラーが発生する

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
// 修正後のコードは Promise.all で2つのクエリを並列実行する:
// 1. .select().eq('buyer_number', query).limit() - 完全一致
// 2. .select().or(...).limit() - 部分一致
const mockLimit = jest.fn();
const mockEq = jest.fn().mockReturnValue({ limit: mockLimit });
const mockOr = jest.fn().mockReturnValue({ limit: mockLimit });
const mockSelect = jest.fn().mockReturnValue({ or: mockOr, eq: mockEq });
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

describe('バグ条件探索: 売主新規登録 買主コピー検索バグ', () => {
  let buyerService: BuyerService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Supabase チェーンのモックをリセット
    // 修正後のコードは Promise.all で2つのクエリを並列実行する
    mockLimit.mockResolvedValue({ data: [], error: null });
    mockEq.mockReturnValue({ limit: mockLimit });
    mockOr.mockReturnValue({ limit: mockLimit });
    mockSelect.mockReturnValue({ or: mockOr, eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });

    // 環境変数を設定
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    buyerService = new BuyerService();
  });

  // ============================================================
  // Bug Condition 1: 数字のみのクエリで型不一致エラーが発生する
  // ============================================================
  describe('Bug Condition 1: 数字のみの買主番号で buyer_number.eq.{数値} が使われる', () => {
    it('Bug Condition: search("7211") がエラーなく配列を返すこと（修正前は500エラーで失敗する）', async () => {
      // 修正後: Promise.all で .eq() と .or() を並列実行するため型不一致エラーが発生しない
      mockLimit.mockResolvedValue({ data: [], error: null });

      let result: any[] | null = null;
      let thrownError: Error | null = null;

      try {
        result = await buyerService.search('7211');
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).toBeNull();
      expect(result).not.toBeNull();
      expect(Array.isArray(result)).toBe(true);
    });

    it('Bug Condition: レスポンスの buyer_number フィールドが文字列であること', async () => {
      // .eq() クエリが buyer_number: '7211' を返すシミュレーション
      mockLimit
        .mockResolvedValueOnce({
          data: [
            {
              id: 'test-uuid-1234',
              buyer_number: '7211',
              name: 'テスト太郎',
              phone_number: '090-1234-5678',
              email: 'test@example.com',
              property_number: 'AA12345',
              latest_status: '追客中',
              initial_assignee: 'Y',
            },
          ],
          error: null,
        })
        .mockResolvedValueOnce({ data: [], error: null });

      const result = await buyerService.search('7211');

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].buyer_number).toBeDefined();
      expect(typeof result[0].buyer_number).toBe('string');
      expect(result[0].buyer_number).toBe('7211');
    });
  });

  // ============================================================
  // Bug Condition 2: .eq() を使って TEXT型として正しく比較される
  // ============================================================
  describe('Bug Condition 2: 修正後は .eq() で TEXT型として正しく比較される', () => {
    it('Bug Condition: 数字のみのクエリで .eq("buyer_number", query) が呼ばれること', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await buyerService.search('7211');

      // 修正後: .eq('buyer_number', '7211') が呼ばれることを確認
      expect(mockEq).toHaveBeenCalledWith('buyer_number', '7211');
    });

    it('Bug Condition: 4桁の数字 "1234" でも .eq() が呼ばれること', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      let thrownError: Error | null = null;
      try {
        await buyerService.search('1234');
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).toBeNull();
      expect(mockEq).toHaveBeenCalledWith('buyer_number', '1234');
    });

    it('Bug Condition: 5桁の数字 "12345" でも .eq() が呼ばれること', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      let thrownError: Error | null = null;
      try {
        await buyerService.search('12345');
      } catch (e) {
        thrownError = e as Error;
      }

      expect(thrownError).toBeNull();
      expect(mockEq).toHaveBeenCalledWith('buyer_number', '12345');
    });
  });

  // ============================================================
  // バグ条件サマリー
  // ============================================================
  describe('バグ条件サマリー: isBugCondition(input) = /^\\d+$/.test(input) && input.length >= 2', () => {
    it('根本原因修正確認: 数字クエリで .or() に buyer_number.eq.{数値} が含まれないこと', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await buyerService.search('7211');

      // 修正後: .or() の引数に buyer_number.eq.7211 が含まれない
      const orCallArg = mockOr.mock.calls[0][0] as string;
      expect(orCallArg).not.toContain('buyer_number.eq.7211');

      // 代わりに .eq() が呼ばれていること
      expect(mockEq).toHaveBeenCalledWith('buyer_number', '7211');
    });
  });
});
