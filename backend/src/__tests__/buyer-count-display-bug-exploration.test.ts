/**
 * 買主件数表示バグ - バグ条件探索テスト
 *
 * **Validates: Requirements 1.1, 1.3**
 *
 * Property 1: Bug Condition - 買主件数の一覧・詳細不一致バグ
 *
 * バグの本質:
 *   `getBuyerCountsForProperties(['AA9729'])` が返す件数と
 *   `getBuyersForProperty('AA9729').length` が返す件数が一致しない。
 *
 *   一覧画面: 「👥 2」と表示
 *   詳細画面: 「買主リスト (8件)」と表示
 *
 * 根本原因の仮説:
 *   `getBuyerCountsForProperties` は全 buyers レコードを取得してアプリケーション側で集計するが、
 *   `getBuyersForProperty` は `.eq('property_number', propertyNumber)` で直接フィルタリングする。
 *   この2つのロジックの不整合により件数が異なる。
 *
 * **CRITICAL**: このテストは未修正コードで FAIL する必要がある — 失敗がバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードする — 修正後にパスすることで修正を検証する
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { BuyerLinkageService } from '../services/BuyerLinkageService';

// 環境変数を読み込む
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../.env.local'),
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please check backend/.env file.\n' +
    `SUPABASE_URL: ${process.env.SUPABASE_URL ? 'SET' : 'NOT SET'}\n` +
    `SUPABASE_SERVICE_KEY: ${process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'NOT SET'}`
  );
}

/**
 * isBugCondition: 一覧用カウントと詳細用カウントが異なる場合 true
 */
async function isBugCondition(
  service: BuyerLinkageService,
  propertyNumber: string
): Promise<{ isBug: boolean; countFromList: number; countFromDetail: number }> {
  const countsMap = await service.getBuyerCountsForProperties([propertyNumber]);
  const countFromList = countsMap.get(propertyNumber) ?? 0;

  const buyers = await service.getBuyersForProperty(propertyNumber);
  const countFromDetail = buyers.length;

  return {
    isBug: countFromList !== countFromDetail,
    countFromList,
    countFromDetail,
  };
}

describe('買主件数表示バグ - バグ条件探索', () => {
  let service: BuyerLinkageService;

  beforeAll(() => {
    service = new BuyerLinkageService();
  });

  /**
   * Property 1: Bug Condition - AA9729 の一覧・詳細件数不一致
   *
   * **Validates: Requirements 1.1, 1.3**
   *
   * `getBuyerCountsForProperties(['AA9729'])` の結果と
   * `getBuyersForProperty('AA9729').length` を比較する。
   *
   * **CRITICAL**: このアサーションは未修正コードで FAIL する
   * 期待される動作（修正後）: countFromList === countFromDetail
   * 未修正コードでは: countFromList ≠ countFromDetail → FAIL
   */
  it('Property 1: getBuyerCountsForProperties と getBuyersForProperty の件数が一致すること（バグ条件）', async () => {
    const propertyNumber = 'AA9729';

    console.log('\n========================================');
    console.log('🔍 バグ条件探索テスト開始: 買主件数の一覧・詳細不一致');
    console.log(`   対象物件番号: ${propertyNumber}`);
    console.log('========================================\n');

    // ステップ1: 一覧用カウントを取得
    console.log('📊 ステップ1: getBuyerCountsForProperties を呼び出す');
    const countsMap = await service.getBuyerCountsForProperties([propertyNumber]);
    const countFromList = countsMap.get(propertyNumber) ?? 0;
    console.log(`   一覧用カウント: ${countFromList}`);

    // ステップ2: 詳細用カウントを取得
    console.log('\n📊 ステップ2: getBuyersForProperty を呼び出す');
    const buyers = await service.getBuyersForProperty(propertyNumber);
    const countFromDetail = buyers.length;
    console.log(`   詳細用カウント: ${countFromDetail}`);

    // ステップ3: バグ条件の確認
    const bugResult = await isBugCondition(service, propertyNumber);
    console.log(`\n🚨 ステップ3: バグ条件 (isBugCondition): ${bugResult.isBug}`);

    if (bugResult.isBug) {
      console.log('   ❌ バグ確認: 一覧と詳細の件数が一致しません（バグあり）');
      console.log(`   → 一覧用: ${bugResult.countFromList} 件`);
      console.log(`   → 詳細用: ${bugResult.countFromDetail} 件`);
      console.log('   → 根本原因: getBuyerCountsForProperties の集計ロジックが');
      console.log('              getBuyersForProperty と異なるクエリを使用している');
    } else {
      console.log('   ✅ 一覧と詳細の件数が一致しています（バグなし）');
    }

    console.log('\n========================================');
    console.log('📋 テスト結果サマリー:');
    console.log(`   物件番号: ${propertyNumber}`);
    console.log(`   一覧用カウント (getBuyerCountsForProperties): ${countFromList}`);
    console.log(`   詳細用カウント (getBuyersForProperty.length): ${countFromDetail}`);
    console.log(`   バグ条件: ${bugResult.isBug ? '✅ 確認（件数不一致）' : '❌ 未確認（件数一致）'}`);
    console.log('========================================\n');

    // **CRITICAL**: このアサーションは未修正コードで FAIL する
    // 期待される動作（修正後）: 一覧と詳細の件数が一致する
    // 未修正コードでは: countFromList ≠ countFromDetail → FAIL
    expect(countFromList).toBe(countFromDetail);
  }, 30000);
});
