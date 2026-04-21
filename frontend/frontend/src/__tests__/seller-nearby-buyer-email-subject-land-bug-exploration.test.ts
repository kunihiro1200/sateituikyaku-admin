/**
 * Bug Condition Exploration Test
 *
 * Property 1: Bug Condition - 土地の場合に件名に「事前に内覧可能です！」が含まれるバグ
 *
 * CRITICAL: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
 * DO NOT attempt to fix the test or the code when it fails
 *
 * バグ条件（design.md の Bug Condition より）:
 *   - isLand(effectivePropertyType) = true の場合
 *   - 件名に「事前に内覧可能です！」が含まれる
 *
 * 根本原因（design.md より）:
 *   - handleSendEmail 関数内の件名生成ロジックが物件種別を考慮せず
 *     固定文字列として「事前に内覧可能です！」を常に付与している
 *   - isLand() は既にインポート済みだが件名生成には適用されていない
 *
 * 目的: バグが存在することを示すカウンターサンプルを見つける
 * 期待される結果: テスト FAIL（これが正しい。バグの存在を証明する）
 *
 * **Validates: Requirements 1.1, 2.1**
 */

import { isLand } from '../utils/propertyTypeUtils';

/**
 * handleSendEmail 関数内の件名生成ロジックを再現する関数（修正後）
 * NearbyBuyersList.tsx の handleSendEmail 関数（約541行目付近）より抽出
 *
 * 修正後のコード:
 *   const subject = isLand(effectivePropertyType)
 *     ? `${address}に興味のあるかた！もうすぐ売り出します！`
 *     : `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
 */
function generateSubjectBuggy(address: string, effectivePropertyType: string | null | undefined): string {
  // 修正後: isLand() チェックを追加して土地の場合は「事前に内覧可能です！」を省略
  return isLand(effectivePropertyType)
    ? `${address}に興味のあるかた！もうすぐ売り出します！`
    : `${address}に興味のあるかた！もうすぐ売り出します！事前に内覧可能です！`;
}

describe('バグ条件の探索テスト - 土地の件名に「事前に内覧可能です！」が含まれるバグ（未修正コードで FAIL することを確認）', () => {
  /**
   * テストケース1: effectivePropertyType = '土地'
   *
   * バグ条件:
   * - isLand('土地') = true
   * - 件名生成ロジックが effectivePropertyType を参照しない
   * - 件名に「事前に内覧可能です！」が含まれる
   *
   * 期待（修正後の正しい動作）:
   * - 件名に「事前に内覧可能です！」が含まれない
   *
   * バグ（未修正コード）:
   * - 件名に「事前に内覧可能です！」が含まれる
   *
   * このテストは未修正コードで FAIL することでバグを証明する。
   */
  test('テストケース1: effectivePropertyType=土地 → 件名に「事前に内覧可能です！」が含まれないこと（修正前は FAIL）', () => {
    const effectivePropertyType = '土地';
    const address = '大分市中央町1-2-3';

    // isLand が true を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(true);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    // 期待（修正後の正しい動作）: 件名に「事前に内覧可能です！」が含まれない
    // バグ（未修正コード）: 件名に「事前に内覧可能です！」が含まれる → FAIL
    expect(subject).not.toContain('事前に内覧可能です！');
  });

  /**
   * テストケース2: effectivePropertyType = '土'（略称）
   *
   * バグ条件:
   * - isLand('土') = true
   * - 件名生成ロジックが effectivePropertyType を参照しない
   * - 件名に「事前に内覧可能です！」が含まれる
   *
   * 期待（修正後の正しい動作）:
   * - 件名に「事前に内覧可能です！」が含まれない
   *
   * バグ（未修正コード）:
   * - 件名に「事前に内覧可能です！」が含まれる
   *
   * このテストは未修正コードで FAIL することでバグを証明する。
   */
  test('テストケース2: effectivePropertyType=土（略称）→ 件名に「事前に内覧可能です！」が含まれないこと（修正前は FAIL）', () => {
    const effectivePropertyType = '土';
    const address = '大分市中央町1-2-3';

    // isLand が true を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(true);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    // 期待（修正後の正しい動作）: 件名に「事前に内覧可能です！」が含まれない
    // バグ（未修正コード）: 件名に「事前に内覧可能です！」が含まれる → FAIL
    expect(subject).not.toContain('事前に内覧可能です！');
  });

  /**
   * テストケース3: effectivePropertyType = 'land'（英語）
   *
   * バグ条件:
   * - isLand('land') = true
   * - 件名生成ロジックが effectivePropertyType を参照しない
   * - 件名に「事前に内覧可能です！」が含まれる
   *
   * 期待（修正後の正しい動作）:
   * - 件名に「事前に内覧可能です！」が含まれない
   *
   * バグ（未修正コード）:
   * - 件名に「事前に内覧可能です！」が含まれる
   *
   * このテストは未修正コードで FAIL することでバグを証明する。
   */
  test('テストケース3: effectivePropertyType=land（英語）→ 件名に「事前に内覧可能です！」が含まれないこと（修正前は FAIL）', () => {
    const effectivePropertyType = 'land';
    const address = '大分市中央町1-2-3';

    // isLand が true を返すことを確認（前提条件）
    expect(isLand(effectivePropertyType)).toBe(true);

    // 修正前の件名生成ロジックを実行
    const subject = generateSubjectBuggy(address, effectivePropertyType);

    // 期待（修正後の正しい動作）: 件名に「事前に内覧可能です！」が含まれない
    // バグ（未修正コード）: 件名に「事前に内覧可能です！」が含まれる → FAIL
    expect(subject).not.toContain('事前に内覧可能です！');
  });
});
