// Preservation property test: seller-phone-search-bug
// Validates: Requirements 3.1, 3.2, 3.3, 3.4
//
// Property 3: Preservation - 非ハッシュ検索入力の動作保持
//
// このテストは未修正コードで PASS することが期待される。
// バグ修正前後で、非バグ条件の入力に対する動作が変わらないことを確認する。
//
// 保全すべき動作:
//   - 売主番号（AA/FI/BB + 数字）検索 → seller_number 高速検索
//   - 名前・住所検索 → 全件スキャン後に復号して部分一致検索
//   - 7桁未満の数字 → seller_number LIKE 検索
//   - 空クエリ → 通常の売主一覧表示（全件スキャン）

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

import { SellerService } from '../SellerService.supabase';

// ============================================================
// ヘルパー: バグ条件の判定関数（design.md と同一定義）
// ============================================================

function isPhoneBugCondition(x: string): boolean {
  return /^\d{7,}$/.test(x);
}

function isEmailBugCondition(x: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
}

// ============================================================
// モック: Supabase クライアントのクエリ呼び出しを記録する
// ============================================================

/**
 * searchSellers のクエリ呼び出しを記録するモックを作成する。
 *
 * 記録内容:
 *   - eqCalls: .eq(column, value) の呼び出し一覧
 *   - ilikeCalls: .ilike(column, value) の呼び出し一覧
 *   - limitCalls: .limit(n) の呼び出し一覧
 *   - orderCalls: .order(column, options) の呼び出し一覧
 */
function createSearchMock(returnedSellers: any[] = []) {
  const eqCalls: Array<{ column: string; value: any }> = [];
  const ilikeCalls: Array<{ column: string; pattern: string }> = [];
  const limitCalls: number[] = [];
  const orderCalls: Array<{ column: string; options?: any }> = [];

  function makeQueryBuilderWithData(data: any[]): any {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation((col: string, val: any) => {
        eqCalls.push({ column: col, value: val });
        return makeQueryBuilderWithData(data);
      }),
      ilike: jest.fn().mockImplementation((col: string, pattern: string) => {
        ilikeCalls.push({ column: col, pattern });
        return makeQueryBuilderWithData(data);
      }),
      or: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockImplementation((col: string, options?: any) => {
        orderCalls.push({ column: col, options });
        return makeQueryBuilderWithData(data);
      }),
      limit: jest.fn().mockImplementation((n: number) => {
        limitCalls.push(n);
        return makeQueryBuilderWithData(data);
      }),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      then: undefined as any,
    };
    Object.defineProperty(builder, 'then', {
      get: () => (resolve: any, reject: any) =>
        Promise.resolve({ data, error: null }).then(resolve, reject),
    });
    return builder;
  }

  const supabaseMock = {
    from: jest.fn().mockImplementation((_table: string) => makeQueryBuilderWithData(returnedSellers)),
  } as any;

  return { supabaseMock, eqCalls, ilikeCalls, limitCalls, orderCalls };
}

// ============================================================
// テストデータ
// ============================================================

