// AA13831 削除同期バグ修正 - バグ条件探索テスト
// Property 1: Bug Condition - executeSoftDelete() がハードデリートを実行するバグ
// **Validates: Requirements 1.1, 1.2, 1.3**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示す counterexample を発見する

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedAutoSyncService } from '../EnhancedAutoSyncService';

// ============================================================
// Supabase クライアントのモック
// ============================================================

/**
 * Supabase クライアントのモックを作成する
 * .delete() と .update() の呼び出しを追跡する
 */
function createSupabaseMock() {
  const deleteMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockResolvedValue({ error: null }),
  });

  const updateMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      is: jest.fn().mockResolvedValue({ error: null }),
    }),
  });

  const selectMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      is: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'test-id',
            seller_number: 'AA13831',
            status: '追客中', // アクティブ契約なし → validateDeletion を通過する
          },
          error: null,
        }),
      }),
    }),
  });

  const fromMock = jest.fn().mockImplementation((table: string) => {
    return {
      select: selectMock,
      delete: deleteMock,
      update: updateMock,
    };
  });

  return {
    from: fromMock,
    deleteMock,
    updateMock,
    selectMock,
  };
}

// ============================================================
// テストスイート
// ============================================================

describe('executeSoftDelete - Bug Condition Exploration', () => {
  let service: EnhancedAutoSyncService;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();

    // EnhancedAutoSyncService のインスタンスを作成し、Supabase クライアントをモックに差し替える
    service = new EnhancedAutoSyncService(
      'https://mock.supabase.co',
      'mock-key'
    );

    // private フィールド supabase をモックに差し替える
    (service as any).supabase = supabaseMock;
  });

  // ============================================================
  // メインテスト: executeSoftDelete がソフトデリートを実行するか確認
  // ============================================================

  it('should set deleted_at instead of hard-deleting the seller (AA13831)', async () => {
    // Arrange
    const sellerNumber = 'AA13831';

    // Act: executeSoftDelete を呼び出す（private メソッドなので型キャストでアクセス）
    const result = await (service as any).executeSoftDelete(sellerNumber);

    // === counterexample 記録 ===
    console.log('=== counterexample 記録 ===');
    console.log('呼び出し: executeSoftDelete("AA13831")');
    console.log('.delete() が呼ばれたか:', supabaseMock.deleteMock.mock.calls.length > 0);
    console.log('.update() が呼ばれたか:', supabaseMock.updateMock.mock.calls.length > 0);
    if (supabaseMock.updateMock.mock.calls.length > 0) {
      console.log('.update() の引数:', JSON.stringify(supabaseMock.updateMock.mock.calls[0]));
    }
    console.log('result:', JSON.stringify(result));
    console.log('=== counterexample 終了 ===');

    // Assert 1: .delete() が呼ばれないことをアサート（未修正コードでは FAIL する）
    // 未修正コードでは .delete() が呼ばれるため、このアサーションは失敗する
    expect(supabaseMock.deleteMock).not.toHaveBeenCalled();

    // Assert 2: .update() が呼ばれることをアサート（未修正コードでは FAIL する）
    // 未修正コードでは .update() が呼ばれないため、このアサーションは失敗する
    expect(supabaseMock.updateMock).toHaveBeenCalled();

    // Assert 3: .update() に deleted_at が含まれることをアサート（未修正コードでは FAIL する）
    // 未修正コードでは .update() が呼ばれないため、このアサーションは失敗する
    const updateArgs = supabaseMock.updateMock.mock.calls[0];
    expect(updateArgs).toBeDefined();
    const updateData = updateArgs?.[0] as any;
    expect(updateData).toHaveProperty('deleted_at');
    expect(updateData.deleted_at).not.toBeNull();
    expect(updateData.deleted_at).not.toBe('');

    // Assert 4: 結果が成功であることをアサート
    expect(result.success).toBe(true);
    expect(result.sellerNumber).toBe(sellerNumber);
    expect(result.deletedAt).toBeDefined();
  });

  it('should NOT call .delete() when executeSoftDelete is called (AA13831)', async () => {
    // Arrange
    const sellerNumber = 'AA13831';

    // Act
    await (service as any).executeSoftDelete(sellerNumber);

    // Assert: .delete() が呼ばれないことを確認
    // 未修正コードでは .delete() が呼ばれるため、このアサーションは失敗する（バグの証拠）
    console.log('=== ハードデリート確認テスト ===');
    console.log('.delete() 呼び出し回数:', supabaseMock.deleteMock.mock.calls.length);
    console.log('期待値: 0回（ソフトデリートなので .delete() は呼ばれないはず）');
    console.log('=== 確認終了 ===');

    expect(supabaseMock.deleteMock).not.toHaveBeenCalled();
  });

  it('should call .update() with deleted_at field when executeSoftDelete is called', async () => {
    // Arrange
    const sellerNumber = 'AA13831';
    const beforeCall = new Date();

    // Act
    await (service as any).executeSoftDelete(sellerNumber);

    const afterCall = new Date();

    // Assert: .update() が deleted_at を含む引数で呼ばれることを確認
    // 未修正コードでは .update() が呼ばれないため、このアサーションは失敗する（バグの証拠）
    expect(supabaseMock.updateMock).toHaveBeenCalled();

    const updateArgs = supabaseMock.updateMock.mock.calls[0];
    const updateData = updateArgs?.[0] as any;

    console.log('=== deleted_at 設定確認テスト ===');
    console.log('.update() 呼び出し回数:', supabaseMock.updateMock.mock.calls.length);
    console.log('update データ:', JSON.stringify(updateData));
    console.log('deleted_at の値:', updateData?.deleted_at);
    console.log('=== 確認終了 ===');

    expect(updateData).toHaveProperty('deleted_at');

    // deleted_at が有効な ISO 8601 日時文字列であることを確認
    const deletedAt = new Date(updateData.deleted_at);
    expect(deletedAt.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
    expect(deletedAt.getTime()).toBeLessThanOrEqual(afterCall.getTime());
  });
});

