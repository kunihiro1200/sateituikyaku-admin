/**
 * Bug Condition 探索テスト: 内覧形態クリック遅延バグ
 *
 * このテストは修正前のコードで FAIL することが期待される（バグの存在を証明）
 * テストが失敗しても、テストやコードを修正しないこと
 *
 * バグ: 買主リストの「内覧形態」フィールドをクリックすると約5秒の遅延が発生する
 *
 * 根本原因:
 * - BuyerService.updateWithSync() の冒頭で await this.initSyncServices() が呼ばれる
 * - Vercel コールドスタート時は this.writeService が null のため
 *   sheetsClient.authenticate() → auth.authorize() が実行される
 * - この JWT 認証処理が約5秒かかり、UI がフリーズする
 *
 * Bug_Condition: isBugCondition(input)
 *   = input.fieldName IN ['viewing_mobile', 'viewing_type_general']
 *     AND this.writeService IS NULL（コールドスタート後の初回リクエスト）
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 */

import { createClient } from '@supabase/supabase-js';
import { BuyerService } from '../services/BuyerService';
import { GoogleSheetsClient } from '../services/GoogleSheetsClient';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// 環境変数を読み込み
const envPaths = [
  path.join(__dirname, '../../.env'),
  path.join(__dirname, '../../.env.local'),
  path.join(__dirname, '../../.env.production'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

// ===== モック設定 =====
// sheetsClient.authenticate() を5秒遅延するモックに差し替える
// これにより Vercel コールドスタート時の認証遅延を再現する

const MOCK_AUTH_DELAY_MS = 5000; // 5秒遅延（本番環境の認証遅延を模倣）
const ACCEPTABLE_RESPONSE_TIME_MS = 1000; // 期待される応答時間（1秒以内）

// GoogleSheetsClient をモック化
jest.mock('../services/GoogleSheetsClient', () => {
  return {
    GoogleSheetsClient: jest.fn().mockImplementation(() => {
      return {
        authenticate: jest.fn().mockImplementation(async () => {
          // 5秒遅延して認証を模倣（コールドスタート時の JWT 認証遅延を再現）
          console.log(`[Mock] sheetsClient.authenticate() 開始 - ${MOCK_AUTH_DELAY_MS}ms 遅延`);
          await new Promise(resolve => setTimeout(resolve, MOCK_AUTH_DELAY_MS));
          console.log(`[Mock] sheetsClient.authenticate() 完了`);
        }),
        getSheetData: jest.fn().mockResolvedValue([]),
        updateCell: jest.fn().mockResolvedValue(undefined),
        updateCells: jest.fn().mockResolvedValue(undefined),
        batchUpdate: jest.fn().mockResolvedValue(undefined),
        getSpreadsheetId: jest.fn().mockReturnValue('mock-spreadsheet-id'),
        getSheetName: jest.fn().mockReturnValue('買主リスト'),
      };
    }),
  };
});

// BuyerWriteService をモック化（認証後の書き込み処理）
jest.mock('../services/BuyerWriteService', () => {
  return {
    BuyerWriteService: jest.fn().mockImplementation(() => {
      return {
        updateFields: jest.fn().mockResolvedValue({ success: true }),
      };
    }),
  };
});

// ConflictResolver をモック化
jest.mock('../services/ConflictResolver', () => {
  return {
    ConflictResolver: jest.fn().mockImplementation(() => {
      return {
        checkConflict: jest.fn().mockResolvedValue({ hasConflict: false, conflicts: [] }),
      };
    }),
  };
});

// RetryHandler をモック化
jest.mock('../services/RetryHandler', () => {
  return {
    RetryHandler: jest.fn().mockImplementation(() => {
      return {
        executeWithRetry: jest.fn().mockResolvedValue({ success: true, attempts: 1 }),
        queueFailedChange: jest.fn().mockResolvedValue(undefined),
      };
    }),
  };
});

// BuyerColumnMapper をモック化
jest.mock('../services/BuyerColumnMapper', () => {
  return {
    BuyerColumnMapper: jest.fn().mockImplementation(() => {
      return {
        mapDatabaseToSpreadsheet: jest.fn().mockReturnValue({}),
        mapSpreadsheetToDatabase: jest.fn().mockReturnValue({}),
      };
    }),
  };
});

// AuditLogService をモック化
jest.mock('../services/AuditLogService', () => {
  return {
    AuditLogService: {
      logFieldUpdate: jest.fn().mockResolvedValue(undefined),
    },
  };
});

// Supabase をモック化（DB 操作）
jest.mock('@supabase/supabase-js', () => {
  const mockBuyerData = {
    id: 'test-buyer-uuid-001',
    buyer_id: 'test-buyer-uuid-001',
    buyer_number: 9999,
    name: 'テスト買主',
    viewing_mobile: '訪問',
    viewing_type_general: 'オンライン',
    last_synced_at: null, // 競合チェックをスキップするため null
    db_updated_at: new Date().toISOString(),
    deleted_at: null,
    // calculateBuyerStatus に必要なフィールド
    latest_status: null,
    reception_date: null,
    viewing_date: null,
    desired_timing: null,
    assignee: null,
    follow_up_assignee: null,
    broker_inquiry: null,
  };

  // クエリビルダーのモック（チェーン可能）
  const createQueryBuilder = (resolveData: any) => {
    const builder: any = {
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: resolveData, error: null }),
    };
    // 自己参照を設定
    builder.eq.mockReturnValue(builder);
    builder.is.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.update.mockReturnValue(builder);
    return builder;
  };

  const mockFrom = jest.fn().mockImplementation((table: string) => {
    return createQueryBuilder(mockBuyerData);
  });

  return {
    createClient: jest.fn().mockReturnValue({
      from: mockFrom,
    }),
  };
});

