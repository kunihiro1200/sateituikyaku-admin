// 買主メールアドレス検索バグ - バグ条件探索テスト
// Property 1: Bug Condition - メールアドレス検索で買主が返されないバグ
// **Validates: Requirements 2.1, 2.2**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示すカウンターサンプルを発見する
//
// Bug Condition: input.search が "@" を含む文字列 かつ 対応する買主がDBに存在する
// 根本原因: BuyerService.getAll() の or() 条件に email フィールドが含まれていない
//   現在のバグのあるコード:
//   `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,property_number.ilike.%${search}%`
//   email.ilike が欠落しているため、メールアドレスで検索しても0件が返る

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

// ============================================================
// Supabase クライアントのモック
// getAll() は以下のチェーンを使用する:
//   supabase.from('buyers').select('*', { count: 'exact' })
//     .or(...)  ← 検索条件
//     .order(sortBy, {...})
//     .range(offset, offset + limit - 1)
//   ※ 全メソッドが自分自身を返すプロキシ的なモックを使用する
// ============================================================

// or() の呼び出し引数を記録するためのモック（テストで検証する）
const mockOrCapture = jest.fn();

// クエリチェーンを生成するファクトリ関数
function createQueryChain(rangeResult: any): any {
  const chain: any = {};
  chain.or = jest.fn().mockImplementation((...args: any[]) => {
    mockOrCapture(...args);
    return chain;
  });
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.is = jest.fn().mockReturnValue(chain);
  chain.not = jest.fn().mockReturnValue(chain);
  chain.neq = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.ilike = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.range = jest.fn().mockResolvedValue(rangeResult);
  return chain;
}

// property_listings 用のクエリチェーン
function createPropertyQueryChain(): any {
  const chain: any = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockResolvedValue({ data: [], error: null });
  return chain;
}

let currentQueryChain: any;
let currentPropertyChain: any;

const mockFrom = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// ============================================================
// テスト本体
// ============================================================

import { BuyerService } from '../BuyerService';

describe('バグ条件探索: 買主メールアドレス検索バグ', () => {
  let buyerService: BuyerService;

  beforeEach(() => {
    jest.clearAllMocks();

    // 各テストごとに新しいクエリチェーンを生成
    currentQueryChain = createQueryChain({ data: [], count: 0, error: null });
    currentPropertyChain = createPropertyQueryChain();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'property_listings') {
        return currentPropertyChain;
      }
      return { select: jest.fn().mockReturnValue(currentQueryChain) };
    });

    // 環境変数を設定
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    buyerService = new BuyerService();
  });

  // ============================================================
  // Bug Condition: メールアドレス検索で or() に email.ilike が含まれない
  // ============================================================
  describe('Bug Condition: getAll({ search: "test@example.com" }) の or() 条件に email.ilike が含まれない', () => {

    it('Bug Condition: メールアドレス検索時に or() に email.ilike が含まれること（未修正コードでは FAIL する）', async () => {
      // 対応する買主が存在するシミュレーション（range()の戻り値を設定）
      currentQueryChain.range.mockResolvedValue({
        data: [
          {
            id: 'test-uuid-1234',
            buyer_number: '7211',
            name: 'テスト太郎',
            phone_number: '090-1234-5678',
            email: 'test@example.com',
            property_number: 'AA12345',
            latest_status: '追客中',
          },
        ],
        count: 1,
        error: null,
      });

      await buyerService.getAll({ search: 'test@example.com' });

      // or() が呼ばれたことを確認
      expect(mockOrCapture).toHaveBeenCalled();

      // or() に渡された引数を取得（検索条件の or() は最初の呼び出し）
      const orCallArg = mockOrCapture.mock.calls[0][0] as string;

      // ============================================================
      // このアサーションは未修正コードで FAIL する（バグの存在を証明）
      // 修正後は email.ilike.%test@example.com% が含まれるため PASS する
      // ============================================================
      expect(orCallArg).toContain('email.ilike');
    });

    it('Bug Condition: "@" を含む検索文字列で or() に email.ilike.%...% が含まれること（未修正コードでは FAIL する）', async () => {
      await buyerService.getAll({ search: 'test@example.com' });

      expect(mockOrCapture).toHaveBeenCalled();
      const orCallArg = mockOrCapture.mock.calls[0][0] as string;

      // ============================================================
      // カウンターサンプル: "test@example.com" で検索したとき
      // 未修正コードの or() 条件:
      //   "buyer_number.ilike.%test@example.com%,name.ilike.%test@example.com%,
      //    phone_number.ilike.%test@example.com%,property_number.ilike.%test@example.com%"
      // email.ilike が含まれていない → バグ確認
      // ============================================================
      expect(orCallArg).toContain('email.ilike.%test@example.com%');
    });

    it('Bug Condition: ドメイン部分のみの検索 "example.com" でも email.ilike が含まれること（未修正コードでは FAIL する）', async () => {
      await buyerService.getAll({ search: 'example.com' });

      expect(mockOrCapture).toHaveBeenCalled();
      const orCallArg = mockOrCapture.mock.calls[0][0] as string;

      // ドメイン部分のみの検索でも email.ilike が含まれるべき
      expect(orCallArg).toContain('email.ilike.%example.com%');
    });
  });

  // ============================================================
  // バグ条件サマリー
  // ============================================================
  describe('バグ条件サマリー: or() 条件文字列に email.ilike が欠落している', () => {

    it('根本原因確認: 現在の or() 条件に buyer_number, name, phone_number, property_number は含まれるが email は含まれない', async () => {
      await buyerService.getAll({ search: 'test@example.com' });

      expect(mockOrCapture).toHaveBeenCalled();
      const orCallArg = mockOrCapture.mock.calls[0][0] as string;

      // 既存フィールドは含まれている（これらは正常）
      expect(orCallArg).toContain('buyer_number.ilike');
      expect(orCallArg).toContain('name.ilike');
      expect(orCallArg).toContain('phone_number.ilike');
      expect(orCallArg).toContain('property_number.ilike');

      // ============================================================
      // このアサーションは未修正コードで FAIL する（バグの存在を証明）
      // email.ilike が欠落していることがバグの根本原因
      // ============================================================
      expect(orCallArg).toContain('email.ilike');
    });
  });
});

