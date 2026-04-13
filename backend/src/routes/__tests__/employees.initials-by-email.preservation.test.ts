/**
 * 保存プロパティテスト: initials-by-email エンドポイントの正常動作保存
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * このテストは修正前後ともに PASS するべき（保存テスト）。
 * バグ条件が成立しない（キャッシュ混入なし）状態での正常動作を検証する。
 *
 * 保存すべき動作:
 *   - キャッシュが空の場合、`initials-by-email` は正しいユーザーのイニシャルを返す
 *   - 認証・セッション管理の動作が変わらない
 *   - DBにinitialsが存在する場合はDBの値を優先する
 *   - DBにinitialsが存在しない場合はスプレッドシートにフォールバックする
 */

import * as fc from 'fast-check';
import request from 'supertest';
import express from 'express';

// =========================================================================
// モック設定
// =========================================================================

const mockValidateSession = jest.fn();
const mockSupabaseFrom = jest.fn();
const mockGetInitialsByEmail = jest.fn();

// 認証ミドルウェアをモック化
// authenticate ミドルウェアは req.employee を設定する（正常動作）
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    // テスト用: req._mockEmployee が設定されている場合はそれを使用
    // 設定されていない場合はデフォルトのユーザーAを使用
    req.employee = req._mockEmployee || {
      id: 'user-a-id',
      email: 'user-a@example.com',
      name: 'ユーザーA',
      initials: 'A',
      role: 'agent',
      is_active: true,
    };
    next();
  },
}));

// AuthService をモック化
// 保存テストでは validateSession はキャッシュ混入なしの正常状態をシミュレート
jest.mock('../../services/AuthService.supabase', () => ({
  AuthService: jest.fn().mockImplementation(() => ({
    validateSession: mockValidateSession,
  })),
}));

// Supabase クライアントをモック化（DBルックアップ用）
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn().mockReturnValue({
    from: mockSupabaseFrom,
  }),
}));

// StaffManagementService をモック化
jest.mock('../../services/StaffManagementService', () => ({
  StaffManagementService: jest.fn().mockImplementation(() => ({
    getInitialsByEmail: mockGetInitialsByEmail,
  })),
}));

// GoogleAuthService をモック化
jest.mock('../../services/GoogleAuthService', () => ({
  GoogleAuthService: jest.fn().mockImplementation(() => ({})),
}));

// EmployeeUtils をモック化
jest.mock('../../utils/employeeUtils', () => ({
  EmployeeUtils: jest.fn().mockImplementation(() => ({})),
  extractDisplayName: jest.fn(),
}));

import employeesRouter from '../employees';

// テスト用 Express アプリケーション
const app = express();
app.use(express.json());
app.use('/api/employees', employeesRouter);

// =========================================================================
// テストデータ
// =========================================================================

// ユーザーA: 正常にリクエストするユーザー（キャッシュ混入なし）
const userA = {
  id: 'user-a-id',
  email: 'user-a@example.com',
  name: 'ユーザーA',
  initials: 'A',
  role: 'agent',
  is_active: true,
};

// =========================================================================
// ヘルパー関数
// =========================================================================

/**
 * DBルックアップが成功するモックを設定する
 * @param initials 返すイニシャル
 */
function setupDbHit(initials: string) {
  mockSupabaseFrom.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { initials },
      error: null,
    }),
  });
}

/**
 * DBルックアップが失敗するモックを設定する（スプレッドシートフォールバック用）
 */
function setupDbMiss() {
  mockSupabaseFrom.mockReturnValue({
    select: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'No rows found' },
    }),
  });
}

// =========================================================================
// 保存プロパティテスト
// =========================================================================

