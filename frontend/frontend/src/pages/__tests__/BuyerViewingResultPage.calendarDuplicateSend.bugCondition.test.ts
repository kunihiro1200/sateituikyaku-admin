/**
 * BuyerViewingResultPage カレンダー重複送信バグ条件探索テスト（Property 1: Bug Condition）
 *
 * このテストは修正前のコードで FAIL することでバグの存在を証明する。
 * ソースコード静的解析により、バグ条件（add= と src= の二重使用、業者ハードコード）が
 * 現在のコードに存在することを確認する。
 *
 * **CRITICAL**: このテストは修正前のコードで必ず FAIL すること — FAIL がバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
 *
 * **Validates: Requirements 1.1, 1.2**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// 対象ファイルのパス
const TARGET_FILE = path.resolve(
  __dirname,
  '../BuyerViewingResultPage.tsx'
);

// ファイル内容を読み込む
function readTargetFile(): string {
  return fs.readFileSync(TARGET_FILE, 'utf-8');
}

// -----------------------------------------------------------------------
// バグ条件の定義（design.md の isBugCondition 関数に対応）
// -----------------------------------------------------------------------

/**
 * バグ条件1（重複送信）:
 *   handleCalendarButtonClick 内で add パラメータと src パラメータが
 *   同時に使用されている
 *
 * バグ条件2（誤送信）:
 *   後続担当が「業者」の場合に tenant@ifoo-oita.com がハードコードされている
 */

// -----------------------------------------------------------------------
// Property 1: Bug Condition テスト
// 修正前のコードで FAIL することでバグの存在を証明する
// -----------------------------------------------------------------------

describe('Property 1: Bug Condition — カレンダーイベントの重複送信・誤送信バグの検出', () => {
  /**
   * バグ条件1（重複送信）:
   * 修正前のコードでは params.append('add', assignedEmail) と
   * &src=${encodeURIComponent(assignedEmail)} が同時に使用されている。
   *
   * 期待される正しい動作（修正後）: add= パラメータが使用されないこと
   * 修正前の動作（バグ）: add= と src= が両方使用される
   *
   * このテストは修正前のコードで FAIL する（バグの存在を証明）
   * 修正後は PASS する（バグが修正されたことを確認）
   */
  test('バグ条件1（重複送信）: handleCalendarButtonClick に add= パラメータが存在しないこと', () => {
    const source = readTargetFile();

    // handleCalendarButtonClick 関数のブロックを抽出する
    // 関数の開始から window.open の呼び出しまでを対象とする
    const funcMatch = source.match(
      /handleCalendarButtonClick[\s\S]*?window\.open\([^)]+\)/
    );
    expect(funcMatch).not.toBeNull();

    const funcBody = funcMatch![0];

    // 期待される正しい動作（修正後）: add= パラメータが使用されないこと
    // 修正前のコードでは params.append('add', assignedEmail) が存在するため FAIL する
    expect(funcBody).not.toContain('params.append(\'add\'');
    expect(funcBody).not.toContain('params.append("add"');
  });

  /**
   * バグ条件2（誤送信）:
   * 修正前のコードでは followUpAssignee === '業者' の場合に
   * assignedEmail = 'tenant@ifoo-oita.com' がハードコードされている。
   *
   * 期待される正しい動作（修正後）: 業者の場合は tenant@ifoo-oita.com を使用しないこと
   * 修正前の動作（バグ）: tenant@ifoo-oita.com がハードコードされて使用される
   *
   * このテストは修正前のコードで FAIL する（バグの存在を証明）
   * 修正後は PASS する（バグが修正されたことを確認）
   */
  test('バグ条件2（誤送信）: handleCalendarButtonClick に tenant@ifoo-oita.com のハードコードが存在しないこと', () => {
    const source = readTargetFile();

    // handleCalendarButtonClick 関数のブロックを抽出する
    const funcMatch = source.match(
      /handleCalendarButtonClick[\s\S]*?window\.open\([^)]+\)/
    );
    expect(funcMatch).not.toBeNull();

    const funcBody = funcMatch![0];

    // 期待される正しい動作（修正後）: tenant@ifoo-oita.com がハードコードされていないこと
    // 修正前のコードでは assignedEmail = 'tenant@ifoo-oita.com' が存在するため FAIL する
    expect(funcBody).not.toContain('tenant@ifoo-oita.com');
  });
});

// -----------------------------------------------------------------------
// 補足: バグ条件の詳細確認
// -----------------------------------------------------------------------

describe('バグ条件の詳細確認 — 修正前コードのバグパターンを特定', () => {
  /**
   * 修正前のコードに add パラメータの付与コードが存在することを確認
   * （これが PASS すれば、バグが現在のコードに存在することを意味する）
   */
  test('[バグ修正確認] 修正後コードに params.append(add) が存在しないこと', () => {
    const source = readTargetFile();

    // 修正後のコードには params.append('add', assignedEmail) が存在しない
    const hasAddParam =
      source.includes('params.append(\'add\'') ||
      source.includes('params.append("add"');

    // このテストは修正後のコードで PASS する（バグが削除されたことを確認）
    // ※ このテストは参考情報として使用する
    console.log('[バグ修正確認] params.append(add) の存在:', hasAddParam);
    expect(hasAddParam).toBe(false);
  });

  /**
   * 修正前のコードに tenant@ifoo-oita.com のハードコードが存在することを確認
   * （これが PASS すれば、バグが現在のコードに存在することを意味する）
   */
  test('[バグ修正確認] 修正後コードの handleCalendarButtonClick に tenant@ifoo-oita.com のハードコードが存在しないこと', () => {
    const source = readTargetFile();

    // handleCalendarButtonClick 関数のブロックを抽出する
    const funcMatch = source.match(
      /handleCalendarButtonClick[\s\S]*?window\.open\([^)]+\)/
    );
    expect(funcMatch).not.toBeNull();

    const funcBody = funcMatch![0];

    // 修正後のコードでは handleCalendarButtonClick 内に tenant@ifoo-oita.com が存在しない
    const hasTenantEmail = funcBody.includes('tenant@ifoo-oita.com');

    // このテストは修正後のコードで PASS する（バグが削除されたことを確認）
    // ※ このテストは参考情報として使用する
    console.log('[バグ修正確認] handleCalendarButtonClick 内の tenant@ifoo-oita.com の存在:', hasTenantEmail);
    expect(hasTenantEmail).toBe(false);
  });
});
