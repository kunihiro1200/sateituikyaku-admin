/**
 * 保全プロパティテスト: 売主査定額メール面積表記バグ
 *
 * **Validates: Requirements 3.1, 3.2, 3.3**
 *
 * このテストは「未修正コード」で実行し、必ず PASS すること。
 * テストのパスがベースライン動作（修正前の正常動作）を確認する。
 *
 * 保全プロパティ:
 * - 3.1: landAreaVerified も buildingAreaVerified も未設定の場合、
 *         メール本文は従来通り landArea/buildingArea のみを表示する（注記なし）
 * - 3.2: 査定額（valuationAmount1/2/3）の計算・表示ロジックは変更しない
 * - 3.3: generateValuationEmailTemplate の面積表記以外の本文内容は変更しない
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

// 非バグ条件の valuationData を生成するヘルパー
// landAreaVerified=null, buildingAreaVerified=null の場合（保全対象）
function createValuationDataNoBugCondition(
  landArea: number,
  buildingArea: number,
  valuationAmount1 = 15000000,
  valuationAmount2 = 18000000,
  valuationAmount3 = 20000000
): any {
  return {
    valuationAmount1,
    valuationAmount2,
    valuationAmount3,
    fixedAssetTaxRoadPrice: 100000,
    landArea,
    buildingArea,
    // landAreaVerified と buildingAreaVerified は含めない（null/undefined）
  };
}

describe('売主査定額メール面積表記バグ - 保全プロパティテスト', () => {
  let emailService: EmailService;

  beforeAll(() => {
    // EmailService のインスタンスを作成
    emailService = new EmailService() as any;
  });

  // ============================================================
  // 観察: 非バグ条件の動作確認
  // landArea=50, buildingArea=50, landAreaVerified=null, buildingAreaVerified=null
  // → ※土地50㎡、建物50㎡で算出しております。 が生成される
  // ============================================================

  /**
   * 観察テスト: 非バグ条件の基本動作確認
   *
   * **Validates: Requirements 3.1**
   *
   * landArea=50, buildingArea=50, landAreaVerified=null, buildingAreaVerified=null の場合、
   * 現在のコードは ※土地50㎡、建物50㎡で算出しております。 を生成する。
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  test('観察: landArea=50, buildingArea=50, landAreaVerified=null → ※土地50㎡、建物50㎡で算出しております。', () => {
    console.log('\n========================================');
    console.log('🔍 観察テスト: 非バグ条件の基本動作確認');
    console.log('========================================\n');

    const seller = createTestSeller({ landArea: 50, buildingArea: 50 });
    const valuationData = createValuationDataNoBugCondition(50, 50);

    const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

    // 面積表記行を抽出
    const areaLine = template.body.split('\n').find((line: string) => line.includes('㎡'));
    console.log('  生成された面積表記行:', areaLine);
    console.log('  期待値: ※土地50㎡、建物50㎡で算出しております。');

    // 保全要件: 注記なしで元の面積値のみが表示される
    expect(template.body).toContain('※土地50㎡、建物50㎡で算出しております。');
    // 「当社調べ」注記が付いていないことを確認
    expect(template.body).not.toContain('（当社調べ）');

    console.log('\n✅ 非バグ条件の基本動作が確認されました');
    console.log('\n========================================');
    console.log('🔍 観察テスト終了');
    console.log('========================================\n');
  });

  // ============================================================
  // Property 2: Preservation - 3.1
  // landAreaVerified=null, buildingAreaVerified=null の全ケースで
  // 結果が landArea/buildingArea のみを使用した面積表記（注記なし）であること
  // ============================================================

  /**
   * Property-Based Test: 非バグ条件の全ケースで注記なし面積表記が維持される
   *
   * **Validates: Requirements 3.1**
   *
   * landAreaVerified=null, buildingAreaVerified=null の全ケースで、
   * メール本文の面積表記が landArea/buildingArea のみを使用し、
   * 「（当社調べ）」注記が付かないことを検証する。
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  test('PBT: landAreaVerified=null, buildingAreaVerified=null の全ケースで注記なし面積表記が維持される', () => {
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト: 非バグ条件の面積表記');
    console.log('========================================\n');

    // 非バグ条件のジェネレーター
    // landAreaVerified=null, buildingAreaVerified=null（isBugCondition=false）
    const noBugConditionArbitrary = fc.record({
      landArea: fc.integer({ min: 1, max: 500 }),
      buildingArea: fc.integer({ min: 1, max: 300 }),
    });

    fc.assert(
      fc.property(noBugConditionArbitrary, ({ landArea, buildingArea }) => {
        const seller = createTestSeller({ landArea, buildingArea });

        // 非バグ条件: landAreaVerified=null, buildingAreaVerified=null
        const valuationData = createValuationDataNoBugCondition(landArea, buildingArea);

        const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

        // 保全要件1: 元の面積値が使用されること
        const hasLandArea = template.body.includes(`${landArea}㎡`);
        const hasBuildingArea = template.body.includes(`${buildingArea}㎡`);

        // 保全要件2: 「当社調べ」注記が付かないこと
        const hasNoVerifiedNote = !template.body.includes('（当社調べ）');

        // 保全要件3: 面積表記行の形式が正しいこと
        const hasCorrectFormat = template.body.includes(
          `※土地${landArea}㎡、建物${buildingArea}㎡で算出しております。`
        );

        if (!hasLandArea || !hasBuildingArea || !hasNoVerifiedNote || !hasCorrectFormat) {
          console.log(`カウンター例: landArea=${landArea}, buildingArea=${buildingArea}`);
          console.log(`  hasLandArea=${hasLandArea}, hasBuildingArea=${hasBuildingArea}`);
          console.log(`  hasNoVerifiedNote=${hasNoVerifiedNote}, hasCorrectFormat=${hasCorrectFormat}`);
        }

        return hasLandArea && hasBuildingArea && hasNoVerifiedNote && hasCorrectFormat;
      }),
      { numRuns: 100 }
    );

    console.log('✅ 非バグ条件の全ケースで注記なし面積表記が維持されています');
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト終了');
    console.log('========================================\n');
  });

  // ============================================================
  // Property 2: Preservation - 3.2
  // 査定額（valuationAmount1/2/3）の表示が変わらないこと
  // ============================================================

  /**
   * 追加テスト: 査定額の表示が正しく維持される
   *
   * **Validates: Requirements 3.2**
   *
   * valuationAmount1/2/3 の値がメール本文に正しく表示されることを確認する。
   * 面積修正後も査定額の表示ロジックが変わらないことを保証する。
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  test('追加テスト: 査定額（valuationAmount1/2/3）の表示が正しく維持される', () => {
    console.log('\n========================================');
    console.log('🔍 保全テスト: 査定額の表示確認');
    console.log('========================================\n');

    const seller = createTestSeller({ landArea: 50, buildingArea: 50 });

    // 具体的な査定額を設定
    const valuationData = createValuationDataNoBugCondition(
      50, 50,
      15000000,  // 1500万円
      18000000,  // 1800万円
      20000000   // 2000万円
    );

    const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

    console.log('  生成されたメール本文（査定額部分）:');
    const lines = template.body.split('\n');
    lines.forEach((line: string, i: number) => {
      if (line.includes('万円') || line.includes('相場') || line.includes('チャレンジ') || line.includes('買取')) {
        console.log(`  [${i}]: ${line}`);
      }
    });

    // 査定額が万円単位に変換されて表示されること
    // 15000000 → 1500万円
    expect(template.body).toContain('1500万円');
    // 18000000 → 1800万円
    expect(template.body).toContain('1800万円');
    // 20000000 → 2000万円
    expect(template.body).toContain('2000万円');

    console.log('\n✅ 査定額の表示が正しく維持されています');
    console.log('\n========================================');
    console.log('🔍 保全テスト終了: 査定額の表示確認');
    console.log('========================================\n');
  });

  /**
   * Property-Based Test: 任意の査定額で表示が正しく維持される
   *
   * **Validates: Requirements 3.2**
   *
   * 様々な査定額に対して、万円単位への変換と表示が常に正しく動作することを確認する。
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  test('PBT: 任意の査定額で万円単位への変換と表示が正しく維持される', () => {
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト: 査定額の多様な入力');
    console.log('========================================\n');

    // 査定額のジェネレーター（100万円〜5000万円の範囲）
    const valuationArbitrary = fc.record({
      amount1: fc.integer({ min: 1000000, max: 30000000 }).map(v => Math.round(v / 10000) * 10000),
      amount2: fc.integer({ min: 1000000, max: 40000000 }).map(v => Math.round(v / 10000) * 10000),
      amount3: fc.integer({ min: 1000000, max: 50000000 }).map(v => Math.round(v / 10000) * 10000),
    });

    fc.assert(
      fc.property(valuationArbitrary, ({ amount1, amount2, amount3 }) => {
        const seller = createTestSeller({ landArea: 50, buildingArea: 50 });
        const valuationData = createValuationDataNoBugCondition(50, 50, amount1, amount2, amount3);

        const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

        // 万円単位に変換された値がメール本文に含まれること
        const amount1Man = Math.round(amount1 / 10000);
        const amount2Man = Math.round(amount2 / 10000);
        const amount3Man = Math.round(amount3 / 10000);

        const hasAmount1 = template.body.includes(`${amount1Man}万円`);
        const hasAmount2 = template.body.includes(`${amount2Man}万円`);
        const hasAmount3 = template.body.includes(`${amount3Man}万円`);

        if (!hasAmount1 || !hasAmount2 || !hasAmount3) {
          console.log(`カウンター例: amount1=${amount1}(${amount1Man}万円), amount2=${amount2}(${amount2Man}万円), amount3=${amount3}(${amount3Man}万円)`);
        }

        return hasAmount1 && hasAmount2 && hasAmount3;
      }),
      { numRuns: 50 }
    );

    console.log('✅ 任意の査定額で万円単位への変換と表示が正しく動作しています');
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト終了: 査定額の多様な入力');
    console.log('========================================\n');
  });

  // ============================================================
  // Property 2: Preservation - 3.3
  // 面積行以外の本文内容が変わらないこと
  // ============================================================

  /**
   * 追加テスト: 面積行以外の本文内容が維持される
   *
   * **Validates: Requirements 3.3**
   *
   * generateValuationEmailTemplate の面積表記以外の本文内容が
   * 変更されないことを確認する。
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  test('追加テスト: 面積行以外の本文内容（件名・挨拶・会社情報等）が維持される', () => {
    console.log('\n========================================');
    console.log('🔍 保全テスト: 面積行以外の本文内容確認');
    console.log('========================================\n');

    const seller = createTestSeller({
      name: '山田太郎',
      landArea: 50,
      buildingArea: 50,
    });
    const valuationData = createValuationDataNoBugCondition(50, 50);

    const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

    console.log('  件名:', template.subject);

    // 件名に売主名が含まれること
    expect(template.subject).toContain('山田太郎');
    expect(template.subject).toContain('査定結果');

    // 本文に売主名が含まれること
    expect(template.body).toContain('山田太郎様');

    // 本文に会社情報が含まれること
    expect(template.body).toContain('株式会社 いふう');
    expect(template.body).toContain('097-533-2022');

    // 本文に査定説明が含まれること
    expect(template.body).toContain('机上査定は以下の通りとなっております。');

    // 本文に相場価格・チャレンジ価格・買取価格のセクションが含まれること
    expect(template.body).toContain('＜相場価格＞');
    expect(template.body).toContain('＜チャレンジ価格＞');
    expect(template.body).toContain('＜買取価格＞');

    // 本文に訪問査定の案内が含まれること
    expect(template.body).toContain('訪問査定');

    console.log('\n✅ 面積行以外の本文内容が正しく維持されています');
    console.log('\n========================================');
    console.log('🔍 保全テスト終了: 面積行以外の本文内容確認');
    console.log('========================================\n');
  });

  /**
   * Property-Based Test: 任意の売主名で本文構造が維持される
   *
   * **Validates: Requirements 3.3**
   *
   * 様々な売主名に対して、メール本文の構造（件名・挨拶・会社情報等）が
   * 常に正しく維持されることを確認する。
   *
   * **EXPECTED**: このテストは未修正コードで PASS する（ベースライン動作）
   */
  test('PBT: 任意の売主名・面積値で本文の必須要素が維持される', () => {
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト: 本文構造の維持');
    console.log('========================================\n');

    // 売主名のジェネレーター
    const sellerNameArbitrary = fc.constantFrom(
      '田中太郎',
      '山田花子',
      '佐藤一郎',
      '鈴木次郎',
      'テスト売主',
    );

    // 面積値のジェネレーター（非バグ条件: landAreaVerified=null, buildingAreaVerified=null）
    const areaArbitrary = fc.record({
      landArea: fc.integer({ min: 1, max: 500 }),
      buildingArea: fc.integer({ min: 1, max: 300 }),
    });

    fc.assert(
      fc.property(sellerNameArbitrary, areaArbitrary, (sellerName, { landArea, buildingArea }) => {
        const seller = createTestSeller({ name: sellerName, landArea, buildingArea });
        const valuationData = createValuationDataNoBugCondition(landArea, buildingArea);

        const template = (emailService as any).generateValuationEmailTemplate(seller, valuationData);

        // 件名に売主名が含まれること
        const subjectHasName = template.subject.includes(sellerName);

        // 本文に売主名が含まれること
        const bodyHasName = template.body.includes(`${sellerName}様`);

        // 本文に会社情報が含まれること
        const bodyHasCompany = template.body.includes('株式会社 いふう');

        // 本文に査定説明が含まれること
        const bodyHasValuationDesc = template.body.includes('机上査定は以下の通りとなっております。');

        // 本文に面積表記行が含まれること（注記なし）
        const bodyHasAreaLine = template.body.includes(
          `※土地${landArea}㎡、建物${buildingArea}㎡で算出しております。`
        );

        // 「当社調べ」注記が付いていないこと
        const bodyHasNoVerifiedNote = !template.body.includes('（当社調べ）');

        if (!subjectHasName || !bodyHasName || !bodyHasCompany || !bodyHasValuationDesc || !bodyHasAreaLine || !bodyHasNoVerifiedNote) {
          console.log(`カウンター例: sellerName=${sellerName}, landArea=${landArea}, buildingArea=${buildingArea}`);
          console.log(`  subjectHasName=${subjectHasName}, bodyHasName=${bodyHasName}`);
          console.log(`  bodyHasCompany=${bodyHasCompany}, bodyHasValuationDesc=${bodyHasValuationDesc}`);
          console.log(`  bodyHasAreaLine=${bodyHasAreaLine}, bodyHasNoVerifiedNote=${bodyHasNoVerifiedNote}`);
        }

        return subjectHasName && bodyHasName && bodyHasCompany && bodyHasValuationDesc && bodyHasAreaLine && bodyHasNoVerifiedNote;
      }),
      { numRuns: 50 }
    );

    console.log('✅ 任意の売主名・面積値で本文の必須要素が維持されています');
    console.log('\n========================================');
    console.log('🔍 保全プロパティテスト終了: 本文構造の維持');
    console.log('========================================\n');
  });
});
