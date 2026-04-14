// Bug condition exploration test: seller-phone-search-bug
// Validates: Requirements 1.1, 1.2, 1.3, 1.4
//
// CRITICAL: This test is EXPECTED TO FAIL on unfixed code (proves the bug exists)
// DO NOT attempt to fix the test or the code when it fails
//
// Bug conditions:
//   isPhoneBugCondition(X): X.matches(/^\d{7,}$/) が true のとき、
//     phone_number_hash 検索が行われず seller_number LIKE 検索のみ実行される
//   isEmailBugCondition(X): X.matches(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) が true のとき、
//     email_hash 検索が行われず全件スキャン（最新500件）のみ実行される
//
// Expected outcome on unfixed code:
//   - 電話番号ケース: phone_number_hash での eq 検索が呼ばれない → FAIL
//   - メールアドレスケース: email_hash での eq 検索が呼ばれない → FAIL

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

import * as crypto from 'crypto';
import { SellerService } from '../SellerService.supabase';

// ============================================================
// ヘルパー: バグ条件の判定関数
// ============================================================

function isPhoneBugCondition(x: string): boolean {
  return /^\d{7,}$/.test(x);
}

function isEmailBugCondition(x: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x);
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
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
 *
 * 返却値:
 *   - phone_number_hash / email_hash の eq 検索が呼ばれた場合は matchedSeller を返す
 *   - それ以外は空配列を返す（全件スキャンでもヒットしない）
 */
function createSearchMock(matchedSeller: any) {
  const eqCalls: Array<{ column: string; value: any }> = [];
  const ilikeCalls: Array<{ column: string; pattern: string }> = [];
  const limitCalls: number[] = [];

  // チェーン可能なクエリビルダーを返す
  function makeQueryBuilder(resolveData: any): any {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation((col: string, val: any) => {
        eqCalls.push({ column: col, value: val });
        // phone_number_hash または email_hash の eq 検索の場合は matchedSeller を返す
        if (col === 'phone_number_hash' || col === 'email_hash') {
          return makeQueryBuilderWithData([matchedSeller]);
        }
        return makeQueryBuilderWithData([]);
      }),
      ilike: jest.fn().mockImplementation((col: string, pattern: string) => {
        ilikeCalls.push({ column: col, pattern });
        return makeQueryBuilderWithData([]);
      }),
      or: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation((n: number) => {
        limitCalls.push(n);
        return makeQueryBuilderWithData(resolveData);
      }),
      single: jest.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
      then: undefined as any,
    };
    // Promise として解決できるようにする
    Object.defineProperty(builder, 'then', {
      get: () => (resolve: any, reject: any) =>
        Promise.resolve({ data: resolveData, error: null }).then(resolve, reject),
    });
    return builder;
  }

  function makeQueryBuilderWithData(data: any[]): any {
    const builder: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation((col: string, val: any) => {
        eqCalls.push({ column: col, value: val });
        if (col === 'phone_number_hash' || col === 'email_hash') {
          return makeQueryBuilderWithData([matchedSeller]);
        }
        return makeQueryBuilderWithData([]);
      }),
      ilike: jest.fn().mockImplementation((col: string, pattern: string) => {
        ilikeCalls.push({ column: col, pattern });
        return makeQueryBuilderWithData([]);
      }),
      or: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
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
    from: jest.fn().mockImplementation((_table: string) => makeQueryBuilder([])),
  } as any;

  return { supabaseMock, eqCalls, ilikeCalls, limitCalls };
}

// ============================================================
// テストデータ
// ============================================================

const PHONE_NUMBER = '09012345678'; // 11桁の数字 → isPhoneBugCondition = true
const EMAIL_ADDRESS = 'tomoko.kunihiro@ifoo-oita.com'; // メールアドレス → isEmailBugCondition = true

const PHONE_HASH = sha256(PHONE_NUMBER);
const EMAIL_HASH = sha256(EMAIL_ADDRESS);

// 電話番号ハッシュが一致する売主（DB に存在する想定）
const SELLER_WITH_PHONE_HASH = {
  id: 'seller-phone-001',
  seller_number: 'AA99901',
  name: 'encrypted-name',
  address: 'encrypted-address',
  phone_number: 'encrypted-phone',
  phone_number_hash: PHONE_HASH,
  email: null,
  email_hash: null,
  status: '追客中',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
};

