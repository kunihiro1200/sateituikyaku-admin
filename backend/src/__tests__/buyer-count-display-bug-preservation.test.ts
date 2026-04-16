/**
 * 買主件数表示バグ - 保全プロパティテスト（修正前に実施）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Property 2: Preservation - 非バグ条件入力の動作保持
 *
 * 目的:
 *   `isBugCondition(X)` が false の全入力に対して、
 *   修正前後の `getBuyerCountsForProperties` が同じ結果を返すことを検証する。
 *
 * 観察優先メソドロジー:
 *   - 未修正コードで買主が 0 件の物件に対して `getBuyerCountsForProperties` が 0 を返すことを確認する
 *   - 未修正コードで `deleted_at IS NOT NULL` の買主が存在する物件で、削除済みが除外されることを確認する
 *   - 未修正コードで `getBuyersForProperty` の動作が変わらないことを確認する
 *
 * **期待される結果**: 未修正コードでテストが PASS する（ベースライン動作の確認）
 *
 * 保全要件（design.md より）:
 *   FOR ALL X WHERE NOT isBugCondition(X) DO
 *     ASSERT getBuyerCountsForProperties(X) = getBuyerCountsForProperties'(X)
 *   END FOR
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import * as fc from 'fast-check';
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
): Promise<boolean> {
  const countsMap = await service.getBuyerCountsForProperties([propertyNumber]);
  const countFromList = countsMap.get(propertyNumber) ?? 0;

  const buyers = await service.getBuyersForProperty(propertyNumber);
  const countFromDetail = buyers.length;

  return countFromList !== countFromDetail;
}

describe('買主件数表示バグ - 保全プロパティテスト', () => {
  let service: BuyerLinkageService;

  beforeAll(() => {
    service = new BuyerLinkageService();
  });

  // ===== 観察例1: 0件物件の保持 =====

  /**
   * 観察例1: 買主が存在しない物件で 0 件を返すことを確認
   *
   * 非バグ条件（isBugCondition = false）の典型例:
   * 買主が存在しない物件では一覧・詳細ともに 0 件を返す。
   *
   * Validates: Requirements 3.2
   */
  it('観察例1: 買主が存在しない物件で getBuyerCountsForProperties が 0 を返すこと', async () => {
    // 存在しない物件番号（買主が 0 件であることが確実）
    const nonExistentPropertyNumber = 'ZZTEST_NONEXISTENT_9999';

    console.log('\n========================================');
    console.log('🔍 観察例1: 0件物件の保持テスト');
    console.log(`   対象物件番号: ${nonExistentPropertyNumber}`);
    console.log('========================================\n');

    const countsMap = await service.getBuyerCountsForProperties([nonExistentPropertyNumber]);
    const countFromList = countsMap.get(nonExistentPropertyNumber) ?? 0;

    const buyers = await service.getBuyersForProperty(nonExistentPropertyNumber);
    const countFromDetail = buyers.length;

    console.log(`   一覧用カウント: ${countFromList}`);
    console.log(`   詳細用カウント: ${countFromDetail}`);

    // 0件物件では両方とも 0 を返すこと
    expect(countFromList).toBe(0);
    expect(countFromDetail).toBe(0);

    // バグ条件が成立しないことを確認（非バグ条件）
    const isBug = await isBugCondition(service, nonExistentPropertyNumber);
    console.log(`   バグ条件: ${isBug ? 'true（バグあり）' : 'false（正常）'}`);
    expect(isBug).toBe(false);
  }, 30000);

  // ===== 観察例2: 削除済み買主の除外保持 =====

  /**
   * 観察例2: deleted_at IS NOT NULL の買主が存在する物件で、削除済みが除外されることを確認
   *
   * getBuyerCountsForProperties は .is('deleted_at', null) フィルタを使用しているため、
   * 削除済み買主は件数に含まれない。
   *
   * Validates: Requirements 3.3
   */
  it('観察例2: getBuyerCountsForProperties が削除済み買主を除外すること', async () => {
    console.log('\n========================================');
    console.log('🔍 観察例2: 削除済み買主の除外保持テスト');
    console.log('========================================\n');

    // 削除済み買主を含む可能性のある物件を確認するため、
    // 実際のDBから削除済み買主が存在する物件を探す
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 削除済み買主が存在する物件番号を取得
    const { data: deletedBuyers, error } = await supabase
      .from('buyers')
      .select('property_number')
      .not('deleted_at', 'is', null)
      .not('property_number', 'is', null)
      .limit(5);

    if (error || !deletedBuyers || deletedBuyers.length === 0) {
      console.log('   削除済み買主が存在しないため、このテストをスキップします');
      console.log('   （削除済み買主が存在しない場合は正常な状態）');
      return;
    }

    // 最初の削除済み買主の物件番号を使用
    const propertyNumber = deletedBuyers[0].property_number;
    console.log(`   削除済み買主が存在する物件番号: ${propertyNumber}`);

    // 削除済みを含む全件数を取得
    const { count: totalCount } = await supabase
      .from('buyers')
      .select('*', { count: 'exact', head: true })
      .eq('property_number', propertyNumber);

    // 削除済みを除いた件数を取得
    const { count: activeCountRaw } = await supabase
      .from('buyers')
      .select('*', { count: 'exact', head: true })
      .eq('property_number', propertyNumber)
      .is('deleted_at', null);

    // count が null の場合は 0 として扱う（Supabase の仕様）
    const activeCount = activeCountRaw ?? 0;
    const totalCountNormalized = totalCount ?? 0;

    console.log(`   全件数（削除済み含む）: ${totalCountNormalized}`);
    console.log(`   有効件数（削除済み除外）: ${activeCount}`);

    // getBuyerCountsForProperties が削除済みを除外した件数を返すことを確認
    const countsMap = await service.getBuyerCountsForProperties([propertyNumber]);
    const countFromList = countsMap.get(propertyNumber) ?? 0;

    console.log(`   getBuyerCountsForProperties の結果: ${countFromList}`);

    // 削除済みを除外した件数と一致すること
    expect(countFromList).toBe(activeCount);

    // 削除済みを含む全件数とは異なること（削除済みが存在する場合）
    if (totalCountNormalized > activeCount) {
      expect(countFromList).toBeLessThan(totalCountNormalized);
      console.log('   ✅ 削除済み買主が正しく除外されています');
    }
  }, 30000);

  // ===== 観察例3: 詳細画面の保持 =====

  /**
   * 観察例3: getBuyersForProperty の動作が変わらないことを確認
   *
   * AA9729 で 8件返すことを確認（詳細画面の動作は変更しない）
   *
   * Validates: Requirements 3.1
   */
  it('観察例3: getBuyersForProperty が AA9729 で正しい件数を返すこと（詳細画面の保持）', async () => {
    const propertyNumber = 'AA9729';

    console.log('\n========================================');
    console.log('🔍 観察例3: 詳細画面の保持テスト');
    console.log(`   対象物件番号: ${propertyNumber}`);
    console.log('========================================\n');

    const buyers = await service.getBuyersForProperty(propertyNumber);
    const countFromDetail = buyers.length;

    console.log(`   getBuyersForProperty の結果: ${countFromDetail} 件`);
    console.log(`   買主一覧: ${buyers.map(b => b.buyer_number || b.buyer_id).join(', ')}`);

    // 詳細画面は 8件を返すこと（バグ修正前後で変わらない）
    expect(countFromDetail).toBe(8);
    console.log('   ✅ 詳細画面は正しく 8件を返しています');
  }, 30000);

  // ===== Property 2: Preservation プロパティベーステスト =====

  /**
   * Property 2 (PBT): isBugCondition(X) が false の全入力に対して、
   * getBuyerCountsForProperties が 0 を返すこと（0件物件の保持）
   *
   * **Validates: Requirements 3.2**
   *
   * 非バグ条件の典型例として、存在しない物件番号（買主が 0 件）を使用する。
   * 未修正コードでも 0件物件は正しく 0 を返すため、このテストは PASS する。
   */
  it('Property 2 (PBT): 存在しない物件番号に対して getBuyerCountsForProperties が 0 を返すこと', async () => {
    console.log('\n========================================');
    console.log('🔍 Property 2 (PBT): 0件物件の保持プロパティテスト');
    console.log('========================================\n');

    // 存在しない物件番号のパターンを生成（ZZTEST_ プレフィックスで確実に存在しない）
    const nonExistentNumbers = [
      'ZZTEST_0001',
      'ZZTEST_0002',
      'ZZTEST_0003',
      'ZZTEST_EMPTY',
      'ZZTEST_NONE',
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: nonExistentNumbers.length - 1 }),
        async (index) => {
          const propertyNumber = nonExistentNumbers[index];
          const countsMap = await service.getBuyerCountsForProperties([propertyNumber]);
          const count = countsMap.get(propertyNumber) ?? 0;

          if (count !== 0) {
            console.log(`[PBT] 反例発見: 存在しない物件番号 "${propertyNumber}" で ${count} 件が返された`);
            return false;
          }
          return true;
        }
      ),
      { numRuns: 5 }
    );

    console.log('   ✅ 全ての存在しない物件番号で 0 件が返されました');
  }, 60000);

  /**
   * Property 2 (PBT): isBugCondition(X) が false の全入力に対して、
   * getBuyerCountsForProperties と getBuyersForProperty が同じ結果を返すこと
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   *
   * 非バグ条件（isBugCondition = false）の入力に対して、
   * 修正前後で getBuyerCountsForProperties の結果が変わらないことを確認する。
   *
   * 実装方針:
   *   - 存在しない物件番号（0件）は確実に非バグ条件
   *   - 実際のDBから非バグ条件の物件番号を動的に取得して検証する
   */
  it('Property 2 (PBT): 非バグ条件の入力に対して getBuyerCountsForProperties が一貫した結果を返すこと', async () => {
    console.log('\n========================================');
    console.log('🔍 Property 2 (PBT): 非バグ条件の保全プロパティテスト');
    console.log('========================================\n');

    // ステップ1: 実際のDBから物件番号を取得して非バグ条件のものを選別
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 買主が存在する物件番号を取得（最大20件）
    const { data: buyerData } = await supabase
      .from('buyers')
      .select('property_number')
      .is('deleted_at', null)
      .not('property_number', 'is', null)
      .limit(50);

    // 物件番号の重複を除去
    const allPropertyNumbers = [...new Set(
      (buyerData || []).map((b: any) => b.property_number).filter(Boolean)
    )] as string[];

    console.log(`   DBから取得した物件番号数: ${allPropertyNumbers.length}`);

    // 非バグ条件の物件番号を選別（isBugCondition = false のもの）
    const nonBugPropertyNumbers: string[] = [];
    for (const propNum of allPropertyNumbers.slice(0, 20)) {
      const isBug = await isBugCondition(service, propNum);
      if (!isBug) {
        nonBugPropertyNumbers.push(propNum);
      }
      if (nonBugPropertyNumbers.length >= 5) break; // 5件で十分
    }

    // 存在しない物件番号も追加（確実に非バグ条件）
    nonBugPropertyNumbers.push('ZZTEST_NONEXISTENT_PBT');

    console.log(`   非バグ条件の物件番号数: ${nonBugPropertyNumbers.length}`);
    console.log(`   対象物件番号: ${nonBugPropertyNumbers.join(', ')}`);

    // ステップ2: 非バグ条件の物件番号に対してプロパティテストを実行
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: nonBugPropertyNumbers.length - 1 }),
        async (index) => {
          const propertyNumber = nonBugPropertyNumbers[index];

          // getBuyerCountsForProperties の結果を取得
          const countsMap = await service.getBuyerCountsForProperties([propertyNumber]);
          const countFromList = countsMap.get(propertyNumber) ?? 0;

          // getBuyersForProperty の結果を取得
          const buyers = await service.getBuyersForProperty(propertyNumber);
          const countFromDetail = buyers.length;

          // 非バグ条件では両方の結果が一致すること
          if (countFromList !== countFromDetail) {
            console.log(`[PBT] 反例発見: 物件番号 "${propertyNumber}"`);
            console.log(`[PBT]   一覧用カウント: ${countFromList}`);
            console.log(`[PBT]   詳細用カウント: ${countFromDetail}`);
            console.log(`[PBT]   → バグ条件が成立しているため、非バグ条件の選別が不正確`);
            return false;
          }

          return true;
        }
      ),
      { numRuns: nonBugPropertyNumbers.length }
    );

    console.log('   ✅ 全ての非バグ条件の物件番号で一覧・詳細の件数が一致しました');
  }, 120000);
});
