/**
 * Property 1: Bug Condition - jimuStaff空配列時のreplyToデフォルト設定失敗
 *
 * このテストは「未修正コードでバグを再現する」ためのものです。
 * バグ条件: handleOpenEmailDialog / handleSelectPropertyEmailTemplate が呼ばれた時点で
 * jimuStaff が空配列の場合、replyTo が設定されない。
 *
 * **CRITICAL**: このテストは未修正コードで FAIL することが期待されます。
 * テストが FAIL することでバグの存在が確認されます。
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../PropertyListingDetailPage.tsx'
);

function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// バグ条件テスト: handleOpenEmailDialog / handleSelectPropertyEmailTemplate 内に
// jimuStaff.find() を直接呼び出す replyTo 設定ロジックが存在すること（バグの証拠）
// -----------------------------------------------------------------------
describe('Property 1: Bug Condition - handleOpenEmailDialog内のreplyTo設定ロジック（未修正コードでバグを再現）', () => {
  /**
   * バグ条件C1: handleOpenEmailDialog 内で jimuStaff.find() を直接呼び出している
   * 未修正コードではこのテストが PASS する（バグが存在する証拠）
   * 修正後はこのテストが FAIL する（バグが修正された証拠）
   *
   * **EXPECTED OUTCOME on UNFIXED code**: PASS（バグが存在することを確認）
   * **EXPECTED OUTCOME on FIXED code**: FAIL（バグが修正されたことを確認）
   */
  test('handleOpenEmailDialog 内に jimuStaff.find() による replyTo 設定ロジックが存在すること（バグの証拠）', () => {
    const source = readTargetFile();

    // handleOpenEmailDialog 関数のブロックを抽出
    const handleOpenEmailDialogStart = source.indexOf('const handleOpenEmailDialog = ()');
    expect(handleOpenEmailDialogStart).toBeGreaterThan(-1);

    // 関数の終わりを探す（次の const handle... まで）
    const nextHandlerStart = source.indexOf('\n  const ', handleOpenEmailDialogStart + 1);
    const functionBody = source.substring(handleOpenEmailDialogStart, nextHandlerStart);

    // バグ条件: jimuStaff.find() が関数内に直接存在すること
    // 未修正コードではこれが true（バグあり）
    // 修正後はこれが false（バグなし）
    const hasBuggyLogic = functionBody.includes('jimuStaff.find(') && functionBody.includes('setReplyTo(');

    // このアサーションは未修正コードで PASS、修正後に FAIL する
    // （バグが修正されたことを確認するため、修正後は FAIL が期待される）
    expect(hasBuggyLogic).toBe(false); // 修正後の期待値: false（バグなし）
  });

  /**
   * バグ条件C2: handleSelectPropertyEmailTemplate 内で jimuStaff.find() を直接呼び出している
   * 未修正コードではこのテストが PASS する（バグが存在する証拠）
   * 修正後はこのテストが FAIL する（バグが修正された証拠）
   */
  test('handleSelectPropertyEmailTemplate 内に jimuStaff.find() による replyTo 設定ロジックが存在すること（バグの証拠）', () => {
    const source = readTargetFile();

    // handleSelectPropertyEmailTemplate 関数のブロックを抽出
    const handleSelectStart = source.indexOf('const handleSelectPropertyEmailTemplate = async');
    expect(handleSelectStart).toBeGreaterThan(-1);

    // 関数の終わりを探す（次の const handle... まで）
    const nextHandlerStart = source.indexOf('\n  const ', handleSelectStart + 1);
    const functionBody = source.substring(handleSelectStart, nextHandlerStart);

    // バグ条件: jimuStaff.find() が関数内に直接存在すること
    const hasBuggyLogic = functionBody.includes('jimuStaff.find(') && functionBody.includes('setReplyTo(');

    // このアサーションは未修正コードで PASS、修正後に FAIL する
    expect(hasBuggyLogic).toBe(false); // 修正後の期待値: false（バグなし）
  });

  /**
   * 修正後の期待動作: emailDialog.open を監視する useEffect が存在すること
   * 未修正コードではこのテストが FAIL する
   * 修正後はこのテストが PASS する
   */
  test('emailDialog.open を監視する useEffect が存在すること（修正後の期待動作）', () => {
    const source = readTargetFile();

    // emailDialog.open を依存配列に含む useEffect が存在すること
    const hasUseEffectForEmailDialog = source.includes('emailDialog.open') &&
      source.includes('jimuStaff') &&
      /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?emailDialog\.open[\s\S]*?\}\s*,\s*\[[\s\S]*?emailDialog\.open[\s\S]*?\]\)/.test(source);

    // 修正後はこれが true
    expect(hasUseEffectForEmailDialog).toBe(true);
  });

  /**
   * 修正後の期待動作: useEffect 内で jimuStaff.length > 0 チェックが存在すること
   */
  test('emailDialog.open useEffect 内で jimuStaff.length > 0 チェックが存在すること（修正後の期待動作）', () => {
    const source = readTargetFile();

    // jimuStaff.length > 0 チェックが存在すること
    const hasLengthCheck = source.includes('jimuStaff.length > 0');

    expect(hasLengthCheck).toBe(true);
  });
});
