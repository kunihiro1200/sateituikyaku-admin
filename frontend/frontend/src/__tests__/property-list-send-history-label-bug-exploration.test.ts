/**
 * バグ条件探索テスト: SellerSendHistory.tsx のセクションラベル誤表示バグ
 *
 * **CRITICAL**: このテストは未修正コードで実行し、バグの存在を確認する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **GOAL**: バグが存在することを示すカウンターサンプルを発見する
 *
 * **Validates: Requirements 1.1**
 *
 * Property 1: Bug Condition - セクションラベル誤表示バグ
 *
 * バグの根本原因:
 * - SellerSendHistory.tsx の Typography コンポーネント内に
 *   「売主への送信履歴」というテキストがハードコードされている
 * - 正しいラベルは「売主・物件の送信履歴」であるべき
 *
 * バグ条件 (isBugCondition):
 * - renderedOutput に「売主への送信履歴」というテキストが含まれる
 * - renderedOutput に「売主・物件の送信履歴」というテキストが含まれない
 *
 * **注意**: このテストは期待される動作をエンコードしている
 * - 未修正コード: テストが FAIL する（バグの存在を証明）
 * - 修正後コード: テストが PASS する（バグが修正されたことを確認）
 */

import * as fs from 'fs';
import * as path from 'path';

