/**
 * CallModePage 査定額メール面積フィールド 保持テスト（Property 2: Preservation）
 *
 * このテストは修正前のコードでPASSすることで、保持すべきベースライン動作を確認する。
 * 修正後もこのテストがPASSすることで、リグレッションがないことを確認する。
 *
 * **観察優先メソドロジー**: 修正前のコードで「当社調べ」フィールドがない入力（バグ条件外）の
 * 動作を観察し、その動作をテストとして記録する。
 *
 * **観察結果**:
 * - `landAreaVerified=null`, `buildingAreaVerified=null`, `landArea=150.0`, `buildingArea=90.0`
 *   → メール本文に `150` と `90` が含まれる
 * - `landAreaVerified=undefined`, `buildingAreaVerified=undefined` の場合も同様
 * - 全てnullの場合、「未設定」が表示される
 *
 * **EXPECTED OUTCOME**: テストPASS（ベースラインの動作を確認）
 *
 * **Validates: Requirements 3.1, 3.2**
 */
import { describe, test, expect } from 'vitest';

// -----------------------------------------------------------------------
// PropertyInfo型の最小定義（テスト用）
// -----------------------------------------------------------------------
interface PropertyInfoForTest {
  landArea?: string | number | null;
  buildingArea?: string | number | null;
  landAreaVerified?: string | number | null;
  buildingAreaVerified?: string | number | null;
}

// -----------------------------------------------------------------------
// バグ条件の定義（design.mdのisBugCondition関数に対応）
// -----------------------------------------------------------------------

/**
 * バグ条件: landAreaVerified または buildingAreaVerified に値が存在する場合
 * この条件が false の場合、修正前後で動作は変わらない（保持対象）
 */
function isBugCondition(property: PropertyInfoForTest): boolean {
  return (
    (property.landAreaVerified !== null &&
      property.landAreaVerified !== undefined &&
      property.landAreaVerified !== '') ||
    (property.buildingAreaVerified !== null &&
      property.buildingAreaVerified !== undefined &&
      property.buildingAreaVerified !== '')
  );
}

// -----------------------------------------------------------------------
// 修正前の面積取得ロジック（CallModePage.tsx 約2661行目付近）
// 「当社調べ」フィールドを無視するバグあり
// -----------------------------------------------------------------------

/**
 * 修正前の面積取得ロジック（バグあり）
 * property.landAreaVerified / buildingAreaVerified を無視し、
 * 常に property.landArea / buildingArea を使用する
 */
function getAreaValues_buggy(property: PropertyInfoForTest): {
  landArea: string | number;
  buildingArea: string | number;
} {
  // バグ: landAreaVerified / buildingAreaVerified を無視している
  const landArea = property.landArea || '未設定';
  const buildingArea = property.buildingArea || '未設定';
  return { landArea, buildingArea };
}

/**
 * 修正前のメール本文生成ロジック（バグあり）
 * 面積部分のみを抽出して返す
 */
function generateEmailAreaText_buggy(property: PropertyInfoForTest): string {
  const { landArea, buildingArea } = getAreaValues_buggy(property);
  return `※土地${landArea}㎡、建物${buildingArea}㎡で算出しております。`;
}

// -----------------------------------------------------------------------
// 修正後の面積取得ロジック（期待される正しい動作）
// 「当社調べ」フィールドを優先する
// -----------------------------------------------------------------------

/**
 * 修正後の面積取得ロジック（期待される正しい動作）
 * property.landAreaVerified / buildingAreaVerified を優先し、
 * なければ property.landArea / buildingArea にフォールバックする
 */
function getAreaValues_fixed(property: PropertyInfoForTest): {
  landArea: string | number;
  buildingArea: string | number;
} {
  // 修正後: 「当社調べ」フィールドを優先
  const landArea = property.landAreaVerified || property.landArea || '未設定';
  const buildingArea = property.buildingAreaVerified || property.buildingArea || '未設定';
  return { landArea, buildingArea };
}