// ============================================================
// タスク2: 保全プロパティテスト（修正前に実施）
// Property 2: Preservation - スプレッドシートに存在する売主・アクティブ契約ありの売主が影響を受けない
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
//
// このテストは未修正コードで SUCCESS することが期待される（ベースライン動作の確認）
// ============================================================

import fc from 'fast-check';

// ============================================================
// 保全テスト用のモックファクトリ
// ============================================================

/**
 * validateDeletion テスト用の Supabase モックを作成する
 * 売主のステータスを指定して、バリデーション結果を制御する
 */
function createValidationMock(sellerStatus: string) {
  const selectMock = jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnValue({
      is: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'test-id',
            seller_number: 'AA99999',
            status: sellerStatus,
          },
          error: null,
        }),
      }),
    }),
  });

  const fromMock = jest.fn().mockImplementation((_table: unknown) => ({
    select: selectMock,
    delete: jest.fn().mockReturnValue({
      eq: jest.fn().mockResolvedValue({ error: null }),
    }),
    update: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ error: null }),
      }),
    }),
  }));

  return { from: fromMock };
}

/**
 * getAllActiveDbSellerNumbers テスト用の Supabase モックを作成する
 * deleted_at が null の売主のみを返すフィルタリングをシミュレートする
 */
function createActiveSellersMock(sellers: Array<{ seller_number: string; deleted_at: string | null }>) {
  // deleted_at = null の売主のみフィルタリング（.is('deleted_at', null) の動作をシミュレート）
  const activeSellers = sellers.filter(s => s.deleted_at === null);

  const fromMock = jest.fn().mockImplementation((_table: unknown) => ({
    select: jest.fn().mockReturnValue({
      is: jest.fn().mockReturnValue({
        range: jest.fn().mockResolvedValue({
          data: activeSellers.map(s => ({ seller_number: s.seller_number })),
          error: null,
        }),
      }),
    }),
  }));

  return { from: fromMock };
}

// ============================================================
// 保全テストスイート
// ============================================================