describe('Property 1: Bug Condition - セクションラベル誤表示バグ（SellerSendHistory.tsx 静的解析）', () => {
  const componentPath = path.join(
    __dirname,
    '../components/SellerSendHistory.tsx'
  );

  let componentContent: string;

  beforeAll(() => {
    componentContent = fs.readFileSync(componentPath, 'utf-8');
  });

  /**
   * テスト 1: 「売主への送信履歴」というテキストが存在することを確認（isBugCondition = true の条件1）
   *
   * バグ条件:
   * - 現在のコード: Typography コンポーネント内に「売主への送信履歴」がハードコードされている
   * - 修正後: このテキストは存在しないはず
   *
   * **EXPECTED OUTCOME**:
   * - 未修正コード: 「売主への送信履歴」が存在する → このテストは PASS する（バグ条件1が成立）
   * - 修正後コード: 「売主への送信履歴」が存在しない → このテストは FAIL する
   *
   * このテスト単体は未修正コードで PASS するが、テスト2と組み合わせることで
   * バグ条件 (isBugCondition = true) が成立していることを証明する
   */
  test('Bug Condition 1.1: 「売主への送信履歴」というテキストが SellerSendHistory.tsx に存在する（バグ条件の確認）', () => {
    const buggyLabelExists = componentContent.includes('売主への送信履歴');

    console.log('📊 SellerSendHistory.tsx のラベルテキスト分析:');
    console.log('  - 「売主への送信履歴」が存在する:', buggyLabelExists);

    if (buggyLabelExists) {
      console.log('');
      console.log('✅ バグ条件1が成立: 「売主への送信履歴」というテキストが存在する');
      console.log('  → isBugCondition の条件1が true');
      console.log('  → ユーザーが送信対象を誤解する可能性がある');
    } else {
      console.log('');
      console.log('✅ 修正確認: 「売主への送信履歴」というテキストが存在しない');
    }

    // 未修正コードでは「売主への送信履歴」が存在する → PASS
    // 修正後コードでは「売主への送信履歴」が存在しない → FAIL
    // このテスト自体は「バグが存在すること」を確認するためのもの
    expect(buggyLabelExists).toBe(true);
  });

  /**
   * テスト 2: 「売主・物件の送信履歴」というテキストが存在しないことを確認（isBugCondition = true の条件2）
   *
   * バグ条件:
   * - 現在のコード: 「売主・物件の送信履歴」というテキストが存在しない
   * - 修正後: このテキストが存在するはず
   *
   * **EXPECTED OUTCOME**:
   * - 未修正コード: 「売主・物件の送信履歴」が存在しない → このテストは FAIL する（バグの存在を証明）
   * - 修正後コード: 「売主・物件の送信履歴」が存在する → このテストは PASS する
   *
   * このテストが FAIL することで、バグが存在することが証明される
   */
  test('Bug Condition 1.2: 「売主・物件の送信履歴」というテキストが SellerSendHistory.tsx に存在する（修正後に PASS）', () => {
    const correctLabelExists = componentContent.includes('売主・物件の送信履歴');

    console.log('📊 SellerSendHistory.tsx の正しいラベルテキスト分析:');
    console.log('  - 「売主・物件の送信履歴」が存在する:', correctLabelExists);

    if (!correctLabelExists) {
      // バグが存在する（未修正コード）
      console.log('');
      console.log('❌ カウンターサンプル発見:');
      console.log('  入力: SellerSendHistory コンポーネントをレンダリング（任意の propertyNumber）');
      console.log('  現在のラベル: 「売主への送信履歴」');
      console.log('  期待されるラベル: 「売主・物件の送信履歴」');
      console.log('  実際の動作: 誤ったラベルが表示される（バグ）');
      console.log('  バグ条件: isBugCondition = true');
      console.log('    - 「売主への送信履歴」が存在する: true');
      console.log('    - 「売主・物件の送信履歴」が存在しない: true');
      console.log('');
      console.log('  ソースコード上の証拠:');
      // 「売主への送信履歴」が含まれる行を抽出
      const lines = componentContent.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('売主への送信履歴')) {
          console.log(`  Line ${index + 1}: ${line.trim()}`);
        }
      });
      console.log('');
    } else {
      // バグが修正された（修正後コード）
      console.log('✅ 修正確認: 「売主・物件の送信履歴」というテキストが存在する');
    }

    // 未修正コードでは「売主・物件の送信履歴」が存在しない → FAIL（バグの存在を証明）
    // 修正後コードでは「売主・物件の送信履歴」が存在する → PASS
    expect(correctLabelExists).toBe(true);
  });

  /**
   * テスト 3: バグ条件の総合確認 (isBugCondition 関数の実装)
   *
   * isBugCondition の定義:
   * - renderedOutput に「売主への送信履歴」が含まれる AND
   * - renderedOutput に「売主・物件の送信履歴」が含まれない
   *
   * **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明）
   * - 未修正コード: isBugCondition = true → FAIL（バグの存在を証明）
   * - 修正後コード: isBugCondition = false → PASS（バグが修正されたことを確認）
   */
  test('Bug Condition 1.3: isBugCondition が false である（修正後に PASS）', () => {
    /**
     * isBugCondition 関数の実装
     * design.md の Formal Specification に基づく:
     *
     * FUNCTION isBugCondition(renderedOutput)
     *   INPUT: renderedOutput - SellerSendHistory コンポーネントのレンダリング結果
     *   OUTPUT: boolean
     *   RETURN renderedOutput に「売主への送信履歴」というテキストが含まれる
     *          AND renderedOutput に「売主・物件の送信履歴」というテキストが含まれない
     * END FUNCTION
     */
    function isBugCondition(sourceCode: string): boolean {
      const hasBuggyLabel = sourceCode.includes('売主への送信履歴');
      const hasCorrectLabel = sourceCode.includes('売主・物件の送信履歴');
      return hasBuggyLabel && !hasCorrectLabel;
    }

    const bugConditionResult = isBugCondition(componentContent);

    console.log('📊 isBugCondition 関数の評価:');
    console.log('  - 「売主への送信履歴」が存在する:', componentContent.includes('売主への送信履歴'));
    console.log('  - 「売主・物件の送信履歴」が存在しない:', !componentContent.includes('売主・物件の送信履歴'));
    console.log('  - isBugCondition の結果:', bugConditionResult);

    if (bugConditionResult) {
      console.log('');
      console.log('❌ バグ条件が成立 (isBugCondition = true):');
      console.log('  - SellerSendHistory コンポーネントは「売主への送信履歴」を表示する（誤り）');
      console.log('  - 「売主・物件の送信履歴」は表示されない（欠落）');
      console.log('');
      console.log('  カウンターサンプル:');
      console.log('  - propertyNumber = "任意の値" でコンポーネントをレンダリング');
      console.log('  - getByText("売主への送信履歴") → 要素を返す（バグ）');
      console.log('  - queryByText("売主・物件の送信履歴") → null を返す（バグ）');
      console.log('');
    } else {
      console.log('');
      console.log('✅ バグ条件が成立しない (isBugCondition = false):');
      console.log('  - SellerSendHistory コンポーネントは「売主・物件の送信履歴」を表示する（正しい）');
      console.log('  - 「売主への送信履歴」は表示されない（修正済み）');
    }

    // isBugCondition が false であることを期待する
    // 未修正コードでは isBugCondition = true → FAIL（バグの存在を証明）
    // 修正後コードでは isBugCondition = false → PASS（バグが修正されたことを確認）
    expect(bugConditionResult).toBe(false);
  });
});