// メールアドレスハッシュが一致する売主（DB に存在する想定）
const SELLER_WITH_EMAIL_HASH = {
  id: 'seller-email-001',
  seller_number: 'AA18',
  name: 'encrypted-name',
  address: 'encrypted-address',
  phone_number: 'encrypted-phone',
  phone_number_hash: null,
  email: 'encrypted-email',
  email_hash: EMAIL_HASH,
  status: '追客中',
  created_at: '2020-01-01T00:00:00.000Z', // 古い売主（500件目以降に相当）
  updated_at: '2020-01-01T00:00:00.000Z',
};

// ============================================================
// テスト本体
// ============================================================

describe('Bug Condition Exploration: seller-phone-search-bug', () => {
  let service: SellerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SellerService();
    // decryptSeller をモック（暗号化されていないテストデータを返す）
    (service as any).decryptSeller = jest.fn().mockImplementation(async (seller: any) => ({
      id: seller.id,
      sellerNumber: seller.seller_number,
      name: 'テスト売主',
      address: 'テスト住所',
      phoneNumber: PHONE_NUMBER,
      email: seller.email_hash ? EMAIL_ADDRESS : undefined,
      status: seller.status,
      createdAt: new Date(seller.created_at),
      updatedAt: new Date(seller.updated_at),
    }));
    // _attachLastCalledAt をモック（そのまま返す）
    (service as any)._attachLastCalledAt = jest.fn().mockImplementation(async (sellers: any[]) => sellers);
  });

  // ----------------------------------------------------------
  // バグ条件の確認: isPhoneBugCondition / isEmailBugCondition
  // ----------------------------------------------------------
  describe('バグ条件の判定関数', () => {
    it('09012345678 は isPhoneBugCondition = true（11桁の数字）', () => {
      expect(isPhoneBugCondition(PHONE_NUMBER)).toBe(true);
    });

    it('tomoko.kunihiro@ifoo-oita.com は isEmailBugCondition = true', () => {
      expect(isEmailBugCondition(EMAIL_ADDRESS)).toBe(true);
    });

    it('090123 は isPhoneBugCondition = false（6桁、7桁未満）', () => {
      expect(isPhoneBugCondition('090123')).toBe(false);
    });

    it('test@ は isEmailBugCondition = false（不完全なメール）', () => {
      expect(isEmailBugCondition('test@')).toBe(false);
    });

    it('AA12345 は isPhoneBugCondition = false（売主番号形式）', () => {
      expect(isPhoneBugCondition('AA12345')).toBe(false);
    });
  });

  // ----------------------------------------------------------
  // 電話番号ケース: phone_number_hash での DB 検索が行われることを確認
  // EXPECTED: FAIL on unfixed code
  // ----------------------------------------------------------
  describe('電話番号ケース: phone_number_hash 検索（バグの存在を証明）', () => {
    /**
     * Validates: Requirements 1.1, 2.1, 2.3
     *
     * バグ条件:
     *   isPhoneBugCondition('09012345678') = true
     *   未修正コードでは phone_number_hash での eq 検索が行われない
     *   → seller_number LIKE 検索のみ実行される
     *
     * 期待される反例:
     *   phone_number_hash での eq 検索が呼ばれないため、
     *   SELLER_WITH_PHONE_HASH が返されない
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('09012345678 を入力したとき phone_number_hash で eq 検索が呼ばれる（未修正コードで FAIL）', async () => {
      const { supabaseMock, eqCalls } = createSearchMock(SELLER_WITH_PHONE_HASH);
      (service as any).supabase = supabaseMock;

      await service.searchSellers(PHONE_NUMBER);

      // 修正後の期待動作: phone_number_hash で eq 検索が呼ばれる
      // 未修正コードでは seller_number LIKE 検索のみ → このアサーションが FAIL する
      const phoneHashSearch = eqCalls.find(
        (c) => c.column === 'phone_number_hash' && c.value === PHONE_HASH
      );
      expect(phoneHashSearch).toBeDefined(); // FAILS on unfixed code
    });

    it('09012345678 を入力したとき phone_number_hash が一致する売主が返される（未修正コードで FAIL）', async () => {
      const { supabaseMock } = createSearchMock(SELLER_WITH_PHONE_HASH);
      (service as any).supabase = supabaseMock;

      const results = await service.searchSellers(PHONE_NUMBER);

      // 修正後の期待動作: SELLER_WITH_PHONE_HASH が返される
      // 未修正コードでは seller_number LIKE 検索でヒットせず空配列 → このアサーションが FAIL する
      const found = results.find((s: any) => s.id === SELLER_WITH_PHONE_HASH.id);
      expect(found).toBeDefined(); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // メールアドレスケース: email_hash での DB 検索が行われることを確認
  // EXPECTED: FAIL on unfixed code
  // ----------------------------------------------------------
  describe('メールアドレスケース: email_hash 検索（バグの存在を証明）', () => {
    /**
     * Validates: Requirements 1.2, 2.2, 2.3
     *
     * バグ条件:
     *   isEmailBugCondition('tomoko.kunihiro@ifoo-oita.com') = true
     *   未修正コードでは email_hash での eq 検索が行われない
     *   → 全件スキャン（最新500件）のみ実行される
     *
     * 期待される反例:
     *   email_hash での eq 検索が呼ばれないため、
     *   SELLER_WITH_EMAIL_HASH（古い売主）が返されない
     *
     * EXPECTED: FAIL on unfixed code
     */
    it('tomoko.kunihiro@ifoo-oita.com を入力したとき email_hash で eq 検索が呼ばれる（未修正コードで FAIL）', async () => {
      const { supabaseMock, eqCalls } = createSearchMock(SELLER_WITH_EMAIL_HASH);
      (service as any).supabase = supabaseMock;

      await service.searchSellers(EMAIL_ADDRESS);

      // 修正後の期待動作: email_hash で eq 検索が呼ばれる
      // 未修正コードでは全件スキャンのみ → このアサーションが FAIL する
      const emailHashSearch = eqCalls.find(
        (c) => c.column === 'email_hash' && c.value === EMAIL_HASH
      );
      expect(emailHashSearch).toBeDefined(); // FAILS on unfixed code
    });

    it('tomoko.kunihiro@ifoo-oita.com を入力したとき email_hash が一致する売主が返される（未修正コードで FAIL）', async () => {
      const { supabaseMock } = createSearchMock(SELLER_WITH_EMAIL_HASH);
      (service as any).supabase = supabaseMock;

      const results = await service.searchSellers(EMAIL_ADDRESS);

      // 修正後の期待動作: SELLER_WITH_EMAIL_HASH が返される
      // 未修正コードでは全件スキャン（最新500件）のみ → 古い売主はヒットしない → このアサーションが FAIL する
      const found = results.find((s: any) => s.id === SELLER_WITH_EMAIL_HASH.id);
      expect(found).toBeDefined(); // FAILS on unfixed code
    });
  });

  // ----------------------------------------------------------
  // 補足: バグ条件外の入力は既存動作のまま（PASS on both unfixed and fixed code）
  // ----------------------------------------------------------
  describe('バグ条件外の入力: 既存動作の確認（未修正・修正後ともに PASS）', () => {
    it('090123（6桁）は isPhoneBugCondition = false → seller_number LIKE 検索が実行される', async () => {
      const { supabaseMock, ilikeCalls } = createSearchMock(null);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('090123');

      // 数字のみパス: seller_number LIKE 検索が実行される
      const sellerNumberSearch = ilikeCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberSearch).toBeDefined();
    });

    it('AA12345 は売主番号パターン → seller_number 高速検索が実行される', async () => {
      const { supabaseMock, eqCalls } = createSearchMock(null);
      (service as any).supabase = supabaseMock;

      await service.searchSellers('AA12345');

      // 売主番号パス: seller_number eq 検索が実行される
      const sellerNumberSearch = eqCalls.find(
        (c) => c.column === 'seller_number'
      );
      expect(sellerNumberSearch).toBeDefined();
    });
  });
});
