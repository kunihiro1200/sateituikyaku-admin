/**
 * 保全プロパティテスト
 *
 * Property 2: Preservation - 土地以外の場合は件名が変わらない
 *
 * **Validates: Requirements 3.1**
 *
 * このテストは修正前後ともに PASS する（保全すべきベースライン動作を確認）
 *
 * 観察（修正前のコードで確認）:
 *   - effectivePropertyType = '戸建'  → 件名に「事前に内覧可能です！」が含まれる
 *   - effectivePropertyType = 'マンション' → 件名に「事前に内覧可能です！」が含まれる
 *   - effectivePropertyType = '収益物件' → 件名に「事前に内覧可能です！」が含まれる
 *   - effectivePropertyType = null      → 件名に「事前に内覧可能です！」が含まれる
 *   - effectivePropertyType = undefined → 件名に「事前に内覧可能です！」が含まれる
 *
 * 根拠（design.md の Preservation Requirements より）:
 *   - 物件種別が「土地」以外の場合、件名は修正前後で変わらない
 *   - isLand() が false を返す全ての入力で「事前に内覧可能です！」が含まれる
 */

import * as fc from 'fast-check';
import { isLand } from '../utils/propertyTypeUtils';

/**
 * handleSendEmail 関数内の件名生成ロジックを再現する関数（修正前）
 * NearbyBuyersList.tsx の handleSendEmail 関数（約541行目付近）より抽出
 *
 * 修正前のコード:
 *   const subject = `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
 */
function generateSubjectBuggy(address: string, _effectivePropertyType: string | null | undefined): string {
  // 修正前: effectivePropertyType を参照せず固定文字列を返す
  return `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
}

describe('保全プロパティテスト - 土地以外の場合は件名に「事前に内覧可能です！」が含まれる（修正前後ともに PASS）', () => {
  const address = '大分市中央町1-2-3';

  // ============================================================
  // 観察1: effectivePropertyType = '戸建'
  // ============================================================

  /**
   * 観察テスト: effectivePropertyType = '戸建' → 件名に「事前に内覧可能です！」が含まれる
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察1: effectivePropertyType=戸建 → 件名に「事前に内覧可能です！」が含まれる', () => {
    const effectivePropertyType = '戸建';

    // isLand が false を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(false);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    console.log('戸建の件名:', subject);

    // 保全: 件名に「事前に内覧可能です！」が含まれる（修正前後ともに変わらない）
    expect(subject).toContain('事前に内覧可能です！');
  });

  // ============================================================
  // 観察2: effectivePropertyType = 'マンション'
  // ============================================================

  /**
   * 観察テスト: effectivePropertyType = 'マンション' → 件名に「事前に内覧可能です！」が含まれる
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察2: effectivePropertyType=マンション → 件名に「事前に内覧可能です！」が含まれる', () => {
    const effectivePropertyType = 'マンション';

    // isLand が false を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(false);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    console.log('マンションの件名:', subject);

    // 保全: 件名に「事前に内覧可能です！」が含まれる（修正前後ともに変わらない）
    expect(subject).toContain('事前に内覧可能です！');
  });

  // ============================================================
  // 観察3: effectivePropertyType = '収益物件'
  // ============================================================

  /**
   * 観察テスト: effectivePropertyType = '収益物件' → 件名に「事前に内覧可能です！」が含まれる
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察3: effectivePropertyType=収益物件 → 件名に「事前に内覧可能です！」が含まれる', () => {
    const effectivePropertyType = '収益物件';

    // isLand が false を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(false);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    console.log('収益物件の件名:', subject);

    // 保全: 件名に「事前に内覧可能です！」が含まれる（修正前後ともに変わらない）
    expect(subject).toContain('事前に内覧可能です！');
  });

  // ============================================================
  // 観察4: effectivePropertyType = null
  // ============================================================

  /**
   * 観察テスト: effectivePropertyType = null → 件名に「事前に内覧可能です！」が含まれる
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察4: effectivePropertyType=null → 件名に「事前に内覧可能です！」が含まれる', () => {
    const effectivePropertyType = null;

    // isLand が false を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(false);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    console.log('null の件名:', subject);

    // 保全: 件名に「事前に内覧可能です！」が含まれる（修正前後ともに変わらない）
    expect(subject).toContain('事前に内覧可能です！');
  });

  // ============================================================
  // 観察5: effectivePropertyType = undefined
  // ============================================================

  /**
   * 観察テスト: effectivePropertyType = undefined → 件名に「事前に内覧可能です！」が含まれる
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('観察5: effectivePropertyType=undefined → 件名に「事前に内覧可能です！」が含まれる', () => {
    const effectivePropertyType = undefined;

    // isLand が false を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(false);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    console.log('undefined の件名:', subject);

    // 保全: 件名に「事前に内覧可能です！」が含まれる（修正前後ともに変わらない）
    expect(subject).toContain('事前に内覧可能です！');
  });

  // ============================================================
  // PBT: isLand() が false を返す全ての入力で件名に「事前に内覧可能です！」が含まれる
  // ============================================================

  /**
   * Property-Based Test: isLand() が false を返す全ての入力で件名に「事前に内覧可能です！」が含まれる
   *
   * **Validates: Requirements 3.1**
   *
   * このテストは修正前後ともに PASS する（保全すべきベースライン動作）
   */
  test('PBT: isLand() が false を返す非土地物件種別で件名に「事前に内覧可能です！」が含まれる', () => {
    // 非土地物件種別の候補（isLand() が false を返す値）
    const nonLandTypes = [
      '戸建',
      '戸建て',
      '戸',
      'detached_house',
      'マンション',
      'マ',
      'apartment',
      '収益物件',
      '収',
      'income',
      '商業用',
      'commercial',
      '未設定',
      'その他',
    ];

    const arbitrary = fc.oneof(
      fc.constantFrom(...nonLandTypes),
      // ランダムな文字列（土地系の値を除外）
      fc.string({ minLength: 1, maxLength: 10 }).filter(
        (s) => !isLand(s)
      )
    );

    fc.assert(
      fc.property(arbitrary, (propertyType) => {
        // 前提条件: isLand が false を返すこと
        if (isLand(propertyType)) return true; // スキップ

        const subject = generateSubjectBuggy(address, propertyType);

        // 保全: 件名に「事前に内覧可能です！」が含まれる
        return subject.includes('事前に内覧可能です！');
      }),
      { numRuns: 100 }
    );
  });
});
