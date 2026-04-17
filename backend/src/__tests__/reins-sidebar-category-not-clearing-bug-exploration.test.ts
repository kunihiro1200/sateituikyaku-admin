/**
 * バグ探索テスト: レインズ登録＋SUUMO登録カテゴリーが消えないバグ
 *
 * Property 1: Bug Condition
 * - SUUMO URL登録後にsidebar_statusが再計算されないバグを確認する
 *
 * 重要: このテストは未修正コードで FAIL することが期待される
 * FAIL = バグの存在を証明する
 *
 * Validates: Requirements 1.1, 1.2
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// .envファイルを読み込む
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { PropertyListingService } from '../services/PropertyListingService';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env file');
}

// テスト用の物件番号（テスト後にロールバックするため一時的な番号を使用）
const TEST_PROPERTY_NUMBER = 'AA13600';

describe('レインズ登録＋SUUMO登録カテゴリー消えないバグ - 探索テスト', () => {
  let service: PropertyListingService;
  let originalSidebarStatus: string | null = null;
  let originalSuumoUrl: string | null = null;

  beforeAll(async () => {
    service = new PropertyListingService();
  });

  afterAll(async () => {
    // テスト後に元の状態に戻す（ロールバック）
    if (originalSidebarStatus !== null || originalSuumoUrl !== null) {
      try {
        await service.update(TEST_PROPERTY_NUMBER, {
          sidebar_status: originalSidebarStatus,
          suumo_url: originalSuumoUrl,
        });
        console.log(`[ロールバック] ${TEST_PROPERTY_NUMBER} を元の状態に戻しました`);
      } catch (e) {
        console.warn(`[ロールバック失敗] ${TEST_PROPERTY_NUMBER}:`, e);
      }
    }
  });

  /**
   * Property 1: Bug Condition
   *
   * isBugCondition: X.sidebar_status = 'レインズ登録＋SUUMO登録'
   *                 AND X.suumo_url IS NOT NULL AND X.suumo_url != ''
   *
   * expectedBehavior: result.sidebar_status != 'レインズ登録＋SUUMO登録'
   *
   * 未修正コードでは FAIL する（バグの存在を証明）
   */
  test(
    'SUUMO URLを登録後、sidebar_statusが「レインズ登録＋SUUMO登録」以外に変わること（未修正コードでFAIL）',
    async () => {
      // ステップ1: テスト対象物件の現在の状態を取得
      const current = await service.getByPropertyNumber(TEST_PROPERTY_NUMBER);

      if (!current) {
        // 物件が存在しない場合はスキップ（テスト環境の問題）
        console.warn(`[スキップ] ${TEST_PROPERTY_NUMBER} が見つかりません`);
        return;
      }

      // 元の状態を保存（ロールバック用）
      originalSidebarStatus = current.sidebar_status;
      originalSuumoUrl = current.suumo_url;

      console.log(`\n--- ${TEST_PROPERTY_NUMBER} の現在の状態 ---`);
      console.log(`  sidebar_status: ${current.sidebar_status}`);
      console.log(`  suumo_url: ${current.suumo_url || '(空)'}`);
      console.log(`  atbb_status: ${current.atbb_status}`);

      // ステップ2: バグ条件を満たす状態にセットアップ
      // sidebar_status = 'レインズ登録＋SUUMO登録' かつ suumo_url が空
      await service.update(TEST_PROPERTY_NUMBER, {
        sidebar_status: 'レインズ登録＋SUUMO登録',
        suumo_url: '',
      });

      // セットアップ後の状態を確認
      const setupState = await service.getByPropertyNumber(TEST_PROPERTY_NUMBER);
      console.log(`\n--- セットアップ後の状態 ---`);
      console.log(`  sidebar_status: ${setupState?.sidebar_status}`);
      console.log(`  suumo_url: ${setupState?.suumo_url || '(空)'}`);

      // バグ条件が成立していることを確認
      expect(setupState?.sidebar_status).toBe('レインズ登録＋SUUMO登録');
      expect(!setupState?.suumo_url || setupState?.suumo_url === '').toBe(true);

      // ステップ3: SUUMO URLを登録する（バグを発現させる操作）
      const testSuumoUrl = 'https://suumo.jp/test/property/12345/';
      console.log(`\n--- SUUMO URL登録: ${testSuumoUrl} ---`);

      const result = await service.update(TEST_PROPERTY_NUMBER, {
        suumo_url: testSuumoUrl,
      });

      console.log(`\n--- update()後の結果 ---`);
      console.log(`  result.sidebar_status: ${result?.sidebar_status}`);
      console.log(`  result.suumo_url: ${result?.suumo_url}`);

      // バグ条件の確認
      // isBugCondition: sidebar_status = 'レインズ登録＋SUUMO登録' AND suumo_url IS NOT NULL AND suumo_url != ''
      const isBugCondition =
        result?.sidebar_status === 'レインズ登録＋SUUMO登録' &&
        result?.suumo_url !== null &&
        result?.suumo_url !== '';

      console.log(`\n--- バグ条件の判定 ---`);
      console.log(`  isBugCondition: ${isBugCondition}`);
      console.log(
        `  sidebar_status === 'レインズ登録＋SUUMO登録': ${result?.sidebar_status === 'レインズ登録＋SUUMO登録'}`
      );
      console.log(`  suumo_url が空でない: ${!!result?.suumo_url && result?.suumo_url !== ''}`);

      if (isBugCondition) {
        console.log(
          `\n🐛 バグ確認: SUUMO URL登録後も sidebar_status が「レインズ登録＋SUUMO登録」のまま`
        );
        console.log(`   反例: update({suumo_url: '${testSuumoUrl}'}) 後も sidebar_status = '${result?.sidebar_status}'`);
        console.log(`   根本原因: PropertyListingService.update() に suumo_url 更新時の sidebar_status 再計算ロジックが存在しない`);
      }

      // 期待動作: SUUMO URL登録後は sidebar_status が「レインズ登録＋SUUMO登録」以外になるべき
      // 未修正コードでは FAIL する（これがバグの証明）
      expect(result?.sidebar_status).not.toBe('レインズ登録＋SUUMO登録');
    },
    30000 // タイムアウト: 30秒
  );
});
