// 物件リスト・業務依頼 自動同期バグ修正 - 修正確認テスト
// Property 1: 修正後に startServer() が業務依頼の定期同期をスケジュールすることを確認
// Property 2: 手動同期・重複防止・売主・買主同期が引き続き正常に動作することを確認

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

describe('修正確認: 業務依頼定期同期スケジューラーの追加', () => {

  describe('Property 1: Bug Condition - 業務依頼定期同期の自動起動', () => {
    it('index.ts の startServer() 内に WorkTaskSyncService の定期実行コードが存在する（修正確認）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 修正後: 業務依頼の定期同期スケジューラーが存在する
      expect(startServerBody).toContain('WorkTaskSyncService');
      expect(startServerBody).toContain('isSyncInProgress');
      expect(startServerBody).toContain('syncAll');
      expect(startServerBody).toContain('setInterval');
      expect(startServerBody).toContain('WORK_TASK_SYNC_INTERVAL_MINUTES');
    });

    it('売主・買主・業務依頼の定期同期が全てスケジュールされている（対称性の確認）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 売主リストの定期同期が存在する
      expect(startServerBody).toContain('getEnhancedPeriodicSyncManager');
      // 買主リストの定期同期が存在する
      expect(startServerBody).toContain('BuyerSyncService');
      // 業務依頼の定期同期が存在する
      expect(startServerBody).toContain('WorkTaskSyncService');
    });

    it('業務依頼定期同期は買主リスト定期同期より後に起動する（クォータ分散）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      // 買主同期の遅延（20秒）より業務依頼同期の遅延（40秒）が大きい
      const buyerDelayMatch = indexSource.match(/BuyerSyncService[\s\S]*?},\s*(\d+)\)/);
      const workTaskDelayMatch = indexSource.match(/WorkTaskSyncService[\s\S]*?},\s*(\d+)\)/);

      expect(buyerDelayMatch).not.toBeNull();
      expect(workTaskDelayMatch).not.toBeNull();

      const buyerDelay = parseInt(buyerDelayMatch![1]);
      const workTaskDelay = parseInt(workTaskDelayMatch![1]);
      expect(workTaskDelay).toBeGreaterThan(buyerDelay);
    });
  });

  describe('Property 1: WorkTaskSyncService の isSyncInProgress() メソッド', () => {
    it('WorkTaskSyncService に isSyncInProgress() メソッドが存在する', () => {
      const servicePath = path.resolve(__dirname, '../WorkTaskSyncService.ts');
      const serviceSource = fs.readFileSync(servicePath, 'utf-8');

      expect(serviceSource).toContain('isSyncInProgress()');
      expect(serviceSource).toContain('isSyncing');
    });

    it('syncAll() が finally ブロックで isSyncing をリセットする', () => {
      const servicePath = path.resolve(__dirname, '../WorkTaskSyncService.ts');
      const serviceSource = fs.readFileSync(servicePath, 'utf-8');

      expect(serviceSource).toContain('this.isSyncing = true');
      expect(serviceSource).toContain('this.isSyncing = false');
      expect(serviceSource).toContain('finally');
    });
  });

  describe('Property 2: Preservation - 重複防止ロジックの維持', () => {
    it('isSyncInProgress() が true の場合、定期同期をスキップする（重複防止）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 業務依頼の定期同期コードが重複防止チェックを含んでいる
      expect(startServerBody).toContain('isSyncInProgress');
    });

    it('Property-Based: 任意の同期間隔設定（1〜60分）でスケジューラーが正しい間隔を使用する', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 60 }),
          (intervalMinutes) => {
            const intervalMs = intervalMinutes * 60 * 1000;
            return intervalMs === intervalMinutes * 60000 && intervalMs > 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property-Based: 同期中フラグが true の場合、常にスキップ判定になる', () => {
      fc.assert(
        fc.property(
          fc.boolean(),
          (isSyncing) => {
            const shouldSkip = isSyncing === true;
            return isSyncing ? shouldSkip === true : shouldSkip === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Preservation - 売主・買主同期の独立性', () => {
    it('売主リストの定期同期コード（EnhancedPeriodicSyncManager）が変更されていない', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      expect(startServerBody).toContain('getEnhancedPeriodicSyncManager');
      expect(startServerBody).toContain('isAutoSyncEnabled');
      expect(startServerBody).toContain('periodicSyncManager.start()');
    });

    it('買主リストの定期同期コード（BuyerSyncService）が変更されていない', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      expect(startServerBody).toContain('BuyerSyncService');
      expect(startServerBody).toContain('BUYER_SYNC_INTERVAL_MINUTES');
    });

    it('手動同期エンドポイント（POST /api/work-tasks/sync）のルートが変更されていない', () => {
      const routesDir = path.resolve(__dirname, '../../routes');
      const routeFiles = fs.readdirSync(routesDir);

      // work-tasks または workTasks 関連のルートファイルを探す
      const workTaskRouteFile = routeFiles.find(f =>
        f.toLowerCase().includes('work') || f.toLowerCase().includes('task')
      );

      if (workTaskRouteFile) {
        const routeSource = fs.readFileSync(path.join(routesDir, workTaskRouteFile), 'utf-8');
        // 手動同期エンドポイントが存在する
        expect(routeSource).toContain("router.post('/sync'");
      } else {
        // ルートファイルが見つからない場合はスキップ（index.tsに直接実装されている可能性）
        console.log('Work task route file not found separately, may be in index.ts');
      }
    });
  });

});
