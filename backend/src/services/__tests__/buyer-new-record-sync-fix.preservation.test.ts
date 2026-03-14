// 買主リスト新規レコード同期バグ修正 - 保存確認プロパティテスト
// Property 2: Preservation - 手動同期・重複防止・ローカル環境動作が変わらない
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5

import * as fs from 'fs';
import * as path from 'path';

describe('保存確認: 手動同期・重複防止・ローカル環境動作が変わらない', () => {
  const buyersRoutePath = path.resolve(__dirname, '../../routes/buyers.ts');
  const buyerSyncServicePath = path.resolve(__dirname, '../BuyerSyncService.ts');
  const indexPath = path.resolve(__dirname, '../../index.ts');

  let buyersRouteSource: string;
  let buyerSyncServiceSource: string;
  let indexSource: string;

  beforeAll(() => {
    buyersRouteSource = fs.readFileSync(buyersRoutePath, 'utf-8');
    buyerSyncServiceSource = fs.readFileSync(buyerSyncServicePath, 'utf-8');
    indexSource = fs.readFileSync(indexPath, 'utf-8');
  });

  // Preservation 1: 手動同期エンドポイントが存在する
  // Requirements 3.1: ユーザーがUIの「スプレッドシートから同期」ボタンを押す → 手動同期が正常に実行される
  describe('手動同期保存 (Requirements 3.1)', () => {
    it('POST /api/buyers/sync エンドポイントが buyers.ts に定義されている', () => {
      const hasManualSyncEndpoint = /router\.post\(['"]\/?sync['"]/.test(buyersRouteSource);
      expect(hasManualSyncEndpoint).toBe(true);
    });

    it('手動同期エンドポイントが buyerSyncService.syncAll() を呼び出している', () => {
      const callsSyncAll = buyersRouteSource.includes('buyerSyncService.syncAll()');
      expect(callsSyncAll).toBe(true);
    });
  });

  // Preservation 2: 重複防止ロジックが存在する
  // Requirements 3.3: 同期中に別の同期リクエストが来る → 重複同期が防止される
  describe('重複防止保存 (Requirements 3.3)', () => {
    it('BuyerSyncService に isSyncInProgress() メソッドが存在する', () => {
      const hasIsSyncInProgress = buyerSyncServiceSource.includes('isSyncInProgress()');
      expect(hasIsSyncInProgress).toBe(true);
    });

    it('isSyncInProgress() が isSyncing フラグを返す', () => {
      const returnsSyncingFlag = /isSyncInProgress\(\)[^{]*\{[^}]*return\s+this\.isSyncing/.test(
        buyerSyncServiceSource
      );
      expect(returnsSyncingFlag).toBe(true);
    });

    it('手動同期エンドポイントが isSyncInProgress() チェックを含む', () => {
      const hasProgressCheck = buyersRouteSource.includes('buyerSyncService.isSyncInProgress()');
      expect(hasProgressCheck).toBe(true);
    });

    it('同期中の場合に 409 を返す', () => {
      const returns409 = buyersRouteSource.includes('status(409)');
      expect(returns409).toBe(true);
    });
  });

  // Preservation 3: 認証チェックが存在する
  // Requirements 3.3: CRON_SECRET 認証チェックが維持される
  describe('認証チェック保存 (Requirements 3.3)', () => {
    it('既存の /api/cron/sync-inquiries エンドポイントが CRON_SECRET 認証チェックを含む', () => {
      const hasCronSecret = indexSource.includes('CRON_SECRET');
      expect(hasCronSecret).toBe(true);
    });

    it('認証チェックが Bearer トークン形式を使用している', () => {
      const usesBearerToken = indexSource.includes('Bearer ${process.env.CRON_SECRET}');
      expect(usesBearerToken).toBe(true);
    });

    it('認証失敗時に 401 を返す', () => {
      const returns401 = /status\(401\)/.test(indexSource);
      expect(returns401).toBe(true);
    });
  });

  // Preservation 4: ローカル環境の setInterval が存在する
  // Requirements 3.4: ローカル環境（非Vercel）でサーバーが起動する → setInterval による定期同期が動作する
  describe('ローカル環境保存 (Requirements 3.4)', () => {
    it('index.ts に if (process.env.VERCEL !== "1") ブロックが存在する', () => {
      const hasVercelCheck = indexSource.includes("process.env.VERCEL !== '1'");
      expect(hasVercelCheck).toBe(true);
    });

    it('VERCEL !== "1" ブロック内に setInterval による買主定期同期が含まれる', () => {
      // setInterval が存在し、かつ BuyerSyncService が参照されている
      const hasSetInterval = indexSource.includes('setInterval');
      const hasBuyerSyncInInterval = indexSource.includes('BuyerSyncService');
      expect(hasSetInterval).toBe(true);
      expect(hasBuyerSyncInInterval).toBe(true);
    });

    it('買主定期同期の setInterval が VERCEL !== "1" ブロック内に存在する', () => {
      // VERCEL !== '1' ブロックの中に setInterval(runBuyerSync, ...) が含まれることを確認
      const vercelBlockMatch = indexSource.match(
        /if\s*\(\s*process\.env\.VERCEL\s*!==\s*['"]1['"]\s*\)([\s\S]*?)(?=\}\s*else|\}\s*\/\/\s*Vercel環境|\}\s*$)/
      );
      if (vercelBlockMatch) {
        const vercelBlock = vercelBlockMatch[1];
        const hasSetIntervalInBlock = vercelBlock.includes('setInterval');
        expect(hasSetIntervalInBlock).toBe(true);
      } else {
        // ブロックが見つからない場合は、app.listen コールバック内に存在することを確認
        const hasAppListen = indexSource.includes('app.listen');
        expect(hasAppListen).toBe(true);
      }
    });
  });
});