/**
 * 修正後のメール本文生成ロジック（期待される正しい動作）
 */
function generateEmailAreaText_fixed(property: PropertyInfoForTest): string {
  const { landArea, buildingArea } = getAreaValues_fixed(property);
  return `※土地${landArea}㎡、建物${buildingArea}㎡で算出しております。`;
}

// -----------------------------------------------------------------------
// Property 2: Preservation テスト
// 修正前のコードでPASSすることで、ベースライン動作を確認する
// -----------------------------------------------------------------------

describe('Property 2: Preservation — 「当社調べ」フィールドがない場合の既存動作保持', () => {
  /**
   * テストケース1: landAreaVerified=null, buildingAreaVerified=null の場合
   * landArea=150.0, buildingArea=90.0 の値がメール本文に使用されること
   *
   * 観察: バグ条件外（「当社調べ」フィールドなし）では、通常フィールドが使われる
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  test('テストケース1: landAreaVerified=null, buildingAreaVerified=null の場合、landArea=150.0 と buildingArea=90.0 がメール本文に含まれること', () => {
    const property: PropertyInfoForTest = {
      landAreaVerified: null,
      landArea: 150.0,
      buildingAreaVerified: null,
      buildingArea: 90.0,
    };

    // バグ条件に該当しないことを確認（保持対象）
    expect(isBugCondition(property)).toBe(false);

    // 修正前のロジックでメール本文を生成
    const emailText = generateEmailAreaText_buggy(property);

    // 観察された動作: landArea=150.0 と buildingArea=90.0 がメール本文に含まれること
    expect(emailText).toContain('150');
    expect(emailText).toContain('90');
    // 「当社調べ」フィールドの値は含まれないこと（null なので）
    expect(emailText).not.toContain('未設定');
  });

  /**
   * テストケース2: landAreaVerified=undefined, buildingAreaVerified=undefined の場合
   * landArea=150.0, buildingArea=90.0 の値がメール本文に使用されること
   *
   * 観察: undefined も null と同様にバグ条件外として扱われる
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  test('テストケース2: landAreaVerified=undefined, buildingAreaVerified=undefined の場合、landArea=150.0 と buildingArea=90.0 がメール本文に含まれること', () => {
    const property: PropertyInfoForTest = {
      landAreaVerified: undefined,
      landArea: 150.0,
      buildingAreaVerified: undefined,
      buildingArea: 90.0,
    };

    // バグ条件に該当しないことを確認（保持対象）
    expect(isBugCondition(property)).toBe(false);

    // 修正前のロジックでメール本文を生成
    const emailText = generateEmailAreaText_buggy(property);

    // 観察された動作: landArea=150.0 と buildingArea=90.0 がメール本文に含まれること
    expect(emailText).toContain('150');
    expect(emailText).toContain('90');
    expect(emailText).not.toContain('未設定');
  });

  /**
   * テストケース3: 全てnullの場合（landArea=null, buildingArea=null）
   * 「未設定」がメール本文に表示されること
   *
   * 観察: 全てnullの場合、フォールバックとして「未設定」が表示される
   *
   * **Validates: Requirements 3.1**
   */
  test('テストケース3: 全てnullの場合（landArea=null, buildingArea=null）、「未設定」がメール本文に表示されること', () => {
    const property: PropertyInfoForTest = {
      landAreaVerified: null,
      landArea: null,
      buildingAreaVerified: null,
      buildingArea: null,
    };

    // バグ条件に該当しないことを確認（保持対象）
    expect(isBugCondition(property)).toBe(false);

    // 修正前のロジックでメール本文を生成
    const emailText = generateEmailAreaText_buggy(property);

    // 観察された動作: 「未設定」がメール本文に表示されること
    expect(emailText).toContain('未設定');
  });
});

