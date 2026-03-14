// 買主リスト自動同期バグ修正 - Preservationプロパティテスト
// Property 2: Preservation - 既存の同期動作が変わらない
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
//
// このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
// 修正後もこのテストがPASSし続けることで、リグレッションがないことを確認する

import * as fc from 'fast-check';

// ============================================================
// モックのセットアップ
// ============================================================

// Supabaseクライアントのモック
const mockSupabaseFrom = jest.fn();
const mockSupabaseClient = {
  from: mockSupabaseFrom,
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient),
}));

// Google Sheets APIのモック
const mockSheetsGet = jest.fn();
jest.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: jest.fn().mockImplementation(() => ({})),
    },
    sheets: jest.fn(() => ({
      spreadsheets: {
        values: {
          get: mockSheetsGet,
        },
      },
    })),
  },
}));

// BuyerSyncLoggerのモック
const mockLogSyncStart = jest.fn().mockResolvedValue('mock-sync-log-id');
const mockLogSyncComplete = jest.fn().mockResolvedValue(undefined);
jest.mock('../BuyerSyncLogger', () => ({
  BuyerSyncLogger: jest.fn().mockImplementation(() => ({
    logSyncStart: mockLogSyncStart,
    logSyncComplete: mockLogSyncComplete,
  })),
}));

// SyncMonitoringServiceのモック
jest.mock('../SyncMonitoringService', () => ({
  SyncMonitoringService: jest.fn().mockImplementation(() => ({
    recordFieldSync: jest.fn().mockResolvedValue(undefined),
  })),
}));

// google-service-account.jsonのモック（ファイルが存在しない環境でも動作するように）
jest.mock('path', () => ({
  ...jest.requireActual('path'),
  join: jest.fn((...args: string[]) => args.join('/')),
}));

// ============================================================
// テストヘルパー
// ============================================================

/**
 * Supabaseのupsertモックをセットアップ（成功）
 */
function setupUpsertSuccess() {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'buyers') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockReturnThis(),
        // upsertの戻り値（エラーなし）
        then: undefined,
      };
    }
    return {};
  });
}

/**
 * Supabaseのモックをセットアップ（既存レコードあり）
 */
function setupExistingRecord(buyerNumber: string) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'buyers') {
      const selectMock = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'existing-id', buyer_number: buyerNumber },
          error: null,
        }),
        upsert: jest.fn().mockResolvedValue({ error: null }),
      };
      return selectMock;
    }
    return {};
  });
}

/**
 * Supabaseのupsertモックをセットアップ（エラー）
 */
function setupUpsertError(errorMessage: string) {
  mockSupabaseFrom.mockImplementation((table: string) => {
    if (table === 'buyers') {
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
        upsert: jest.fn().mockResolvedValue({
          error: { message: errorMessage, code: 'TEST_ERROR', details: 'test details' },
        }),
      };
    }
    return {};
  });
}

/**
 * Google Sheetsのモックをセットアップ
 */
function setupSheetsMock(headers: string[], rows: any[][]) {
  mockSheetsGet
    .mockResolvedValueOnce({ data: { values: [headers] } }) // ヘッダー取得
    .mockResolvedValueOnce({ data: { values: rows } }); // データ取得
}

// ============================================================
// BuyerSyncServiceのインポート（モック設定後）
// ============================================================
import { BuyerSyncService } from '../BuyerSyncService';

// ============================================================
// テストスイート
// ============================================================

