// 買主リスト新規レコード同期バグ修正 - バグ条件探索テスト
// Property 1: Bug Condition - Cron エンドポイント不在による定期同期の欠如
// Validates: Requirements 1.1, 1.2

import * as fs from 'fs';
import * as path from 'path';

describe('バグ条件探索: Cron エンドポイント不在による定期同期の欠如', () => {
  const indexPath = path.resolve(__dirname, '../../index.ts');
  let indexSource: string;

  beforeAll(() => {
    indexSource = fs.readFileSync(indexPath, 'utf-8');
  });

  it('Bug Condition: /api/cron/buyer-sync エンドポイントが index.ts に存在しない', () => {
    const hasBuyerSyncEndpoint = indexSource.includes('/api/cron/buyer-sync');
    expect(hasBuyerSyncEndpoint).toBe(true);
  });

  it('Bug Condition: /api/cron/work-task-sync エンドポイントが index.ts に存在しない', () => {
    const hasWorkTaskSyncEndpoint = indexSource.includes('/api/cron/work-task-sync');
    expect(hasWorkTaskSyncEndpoint).toBe(true);
  });

  it('Bug Condition: BuyerSyncService の Cron エンドポイントが app.get として定義されていない', () => {
    const cronEndpointDefined = /app\.get\(['"]\/?api\/cron\/buyer-sync['"]/.test(indexSource);
    expect(cronEndpointDefined).toBe(true);
  });
});