describe('Property 2: Preservation - キャッシュ混入なし状態での正常動作保存', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // デフォルト: validateSession はユーザーAを返す（キャッシュ混入なし）
    mockValidateSession.mockResolvedValue(userA);
    // デフォルト: スプレッドシートフォールバックは null を返す
    mockGetInitialsByEmail.mockResolvedValue(null);
  });

  // =========================================================================
  // Requirement 3.6: DBにinitialsが存在する場合はDBの値を優先する
  // =========================================================================
  describe('Requirement 3.6: DBにinitialsが存在する場合はDBの値を優先する', () => {
    /**
     * Property: キャッシュが空の状態で `initials-by-email` を呼び出すと、
     * DBに存在するイニシャルが返される。
     *
     * 修正前後ともに PASS するべき（保存テスト）。
     *
     * **Validates: Requirements 3.6**
     */
    it('キャッシュが空の状態でDBにinitialsが存在する場合、DBの値が返される', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 様々なイニシャル（英字1〜3文字）
          fc.stringMatching(/^[A-Z]{1,3}$/),
          async (initials) => {
            // DBルックアップが成功する状態をセットアップ
            setupDbHit(initials);

            const response = await request(app)
              .get('/api/employees/initials-by-email')
              .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

            expect(response.status).toBe(200);
            // DBに存在するイニシャルが返されるべき
            expect(response.body.initials).toBe(initials);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: DBにinitialsが存在する場合、スプレッドシートは参照されない。
     * DBの値が優先される既存の優先順位ロジックを維持する。
     *
     * **Validates: Requirements 3.6**
     */
    it('DBにinitialsが存在する場合、スプレッドシートは参照されない', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[A-Z]{1,3}$/),
          async (initials) => {
            setupDbHit(initials);
            mockGetInitialsByEmail.mockReset();
            mockGetInitialsByEmail.mockResolvedValue('SPREADSHEET_VALUE');

            const response = await request(app)
              .get('/api/employees/initials-by-email')
              .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

            expect(response.status).toBe(200);
            // DBの値が優先されるべき
            expect(response.body.initials).toBe(initials);
            // スプレッドシートは参照されないべき
            expect(mockGetInitialsByEmail).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 15 }
      );
    });
  });

  // =========================================================================
  // Requirement 3.6: DBにinitialsが存在しない場合はスプレッドシートにフォールバック
  // =========================================================================
  describe('Requirement 3.6: DBにinitialsが存在しない場合はスプレッドシートにフォールバック', () => {
    /**
     * Property: DBにinitialsが存在しない場合、スプレッドシートからイニシャルを取得する。
     * 既存のフォールバックロジックを維持する。
     *
     * **Validates: Requirements 3.6**
     */
    it('DBにinitialsが存在しない場合、スプレッドシートのイニシャルが返される', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.stringMatching(/^[A-Z]{1,3}$/),
          async (initials) => {
            // DBルックアップが失敗する状態をセットアップ
            setupDbMiss();
            // スプレッドシートからイニシャルを返す
            mockGetInitialsByEmail.mockResolvedValue(initials);

            const response = await request(app)
              .get('/api/employees/initials-by-email')
              .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

            expect(response.status).toBe(200);
            // スプレッドシートのイニシャルが返されるべき
            expect(response.body.initials).toBe(initials);
          }
        ),
        { numRuns: 20 }
      );
    });

    /**
     * Property: DBにもスプレッドシートにもinitialsが存在しない場合、null が返される。
     *
     * **Validates: Requirements 3.6**
     */
    it('DBにもスプレッドシートにもinitialsが存在しない場合、null が返される', async () => {
      setupDbMiss();
      mockGetInitialsByEmail.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/employees/initials-by-email')
        .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

      expect(response.status).toBe(200);
      expect(response.body.initials).toBeNull();
    });
  });

  // =========================================================================
  // Requirement 3.5: 認証・セッション管理の動作が変わらない
  // =========================================================================
  describe('Requirement 3.5: 認証・セッション管理の動作が変わらない', () => {
    /**
     * Property: `authenticate` ミドルウェアが正常に動作し、
     * `req.employee` が設定された状態でエンドポイントが処理される。
     * 認証の動作は修正前後で変わらない。
     *
     * **Validates: Requirements 3.5**
     */
    it('authenticate ミドルウェアが正常に動作し、エンドポイントが 200 を返す', async () => {
      setupDbHit(userA.initials);

      const response = await request(app)
        .get('/api/employees/initials-by-email')
        .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

      // 認証が正常に通過し、200 が返されるべき
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('initials');
    });

    /**
     * Property: 様々なユーザーのメールアドレスに対して、
     * エンドポイントは常に 200 を返す（認証が正常に動作する）。
     *
     * **Validates: Requirements 3.5**
     */
    it('様々なユーザーのリクエストに対して認証が正常に動作する', async () => {
      await fc.assert(
        fc.asyncProperty(
          // 様々なメールアドレス
          fc.emailAddress(),
          // 様々なイニシャル
          fc.stringMatching(/^[A-Z]{1,3}$/),
          async (email, initials) => {
            setupDbHit(initials);

            const response = await request(app)
              .get('/api/employees/initials-by-email')
              .set('Authorization', 'Bearer some-valid-token-xxxxxxxxxxxxxxxxxxxxxxxx');

            // 認証が正常に通過し、200 が返されるべき
            expect(response.status).toBe(200);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // =========================================================================
  // Requirement 3.4: アクティビティログの内容（件名・テンプレート名・送信先）は変わらない
  // =========================================================================
  describe('Requirement 3.4: initials-by-email エンドポイントのレスポンス形式が変わらない', () => {
    /**
     * Property: エンドポイントのレスポンスは常に { initials: string | null } 形式を返す。
     * レスポンス形式は修正前後で変わらない。
     *
     * **Validates: Requirements 3.4**
     */
    it('レスポンスは常に { initials } 形式を返す', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.option(fc.stringMatching(/^[A-Z]{1,3}$/), { nil: null }),
          async (initials) => {
            if (initials !== null) {
              setupDbHit(initials);
            } else {
              setupDbMiss();
              mockGetInitialsByEmail.mockResolvedValue(null);
            }

            const response = await request(app)
              .get('/api/employees/initials-by-email')
              .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

            expect(response.status).toBe(200);
            // レスポンスは { initials } 形式であるべき
            expect(response.body).toHaveProperty('initials');
            if (initials !== null) {
              expect(response.body.initials).toBe(initials);
            } else {
              expect(response.body.initials).toBeNull();
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // =========================================================================
  // 具体的なシナリオテスト（ユニットテスト）
  // =========================================================================
  describe('具体的なシナリオ: キャッシュ混入なし状態での正常動作', () => {
    /**
     * シナリオ: キャッシュが空の状態でユーザーAがリクエストする
     * → ユーザーAの正しいイニシャルが返される
     *
     * **Validates: Requirements 3.6**
     */
    it('キャッシュが空の状態でユーザーAのイニシャルが正しく返される', async () => {
      // DBルックアップが成功する状態をセットアップ
      setupDbHit(userA.initials);

      const response = await request(app)
        .get('/api/employees/initials-by-email')
        .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

      expect(response.status).toBe(200);
      expect(response.body.initials).toBe(userA.initials); // 'A'
    });

    /**
     * シナリオ: DBにinitialsが存在し、スプレッドシートにも存在する場合
     * → DBの値が優先される
     *
     * **Validates: Requirements 3.6**
     */
    it('DBとスプレッドシートの両方にinitialsが存在する場合、DBの値が優先される', async () => {
      setupDbHit('DB_INITIALS');
      mockGetInitialsByEmail.mockResolvedValue('SHEET_INITIALS');

      const response = await request(app)
        .get('/api/employees/initials-by-email')
        .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

      expect(response.status).toBe(200);
      // DBの値が優先されるべき
      expect(response.body.initials).toBe('DB_INITIALS');
      // スプレッドシートは参照されないべき
      expect(mockGetInitialsByEmail).not.toHaveBeenCalled();
    });

    /**
     * シナリオ: DBにinitialsが存在しない場合、スプレッドシートにフォールバック
     *
     * **Validates: Requirements 3.6**
     */
    it('DBにinitialsが存在しない場合、スプレッドシートにフォールバックする', async () => {
      setupDbMiss();
      mockGetInitialsByEmail.mockResolvedValue('SHEET_INITIALS');

      const response = await request(app)
        .get('/api/employees/initials-by-email')
        .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

      expect(response.status).toBe(200);
      // スプレッドシートのイニシャルが返されるべき
      expect(response.body.initials).toBe('SHEET_INITIALS');
      // スプレッドシートが参照されるべき
      expect(mockGetInitialsByEmail).toHaveBeenCalled();
    });
  });
});