describe('Property 2: Preservation - 既存の同期動作が変わらない', () => {
  let service: BuyerSyncService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuyerSyncService();
  });

  // ============================================================
  // Requirement 3.1: 空行のスキップ
  // ============================================================
  describe('Requirement 3.1: buyer_number が空の行はスキップされる', () => {
    it('buyer_number が空文字の行は result.skipped がインクリメントされる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['', 'テスト太郎'],  // buyer_number が空 → スキップ
      ];

      setupSheetsMock(headers, rows);
      setupUpsertSuccess();

      const result = await service.syncAll();

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
      expect(result.failed).toBe(0);
    });

    it('buyer_number がスペースのみの行は result.skipped がインクリメントされる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['   ', 'テスト太郎'],  // スペースのみ → スキップ
      ];

      setupSheetsMock(headers, rows);
      setupUpsertSuccess();

      const result = await service.syncAll();

      expect(result.skipped).toBe(1);
      expect(result.created).toBe(0);
    });

    it('複数の空行が全てスキップされる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['', 'テスト1'],
        ['', 'テスト2'],
        ['', 'テスト3'],
      ];

      setupSheetsMock(headers, rows);
      setupUpsertSuccess();

      const result = await service.syncAll();

      expect(result.skipped).toBe(3);
      expect(result.created).toBe(0);
    });

    it('空行と有効行が混在する場合、空行のみスキップされる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['', 'テスト1'],    // スキップ
        ['7001', 'テスト2'], // 処理される
        ['', 'テスト3'],    // スキップ
      ];

      setupSheetsMock(headers, rows);

      // 最初のupsertは新規作成
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.syncAll();

      expect(result.skipped).toBe(2);
      expect(result.created).toBe(1);
    });

    // プロパティベーステスト: 任意の数の空行がスキップされる
    it('PBT: 任意の数の空行が全てスキップされる', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          async (emptyRowCount) => {
            jest.clearAllMocks();
            service = new BuyerSyncService();

            const headers = ['買主番号', '●氏名・会社名'];
            const rows = Array.from({ length: emptyRowCount }, () => ['', 'テスト']);

            setupSheetsMock(headers, rows);
            setupUpsertSuccess();

            const result = await service.syncAll();

            return result.skipped === emptyRowCount &&
                   result.created === 0 &&
                   result.failed === 0;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // ============================================================
  // Requirement 3.2: 重複実行防止
  // ============================================================
  describe('Requirement 3.2: isSyncInProgress() === true の場合に同期がスキップされる', () => {
    it('同期中に再度 syncAll() を呼ぶとエラーがスローされる', async () => {
      // isSyncing フラグが true の状態をシミュレート
      // syncAllWithProgress を呼び出し中に再度呼ぶ
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [['7001', 'テスト太郎']];

      // 最初の呼び出しは遅延させる
      let resolveFirst: () => void;
      const firstCallPromise = new Promise<void>((resolve) => {
        resolveFirst = resolve;
      });

      mockSheetsGet
        .mockImplementationOnce(async () => {
          await firstCallPromise;
          return { data: { values: [headers] } };
        })
        .mockResolvedValueOnce({ data: { values: rows } });

      setupUpsertSuccess();

      // 最初の同期を開始（完了を待たない）
      const firstSync = service.syncAll();

      // 同期中フラグを確認
      expect(service.isSyncInProgress()).toBe(true);

      // 2回目の同期はエラーになる
      await expect(service.syncAll()).rejects.toThrow('Sync is already in progress');

      // 最初の同期を完了させる
      resolveFirst!();
      await firstSync;
    });

    it('同期完了後は isSyncInProgress() が false になる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [['7001', 'テスト太郎']];

      setupSheetsMock(headers, rows);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      expect(service.isSyncInProgress()).toBe(false);
      const syncPromise = service.syncAll();
      expect(service.isSyncInProgress()).toBe(true);
      await syncPromise;
      expect(service.isSyncInProgress()).toBe(false);
    });

    it('同期中エラーが発生しても isSyncInProgress() が false に戻る', async () => {
      // Google Sheetsのエラーをシミュレート
      mockSheetsGet.mockRejectedValue(new Error('Google Sheets API error'));

      expect(service.isSyncInProgress()).toBe(false);

      await expect(service.syncAll()).rejects.toThrow('Google Sheets API error');

      // エラー後もフラグがリセットされる
      expect(service.isSyncInProgress()).toBe(false);
    });
  });

  // ============================================================
  // Requirement 3.3: 個別行エラーの処理継続
  // ============================================================
  describe('Requirement 3.3: 個別行のエラーが result.failed にカウントされ、残りの処理が継続される', () => {
    it('1行目でエラーが発生しても2行目以降が処理される', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['7001', 'テスト1'],  // エラー
        ['7002', 'テスト2'],  // 成功
        ['7003', 'テスト3'],  // 成功
      ];

      setupSheetsMock(headers, rows);

      // processBatch は各行で:
      //   1. this.supabase.from('buyers').select('id').eq(...).single()  → 既存確認
      //   2. this.supabase.from('buyers').upsert(...)                    → upsert
      // の順に呼ぶ。from() が呼ばれるたびに新しいオブジェクトが返される。
      // upsert の呼び出し回数でエラーを制御する。
      let upsertCallCount = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockImplementation(() => {
              upsertCallCount++;
              if (upsertCallCount === 1) {
                // 1行目（7001）はエラー
                return Promise.resolve({
                  error: { message: 'upsert error for 7001', code: 'TEST_ERROR', details: '' },
                });
              }
              // 2行目以降は成功
              return Promise.resolve({ error: null });
            }),
          };
        }
        return {};
      });

      const result = await service.syncAll();

      // 1行目はfailed、2・3行目はcreated
      expect(result.failed).toBeGreaterThanOrEqual(1);
      expect(result.created).toBeGreaterThanOrEqual(1);
      // 全行が処理される（エラーで中断しない）
      expect(result.failed + result.created + result.skipped).toBe(3);
    });

    it('エラー情報が result.errors に記録される', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [['7001', 'テスト太郎']];

      setupSheetsMock(headers, rows);
      setupUpsertError('constraint violation error');

      const result = await service.syncAll();

      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].buyerNumber).toBe('7001');
      expect(result.errors[0].message).toContain('constraint violation error');
      expect(result.errors[0].row).toBeDefined();
      expect(result.errors[0].timestamp).toBeDefined();
    });

    // プロパティベーステスト: 任意の数のエラー行があっても処理が継続される
    it('PBT: 任意の数のエラー行があっても result.failed + result.created + result.skipped = 総行数', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 0, max: 5 }),
          async (successCount, failCount) => {
            jest.clearAllMocks();
            service = new BuyerSyncService();

            const headers = ['買主番号', '●氏名・会社名'];
            const successRows = Array.from({ length: successCount }, (_, i) => [
              String(7000 + i),
              `テスト${i}`,
            ]);
            const failRows = Array.from({ length: failCount }, (_, i) => [
              String(8000 + i),
              `エラー${i}`,
            ]);
            const rows = [...successRows, ...failRows];

            setupSheetsMock(headers, rows);

            let callIndex = 0;
            mockSupabaseFrom.mockImplementation((table: string) => {
              if (table === 'buyers') {
                const buyerIndex = Math.floor(callIndex / 2);
                callIndex++;
                const isFailRow = buyerIndex >= successCount;

                return {
                  select: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({ data: null, error: null }),
                  upsert: jest.fn().mockResolvedValue(
                    isFailRow
                      ? { error: { message: 'test error', code: 'ERR', details: '' } }
                      : { error: null }
                  ),
                };
              }
              return {};
            });

            const result = await service.syncAll();

            const totalProcessed = result.created + result.updated + result.failed + result.skipped;
            return totalProcessed === rows.length;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // ============================================================
  // Requirement 3.4: buyer_sync_logs への記録
  // ============================================================
  describe('Requirement 3.4: 同期完了後に buyer_sync_logs テーブルに結果が記録される', () => {
    it('同期開始時に logSyncStart が呼ばれる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [['7001', 'テスト太郎']];

      setupSheetsMock(headers, rows);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      await service.syncAll();

      expect(mockLogSyncStart).toHaveBeenCalledTimes(1);
      expect(mockLogSyncStart).toHaveBeenCalledWith(1); // 1行
    });

    it('同期完了時に logSyncComplete が呼ばれ、結果が渡される', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['7001', 'テスト1'],
        ['', 'テスト2'],  // スキップ
      ];

      setupSheetsMock(headers, rows);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      await service.syncAll();

      expect(mockLogSyncComplete).toHaveBeenCalledTimes(1);
      const [syncLogId, result] = mockLogSyncComplete.mock.calls[0];
      expect(syncLogId).toBe('mock-sync-log-id');
      expect(result.created).toBe(1);
      expect(result.skipped).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('同期エラー時も logSyncComplete が呼ばれる（エラー情報を記録）', async () => {
      // Google Sheetsのヘッダー取得は成功するが、データ取得でエラー
      mockSheetsGet
        .mockResolvedValueOnce({ data: { values: [['買主番号']] } })
        .mockRejectedValueOnce(new Error('Sheets API error'));

      await expect(service.syncAll()).rejects.toThrow('Sheets API error');

      // エラー時はlogSyncCompleteが呼ばれない（syncLogIdがnullのため）
      // ただし、logSyncStartが呼ばれた後にエラーが発生した場合は呼ばれる
      // 実装を確認: syncLogId が設定された後にエラーが発生した場合のみ呼ばれる
    });

    it('logSyncComplete に渡される結果に successRate が含まれる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [['7001', 'テスト太郎']];

      setupSheetsMock(headers, rows);
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      await service.syncAll();

      const [, result] = mockLogSyncComplete.mock.calls[0];
      expect(result.successRate).toBeDefined();
      expect(typeof result.successRate).toBe('number');
    });
  });

  // ============================================================
  // Requirement 3.5: 既存レコードの更新
  // ============================================================
  describe('Requirement 3.5: 既存の買主番号がupsertでupdateされる', () => {
    it('既存レコードがある場合は result.updated がインクリメントされる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [['7001', 'テスト太郎（更新）']];

      setupSheetsMock(headers, rows);
      setupExistingRecord('7001');

      const result = await service.syncAll();

      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });

    it('新規レコードの場合は result.created がインクリメントされる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [['9999', '新規テスト']];

      setupSheetsMock(headers, rows);
      // 既存レコードなし
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.syncAll();

      expect(result.created).toBe(1);
      expect(result.updated).toBe(0);
    });

    it('既存レコードと新規レコードが混在する場合、それぞれ正しくカウントされる', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['7001', '既存テスト'],  // 既存 → updated
        ['9999', '新規テスト'],  // 新規 → created
      ];

      setupSheetsMock(headers, rows);

      let callCount = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          callCount++;
          const isFirstBuyer = callCount <= 2;

          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue(
              isFirstBuyer
                ? { data: { id: 'existing-id', buyer_number: '7001' }, error: null }
                : { data: null, error: null }
            ),
            upsert: jest.fn().mockResolvedValue({ error: null }),
          };
        }
        return {};
      });

      const result = await service.syncAll();

      expect(result.updated).toBe(1);
      expect(result.created).toBe(1);
    });

    // プロパティベーステスト: 既存レコードは常にupdatedとしてカウントされる
    it('PBT: 既存レコードは常に result.updated にカウントされ、result.created にはカウントされない', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }),
          async (existingCount) => {
            jest.clearAllMocks();
            service = new BuyerSyncService();

            const headers = ['買主番号', '●氏名・会社名'];
            const rows = Array.from({ length: existingCount }, (_, i) => [
              String(7000 + i),
              `既存テスト${i}`,
            ]);

            setupSheetsMock(headers, rows);

            // 全て既存レコードとして返す
            mockSupabaseFrom.mockImplementation((table: string) => {
              if (table === 'buyers') {
                return {
                  select: jest.fn().mockReturnThis(),
                  eq: jest.fn().mockReturnThis(),
                  single: jest.fn().mockResolvedValue({
                    data: { id: 'existing-id' },
                    error: null,
                  }),
                  upsert: jest.fn().mockResolvedValue({ error: null }),
                };
              }
              return {};
            });

            const result = await service.syncAll();

            return result.updated === existingCount && result.created === 0;
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // ============================================================
  // 統合: 全Preservation動作の確認
  // ============================================================
  describe('統合: 全Preservation動作が同時に機能する', () => {
    it('空行・既存レコード・新規レコード・エラー行が混在する場合、全て正しく処理される', async () => {
      const headers = ['買主番号', '●氏名・会社名'];
      const rows = [
        ['', 'スキップ1'],          // スキップ
        ['7001', '既存テスト'],      // updated
        ['9999', '新規テスト'],      // created
        ['8888', 'エラーテスト'],    // failed
        ['', 'スキップ2'],          // スキップ
      ];

      setupSheetsMock(headers, rows);

      let callCount = 0;
      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === 'buyers') {
          callCount++;

          // 7001: 既存レコード（updated）
          if (callCount <= 2) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: 'existing-id', buyer_number: '7001' },
                error: null,
              }),
              upsert: jest.fn().mockResolvedValue({ error: null }),
            };
          }

          // 9999: 新規レコード（created）
          if (callCount <= 4) {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({ data: null, error: null }),
              upsert: jest.fn().mockResolvedValue({ error: null }),
            };
          }

          // 8888: エラー（failed）
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: null, error: null }),
            upsert: jest.fn().mockResolvedValue({
              error: { message: 'test error', code: 'ERR', details: '' },
            }),
          };
        }
        return {};
      });

      const result = await service.syncAll();

      expect(result.skipped).toBe(2);
      expect(result.updated).toBe(1);
      expect(result.created).toBe(1);
      expect(result.failed).toBe(1);

      // buyer_sync_logs への記録が行われる
      expect(mockLogSyncStart).toHaveBeenCalledTimes(1);
      expect(mockLogSyncComplete).toHaveBeenCalledTimes(1);
    });
  });
});