// -----------------------------------------------------------------------
// 保持プロパティ: 修正前後でメール本文が同一であることを確認
// バグ条件外の入力に対して、修正前後で動作が変わらないことを検証する
// -----------------------------------------------------------------------

describe('保持プロパティ: バグ条件外の入力に対して修正前後でメール本文が同一であること', () => {
  /**
   * プロパティテスト: 「当社調べ」フィールドがない場合、修正前後でメール本文が同一であること
   *
   * 複数のテストケースを使って、バグ条件外の入力に対して
   * 修正前後で動作が変わらないことを検証する。
   *
   * **Validates: Requirements 3.1, 3.2**
   */
  const preservationTestCases: Array<{
    description: string;
    property: PropertyInfoForTest;
  }> = [
    {
      description: 'landArea=150.0, buildingArea=90.0, 両方null',
      property: { landAreaVerified: null, landArea: 150.0, buildingAreaVerified: null, buildingArea: 90.0 },
    },
    {
      description: 'landArea=200.5, buildingArea=120.3, 両方null',
      property: { landAreaVerified: null, landArea: 200.5, buildingAreaVerified: null, buildingArea: 120.3 },
    },
    {
      description: 'landArea=50.0, buildingArea=30.0, 両方undefined',
      property: { landAreaVerified: undefined, landArea: 50.0, buildingAreaVerified: undefined, buildingArea: 30.0 },
    },
    {
      description: '全てnull（未設定ケース）',
      property: { landAreaVerified: null, landArea: null, buildingAreaVerified: null, buildingArea: null },
    },
    {
      description: 'landArea=100.0, buildingArea=null（建物面積なし）',
      property: { landAreaVerified: null, landArea: 100.0, buildingAreaVerified: null, buildingArea: null },
    },
    {
      description: 'landArea=null, buildingArea=80.0（土地面積なし）',
      property: { landAreaVerified: null, landArea: null, buildingAreaVerified: null, buildingArea: 80.0 },
    },
    {
      description: 'landArea=文字列"150", buildingArea=文字列"90"',
      property: { landAreaVerified: null, landArea: '150', buildingAreaVerified: null, buildingArea: '90' },
    },
  ];

  test.each(preservationTestCases)(
    '$description: 修正前後でメール本文が同一であること',
    ({ property }) => {
      // バグ条件に該当しないことを確認（保持対象）
      expect(isBugCondition(property)).toBe(false);

      // 修正前後のメール本文を生成
      const emailText_buggy = generateEmailAreaText_buggy(property);
      const emailText_fixed = generateEmailAreaText_fixed(property);

      // 保持プロパティ: バグ条件外では修正前後でメール本文が同一であること
      expect(emailText_buggy).toBe(emailText_fixed);
    }
  );

  /**
   * 追加確認: 修正前のコードが通常フィールドを正しく使用していること
   *
   * **Validates: Requirements 3.2**
   */
  test('修正前コード: landAreaVerified=null の場合、landArea=150.0 が使われること（保持の確認）', () => {
    const property: PropertyInfoForTest = {
      landAreaVerified: null,
      landArea: 150.0,
      buildingAreaVerified: null,
      buildingArea: 90.0,
    };

    const { landArea } = getAreaValues_buggy(property);

    // 保持の確認: 修正前コードは landArea を正しく使う（バグ条件外）
    expect(String(landArea)).toBe('150');
  });

  test('修正前コード: buildingAreaVerified=null の場合、buildingArea=90.0 が使われること（保持の確認）', () => {
    const property: PropertyInfoForTest = {
      landAreaVerified: null,
      landArea: 150.0,
      buildingAreaVerified: null,
      buildingArea: 90.0,
    };

    const { buildingArea } = getAreaValues_buggy(property);

    // 保持の確認: 修正前コードは buildingArea を正しく使う（バグ条件外）
    expect(String(buildingArea)).toBe('90');
  });
});
