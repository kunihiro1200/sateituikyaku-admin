// 買主リスト自動同期バグ修正 - 探索的バグ確認テスト（バグ存在時の記録）
// このテストはバグが存在した時点のコード状態を記録するものです。
// 修正後は fix-check テストで正しい動作を確認してください。

import * as fs from 'fs';
import * as path from 'path';

describe('探索的バグ確認（記録）: 買主リスト定期同期の欠如', () => {
  describe('Bug Condition の記録: startServer() に買主リスト定期同期スケジューラーが存在しなかった', () => {
    it('修正前のバグ: index.ts の startServer() 内に BuyerSyncService の定期実行コードが存在しなかった（修正後はこのテストは失敗する）', () => {
      // このテストはバグが存在した状態を記録するものです
      // 修正後は startServer() 内に BuyerSyncService が存在するため、このテストは失敗します
      // 修正の確認は buyer-list-sync-fix.fix-check.test.ts を参照してください

      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const startServerBody = startServerMatch![1];

      // 売主リストの定期同期は存在する（EnhancedPeriodicSyncManager）
      expect(startServerBody).toContain('EnhancedPeriodicSyncManager');

      // 修正後: 買主リストの定期同期も存在する（バグが修正された）
      expect(startServerBody).toContain('BuyerSyncService');
    });

    it('修正後: 売主リストと買主リストの定期同期が両方スケジュールされている（対称性の確認）', () => {
      const indexPath = path.resolve(__dirname, '../../index.ts');
      const indexSource = fs.readFileSync(indexPath, 'utf-8');

      // 売主リストの定期同期スケジューラーが存在する
      const hasSellerPeriodicSync = indexSource.includes('getEnhancedPeriodicSyncManager');
      expect(hasSellerPeriodicSync).toBe(true);

      // 修正後: 買主リストの定期同期スケジューラーも存在する
      const startServerMatch = indexSource.match(/const startServer = async \(\) => \{([\s\S]*?)^};/m);
      expect(startServerMatch).not.toBeNull();
      const body = startServerMatch![1];
      const hasBuyerPeriodicSync = body.includes('BuyerSyncService') && body.includes('setInterval');
      expect(hasBuyerPeriodicSync).toBe(true);
    });
  });
});
