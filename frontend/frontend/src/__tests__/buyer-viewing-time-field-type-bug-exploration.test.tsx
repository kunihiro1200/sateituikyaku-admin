/**
 * タスク1: バグ条件の探索テスト - 内覧時間フィールド type 属性
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テストが失敗することが期待される結果です（バグの存在を確認）。
 *
 * **Validates: Requirements 1.1, 1.2**
 *
 * Property 1: Bug Condition - 内覧時間フィールドが type="time" を持たないバグ
 *
 * アプローチ: ソースコードを直接解析してバグ条件を確認する
 * （コンポーネントレンダリングなし）
 */

import * as fs from 'fs';
import * as path from 'path';

// NewBuyerPage.tsx のソースコードを読み込む
const sourceFilePath = path.resolve(__dirname, '../pages/NewBuyerPage.tsx');
const sourceCode = fs.readFileSync(sourceFilePath, 'utf-8');

describe('バグ条件探索テスト: 内覧時間フィールド type 属性', () => {
  /**
   * テスト1: 内覧時間フィールドの type 属性確認
   * バグ: type プロパティが未指定のため type="text" として動作する
   * 期待値: type="time" が指定されていること
   * 未修正コードでは失敗する（反例: type="time" が存在しない）
   */
  test('テスト1: 内覧時間フィールドに type="time" が指定されていること', () => {
    // 「内覧時間」ラベルを持つ TextField ブロックを抽出する
    // 「内覧時間」の TextField は「内覧日」の直後に定義されている
    const viewingTimeBlockMatch = sourceCode.match(
      /label="内覧時間"[\s\S]*?(?=<\/TextField>|<Grid|<\/Grid)/
    );

    expect(viewingTimeBlockMatch).not.toBeNull();
    const viewingTimeBlock = viewingTimeBlockMatch![0];

    // 未修正コードでは type="time" が存在しないため、このアサーションは失敗する
    // 反例: viewingTimeBlock に type="time" が含まれていない（バグの存在を証明）
    expect(viewingTimeBlock).toContain('type="time"');
  });

  /**
   * テスト2: InputLabelProps={{ shrink: true }} の適用確認
   * バグ: InputLabelProps が未指定
   * 期待値: InputLabelProps={{ shrink: true }} が指定されていること
   * 未修正コードでは失敗する
   */
  test('テスト2: 内覧時間フィールドに InputLabelProps={{ shrink: true }} が指定されていること', () => {
    // 「内覧時間」ラベルを持つ TextField ブロックを抽出する
    const viewingTimeBlockMatch = sourceCode.match(
      /label="内覧時間"[\s\S]*?(?=<\/TextField>|<Grid|<\/Grid)/
    );

    expect(viewingTimeBlockMatch).not.toBeNull();
    const viewingTimeBlock = viewingTimeBlockMatch![0];

    // 未修正コードでは InputLabelProps が未指定のため、このアサーションは失敗する
    expect(viewingTimeBlock).toContain('InputLabelProps');
    expect(viewingTimeBlock).toContain('shrink: true');
  });

  /**
   * テスト3: 隣の内覧日フィールドが type="date" を持つことを確認（参照実装）
   * このテストは未修正コードでも成功する（参照実装として）
   */
  test('テスト3: 内覧日フィールドに type="date" が指定されていること（参照実装）', () => {
    // 「内覧日」ラベルを持つ TextField ブロックを抽出する
    const viewingDateBlockMatch = sourceCode.match(
      /label="内覧日"[\s\S]*?(?=<\/TextField>|<Grid|<\/Grid)/
    );

    expect(viewingDateBlockMatch).not.toBeNull();
    const viewingDateBlock = viewingDateBlockMatch![0];

    // 内覧日フィールドは正しく type="date" が設定されている（参照実装）
    expect(viewingDateBlock).toContain('type="date"');
    expect(viewingDateBlock).toContain('InputLabelProps');
    expect(viewingDateBlock).toContain('shrink: true');
  });

  /**
   * テスト4: バグの具体的な反例を記録する
   * 未修正コードでの実際の状態を確認する
   */
  test('テスト4: バグの反例確認 - 内覧時間フィールドの現在の状態', () => {
    // 「内覧時間」フィールドの現在の実装を抽出
    const viewingTimeBlockMatch = sourceCode.match(
      /label="内覧時間"[\s\S]*?(?=<\/TextField>|<Grid|<\/Grid)/
    );

    expect(viewingTimeBlockMatch).not.toBeNull();
    const viewingTimeBlock = viewingTimeBlockMatch![0];

    // バグの反例を記録: placeholder="例: 14:00" が存在する（type="time" では不要）
    const hasPlaceholder = viewingTimeBlock.includes('placeholder=');
    const hasTypeTime = viewingTimeBlock.includes('type="time"');
    const hasInputLabelProps = viewingTimeBlock.includes('InputLabelProps');

    console.log('=== バグ条件の反例 ===');
    console.log('内覧時間フィールドの現在の状態:');
    console.log('  - type="time" が存在する:', hasTypeTime);
    console.log('  - InputLabelProps が存在する:', hasInputLabelProps);
    console.log('  - placeholder が存在する:', hasPlaceholder);
    console.log('');
    console.log('期待される状態（修正後）:');
    console.log('  - type="time" が存在する: true');
    console.log('  - InputLabelProps が存在する: true');
    console.log('  - placeholder が存在する: false');

    // 未修正コードでは type="time" が存在しないため失敗する
    // これがバグの存在を証明する反例
    expect(hasTypeTime).toBe(true);
  });
});