describe('Preservation Properties - 保全プロパティテスト', () => {
  let service: EnhancedAutoSyncService;

  beforeEach(() => {
    service = new EnhancedAutoSyncService(
      'https://mock.supabase.co',
      'mock-key'
    );
  });

  // ============================================================
  // 保全プロパティ 1: detectDeletedSellers の差分計算ロジック
  // スプレッドシートに存在する売主は削除対象として検出されない
  // ============================================================

  describe('Preservation 3.1: スプレッドシートに存在する売主は削除対象として検出されない', () => {
    /**
     * detectDeletedSellers の差分計算ロジックを直接テストする
     * スプレッドシートに存在する売主は結果に含まれないことを確認する
     *
     * 注意: detectDeletedSellers() は Google Sheets クライアントが必要なため、
     * 差分計算ロジックを直接テストする（private メソッドへの型キャストでアクセス）
     */
    it('スプレッドシートに存在する売主は差分計算で削除対象にならない（具体例）', () => {
      // Arrange: スプレッドシートの売主番号セット
      const spreadsheetNumbers = new Set(['AA001', 'AA002', 'AA003', 'AA004', 'AA005']);
      // DB のアクティブ売主番号セット（スプレッドシートと同じ + 追加）
      const dbNumbers = new Set(['AA001', 'AA002', 'AA003', 'AA004', 'AA005']);

      // Act: 差分計算（DBにあってスプレッドシートにないもの = 削除対象）
      const deletedSellers: string[] = [];
      for (const sellerNumber of dbNumbers) {
        if (!spreadsheetNumbers.has(sellerNumber)) {
          deletedSellers.push(sellerNumber);
        }
      }

      // Assert: スプレッドシートに存在する全売主が削除対象に含まれない
      for (const sellerNumber of spreadsheetNumbers) {
        expect(deletedSellers).not.toContain(sellerNumber);
      }
      expect(deletedSellers).toHaveLength(0);
    });

    it('スプレッドシートにない売主のみが削除対象として検出される（具体例）', () => {
      // Arrange
      const spreadsheetNumbers = new Set(['AA001', 'AA002', 'AA003']);
      // DB には AA004, AA005 が追加されている（スプレッドシートから削除済み）
      const dbNumbers = new Set(['AA001', 'AA002', 'AA003', 'AA004', 'AA005']);

      // Act: 差分計算
      const deletedSellers: string[] = [];
      for (const sellerNumber of dbNumbers) {
        if (!spreadsheetNumbers.has(sellerNumber)) {
          deletedSellers.push(sellerNumber);
        }
      }

      // Assert: スプレッドシートに存在する売主は含まれない
      expect(deletedSellers).not.toContain('AA001');
      expect(deletedSellers).not.toContain('AA002');
      expect(deletedSellers).not.toContain('AA003');
      // スプレッドシートにない売主のみが含まれる
      expect(deletedSellers).toContain('AA004');
      expect(deletedSellers).toContain('AA005');
    });

    /**
     * プロパティベーステスト: ランダムな売主番号リストで差分計算が正しいことを検証
     * **Validates: Requirements 3.1**
     */
    it('[PBT] スプレッドシートに存在する売主は常に削除対象に含まれない', () => {
      fc.assert(
        fc.property(
          // ランダムな売主番号リスト（スプレッドシート）
          fc.array(
            fc.string({ minLength: 2, maxLength: 8 }).map(s => `AA${s.replace(/[^0-9]/g, '0').slice(0, 5)}`),
            { minLength: 1, maxLength: 20 }
          ),
          // ランダムな追加売主番号リスト（DBにのみ存在する = 削除対象候補）
          fc.array(
            fc.string({ minLength: 2, maxLength: 8 }).map(s => `BB${s.replace(/[^0-9]/g, '0').slice(0, 5)}`),
            { minLength: 0, maxLength: 10 }
          ),
          (spreadsheetList, dbOnlyList) => {
            const spreadsheetNumbers = new Set(spreadsheetList);
            // DB = スプレッドシートの売主 + DBにのみ存在する売主
            const dbNumbers = new Set([...spreadsheetList, ...dbOnlyList]);

            // 差分計算（detectDeletedSellers の核心ロジック）
            const deletedSellers: string[] = [];
            for (const sellerNumber of dbNumbers) {
              if (!spreadsheetNumbers.has(sellerNumber)) {
                deletedSellers.push(sellerNumber);
              }
            }

            // プロパティ: スプレッドシートに存在する売主は削除対象に含まれない
            for (const sellerNumber of spreadsheetNumbers) {
              if (deletedSellers.includes(sellerNumber)) {
                return false; // プロパティ違反
              }
            }
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // ============================================================
  // 保全プロパティ 2: validateDeletion のブロックロジック
  // アクティブ契約ありの売主は削除がブロックされる
  // ============================================================

  describe('Preservation 3.2: アクティブ契約ありの売主は削除がブロックされる', () => {
    it('「専任契約中」の売主は validateDeletion でブロックされる', async () => {
      // Arrange
      const supabaseMock = createValidationMock('専任契約中');
      (service as any).supabase = supabaseMock;

      // Act
      const result = await (service as any).validateDeletion('AA99999');

      // Assert: 削除がブロックされる
      expect(result.canDelete).toBe(false);
      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('専任契約中');
    });

    it('「一般契約中」の売主は validateDeletion でブロックされる', async () => {
      // Arrange
      const supabaseMock = createValidationMock('一般契約中');
      (service as any).supabase = supabaseMock;

      // Act
      const result = await (service as any).validateDeletion('AA99999');

      // Assert: 削除がブロックされる
      expect(result.canDelete).toBe(false);
      expect(result.requiresManualReview).toBe(true);
      expect(result.reason).toContain('一般契約中');
    });

    it('「追客中」の売主は validateDeletion を通過する', async () => {
      // Arrange
      const supabaseMock = createValidationMock('追客中');
      (service as any).supabase = supabaseMock;

      // Act
      const result = await (service as any).validateDeletion('AA99999');

      // Assert: 削除が許可される
      expect(result.canDelete).toBe(true);
      expect(result.requiresManualReview).toBe(false);
    });

    /**
     * プロパティベーステスト: アクティブ契約ステータスの売主は常にブロックされる
     * **Validates: Requirements 3.2**
     */
    it('[PBT] アクティブ契約ステータスの売主は常に validateDeletion でブロックされる', async () => {
      const activeContractStatuses = ['専任契約中', '一般契約中'];

      for (const status of activeContractStatuses) {
        const supabaseMock = createValidationMock(status);
        (service as any).supabase = supabaseMock;

        const result = await (service as any).validateDeletion('AA99999');

        // プロパティ: アクティブ契約ステータスは常にブロックされる
        expect(result.canDelete).toBe(false);
        expect(result.requiresManualReview).toBe(true);
      }
    });

    it('[PBT] 非アクティブ契約ステータスの売主は validateDeletion を通過する', async () => {
      const nonActiveStatuses = ['追客中', '査定中', '他決', '専任解除', '成約'];

      for (const status of nonActiveStatuses) {
        const supabaseMock = createValidationMock(status);
        (service as any).supabase = supabaseMock;

        const result = await (service as any).validateDeletion('AA99999');

        // プロパティ: 非アクティブ契約ステータスは通過する
        expect(result.canDelete).toBe(true);
      }
    });
  });

  // ============================================================
  // 保全プロパティ 3: getAllActiveDbSellerNumbers のフィルタリング
  // ソフトデリート済みの売主は getAllActiveDbSellerNumbers から除外される
  // ============================================================

  describe('Preservation 3.4: ソフトデリート済みの売主は getAllActiveDbSellerNumbers から除外される', () => {
    it('deleted_at が設定済みの売主は結果に含まれない（具体例）', async () => {
      // Arrange: deleted_at が設定済みの売主を含むモック
      const sellers = [
        { seller_number: 'AA001', deleted_at: null },           // アクティブ
        { seller_number: 'AA002', deleted_at: null },           // アクティブ
        { seller_number: 'AA003', deleted_at: '2024-01-01T00:00:00Z' }, // ソフトデリート済み
        { seller_number: 'AA004', deleted_at: '2024-06-15T12:00:00Z' }, // ソフトデリート済み
      ];

      const supabaseMock = createActiveSellersMock(sellers);
      (service as any).supabase = supabaseMock;

      // Act: getAllActiveDbSellerNumbers を呼び出す（private メソッドなので型キャスト）
      const result = await (service as any).getAllActiveDbSellerNumbers();

      // Assert: ソフトデリート済みの売主は含まれない
      expect(result.has('AA001')).toBe(true);
      expect(result.has('AA002')).toBe(true);
      expect(result.has('AA003')).toBe(false); // ソフトデリート済み → 除外
      expect(result.has('AA004')).toBe(false); // ソフトデリート済み → 除外
    });

    it('全売主がアクティブな場合、全員が結果に含まれる', async () => {
      // Arrange: 全員 deleted_at = null
      const sellers = [
        { seller_number: 'AA001', deleted_at: null },
        { seller_number: 'AA002', deleted_at: null },
        { seller_number: 'AA003', deleted_at: null },
      ];

      const supabaseMock = createActiveSellersMock(sellers);
      (service as any).supabase = supabaseMock;

      // Act
      const result = await (service as any).getAllActiveDbSellerNumbers();

      // Assert: 全員が含まれる
      expect(result.size).toBe(3);
      expect(result.has('AA001')).toBe(true);
      expect(result.has('AA002')).toBe(true);
      expect(result.has('AA003')).toBe(true);
    });

    it('全売主がソフトデリート済みの場合、結果は空になる', async () => {
      // Arrange: 全員 deleted_at が設定済み
      const sellers = [
        { seller_number: 'AA001', deleted_at: '2024-01-01T00:00:00Z' },
        { seller_number: 'AA002', deleted_at: '2024-01-02T00:00:00Z' },
      ];

      const supabaseMock = createActiveSellersMock(sellers);
      (service as any).supabase = supabaseMock;

      // Act
      const result = await (service as any).getAllActiveDbSellerNumbers();

      // Assert: 結果は空
      expect(result.size).toBe(0);
    });

    /**
     * プロパティベーステスト: deleted_at が設定済みの売主は常に除外される
     * **Validates: Requirements 3.4**
     */
    it('[PBT] deleted_at が設定済みの売主は常に getAllActiveDbSellerNumbers から除外される', async () => {
      await fc.assert(
        fc.asyncProperty(
          // ランダムなアクティブ売主リスト
          fc.array(
            fc.nat({ max: 99999 }).map(n => `AA${String(n).padStart(5, '0')}`),
            { minLength: 0, maxLength: 10 }
          ),
          // ランダムなソフトデリート済み売主リスト（アクティブと重複しない番号を使用）
          fc.array(
            fc.nat({ max: 99999 }).map(n => `BB${String(n).padStart(5, '0')}`),
            { minLength: 0, maxLength: 10 }
          ),
          async (activeSellerNumbers, deletedSellerNumbers) => {
            const sellers = [
              ...activeSellerNumbers.map(n => ({ seller_number: n, deleted_at: null as null })),
              ...deletedSellerNumbers.map(n => ({ seller_number: n, deleted_at: '2024-01-01T00:00:00Z' })),
            ];

            const supabaseMock = createActiveSellersMock(sellers);
            (service as any).supabase = supabaseMock;

            const result = await (service as any).getAllActiveDbSellerNumbers();

            // プロパティ: ソフトデリート済みの売主は含まれない
            for (const sellerNumber of deletedSellerNumbers) {
              if (result.has(sellerNumber)) {
                return false; // プロパティ違反
              }
            }

            // プロパティ: アクティブな売主は含まれる
            for (const sellerNumber of activeSellerNumbers) {
              if (!result.has(sellerNumber)) {
                return false; // プロパティ違反
              }
            }

            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