// ============================================================
// Property 2: Preservation - 既存検索フィールドの動作が変わらない
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
//
// このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
// 既存フィールド（buyer_number, name, phone_number, property_number）の
// 検索動作が修正前後で変わらないことを証明する
// ============================================================

import * as fc from 'fast-check';

describe('保持プロパティ: 既存検索フィールドの動作が変わらない', () => {
  let buyerService: BuyerService;

  beforeEach(() => {
    jest.clearAllMocks();

    currentQueryChain = createQueryChain({ data: [], count: 0, error: null });
    currentPropertyChain = createPropertyQueryChain();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'property_listings') {
        return currentPropertyChain;
      }
      return { select: jest.fn().mockReturnValue(currentQueryChain) };
    });

    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

    buyerService = new BuyerService();
  });

  // ============================================================
  // 観察1: 4〜5桁の数字は buyer_number の完全一致検索
  // ============================================================
  describe('観察1: 4〜5桁の数字は eq("buyer_number", search) が使われる', () => {

    it('4桁の数字で検索すると eq() が呼ばれ or() は呼ばれない', async () => {
      await buyerService.getAll({ search: '1234' });

      // eq() が buyer_number で呼ばれていること
      expect(currentQueryChain.eq).toHaveBeenCalledWith('buyer_number', '1234');
      // or() は呼ばれない（完全一致のみ）
      expect(mockOrCapture).not.toHaveBeenCalled();
    });

    it('5桁の数字で検索すると eq() が呼ばれ or() は呼ばれない', async () => {
      await buyerService.getAll({ search: '12345' });

      expect(currentQueryChain.eq).toHaveBeenCalledWith('buyer_number', '12345');
      expect(mockOrCapture).not.toHaveBeenCalled();
    });

    it('プロパティテスト: 4〜5桁の数字は常に eq("buyer_number") が使われる', async () => {
      // **Validates: Requirements 3.1**
      await fc.assert(
        fc.asyncProperty(
          // 4〜5桁の数字を生成
          fc.integer({ min: 1000, max: 99999 }).map(n => String(n)),
          async (buyerNumber) => {
            jest.clearAllMocks();
            currentQueryChain = createQueryChain({ data: [], count: 0, error: null });
            currentPropertyChain = createPropertyQueryChain();
            mockFrom.mockImplementation((table: string) => {
              if (table === 'property_listings') return currentPropertyChain;
              return { select: jest.fn().mockReturnValue(currentQueryChain) };
            });

            await buyerService.getAll({ search: buyerNumber });

            // eq('buyer_number', buyerNumber) が呼ばれること
            expect(currentQueryChain.eq).toHaveBeenCalledWith('buyer_number', buyerNumber);
            // or() は呼ばれないこと
            expect(mockOrCapture).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ============================================================
  // 観察2: 非メールアドレス文字列は or() に既存フィールドが含まれる
  // ============================================================
  describe('観察2: 非メールアドレス文字列は or() に既存フィールドが含まれる', () => {

    it('氏名（田中）で検索すると or() に name.ilike が含まれる', async () => {
      await buyerService.getAll({ search: '田中' });

      expect(mockOrCapture).toHaveBeenCalled();
      const orCallArg = mockOrCapture.mock.calls[0][0] as string;
      expect(orCallArg).toContain('name.ilike.%田中%');
    });

    it('電話番号（090）で検索すると or() に phone_number.ilike が含まれる', async () => {
      await buyerService.getAll({ search: '090' });

      expect(mockOrCapture).toHaveBeenCalled();
      const orCallArg = mockOrCapture.mock.calls[0][0] as string;
      expect(orCallArg).toContain('phone_number.ilike.%090%');
    });

    it('物件番号（A-001）で検索すると or() に property_number.ilike が含まれる', async () => {
      await buyerService.getAll({ search: 'A-001' });

      expect(mockOrCapture).toHaveBeenCalled();
      const orCallArg = mockOrCapture.mock.calls[0][0] as string;
      expect(orCallArg).toContain('property_number.ilike.%A-001%');
    });

    it('プロパティテスト: 非メールアドレス・非数字文字列は or() に既存4フィールドが含まれる', async () => {
      // **Validates: Requirements 3.2, 3.3, 3.4**
      // 非メールアドレス（@を含まない）かつ4〜5桁の数字でない文字列を生成
      const nonEmailNonBuyerNumber = fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
        // @を含まない（メールアドレスでない）
        if (s.includes('@')) return false;
        // 4〜5桁の数字でない
        if (/^\d{4,5}$/.test(s)) return false;
        // 空白のみでない
        if (s.trim().length === 0) return false;
        return true;
      });

      await fc.assert(
        fc.asyncProperty(
          nonEmailNonBuyerNumber,
          async (search) => {
            jest.clearAllMocks();
            currentQueryChain = createQueryChain({ data: [], count: 0, error: null });
            currentPropertyChain = createPropertyQueryChain();
            mockFrom.mockImplementation((table: string) => {
              if (table === 'property_listings') return currentPropertyChain;
              return { select: jest.fn().mockReturnValue(currentQueryChain) };
            });

            await buyerService.getAll({ search });

            // or() が呼ばれること
            expect(mockOrCapture).toHaveBeenCalled();
            const orCallArg = mockOrCapture.mock.calls[0][0] as string;

            // 既存4フィールドが全て含まれること（保持確認）
            expect(orCallArg).toContain(`buyer_number.ilike.%${search}%`);
            expect(orCallArg).toContain(`name.ilike.%${search}%`);
            expect(orCallArg).toContain(`phone_number.ilike.%${search}%`);
            expect(orCallArg).toContain(`property_number.ilike.%${search}%`);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  // ============================================================
  // 観察3: search なしの場合は or() も eq() も呼ばれない
  // ============================================================
  describe('観察3: search なしの場合は検索条件が追加されない', () => {

    it('search パラメータなしで getAll() を呼ぶと or() も eq() も呼ばれない', async () => {
      await buyerService.getAll({});

      expect(mockOrCapture).not.toHaveBeenCalled();
      expect(currentQueryChain.eq).not.toHaveBeenCalledWith('buyer_number', expect.anything());
    });
  });
});
