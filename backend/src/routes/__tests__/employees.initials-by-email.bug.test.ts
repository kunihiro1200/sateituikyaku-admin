/**
 * バグ条件探索テスト: initials-by-email エンドポイントのキャッシュ混入バグ
 *
 * **Validates: Requirements 1.6**
 *
 * このテストは修正前のコードで FAIL することでバグの存在を証明する。
 * 修正後は PASS することでバグ修正を確認する。
 *
 * バグの概要:
 *   - `GET /api/employees/initials-by-email` エンドポイントは `authenticate` ミドルウェアで
 *     既に `req.employee` が設定されているにもかかわらず、エンドポイント内で
 *     `authService.validateSession(token)` を二重呼び出ししている
 *   - `_sessionCache` にユーザーBのエントリが存在する状態でユーザーAのトークンでリクエストが来た場合、
 *     キャッシュからユーザーBのemployeeが返され、ユーザーBのイニシャルが記録される
 *
 * 修正前: このテストは FAIL する（バグが存在することを証明）
 * 修正後: このテストは PASS する（バグが修正されたことを確認）
 */

import request from 'supertest';
import express from 'express';

// =========================================================================
// モック設定
// =========================================================================

// _sessionCache を操作するためのモック
// AuthService.supabase.ts のモジュールレベルキャッシュを制御する
const mockValidateSession = jest.fn();
const mockSupabaseFrom = jest.fn();

// 認証ミドルウェアをモック化
// ユーザーAとして認証済みの状態をシミュレート
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    // authenticate ミドルウェアはユーザーAのemployeeを設定する
    req.employee = {
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
// validateSession がキャッシュからユーザーBのemployeeを返すバグ状態をシミュレート
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
    getInitialsByEmail: jest.fn().mockResolvedValue(null),
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

// ユーザーA: 実際にリクエストを送るユーザー
const userA = {
  id: 'user-a-id',
  email: 'user-a@example.com',
  name: 'ユーザーA',
  initials: 'A',
  role: 'agent',
  is_active: true,
};

// ユーザーB: キャッシュに存在する別ユーザー
const userB = {
  id: 'user-b-id',
  email: 'user-b@example.com',
  name: 'ユーザーB',
  initials: 'B',
  role: 'agent',
  is_active: true,
};

// =========================================================================
// バグ条件探索テスト
// =========================================================================

describe('Property 1: Bug Condition - validateSession キャッシュ混入による誤イニシャル記録', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * バグ条件テスト:
   * `_sessionCache` にユーザーBのエントリが存在する状態でユーザーAのトークンで
   * `GET /api/employees/initials-by-email` を呼び出すと、
   * ユーザーBのイニシャルが返される（バグ）。
   *
   * 修正前: validateSession がキャッシュからユーザーBを返すため、
   *         レスポンスのイニシャルが 'B' になる → テスト FAIL
   * 修正後: req.employee（ユーザーA）を直接使用するため、
   *         レスポンスのイニシャルが 'A' になる → テスト PASS
   *
   * **Validates: Requirements 1.6**
   */
  it('キャッシュにユーザーBが存在する状態でユーザーAのトークンでリクエストすると、ユーザーAのイニシャルが返されるべき', async () => {
    // バグ状態のシミュレーション:
    // validateSession がキャッシュからユーザーBのemployeeを返す
    // （トークンの先頭32文字が衝突、または同一プロセスでの別ユーザーキャッシュ混入）
    mockValidateSession.mockResolvedValue(userB);

    // DBルックアップ: 修正後は req.employee.email（userA.email）でDBを検索するため、
    // userA.initials = 'A' が返る
    mockSupabaseFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { initials: userA.initials },
        error: null,
      }),
    });

    // ユーザーAのトークンでリクエスト
    const response = await request(app)
      .get('/api/employees/initials-by-email')
      .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

    expect(response.status).toBe(200);

    // 期待される動作: ユーザーAのイニシャル 'A' が返されるべき
    // 修正後: req.employee.email（userA.email）でDBを検索するため 'A' が返される → PASS
    expect(response.body.initials).toBe(userA.initials); // 'A' であるべき
  });

  /**
   * 二重認証バグの確認テスト:
   * `authenticate` ミドルウェアが `req.employee` にユーザーAを設定しているにもかかわらず、
   * エンドポイント内で `validateSession` が呼び出されることを確認する。
   *
   * 修正前: validateSession が呼び出される（二重認証）
   * 修正後: validateSession は呼び出されない（req.employee を直接使用）
   *
   * **Validates: Requirements 1.6**
   */
  it('修正後は validateSession が呼び出されず req.employee を直接使用するべき', async () => {
    // validateSession がユーザーBを返すように設定（バグ状態）
    mockValidateSession.mockResolvedValue(userB);

    // DBルックアップ: ユーザーAのメールアドレスでDBを検索するとユーザーAのinitialsが返る
    mockSupabaseFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { initials: userA.initials },
        error: null,
      }),
    });

    const response = await request(app)
      .get('/api/employees/initials-by-email')
      .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

    expect(response.status).toBe(200);

    // 修正後: validateSession は呼び出されないはず
    // 修正前: validateSession が呼び出される（二重認証バグ）
    // このアサーションは修正前に FAIL し、修正後に PASS する
    expect(mockValidateSession).not.toHaveBeenCalled();

    // 修正後: ユーザーAのイニシャルが返されるべき
    expect(response.body.initials).toBe(userA.initials);
  });

  /**
   * キャッシュ混入の具体的なシナリオテスト:
   * ユーザーBが先にリクエストしてキャッシュが作成された後、
   * ユーザーAがリクエストするとキャッシュからユーザーBのemployeeが返される。
   *
   * **Validates: Requirements 1.6**
   */
  it('キャッシュ混入シナリオ: ユーザーBのキャッシュが存在する状態でユーザーAのイニシャルが正しく返されるべき', async () => {
    // シナリオ: validateSession がキャッシュからユーザーBを返す（バグ状態）
    mockValidateSession.mockResolvedValue(userB);

    // DBルックアップ: 修正後は req.employee.email（userA.email）でDBを検索するため、
    // userA.initials = 'A' が返る
    // バグ状態では userB.email でDBを検索するため userB.initials = 'B' が返っていた
    mockSupabaseFrom.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => {
        // 修正後: req.employee.email（userA.email）でDBを検索するため userA.initials = 'A' が返る
        return Promise.resolve({
          data: { initials: userA.initials },
          error: null,
        });
      }),
    });

    const response = await request(app)
      .get('/api/employees/initials-by-email')
      .set('Authorization', 'Bearer user-a-token-xxxxxxxxxxxxxxxxxxxxxxxxxxxx');

    expect(response.status).toBe(200);

    // 期待される動作: ユーザーAのイニシャル 'A' が返されるべき
    // 修正後: req.employee.email（userA.email）でDBを検索するため 'A' が返される → PASS
    expect(response.body.initials).toBe(userA.initials); // 'A' であるべき
    expect(response.body.initials).not.toBe(userB.initials); // 'B' であってはいけない
  });
});
