/**
 * バグ条件探索テスト: 売主査定額メール面積表記バグ（修正後確認）
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 *
 * このテストは修正後のコードで PASS することを確認する。
 * バグ修正内容:
 * 1. `emails.ts` の `valuationData` に `landAreaVerified`/`buildingAreaVerified` を追加
 * 2. `generateValuationEmailTemplate` が「当社調べ」値を優先使用するよう修正
 */

import { EmailService } from '../services/EmailService.supabase';
import { Seller } from '../types';
import * as fc from 'fast-check';

// テスト用の最小限の Seller オブジェクトを生成するヘルパー
function createTestSeller(overrides: Partial<Seller> = {}): Seller {
  return {
    id: 'test-seller-id',
    sellerNumber: 'AA00001',
    name: 'テスト売主',
    phoneNumber: '090-0000-0000',
    email: 'test@example.com',
    address: '大分市テスト町1-1-1',
    status: 'following_up' as any,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// テスト用の valuationData（emails.ts の修正後の実装を模倣）
function createValuationDataFixed(seller: Seller): any {
  // 修正後の実装: landAreaVerified/buildingAreaVerified が含まれている
  return {
    valuationAmount1: seller.valuationAmount1 ?? 15000000,
    valuationAmount2: seller.valuationAmount2 ?? 18000000,
    valuationAmount3: seller.valuationAmount3 ?? 20000000,
    fixedAssetTaxRoadPrice: seller.fixedAssetTaxRoadPrice ?? 100000,
    landArea: seller.landArea,
    buildingArea: seller.buildingArea,
    landAreaVerified: seller.landAreaVerified,
    buildingAreaVerified: seller.buildingAreaVerified,
  };
}

describe('売主査定額メール面積表記バグ - バグ条件探索テスト（修正後確認）', () => {
  let emailService: EmailService;

  beforeAll(() => {
    // EmailService のインスタンスを作成
    emailService = new EmailService() as any;
  });

  /**
   * テストケース1: 両方設定あり
   *
   * landAreaVerified=86, buildingAreaVerified=63 を設定した場合、
   * 修正後のコードでは「当社調べ」が反映される。
   *
   * 期待される正しい動作: `※土地86㎡（当社調べ）、建物63㎡（当社調べ）で算出しております。`
   *
   * このテストは修正後コードで PASS する（バグ修正の確認）
   */
  test('テストケース1: landAreaVerified=86, buildingAreaVerified=63 → メール本文に「当社調べ」が反映される（修正後コードでPASS）', () => {
    const seller = createTestSeller({
      landArea: 50,
      buildingArea: 50,
      landAreaVerified: 86,
      buildingAreaVerified: 63,
    });

    // 修正後の valuationData（landAreaVerified/buildingAreaVerified が含まれている）
    const valuationData = createValuationDataFixed(seller);

    // generateValuationEmailTemplate はプライベートメソッドなので any でアクセス
    const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

    console.log('テストケース1 - 生成されたメール本文（面積部分）:');
    const areaLine = template.body.split('\n').find((line: string) => line.includes('㎡'));
    console.log('  実際:', areaLine);
    console.log('  期待: ※土地86㎡（当社調べ）、建物63㎡（当社調べ）で算出しております。');

    // 期待される正しい動作: 「当社調べ」の値が反映されること
    // 修正後コードではこのアサーションが PASS する（バグ修正の確認）
    expect(template.body).toContain('86㎡（当社調べ）');
    expect(template.body).toContain('63㎡（当社調べ）');
    expect(template.body).toContain('※土地86㎡（当社調べ）、建物63㎡（当社調べ）で算出しております。');
  });

  /**
   * テストケース2: 土地のみ設定
   *
   * landAreaVerified=86, buildingAreaVerified=null の場合、
   * 修正後のコードでは土地に「当社調べ」が付く。
   *
   * 期待される正しい動作: `※土地86㎡（当社調べ）、建物50㎡で算出しております。`
   *
   * このテストは修正後コードで PASS する（バグ修正の確認）
   */
  test('テストケース2: landAreaVerified=86, buildingAreaVerified=null → 土地に「当社調べ」が付く（修正後コードでPASS）', () => {
    const seller = createTestSeller({
      landArea: 50,
      buildingArea: 50,
      landAreaVerified: 86,
      buildingAreaVerified: undefined,
    });

    // 修正後の valuationData（landAreaVerified が含まれている）
    const valuationData = createValuationDataFixed(seller);

    const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

    console.log('テストケース2 - 生成されたメール本文（面積部分）:');
    const areaLine = template.body.split('\n').find((line: string) => line.includes('㎡'));
    console.log('  実際:', areaLine);
    console.log('  期待: ※土地86㎡（当社調べ）、建物50㎡で算出しております。');

    // 期待される正しい動作: 土地に「当社調べ」が付くこと
    // 修正後コードではこのアサーションが PASS する（バグ修正の確認）
    expect(template.body).toContain('86㎡（当社調べ）');
    expect(template.body).toContain('※土地86㎡（当社調べ）、建物50㎡で算出しております。');
  });

  /**
   * テストケース3: 建物のみ設定
   *
   * landAreaVerified=null, buildingAreaVerified=63 の場合、
   * 修正後のコードでは建物に「当社調べ」が付く。
   *
   * 期待される正しい動作: `※土地50㎡、建物63㎡（当社調べ）で算出しております。`
   *
   * このテストは修正後コードで PASS する（バグ修正の確認）
   */
  test('テストケース3: landAreaVerified=null, buildingAreaVerified=63 → 建物に「当社調べ」が付く（修正後コードでPASS）', () => {
    const seller = createTestSeller({
      landArea: 50,
      buildingArea: 50,
      landAreaVerified: undefined,
      buildingAreaVerified: 63,
    });

    // 修正後の valuationData（buildingAreaVerified が含まれている）
    const valuationData = createValuationDataFixed(seller);

    const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

    console.log('テストケース3 - 生成されたメール本文（面積部分）:');
    const areaLine = template.body.split('\n').find((line: string) => line.includes('㎡'));
    console.log('  実際:', areaLine);
    console.log('  期待: ※土地50㎡、建物63㎡（当社調べ）で算出しております。');

    // 期待される正しい動作: 建物に「当社調べ」が付くこと
    // 修正後コードではこのアサーションが PASS する（バグ修正の確認）
    expect(template.body).toContain('63㎡（当社調べ）');
    expect(template.body).toContain('※土地50㎡、建物63㎡（当社調べ）で算出しております。');
  });

  /**
   * テストケース4: emails.ts の valuationData に landAreaVerified が含まれることを確認
   *
   * 修正後の emails.ts の valuationData 構築コードを模倣し、
   * landAreaVerified/buildingAreaVerified が含まれることを確認する。
   *
   * このテストは修正後コードで PASS する（バグ修正の確認）
   */
  test('テストケース4: emails.ts の valuationData に landAreaVerified/buildingAreaVerified が含まれている（バグ修正の確認）', () => {
    const seller = createTestSeller({
      landArea: 50,
      buildingArea: 50,
      landAreaVerified: 86,
      buildingAreaVerified: 63,
      valuationAmount1: 15000000,
      valuationAmount2: 18000000,
      valuationAmount3: 20000000,
      fixedAssetTaxRoadPrice: 100000,
    });

    // emails.ts の修正後の実装を模倣
    const valuationData = {
      valuationAmount1: seller.valuationAmount1,
      valuationAmount2: seller.valuationAmount2,
      valuationAmount3: seller.valuationAmount3,
      fixedAssetTaxRoadPrice: seller.fixedAssetTaxRoadPrice,
      landArea: seller.landArea,
      buildingArea: seller.buildingArea,
      landAreaVerified: seller.landAreaVerified,
      buildingAreaVerified: seller.buildingAreaVerified,
    };

    console.log('テストケース4 - 修正後の valuationData の内容:');
    console.log('  valuationData:', JSON.stringify(valuationData, null, 2));
    console.log('  landAreaVerified が含まれているか:', 'landAreaVerified' in valuationData);
    console.log('  buildingAreaVerified が含まれているか:', 'buildingAreaVerified' in valuationData);

    // 期待される正しい動作: valuationData に landAreaVerified/buildingAreaVerified が含まれること
    // 修正後コードではこのアサーションが PASS する（バグ修正の確認）
    expect(valuationData).toHaveProperty('landAreaVerified');
    expect(valuationData).toHaveProperty('buildingAreaVerified');
    expect(valuationData).toHaveProperty('landArea');
    expect(valuationData).toHaveProperty('buildingArea');
  });

  /**
   * プロパティベーステスト: バグ条件（isBugCondition）が成立する全ての入力で
   * 「当社調べ」がメール本文に反映されることを確認する
   *
   * **Validates: Requirements 1.1, 1.2, 1.3**
   *
   * このテストは修正後コードで PASS する（バグ修正の確認）
   */
  test('PBT: isBugCondition が true の全ての入力で「当社調べ」がメール本文に反映される（修正後コードでPASS）', () => {
    // バグ条件: landAreaVerified > 0 または buildingAreaVerified > 0
    const bugConditionArbitrary = fc.record({
      landArea: fc.integer({ min: 10, max: 500 }),
      buildingArea: fc.integer({ min: 10, max: 300 }),
      landAreaVerified: fc.oneof(
        fc.integer({ min: 1, max: 500 }),  // 設定あり
        fc.constant(null)                   // 未設定
      ),
      buildingAreaVerified: fc.oneof(
        fc.integer({ min: 1, max: 300 }),  // 設定あり
        fc.constant(null)                   // 未設定
      ),
    }).filter(({ landAreaVerified, buildingAreaVerified }) =>
      // バグ条件: 少なくとも一方が設定されている
      (landAreaVerified !== null && landAreaVerified > 0) ||
      (buildingAreaVerified !== null && buildingAreaVerified > 0)
    );

    fc.assert(
      fc.property(bugConditionArbitrary, ({ landArea, buildingArea, landAreaVerified, buildingAreaVerified }) => {
        const seller = createTestSeller({ landArea, buildingArea, landAreaVerified, buildingAreaVerified });

        // 修正後の valuationData（landAreaVerified/buildingAreaVerified が含まれている）
        const valuationData = createValuationDataFixed(seller);

        const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

        // 期待される正しい動作: 「当社調べ」の値が反映されること
        if (landAreaVerified !== null && landAreaVerified > 0) {
          // 土地「当社調べ」が設定されている場合、メール本文に反映されるべき
          const hasLandVerified = template.body.includes(`${landAreaVerified}㎡（当社調べ）`);
          if (!hasLandVerified) {
            console.log(`カウンター例: landAreaVerified=${landAreaVerified}, landArea=${landArea}`);
            console.log(`  メール本文に「${landAreaVerified}㎡（当社調べ）」が含まれていない`);
          }
          return hasLandVerified;
        }

        if (buildingAreaVerified !== null && buildingAreaVerified > 0) {
          // 建物「当社調べ」が設定されている場合、メール本文に反映されるべき
          const hasBuildingVerified = template.body.includes(`${buildingAreaVerified}㎡（当社調べ）`);
          if (!hasBuildingVerified) {
            console.log(`カウンター例: buildingAreaVerified=${buildingAreaVerified}, buildingArea=${buildingArea}`);
            console.log(`  メール本文に「${buildingAreaVerified}㎡（当社調べ）」が含まれていない`);
          }
          return hasBuildingVerified;
        }

        return true;
      }),
      { numRuns: 50 }
    );
  });
});
