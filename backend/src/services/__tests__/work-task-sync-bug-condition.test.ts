// 業務依頼GAS同期バグ修正 - バグ条件探索テスト
// Property 1: Bug Condition - Phase 4 が WorkTaskSyncService.syncAll() を呼び出していない
// **Validates: Requirements 1.1, 1.2, 1.3**
//
// このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
// DO NOT attempt to fix the test or the code when it fails
// GOAL: バグが存在することを示す counterexample を発見する

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 静的コード解析: Phase 4 のバグ条件を特定
// ============================================================

describe('バグ条件探索: Phase 4 が WorkTaskSyncService.syncAll() を呼び出していない', () => {
  const enhancedAutoSyncServicePath = path.resolve(
    __dirname,
    '../EnhancedAutoSyncService.ts'
  );
  const workTaskSyncServicePath = path.resolve(
    __dirname,
    '../WorkTaskSyncService.ts'
  );

  let enhancedAutoSyncSource: string;
  let workTaskSyncSource: string;

  beforeAll(() => {
    enhancedAutoSyncSource = fs.readFileSync(enhancedAutoSyncServicePath, 'utf-8');
    workTaskSyncSource = fs.readFileSync(workTaskSyncServicePath, 'utf-8');
  });

  // ============================================================
  // 調査1: WorkTaskSyncService.syncAll() の存在確認
  // ============================================================
  describe('前提確認: WorkTaskSyncService.syncAll() は存在する', () => {
    it('WorkTaskSyncService.ts に syncAll() メソッドが定義されている', () => {
      // syncAll() は存在するが、呼び出されていないことがバグ
      expect(workTaskSyncSource).toContain('async syncAll()');
    });

    it('WorkTaskSyncService.ts は work_tasks テーブルへの upsert を実装している', () => {
      expect(workTaskSyncSource).toContain("from('work_tasks')");
      expect(workTaskSyncSource).toContain('.upsert(');
    });
  });

  // ============================================================
  // 調査2: Phase 4 の実装確認（バグの核心）
  // ============================================================
  describe('根本原因調査: Phase 4 の実装', () => {
    it('EnhancedAutoSyncService.ts に Phase 4 のコードブロックが存在する', () => {
      expect(enhancedAutoSyncSource).toContain('Phase 4: Work Task Sync');
    });

    it('Phase 4 のコードに "handled elsewhere" というコメントが存在する（誤ったコメント）', () => {
      // このコメントは誤り: 実際にはどこからも自動呼び出しされていない
      expect(enhancedAutoSyncSource).toContain('Work task sync is handled elsewhere');
    });

    it('Phase 4 のコードに "handled by existing service" というログが存在する（何もしていない証拠）', () => {
      expect(enhancedAutoSyncSource).toContain('Work task sync (handled by existing service)');
    });
  });

  // ============================================================
  // バグ条件テスト: Property 1 - Bug Condition
  // Phase 4 が WorkTaskSyncService.syncAll() を呼び出していない
  // ============================================================
  describe('Property 1: Bug Condition - Phase 4 が WorkTaskSyncService.syncAll() を呼び出していない', () => {
    it('Bug Condition: EnhancedAutoSyncService が WorkTaskSyncService をインポートしていない', () => {
      // WorkTaskSyncService がインポートされていなければ、呼び出せない
      // 未修正コードではインポートが存在しないため、このアサーションは FAIL する
      // これが counterexample: WorkTaskSyncService が使われていない証拠
      const hasImport = enhancedAutoSyncSource.includes('WorkTaskSyncService');
      expect(hasImport).toBe(true); // ← 未修正コードでは FAIL（インポートなし）
    });

    it('Bug Condition: runFullSync() の Phase 4 ブロック内に WorkTaskSyncService.syncAll() の呼び出しが存在しない', () => {
      // Phase 4 のブロックを抽出して確認
      // "Phase 4: Work Task Sync" から "Phase 4.5" までの範囲を検索
      const phase4Match = enhancedAutoSyncSource.match(
        /Phase 4: Work Task Sync([\s\S]*?)Phase 4\.5/
      );

      expect(phase4Match).not.toBeNull();

      const phase4Block = phase4Match![1];

      // Phase 4 ブロック内に syncAll() の呼び出しが存在するか確認
      // 未修正コードでは存在しないため、このアサーションは FAIL する
      // counterexample: Phase 4 が何もしていない
      const hasSyncAllCall = phase4Block.includes('syncAll()');
      expect(hasSyncAllCall).toBe(true); // ← 未修正コードでは FAIL
    });

    it('Bug Condition: runFullSync() の Phase 4 ブロック内に WorkTaskSyncService のインスタンス化が存在しない', () => {
      const phase4Match = enhancedAutoSyncSource.match(
        /Phase 4: Work Task Sync([\s\S]*?)Phase 4\.5/
      );

      expect(phase4Match).not.toBeNull();

      const phase4Block = phase4Match![1];

      // WorkTaskSyncService のインスタンス化が存在するか確認
      const hasInstantiation =
        phase4Block.includes('new WorkTaskSyncService') ||
        phase4Block.includes('workTaskSyncService');
      expect(hasInstantiation).toBe(true); // ← 未修正コードでは FAIL
    });
  });

  // ============================================================
  // モックを使った動作確認: runFullSync() が work_tasks を同期しない
  // ============================================================
  describe('動作確認: runFullSync() 実行時に work_tasks 同期が行われない', () => {
    it('Bug Condition: Phase 4 のログに WorkTaskSyncService の実行ログが含まれない', () => {
      // Phase 4 のコードを確認
      // 実際の同期ログ（例: "Syncing X work tasks..."）が存在しないことを確認
      const phase4Match = enhancedAutoSyncSource.match(
        /Phase 4: Work Task Sync([\s\S]*?)Phase 4\.5/
      );

      expect(phase4Match).not.toBeNull();

      const phase4Block = phase4Match![1];

      // 実際の同期処理を示すログが存在するか確認
      // 未修正コードでは存在しないため FAIL する
      const hasSyncLog =
        phase4Block.includes('Syncing') ||
        phase4Block.includes('work task') ||
        phase4Block.includes('syncAll');

      // Phase 4 が実際に何かしているなら true になるはず
      // 未修正コードでは "handled by existing service" というログのみで何もしていない
      expect(hasSyncLog).toBe(true); // ← 未修正コードでは FAIL
    });

    it('Bug Condition: Phase 4 のコードブロックが実質的に空（コメントとログのみ）', () => {
      const phase4Match = enhancedAutoSyncSource.match(
        /Phase 4: Work Task Sync([\s\S]*?)Phase 4\.5/
      );

      expect(phase4Match).not.toBeNull();

      const phase4Block = phase4Match![1];

      // コメントとログ出力以外の実際のコードが存在するか確認
      // 実際のコード = 関数呼び出し、変数宣言、await など
      const lines = phase4Block
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .filter(l => !l.startsWith('//'))  // コメント除外
        .filter(l => !l.startsWith('console.log')); // ログ除外

      // 実際のコードが存在すれば lines.length > 0 になる
      // 未修正コードでは何もないため lines.length === 0 になる
      // このテストは「実際のコードが存在すること」を期待する → 未修正では FAIL
      expect(lines.length).toBeGreaterThan(0); // ← 未修正コードでは FAIL
    });
  });

  // ============================================================
  // counterexample の記録
  // ============================================================
  describe('counterexample の記録', () => {
    it('counterexample: Phase 4 の実際のコードを出力して記録する', () => {
      const phase4Match = enhancedAutoSyncSource.match(
        /Phase 4: Work Task Sync([\s\S]*?)Phase 4\.5/
      );

      if (phase4Match) {
        const phase4Block = phase4Match![1];
        console.log('=== Phase 4 の実際のコード（counterexample） ===');
        console.log(phase4Block);
        console.log('=== counterexample 終了 ===');
        console.log('');
        console.log('根本原因: Phase 4 は以下のコードのみで、WorkTaskSyncService.syncAll() を呼び出していない:');
        console.log('  // Note: Work task sync is handled elsewhere');
        console.log('  console.log("✅ Work task sync (handled by existing service)")');
        console.log('');
        console.log('影響: runFullSync() が定期実行されても、work_tasks テーブルは更新されない');
        console.log('例: AA9195 の site_registration_deadline がスプレッドシートで更新されても DB に反映されない');
      }

      // このテストは常に PASS（記録目的）
      expect(phase4Match).not.toBeNull();
    });
  });
});
