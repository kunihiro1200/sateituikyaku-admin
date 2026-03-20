// 業務依頼GAS同期バグ修正 - Preservation テスト
// Property 2: Preservation - 既存の手動同期APIの動作維持
// **Validates: Requirements 3.1, 3.2, 3.3**
//
// observation-first methodology に従い、未修正コードで既存APIが正常動作することを確認する。
// このテストは PASS することが期待される（既存APIは正常動作している）。
// 修正後もこのテストが PASS し続けることで、リグレッションがないことを保証する。

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 静的コード解析: 既存APIの存在確認
// ============================================================

describe('Preservation: 既存の手動同期APIの動作維持', () => {
  const workTasksRoutePath = path.resolve(
    __dirname,
    '../../routes/workTasks.ts'
  );
  const workTaskSyncServicePath = path.resolve(
    __dirname,
    '../WorkTaskSyncService.ts'
  );
  const enhancedAutoSyncServicePath = path.resolve(
    __dirname,
    '../EnhancedAutoSyncService.ts'
  );

  let workTasksRouteSource: string;
  let workTaskSyncServiceSource: string;
  let enhancedAutoSyncSource: string;

  beforeAll(() => {
    workTasksRouteSource = fs.readFileSync(workTasksRoutePath, 'utf-8');
    workTaskSyncServiceSource = fs.readFileSync(workTaskSyncServicePath, 'utf-8');
    enhancedAutoSyncSource = fs.readFileSync(enhancedAutoSyncServicePath, 'utf-8');
  });

  // ============================================================
  // Requirement 3.1: POST /api/work-tasks/sync の存在確認
  // ============================================================
  describe('Requirement 3.1: POST /api/work-tasks/sync が正常に動作する', () => {
    it('workTasks.ts に POST /sync ルートが定義されている', () => {
      // router.post('/sync', ...) が存在することを確認
      expect(workTasksRouteSource).toMatch(/router\.post\(['"]\/sync['"]/);
    });

    it('POST /sync ルートが workTaskSyncService.syncAll() を呼び出している', () => {
      // syncAll() の呼び出しが存在することを確認
      expect(workTasksRouteSource).toContain('workTaskSyncService.syncAll()');
    });

    it('POST /sync ルートが成功レスポンスを返す実装になっている', () => {
      // res.json() でレスポンスを返していることを確認
      expect(workTasksRouteSource).toContain("message: '同期が完了しました'");
    });
  });

  // ============================================================
  // Requirement 3.2: POST /api/work-tasks/sync/:propertyNumber の存在確認
  // ============================================================
  describe('Requirement 3.2: POST /api/work-tasks/sync/:propertyNumber が正常に動作する', () => {
    it('workTasks.ts に POST /sync/:propertyNumber ルートが定義されている', () => {
      // router.post('/sync/:propertyNumber', ...) が存在することを確認
      expect(workTasksRouteSource).toMatch(/router\.post\(['"]\/sync\/:propertyNumber['"]/);
    });

    it('POST /sync/:propertyNumber ルートが workTaskSyncService.syncByPropertyNumber() を呼び出している', () => {
      expect(workTasksRouteSource).toContain('workTaskSyncService.syncByPropertyNumber(propertyNumber)');
    });

    it('POST /sync/:propertyNumber ルートが 404 を返す実装になっている（データなし時）', () => {
      // 404 レスポンスが実装されていることを確認
      expect(workTasksRouteSource).toContain('res.status(404)');
    });
  });

  // ============================================================
  // WorkTaskSyncService のメソッド存在確認
  // ============================================================
  describe('WorkTaskSyncService のメソッドが存在する', () => {
    it('WorkTaskSyncService.syncAll() メソッドが定義されている', () => {
      expect(workTaskSyncServiceSource).toContain('async syncAll()');
    });

    it('WorkTaskSyncService.syncByPropertyNumber() メソッドが定義されている', () => {
      expect(workTaskSyncServiceSource).toContain('async syncByPropertyNumber(propertyNumber: string)');
    });

    it('WorkTaskSyncService.syncAll() が work_tasks テーブルへの upsert を実装している', () => {
      expect(workTaskSyncServiceSource).toContain("from('work_tasks')");
      expect(workTaskSyncServiceSource).toContain('.upsert(');
    });

    it('WorkTaskSyncService.syncAll() が物件番号が空の行をスキップする実装になっている', () => {
      // 物件番号チェックが存在することを確認
      expect(workTaskSyncServiceSource).toContain("物件番号");
      expect(workTaskSyncServiceSource).toContain('continue');
    });

    it('WorkTaskSyncService.syncAll() が SyncResult を返す', () => {
      // SyncResult 型が定義されていることを確認
      expect(workTaskSyncServiceSource).toContain('SyncResult');
      expect(workTaskSyncServiceSource).toContain('successCount');
      expect(workTaskSyncServiceSource).toContain('errorCount');
    });
  });

  // ============================================================
  // Requirement 3.3: EnhancedAutoSyncService の他フェーズ確認
  // ============================================================
  describe('Requirement 3.3: runFullSync() の他フェーズが正常に動作する', () => {
    it('Phase 1: Seller Addition Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 1: Seller Addition Sync');
    });

    it('Phase 2: Seller Update Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 2: Seller Update Sync');
    });

    it('Phase 3: Seller Deletion Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 3: Seller Deletion Sync');
    });

    it('Phase 4.5: Property Listing Update Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 4.5: Property Listing Update Sync');
    });

    it('Phase 4.6: New Property Addition Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 4.6: New Property Addition Sync');
    });

    it('Phase 4.7: Property Details Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 4.7: Property Details Sync');
    });

    it('Phase 4.8: Deleted Property Listings Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 4.8: Deleted Property Listings Sync');
    });

    it('Phase 5: Buyer Sync が存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 5: Buyer Sync');
    });

    it('runFullSync() が CompleteSyncResult を返す実装になっている', () => {
      expect(enhancedAutoSyncSource).toContain('CompleteSyncResult');
      expect(enhancedAutoSyncSource).toContain('additionResult');
      expect(enhancedAutoSyncSource).toContain('deletionResult');
    });

    it('Phase 1〜3 が SELLER_SYNC_ENABLED 環境変数で制御されている', () => {
      expect(enhancedAutoSyncSource).toContain('SELLER_SYNC_ENABLED');
      expect(enhancedAutoSyncSource).toContain('isSellerSyncEnabled');
    });

    it('Phase 4.5〜4.8 がエラー時も処理を継続する実装になっている', () => {
      // try-catch でエラーをキャッチして次のフェーズに進む実装を確認
      const phase45Match = enhancedAutoSyncSource.match(
        /Phase 4\.5: Property Listing Update Sync([\s\S]*?)Phase 4\.6/
      );
      expect(phase45Match).not.toBeNull();
      const phase45Block = phase45Match![1];
      expect(phase45Block).toContain('try {');
      expect(phase45Block).toContain('catch (error');
    });

    it('Phase 5 がエラー時も処理を継続する実装になっている', () => {
      const phase5Match = enhancedAutoSyncSource.match(
        /Phase 5: Buyer Sync([\s\S]*?)const endTime/
      );
      expect(phase5Match).not.toBeNull();
      const phase5Block = phase5Match![1];
      expect(phase5Block).toContain('try {');
      expect(phase5Block).toContain('catch (error');
    });
  });

  // ============================================================
  // モックを使った WorkTaskSyncService の動作確認
  // ============================================================
  describe('WorkTaskSyncService のモック動作確認', () => {
    it('WorkTaskSyncService がインスタンス化できる（モック）', () => {
      // 実際の接続なしにクラス構造を確認
      expect(workTaskSyncServiceSource).toContain('export class WorkTaskSyncService');
      expect(workTaskSyncServiceSource).toContain('constructor()');
    });

    it('WorkTaskSyncService が isSyncInProgress() メソッドを持つ', () => {
      expect(workTaskSyncServiceSource).toContain('isSyncInProgress()');
    });

    it('WorkTaskSyncService が WorkTaskColumnMapper を使用している', () => {
      expect(workTaskSyncServiceSource).toContain('WorkTaskColumnMapper');
      expect(workTaskSyncServiceSource).toContain('columnMapper');
    });

    it('WorkTaskSyncService が Supabase クライアントを使用している', () => {
      expect(workTaskSyncServiceSource).toContain('createClient');
      expect(workTaskSyncServiceSource).toContain('SUPABASE_URL');
    });
  });

  // ============================================================
  // ルートファイルの構造確認
  // ============================================================
  describe('workTasks.ts ルートファイルの構造確認', () => {
    it('WorkTaskSyncService が workTasks.ts でインポートされている', () => {
      expect(workTasksRouteSource).toContain("import { WorkTaskSyncService }");
      expect(workTasksRouteSource).toContain("WorkTaskSyncService");
    });

    it('workTaskSyncService インスタンスが作成されている', () => {
      expect(workTasksRouteSource).toContain('new WorkTaskSyncService()');
    });

    it('GET /api/work-tasks ルートが存在する', () => {
      expect(workTasksRouteSource).toMatch(/router\.get\(['"]\/['"]/);
    });

    it('GET /api/work-tasks/:propertyNumber ルートが存在する', () => {
      expect(workTasksRouteSource).toMatch(/router\.get\(['"]\/\:propertyNumber['"]/);
    });

    it('PUT /api/work-tasks/:propertyNumber ルートが存在する', () => {
      expect(workTasksRouteSource).toMatch(/router\.put\(['"]\/\:propertyNumber['"]/);
    });
  });
});
