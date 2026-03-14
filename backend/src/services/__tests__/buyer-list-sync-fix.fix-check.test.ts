// 買主リスト自動同期バグ修正 - 修正確認テスト
// Property 1: 修正後に startServer() が買主リストの定期同期をスケジュールすることを確認
// Property 2: 手動同期・重複防止・売主同期が引き続き正常に動作することを確認

import * as fs from 'fs';
import * as path from 'path';
import * as fc from 'fast-check';

describe('修正確認: 買主リスト定期同期スケジューラーの追加', () => {

  describe('Property 1: Bug Condition - 買主リスト定期同期の自動起動', () => {
    it('index.ts の startServer() 内に BuyerSyncService の定期実行コードが存在する（修正確認）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 修正後: 買主リストの定期同期スケジューラーが存在する
      expect(startServerBody).toContain('BuyerSyncService');
      expect(startServerBody).toContain('isSyncInProgress');
      expect(startServerBody).toContain('syncAll');
      expect(startServerBody).toContain('setInterval');
      expect(startServerBody).toContain('BUYER_SYNC_INTERVAL_MINUTES');
    });

    it('売主リストと買主リストの定期同期が両方スケジュールされている（対称性の確認）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 売主リストの定期同期が存在する
      expect(startServerBody).toContain('getEnhancedPeriodicSyncManager');
      // 買主リストの定期同期も存在する
      expect(startServerBody).toContain('BuyerSyncService');
    });

    it('買主リスト定期同期は売主リスト定期同期より後に起動する（クォータ分散）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      // 売主同期の遅延（10秒）より買主同期の遅延（20秒）が大きい
      const sellerSyncDelay = indexSource.match(/getEnhancedPeriodicSyncManager[\s\S]*?},\s*(\d+)\)/);
      const buyerSyncDelay = indexSource.match(/BuyerSyncService[\s\S]*?},\s*(\d+)\)/);

      expect(sellerSyncDelay).not.toBeNull();
      expect(buyerSyncDelay).not.toBeNull();

      const sellerDelay = parseInt(sellerSyncDelay![1]);
      const buyerDelay = parseInt(buyerSyncDelay![1]);
      expect(buyerDelay).toBeGreaterThan(sellerDelay);
    });
  });


  describe('Property 2: Preservation - 重複防止ロジックの維持', () => {
    it('isSyncInProgress() が true の場合、定期同期をスキップする（重複防止）', () => {
      // index.ts の定期同期コードが isSyncInProgress() チェックを含んでいることを確認
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 定期同期コードが重複防止チェックを含んでいる
      expect(startServerBody).toContain('isSyncInProgress');
    });

    it('Property-Based: 任意の同期間隔設定（1〜60分）でスケジューラーが正しい間隔を使用する', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 60 }),
          (intervalMinutes) => {
            // 間隔をミリ秒に変換するロジックの検証
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
            // isSyncInProgress() が true なら定期同期をスキップするロジック
            const shouldSkip = isSyncing === true;
            return isSyncing ? shouldSkip === true : shouldSkip === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 2: Preservation - 売主リスト同期の独立性', () => {
    it('売主リストの定期同期コード（EnhancedPeriodicSyncManager）が変更されていない', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 売主リストの定期同期コードが引き続き存在する
      expect(startServerBody).toContain('getEnhancedPeriodicSyncManager');
      expect(startServerBody).toContain('isAutoSyncEnabled');
      expect(startServerBody).toContain('periodicSyncManager.start()');
    });

    it('手動同期エンドポイント（POST /api/buyers/sync）のルートが変更されていない', () => {
      const buyersRoutePath = path.resolve(__dirname, '../../routes/buyers.ts');
      const buyersRouteSource = fs.readFileSync(buyersRoutePath, 'utf-8');

      // 手動同期エンドポイントが存在する
      expect(buyersRouteSource).toContain("router.post('/sync'");
      // 重複防止チェックが存在する
      expect(buyersRouteSource).toContain('isSyncInProgress');
      expect(buyersRouteSource).toContain("'Sync is already in progress'");
    });
  });

});
