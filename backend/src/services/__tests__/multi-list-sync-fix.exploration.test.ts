// 物件リスト・業務依頼 自動同期バグ修正 - 探索的バグ確認テスト
// このテストはバグが存在した時点のコード状態を記録するものです。

import * as fs from 'fs';
import * as path from 'path';

describe('探索的バグ確認（記録）: 業務依頼定期同期の欠如', () => {
  describe('Bug Condition の記録: startServer() に WorkTaskSyncService の定期実行コードが存在しなかった', () => {
    it('修正後: index.ts の startServer() 内に WorkTaskSyncService の定期実行コードが存在する', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 売主リストの定期同期は存在する（EnhancedPeriodicSyncManager）
      expect(startServerBody).toContain('EnhancedPeriodicSyncManager');

      // 買主リストの定期同期は存在する（BuyerSyncService）
      expect(startServerBody).toContain('BuyerSyncService');

      // 修正後: 業務依頼の定期同期も存在する
      expect(startServerBody).toContain('WorkTaskSyncService');
    });

    it('修正後: 売主・買主・業務依頼の定期同期が全てスケジュールされている（対称性の確認）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      // 売主リストの定期同期スケジューラーが存在する
      expect(indexSource).toContain('getEnhancedPeriodicSyncManager');

      // 買主リストの定期同期スケジューラーが存在する
      expect(indexSource).toContain('BuyerSyncService');

      // 修正後: 業務依頼の定期同期スケジューラーも存在する
      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const body = startServerMatch![1];
      const hasWorkTaskPeriodicSync = body.includes('WorkTaskSyncService') && body.includes('setInterval');
      expect(hasWorkTaskPeriodicSync).toBe(true);
    });
  });
});