// 売主番号検索でヒットする売主
const SELLER_BY_NUMBER = {
  id: 'seller-number-001',
  seller_number: 'AA12345',
  name: 'encrypted-name',
  address: 'テスト住所',
  phone_number: 'encrypted-phone',
  phone_number_hash: null,
  email: null,
  email_hash: null,
  status: '追客中',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// 全件スキャンでヒットする売主（名前・住所検索用）
const SELLER_BY_NAME = {
  id: 'seller-name-001',
  seller_number: 'AA99001',
  name: 'encrypted-name',
  address: 'テスト住所',
  phone_number: 'encrypted-phone',
  phone_number_hash: null,
  email: null,
  email_hash: null,
  status: '追客中',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// ============================================================
// テスト本体
// ============================================================

describe('Preservation Property: seller-phone-search-bug', () => {
  let service: SellerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SellerService();
    // decryptSeller をモック（テストデータをそのまま返す）
    (service as any).decryptSeller = jest.fn().mockImplementation(async (seller: any) => ({
      id: seller.id,
      sellerNumber: seller.seller_number,
      name: '山田太郎',
      address: '大分市中央町1-1-1',
      phoneNumber: '09012345',
      email: undefined,
      status: seller.status,
      createdAt: new Date(seller.created_at),
      updatedAt: new Date(seller.updated_at),
    }));
    // _attachLastCalledAt をモック（そのまま返す）
    (service as any)._attachLastCalledAt = jest.fn().mockImplementation(async (sellers: any[]) => sellers);
  });

  // ----------------------------------------------------------
  // 保全条件の確認: 非バグ条件の入力が正しく判定されること
  // ----------------------------------------------------------
  describe('非バグ条件の判定確認', () => {
    it('AA12345 は isPhoneBugCondition = false（売主番号形式）', () => {
      expect(isPhoneBugCondition('AA12345')).toBe(false);
      expect(isEmailBugCondition('AA12345')).toBe(false);
    });

    it('山田太郎 は isPhoneBugCondition = false かつ isEmailBugCondition = false', () => {
      expect(isPhoneBugCondition('山田太郎')).toBe(false);
      expect(isEmailBugCondition('山田太郎')).toBe(false);
    });

    it('大分市 は isPhoneBugCondition = false かつ isEmailBugCondition = false', () => {
      expect(isPhoneBugCondition('大分市')).toBe(false);
      expect(isEmailBugCondition('大分市')).toBe(false);
    });

    it('12345（5桁）は isPhoneBugCondition = false（7桁未満）', () => {
      expect(isPhoneBugCondition('12345')).toBe(false);
      expect(isEmailBugCondition('12345')).toBe(false);
    });

    it('空文字列 は isPhoneBugCondition = false かつ isEmailBugCondition = false', () => {
      expect(isPhoneBugCondition('')).toBe(false);
      expect(isEmailBugCondition('')).toBe(false);
    });

    it('1234567（7桁）は isPhoneBugCondition = true（バグ条件）', () => {
      // 7桁以上の数字はバグ条件に該当することを確認（保全テストの対象外）
      expect(isPhoneBugCondition('1234567')).toBe(true);
    });

    it('test@example.com は isEmailBugCondition = true（バグ条件）', () => {
      // メールアドレス形式はバグ条件に該当することを確認（保全テストの対象外）
      expect(isEmailBugCondition('test@example.com')).toBe(true);
    });
  });

  // ----------------------------------------------------------
  // 保全テスト 1: 売主番号（AA12345）検索
  // Validates: Requirements 3.1
  //
  // 期待動作: seller_number の高速検索（eq または ilike）が実行される
  // EXPECTED: PASS on both unfixed and fixed code
  // ----------------------------------------------------------
  describe('売主番号検索の保持（Requirements 3.1）', () => {
    /**
     * Validates: Requirements 3.1
     *
     * 売主番号（AA/FI/BB + 数字）形式の入力は、
     * 修正前後ともに seller_number の高速検索が実行される。
     *
     * EXPECTED: PASS on both unfixed and fixed code
     */
    it('AA12345 を入力したとき seller_number で eq 検索が実行される', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([SELLER_BY_NUMBER]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('AA12345');

      // 売主番号パス: seller_number eq 検索が実行される
      const sellerNumberSearch = eqCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberSearch).toBeDefined();
    });

    it('FI00123 を入力したとき seller_number で eq 検索が実行される', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([SELLER_BY_NUMBER]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('FI00123');

      const sellerNumberSearch = eqCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberSearch).toBeDefined();
    });

    it('BB456 を入力したとき seller_number で eq または ilike 検索が実行される', async () => {
      const { supabaseMock, eqCalls, ilikeCalls } = createSearchMock([]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('BB456');

      // eq または ilike のいずれかで seller_number 検索が実行される
      const eqSearch = eqCalls.find((c) => c.column === 'seller_number');
      const ilikeSearch = ilikeCalls.find((c) => c.column === 'seller_number');
      expect(eqSearch || ilikeSearch).toBeTruthy();
    });
  });

  // ----------------------------------------------------------
  // 保全テスト 2: 名前検索（山田太郎）
  // Validates: Requirements 3.2
  //
  // 期待動作: 全件スキャン後に復号して部分一致検索
  //   - seller_number eq/ilike 検索は実行されない
  //   - 全件スキャン（limit(500) + order('updated_at')）が実行される
  // EXPECTED: PASS on both unfixed and fixed code
  // ----------------------------------------------------------
  describe('名前検索の保持（Requirements 3.2）', () => {
    /**
     * Validates: Requirements 3.2
     *
     * 名前（漢字・ひらがな等）の入力は、
     * 修正前後ともに全件スキャン後に復号して部分一致検索が実行される。
     *
     * EXPECTED: PASS on both unfixed and fixed code
     */
    it('山田太郎 を入力したとき全件スキャン（limit 500）が実行される', async () => {
      const { supabaseMock, limitCalls } = createSearchMock([SELLER_BY_NAME]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('山田太郎');

      // 全件スキャンパス: limit(500) が実行される
      expect(limitCalls).toContain(500);
    });

    it('山田太郎 を入力したとき seller_number での eq 検索は実行されない', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([SELLER_BY_NAME]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('山田太郎');

      // 名前検索では seller_number eq 検索は実行されない
      const sellerNumberEqSearch = eqCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberEqSearch).toBeUndefined();
    });

    it('山田太郎 を入力したとき updated_at 降順でソートされる', async () => {
      const { supabaseMock, orderCalls } = createSearchMock([SELLER_BY_NAME]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('山田太郎');

      // 全件スキャンパス: updated_at 降順でソート
      const updatedAtOrder = orderCalls.find((c) => c.column === 'updated_at');
      expect(updatedAtOrder).toBeDefined();
    });
  });

  // ----------------------------------------------------------
  // 保全テスト 3: 住所検索（大分市）
  // Validates: Requirements 3.3
  //
  // 期待動作: 全件スキャン後に復号して部分一致検索
  // EXPECTED: PASS on both unfixed and fixed code
  // ----------------------------------------------------------
  describe('住所検索の保持（Requirements 3.3）', () => {
    /**
     * Validates: Requirements 3.3
     *
     * 住所の入力は、修正前後ともに全件スキャン後に復号して部分一致検索が実行される。
     *
     * EXPECTED: PASS on both unfixed and fixed code
     */
    it('大分市 を入力したとき全件スキャン（limit 500）が実行される', async () => {
      const { supabaseMock, limitCalls } = createSearchMock([SELLER_BY_NAME]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('大分市');

      expect(limitCalls).toContain(500);
    });

    it('大分市 を入力したとき seller_number での eq 検索は実行されない', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([SELLER_BY_NAME]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('大分市');

      const sellerNumberEqSearch = eqCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberEqSearch).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 保全テスト 4: 7桁未満の数字（12345）
  // Validates: Requirements 3.1（数字のみパス）
  //
  // 期待動作: seller_number LIKE 検索が実行される（電話番号として扱わない）
  // EXPECTED: PASS on both unfixed and fixed code
  // ----------------------------------------------------------
  describe('7桁未満の数字検索の保持（Requirements 3.1）', () => {
    /**
     * Validates: Requirements 3.1
     *
     * 7桁未満の数字は電話番号として扱わず、
     * 修正前後ともに seller_number LIKE 検索が実行される。
     *
     * EXPECTED: PASS on both unfixed and fixed code
     */
    it('12345（5桁）を入力したとき seller_number ilike 検索が実行される', async () => {
      const { supabaseMock, ilikeCalls } = createSearchMock([]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('12345');

      // 数字のみパス: seller_number ilike 検索が実行される
      const sellerNumberSearch = ilikeCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberSearch).toBeDefined();
    });

    it('090123（6桁）を入力したとき seller_number ilike 検索が実行される', async () => {
      const { supabaseMock, ilikeCalls } = createSearchMock([]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('090123');

      const sellerNumberSearch = ilikeCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberSearch).toBeDefined();
    });

    it('12345（5桁）を入力したとき phone_number_hash での eq 検索は実行されない', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('12345');

      // 7桁未満の数字は電話番号として扱わない
      const phoneHashSearch = eqCalls.find(
        (c) => c.column === 'phone_number_hash'
      );
      expect(phoneHashSearch).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 保全テスト 5: 空クエリ
  // Validates: Requirements 3.4
  //
  // 期待動作: 通常の売主一覧表示（全件スキャン）
  //   - seller_number 検索は実行されない
  //   - phone_number_hash / email_hash 検索は実行されない
  //   - 全件スキャン（limit(500)）が実行される
  // EXPECTED: PASS on both unfixed and fixed code
  // ----------------------------------------------------------
  describe('空クエリの保持（Requirements 3.4）', () => {
    /**
     * Validates: Requirements 3.4
     *
     * 空クエリの場合は、修正前後ともに通常の売主一覧表示（全件スキャン）が実行される。
     *
     * EXPECTED: PASS on both unfixed and fixed code
     */
    it('空文字列を入力したとき全件スキャン（limit 500）が実行される', async () => {
      const { supabaseMock, limitCalls } = createSearchMock([SELLER_BY_NAME]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('');

      expect(limitCalls).toContain(500);
    });

    it('空文字列を入力したとき phone_number_hash での eq 検索は実行されない', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('');

      const phoneHashSearch = eqCalls.find(
        (c) => c.column === 'phone_number_hash'
      );
      expect(phoneHashSearch).toBeUndefined();
    });

    it('空文字列を入力したとき email_hash での eq 検索は実行されない', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([]);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('');

      const emailHashSearch = eqCalls.find(
        (c) => c.column === 'email_hash'
      );
      expect(emailHashSearch).toBeUndefined();
    });
  });

  // ----------------------------------------------------------
  // 保全テスト 6: 不完全なメールアドレス（test@）
  // バグ条件外の入力として全件スキャンにフォールバックすることを確認
  // ----------------------------------------------------------
  describe('不完全なメールアドレスの保持', () => {
    it('test@ を入力したとき email_hash での eq 検索は実行されない', async () => {
      const { supabaseMock, eqCalls } = createSearchMock([]);
      (service as any).supabase = supabaseMock;

      // test@ は isEmailBugCondition = false（不完全なメール）
      expect(isEmailBugCondition('test@')).toBe(false);

      await service.searchSellers('test@');

      const emailHashSearch = eqCalls.find(
        (c) => c.column === 'email_hash'
      );
      expect(emailHashSearch).toBeUndefined();
    });
  });
});
