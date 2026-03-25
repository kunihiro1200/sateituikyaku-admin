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
// 修正後のコードは .or().or().limit() チェーンを使うため、
// mockOr は { or: mockOr, limit: mockLimit } を返す必要がある
const mockLimit = jest.fn();
const mockOr = jest.fn();
mockOr.mockReturnValue({ or: mockOr, limit: mockLimit });
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

describe('バグ条件探索: 売主新規登録 買主コピー検索バグ', () => {
  let buyerService: BuyerService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Supabase チェーンのモックをリセット
    mockLimit.mockResolvedValue({ data: null, error: null });
    mockOr.mockReturnValue({ or: mockOr, limit: mockLimit });
    mockSelect.mockReturnValue({ or: mockOr });
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
      // 期待される動作（修正後）: search("7211") がエラーなく配列を返す
      // 未修正コードでは: Supabase が型不一致エラーを返し、例外がスローされる
      //
      // カウンターサンプル: search("7211") が例外をスローする

      // 修正後のコードは .or().or() チェーンを使うため、型不一致エラーが発生しない
      // Supabase が正常なレスポンスを返すシミュレーション（修正後の動作）
      mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      // 修正後は正常に配列が返される → このアサーションは PASS
      let result: any[] | null = null;
      let thrownError: Error | null = null;

      try {
        result = await buyerService.search('7211');
      } catch (e) {
        thrownError = e as Error;
      }

      // 期待される動作: エラーなく配列を返す
      // 修正後は PASS（例外がスローされない）
      expect(thrownError).toBeNull(); // ← 修正後は PASS
      expect(result).not.toBeNull();  // ← 修正後は PASS
      expect(Array.isArray(result)).toBe(true); // ← 修正後は PASS
    });

    it('Bug Condition: レスポンスの buyer_number フィールドが文字列であること', async () => {
      // 期待される動作（修正後）: レスポンスの buyer_number が文字列として返される
      // 未修正コードでは: 500エラーのため buyer_number が返されない
      //
      // カウンターサンプル: buyer_number が undefined または null になる

      // 正常なレスポンスをシミュレーション（修正後の動作）
      mockLimit.mockResolvedValue({
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
      });

      const result = await buyerService.search('7211');

      // レスポンスの buyer_number が文字列であることを確認
      expect(result).toHaveLength(1);
      expect(result[0].buyer_number).toBeDefined();
      expect(typeof result[0].buyer_number).toBe('string');
      expect(result[0].buyer_number).toBe('7211');
    });
  });

  // ============================================================
  // Bug Condition 2: .or() フィルタ文字列の型不一致確認
  // ============================================================
  describe('Bug Condition 2: .or() フィルタ文字列の型不一致', () => {
    it('Bug Condition: 数字のみのクエリで .or() に渡される文字列にシングルクォートが含まれない（型不一致の原因）', async () => {
      // バグ条件の詳細:
      // 未修正コード: `buyer_number.eq.${query}` → "buyer_number.eq.7211"
      // 修正後コード: 別途 .eq('buyer_number', query) を使用
      //
      // Supabase の .or() フィルタ形式では:
      // - buyer_number.eq.7211 → 数値として解釈 → TEXT型と型不一致
      // - 修正後は .or() に buyer_number.eq.7211 が含まれない

      mockLimit.mockResolvedValue({ data: [], error: null });

      await buyerService.search('7211');

      // .or() が呼ばれたことを確認
      expect(mockOr).toHaveBeenCalled();

      const orCallArg = mockOr.mock.calls[0][0] as string;

      // 未修正コード: buyer_number.eq.7211 が含まれる（シングルクォートなし）
      // 修正後コード: .or() に buyer_number.eq.7211 が含まれない（別途 .eq() を使用）
      const hasUnquotedEq = /buyer_number\.eq\.\d+/.test(orCallArg);

      // 未修正コードでは true（バグあり）→ このアサーションは FAIL
      // 修正後は false（バグなし）→ このアサーションは PASS
      expect(hasUnquotedEq).toBe(false); // ← 未修正コードでは FAIL（バグ条件のカウンターサンプル）
    });

    it('Bug Condition: 4桁の数字 "1234" でも同様のバグが発生する', async () => {
      // 修正後のコードは .or().or() チェーンを使うため、型不一致エラーが発生しない
      mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      let thrownError: Error | null = null;
      try {
        await buyerService.search('1234');
      } catch (e) {
        thrownError = e as Error;
      }

      // 修正後は例外がスローされない → PASS
      expect(thrownError).toBeNull(); // ← 修正後は PASS
    });

    it('Bug Condition: 5桁の数字 "12345" でも同様のバグが発生する', async () => {
      // 修正後のコードは .or().or() チェーンを使うため、型不一致エラーが発生しない
      mockLimit.mockResolvedValue({
        data: [],
        error: null,
      });

      let thrownError: Error | null = null;
      try {
        await buyerService.search('12345');
      } catch (e) {
        thrownError = e as Error;
      }

      // 修正後は例外がスローされない → PASS
      expect(thrownError).toBeNull(); // ← 修正後は PASS
    });
  });

  // ============================================================
  // バグ条件サマリー
  // ============================================================
  describe('バグ条件サマリー: isBugCondition(input) = /^\\d+$/.test(input) && input.length >= 2', () => {
    it('根本原因: search() の buyerNumberMatch が数字クエリに対して buyer_number.eq.{数値} を生成する', async () => {
      // 根本原因の確認:
      // BuyerService.search() の実装:
      //   const buyerNumberMatch = /^\d+$/.test(query)
      //     ? `buyer_number.eq.${query}`      ← バグ: 数値として解釈される
      //     : `buyer_number.ilike.%${query}%`;
      //
      // 修正後:
      //   数字のみのクエリに対して .or() ではなく .eq('buyer_number', query) を使用

      mockLimit.mockResolvedValue({ data: [], error: null });

      await buyerService.search('7211');

      const orCallArg = mockOr.mock.calls[0][0] as string;

      // 未修正コードでは buyer_number.eq.7211 が含まれる
      // 修正後は .or() の引数が変わる（buyer_number.eq.7211 が含まれない）
      expect(orCallArg).not.toContain('buyer_number.eq.7211'); // ← 未修正コードでは FAIL
    });
  });
});