// ===== テスト =====

describe('Bug Condition 探索テスト: 内覧形態クリック遅延バグ', () => {
  let buyerService: BuyerService;

  beforeEach(() => {
    // 各テスト前に BuyerService を新規インスタンス化
    // this.writeService = null（コールドスタート状態）を再現
    buyerService = new BuyerService();

    // コールドスタート状態を確認（writeService が null であること）
    // @ts-ignore: private プロパティへのアクセス（テスト目的）
    expect(buyerService['writeService']).toBeNull();
    console.log('[Setup] BuyerService 新規インスタンス作成 - writeService = null（コールドスタート状態）');
  });

  /**
   * Bug Condition 1.1: viewing_mobile フィールドの更新で5秒以上かかることを確認
   *
   * 修正前のコード: updateWithSync() 冒頭で await this.initSyncServices() が呼ばれ、
   * sheetsClient.authenticate() の5秒遅延がブロッキングで実行される
   *
   * 期待される結果（修正前）: テストが FAIL する（応答時間が5秒以上かかる）
   * 期待される結果（修正後）: テストが PASS する（応答時間が1秒以内）
   */
  test('Bug Condition 1.1: viewing_mobile 更新時に応答時間が1秒以内であること（修正前は FAIL）', async () => {
    console.log('\n[Bug Condition Test 1.1] viewing_mobile フィールドの更新テスト');
    console.log(`[Setup] this.writeService = null（コールドスタート状態）`);
    console.log(`[Setup] sheetsClient.authenticate() は ${MOCK_AUTH_DELAY_MS}ms 遅延するモック`);
    console.log(`[期待] 応答時間 < ${ACCEPTABLE_RESPONSE_TIME_MS}ms`);
    console.log(`[修正前の動作] 応答時間 >= ${MOCK_AUTH_DELAY_MS}ms（認証がブロッキングで実行されるため）`);

    const startTime = Date.now();

    // viewing_mobile フィールドの更新リクエスト（内覧形態クリックを模倣）
    const result = await buyerService.updateWithSync(
      'test-buyer-uuid-001',
      { viewing_mobile: '訪問' },
      'user-001',
      'test@example.com'
    );

    const elapsedMs = Date.now() - startTime;
    console.log(`\n[結果] 応答時間: ${elapsedMs}ms`);
    console.log(`[結果] syncResult:`, JSON.stringify(result.syncResult, null, 2));

    if (elapsedMs >= MOCK_AUTH_DELAY_MS) {
      console.log(`\n❌ バグ確認: 応答時間 ${elapsedMs}ms >= ${MOCK_AUTH_DELAY_MS}ms`);
      console.log(`   → initSyncServices() の認証処理がブロッキングで実行されている`);
      console.log(`   → カウンターエグザンプル: updateWithSync({fieldName: 'viewing_mobile', ...}) が ${elapsedMs}ms かかった`);
    } else {
      console.log(`\n✓ 応答時間 ${elapsedMs}ms < ${MOCK_AUTH_DELAY_MS}ms`);
    }

    // このアサーションは修正前のコードで FAIL する（バグの存在を証明）
    // 修正後のコードでは PASS する（DB 更新後に即座にレスポンスを返すため）
    expect(elapsedMs).toBeLessThan(ACCEPTABLE_RESPONSE_TIME_MS);
  }, 15000); // タイムアウト: 15秒（モック遅延5秒 + バッファ）

  /**
   * Bug Condition 1.2: viewing_type_general フィールドの更新で5秒以上かかることを確認
   *
   * 修正前のコード: updateWithSync() 冒頭で await this.initSyncServices() が呼ばれ、
   * sheetsClient.authenticate() の5秒遅延がブロッキングで実行される
   *
   * 期待される結果（修正前）: テストが FAIL する（応答時間が5秒以上かかる）
   * 期待される結果（修正後）: テストが PASS する（応答時間が1秒以内）
   */
  test('Bug Condition 1.2: viewing_type_general 更新時に応答時間が1秒以内であること（修正前は FAIL）', async () => {
    console.log('\n[Bug Condition Test 1.2] viewing_type_general フィールドの更新テスト');
    console.log(`[Setup] this.writeService = null（コールドスタート状態）`);
    console.log(`[Setup] sheetsClient.authenticate() は ${MOCK_AUTH_DELAY_MS}ms 遅延するモック`);
    console.log(`[期待] 応答時間 < ${ACCEPTABLE_RESPONSE_TIME_MS}ms`);
    console.log(`[修正前の動作] 応答時間 >= ${MOCK_AUTH_DELAY_MS}ms（認証がブロッキングで実行されるため）`);

    const startTime = Date.now();

    // viewing_type_general フィールドの更新リクエスト（内覧形態_一般媒介クリックを模倣）
    const result = await buyerService.updateWithSync(
      'test-buyer-uuid-001',
      { viewing_type_general: 'オンライン' },
      'user-001',
      'test@example.com'
    );

    const elapsedMs = Date.now() - startTime;
    console.log(`\n[結果] 応答時間: ${elapsedMs}ms`);
    console.log(`[結果] syncResult:`, JSON.stringify(result.syncResult, null, 2));

    if (elapsedMs >= MOCK_AUTH_DELAY_MS) {
      console.log(`\n❌ バグ確認: 応答時間 ${elapsedMs}ms >= ${MOCK_AUTH_DELAY_MS}ms`);
      console.log(`   → initSyncServices() の認証処理がブロッキングで実行されている`);
      console.log(`   → カウンターエグザンプル: updateWithSync({fieldName: 'viewing_type_general', ...}) が ${elapsedMs}ms かかった`);
    } else {
      console.log(`\n✓ 応答時間 ${elapsedMs}ms < ${MOCK_AUTH_DELAY_MS}ms`);
    }

    // このアサーションは修正前のコードで FAIL する（バグの存在を証明）
    // 修正後のコードでは PASS する（DB 更新後に即座にレスポンスを返すため）
    expect(elapsedMs).toBeLessThan(ACCEPTABLE_RESPONSE_TIME_MS);
  }, 15000); // タイムアウト: 15秒（モック遅延5秒 + バッファ）

  /**
   * Bug Condition 1.3: コールドスタート状態（this.writeService = null）で
   * initSyncServices() が認証処理を実行することを確認
   *
   * このテストはバグの根本原因を直接確認する
   */
  test('Bug Condition 1.3: コールドスタート状態で initSyncServices() が認証処理をブロッキング実行することを確認', async () => {
    console.log('\n[Bug Condition Test 1.3] コールドスタート状態での認証ブロッキング確認');

    // @ts-ignore: private プロパティへのアクセス（テスト目的）
    expect(buyerService['writeService']).toBeNull();
    console.log('[確認] this.writeService = null（コールドスタート状態）');

    const startTime = Date.now();

    // updateWithSync() を呼び出す（内部で initSyncServices() が呼ばれる）
    await buyerService.updateWithSync(
      'test-buyer-uuid-001',
      { viewing_mobile: '訪問' },
      'user-001',
      'test@example.com'
    );

    const elapsedMs = Date.now() - startTime;
    console.log(`[結果] 応答時間: ${elapsedMs}ms`);

    // GoogleSheetsClient のコンストラクタが呼ばれたことを確認
    const { GoogleSheetsClient: MockGoogleSheetsClient } = require('../services/GoogleSheetsClient');
    console.log(`[確認] GoogleSheetsClient コンストラクタ呼び出し回数: ${MockGoogleSheetsClient.mock.calls.length}`);

    // authenticate() が呼ばれたことを確認（バグの根本原因）
    const mockInstance = MockGoogleSheetsClient.mock.results[0]?.value;
    if (mockInstance) {
      const authenticateCalls = mockInstance.authenticate.mock.calls.length;
      console.log(`[確認] authenticate() 呼び出し回数: ${authenticateCalls}`);

      // 修正前のコードでは authenticate() が呼ばれる（ブロッキング認証）
      // 修正後のコードでは authenticate() は setImmediate 内で非同期実行される
      if (authenticateCalls > 0) {
        console.log(`\n❌ バグ確認: authenticate() が updateWithSync() 内でブロッキング実行された`);
        console.log(`   → 応答時間 ${elapsedMs}ms（認証遅延 ${MOCK_AUTH_DELAY_MS}ms を含む）`);
      }
    }

    // 修正前のコードでは応答時間が MOCK_AUTH_DELAY_MS 以上になる
    // このアサーションは修正前のコードで FAIL する
    expect(elapsedMs).toBeLessThan(ACCEPTABLE_RESPONSE_TIME_MS);
  }, 15000);
});
