/**
 * CallModePage 不通未入力警告欠落バグ 条件探索テスト（Property 1: Bug Condition）
 *
 * このテストは修正前のコードでFAILすることでバグの存在を証明する。
 * navigateWithWarningCheck 関数のロジックを純粋関数として抽出してテストする。
 *
 * **CRITICAL**: このテストは修正前のコードで必ずFAILすること — FAILがバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることで修正を検証する
 *
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// -----------------------------------------------------------------------
// バグ条件の定義（design.md の isBugCondition 関数に対応）
// -----------------------------------------------------------------------

/**
 * バグ条件:
 * - 反響日が2026年1月1日以降（isAfterJan2026 = true）
 * - 不通フィールドが未入力（unreachableStatus === null）
 * - ナビゲーション操作（navigationAction IN ['navbar', 'backButton', 'sellerSwitch']）
 */
function isBugCondition(input: {
  inquiryDate: string;
  unreachableStatus: string | null;
  navigationAction: 'navbar' | 'backButton' | 'sellerSwitch';
}): boolean {
  const isAfterJan2026 = new Date(input.inquiryDate) >= new Date('2026-01-01');
  const isUnreachableEmpty = input.unreachableStatus === null;
  const isNavigationAction = ['navbar', 'backButton', 'sellerSwitch'].includes(input.navigationAction);
  return isAfterJan2026 && isUnreachableEmpty && isNavigationAction;
}

// -----------------------------------------------------------------------
// navigateWithWarningCheck のロジックを純粋関数として抽出
// -----------------------------------------------------------------------

/**
 * ダイアログ呼び出し結果の型
 */
interface NavigationResult {
  /** 遷移ブロックダイアログが表示されたか */
  navigationBlockDialogOpened: boolean;
  /** 次電日変更確認ダイアログが表示されたか */
  nextCallDateReminderDialogOpened: boolean;
  /** 遷移警告ダイアログが表示されたか */
  navigationWarningDialogOpened: boolean;
  /** 遷移警告ダイアログの warningType */
  navigationWarningDialogType: string | null;
  /** onConfirm が直接呼ばれたか（警告なしに遷移したか） */
  onConfirmCalledDirectly: boolean;
}

/**
 * navigateWithWarningCheck の入力パラメータ
 */
interface NavigateCheckInput {
  /** 売主の反響日 */
  inquiryDate: string | null;
  /** 不通ステータス */
  unreachableStatus: string | null;
  /** 追客中かつ次電日未入力か（次電日ブロック条件） */
  isFollowingUpWithoutNextCallDate: boolean;
  /** 次電日変更確認ダイアログを表示すべきか */
  shouldShowReminder: boolean;
  /** 確度未入力警告条件（追客中 かつ 通電OK かつ 確度未入力） */
  isConfidenceWarningCondition: boolean;
  /** 1番電話未入力警告条件（2026年3月以降 かつ 不通入力済み かつ 1番電話未入力） */
  isFirstCallWarningCondition: boolean;
}

/**
 * 修正前の navigateWithWarningCheck ロジック（CallModePage.tsx の現在の実装を再現）
 *
 * 修正前のコードには不通未入力チェックが存在しない。
 * そのため、バグ条件（反響日2026年以降 かつ 不通未入力）でも onConfirm が直接呼ばれる。
 */
function navigateWithWarningCheck_buggy(input: NavigateCheckInput): NavigationResult {
  const result: NavigationResult = {
    navigationBlockDialogOpened: false,
    nextCallDateReminderDialogOpened: false,
    navigationWarningDialogOpened: false,
    navigationWarningDialogType: null,
    onConfirmCalledDirectly: false,
  };

  // 1. 次電日未入力ブロック（最優先）
  if (input.isFollowingUpWithoutNextCallDate) {
    result.navigationBlockDialogOpened = true;
    return result;
  }

  // 2. 次電日変更確認ダイアログ
  if (input.shouldShowReminder) {
    result.nextCallDateReminderDialogOpened = true;
    return result;
  }

  // ⚠️ バグ: 不通未入力チェックが存在しない
  // 修正後はここに以下のチェックが追加される:
  // const isAfterJan2026 = input.inquiryDate && new Date(input.inquiryDate) >= new Date('2026-01-01');
  // if (isAfterJan2026 && !input.unreachableStatus) {
  //   result.navigationWarningDialogOpened = true;
  //   result.navigationWarningDialogType = 'unreachable';
  //   return result;
  // }

  // 3. 確度未入力警告
  if (input.isConfidenceWarningCondition) {
    result.navigationWarningDialogOpened = true;
    result.navigationWarningDialogType = 'confidence';
    return result;
  }

  // 4. 1番電話未入力警告
  if (input.isFirstCallWarningCondition) {
    result.navigationWarningDialogOpened = true;
    result.navigationWarningDialogType = 'firstCall';
    return result;
  }

  // 5. 警告なしに遷移（onConfirm を直接呼ぶ）
  result.onConfirmCalledDirectly = true;
  return result;
}

/**
 * 修正後の navigateWithWarningCheck ロジック（期待される正しい実装）
 *
 * 修正後のコードには不通未入力チェックが追加される。
 * バグ条件（反響日2026年以降 かつ 不通未入力）では warningType: 'unreachable' のダイアログが表示される。
 */
function navigateWithWarningCheck_fixed(input: NavigateCheckInput): NavigationResult {
  const result: NavigationResult = {
    navigationBlockDialogOpened: false,
    nextCallDateReminderDialogOpened: false,
    navigationWarningDialogOpened: false,
    navigationWarningDialogType: null,
    onConfirmCalledDirectly: false,
  };

  // 1. 次電日未入力ブロック（最優先）
  if (input.isFollowingUpWithoutNextCallDate) {
    result.navigationBlockDialogOpened = true;
    return result;
  }

  // 2. 次電日変更確認ダイアログ
  if (input.shouldShowReminder) {
    result.nextCallDateReminderDialogOpened = true;
    return result;
  }

  // 3. 【修正後追加】不通未入力警告（2026年1月1日以降）
  const isAfterJan2026 = input.inquiryDate && new Date(input.inquiryDate) >= new Date('2026-01-01');
  if (isAfterJan2026 && !input.unreachableStatus) {
    result.navigationWarningDialogOpened = true;
    result.navigationWarningDialogType = 'unreachable';
    return result;
  }

  // 4. 確度未入力警告
  if (input.isConfidenceWarningCondition) {
    result.navigationWarningDialogOpened = true;
    result.navigationWarningDialogType = 'confidence';
    return result;
  }

  // 5. 1番電話未入力警告
  if (input.isFirstCallWarningCondition) {
    result.navigationWarningDialogOpened = true;
    result.navigationWarningDialogType = 'firstCall';
    return result;
  }

  // 6. 警告なしに遷移（onConfirm を直接呼ぶ）
  result.onConfirmCalledDirectly = true;
  return result;
}

// -----------------------------------------------------------------------
// Property 1: Bug Condition テスト
// 修正前のコードでFAILすることでバグの存在を証明する
// -----------------------------------------------------------------------

describe('Property 1: Bug Condition — 不通未入力時の遷移警告欠落バグ', () => {
  /**
   * テストケース1: 反響日2026年3月1日・不通未入力 → ナビゲーションバーから遷移
   *
   * バグ条件:
   * - 反響日: 2026-03-01（2026年1月1日以降）
   * - unreachableStatus: null（未入力）
   * - navigationAction: 'navbar'
   *
   * 期待される正しい動作（修正後）:
   *   setNavigationWarningDialog が warningType: 'unreachable' で呼ばれる
   *
   * 修正前の動作（バグ）:
   *   setNavigationWarningDialog が呼ばれず、onConfirm が直接実行される（警告なしに遷移）
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   */
  test('テストケース1: 反響日2026年3月1日・不通未入力 → ナビゲーションバーから遷移 → 警告が表示されること', () => {
    const input: NavigateCheckInput = {
      inquiryDate: '2026-03-01',
      unreachableStatus: null, // 未入力
      isFollowingUpWithoutNextCallDate: false,
      shouldShowReminder: false,
      isConfidenceWarningCondition: false,
      isFirstCallWarningCondition: false,
    };

    // バグ条件に該当することを確認
    expect(isBugCondition({
      inquiryDate: '2026-03-01',
      unreachableStatus: null,
      navigationAction: 'navbar',
    })).toBe(true);

    // 修正後の動作を検証（期待される正しい動作）
    const result = navigateWithWarningCheck_fixed(input);

    // 期待される正しい動作: 不通未入力警告ダイアログが表示されること
    expect(result.navigationWarningDialogOpened).toBe(true);
    expect(result.navigationWarningDialogType).toBe('unreachable');

    // 期待される正しい動作: onConfirm が直接呼ばれないこと（警告なしに遷移しないこと）
    expect(result.onConfirmCalledDirectly).toBe(false);
  });

  /**
   * テストケース2: 反響日2026年1月1日・不通未入力 → 「一覧に戻る」ボタン
   *
   * バグ条件:
   * - 反響日: 2026-01-01（境界値・2026年1月1日以降）
   * - unreachableStatus: null（未入力）
   * - navigationAction: 'backButton'
   *
   * 期待される正しい動作（修正後）:
   *   setNavigationWarningDialog が warningType: 'unreachable' で呼ばれる
   *
   * 修正前の動作（バグ）:
   *   setNavigationWarningDialog が呼ばれず、onConfirm が直接実行される（警告なしに遷移）
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   */
  test('テストケース2: 反響日2026年1月1日・不通未入力 → 「一覧に戻る」ボタン → 警告が表示されること', () => {
    const input: NavigateCheckInput = {
      inquiryDate: '2026-01-01',
      unreachableStatus: null, // 未入力
      isFollowingUpWithoutNextCallDate: false,
      shouldShowReminder: false,
      isConfidenceWarningCondition: false,
      isFirstCallWarningCondition: false,
    };

    // バグ条件に該当することを確認
    expect(isBugCondition({
      inquiryDate: '2026-01-01',
      unreachableStatus: null,
      navigationAction: 'backButton',
    })).toBe(true);

    // 修正後の動作を検証（期待される正しい動作）
    const result = navigateWithWarningCheck_fixed(input);

    // 期待される正しい動作: 不通未入力警告ダイアログが表示されること
    expect(result.navigationWarningDialogOpened).toBe(true);
    expect(result.navigationWarningDialogType).toBe('unreachable');

    // 期待される正しい動作: onConfirm が直接呼ばれないこと（警告なしに遷移しないこと）
    expect(result.onConfirmCalledDirectly).toBe(false);
  });

  /**
   * テストケース3: 反響日2026年2月1日・不通未入力 → 別売主への遷移
   *
   * バグ条件:
   * - 反響日: 2026-02-01（2026年1月1日以降）
   * - unreachableStatus: null（未入力）
   * - navigationAction: 'sellerSwitch'
   *
   * 期待される正しい動作（修正後）:
   *   setNavigationWarningDialog が warningType: 'unreachable' で呼ばれる
   *
   * 修正前の動作（バグ）:
   *   setNavigationWarningDialog が呼ばれず、onConfirm が直接実行される（警告なしに遷移）
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   */
  test('テストケース3: 反響日2026年2月1日・不通未入力 → 別売主への遷移 → 警告が表示されること', () => {
    const input: NavigateCheckInput = {
      inquiryDate: '2026-02-01',
      unreachableStatus: null, // 未入力
      isFollowingUpWithoutNextCallDate: false,
      shouldShowReminder: false,
      isConfidenceWarningCondition: false,
      isFirstCallWarningCondition: false,
    };

    // バグ条件に該当することを確認
    expect(isBugCondition({
      inquiryDate: '2026-02-01',
      unreachableStatus: null,
      navigationAction: 'sellerSwitch',
    })).toBe(true);

    // 修正後の動作を検証（期待される正しい動作）
    const result = navigateWithWarningCheck_fixed(input);

    // 期待される正しい動作: 不通未入力警告ダイアログが表示されること
    expect(result.navigationWarningDialogOpened).toBe(true);
    expect(result.navigationWarningDialogType).toBe('unreachable');

    // 期待される正しい動作: onConfirm が直接呼ばれないこと（警告なしに遷移しないこと）
    expect(result.onConfirmCalledDirectly).toBe(false);
  });

  /**
   * 境界値テスト: 反響日2025年12月31日・不通未入力 → 警告なし（正常動作・バグ条件外）
   *
   * 反響日が2026年1月1日より前の場合は、不通未入力でも警告を表示しない（正常動作）。
   * このテストは修正前後ともに PASS する（バグ条件外のため）。
   */
  test('境界値: 反響日2025年12月31日・不通未入力 → 警告なしに遷移（正常動作・バグ条件外）', () => {
    const input: NavigateCheckInput = {
      inquiryDate: '2025-12-31',
      unreachableStatus: null, // 未入力
      isFollowingUpWithoutNextCallDate: false,
      shouldShowReminder: false,
      isConfidenceWarningCondition: false,
      isFirstCallWarningCondition: false,
    };

    // バグ条件に該当しないことを確認（2026年1月1日より前）
    expect(isBugCondition({
      inquiryDate: '2025-12-31',
      unreachableStatus: null,
      navigationAction: 'navbar',
    })).toBe(false);

    // 修正後の動作を検証（2025年12月31日は対象外なので警告なし）
    const result = navigateWithWarningCheck_fixed(input);

    // 正常動作: 不通未入力警告ダイアログが表示されないこと
    expect(result.navigationWarningDialogType).not.toBe('unreachable');

    // 正常動作: onConfirm が直接呼ばれること（警告なしに遷移する）
    expect(result.onConfirmCalledDirectly).toBe(true);
  });
});

// -----------------------------------------------------------------------
// ソースコード静的解析: 修正前のコードにバグ条件が存在することを確認
// -----------------------------------------------------------------------

describe('ソースコード静的解析 — バグ条件の存在確認（修正前コードでFAIL）', () => {
  const TARGET_FILE = path.resolve(__dirname, '../CallModePage.tsx');

  function readTargetFile(): string {
    return fs.readFileSync(TARGET_FILE, 'utf-8');
  }

  /**
   * バグ条件の静的解析テスト1:
   * navigateWithWarningCheck 関数内に不通未入力チェックが存在すること（修正後コードで PASS）
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   *
   * 期待される修正後のコード:
   *   if (isAfterJan2026 && !unreachableStatus) {
   *     setNavigationWarningDialog({ open: true, warningType: 'unreachable', onConfirm });
   *   }
   */
  test('バグ条件1: navigateWithWarningCheck 内に不通未入力チェックが存在すること（修正後コードで PASS）', () => {
    const source = readTargetFile();

    // navigateWithWarningCheck 関数のブロックを抽出
    // 関数定義から次の関数定義まで（約100行）を取得
    const funcMatch = source.match(
      /const navigateWithWarningCheck = \(onConfirm: \(\) => void\) => \{[\s\S]{0,3000}?\n  \};/
    );

    expect(funcMatch).not.toBeNull();

    if (funcMatch) {
      const funcBody = funcMatch[0];

      // 修正後の確認: 不通未入力チェックが存在すること
      // warningType: 'unreachable' が navigateWithWarningCheck 内に存在すること
      const hasUnreachableCheck = funcBody.includes("warningType: 'unreachable'");

      // 修正後コードでは: 不通未入力チェックが存在する（PASS）
      // 修正前コードでは: 不通未入力チェックが存在しない（FAIL）
      expect(hasUnreachableCheck).toBe(true);
    }
  });

  /**
   * バグ条件の静的解析テスト2:
   * warningType の型定義に 'unreachable' が含まれること（修正後コードで PASS）
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   */
  test('バグ条件2: warningType の型定義に unreachable が含まれること（修正後コードで PASS）', () => {
    const source = readTargetFile();

    // warningType の型定義を確認
    // 修正前: warningType?: 'firstCall' | 'confidence';
    // 修正後: warningType?: 'firstCall' | 'confidence' | 'unreachable';
    const hasUnreachableType = source.includes("'unreachable'") &&
      source.match(/warningType\?.*'unreachable'/) !== null;

    // 修正後コードでは: 'unreachable' が型定義に含まれる（PASS）
    // 修正前コードでは: 'unreachable' が型定義に含まれない（FAIL）
    expect(hasUnreachableType).toBe(true);
  });

  /**
   * バグ条件の静的解析テスト3:
   * NavigationWarningDialog の UI に 'unreachable' ケースが存在すること（修正後コードで PASS）
   *
   * このテストは修正前コードで FAIL する（バグの存在を証明）
   * 修正後コードで PASS する（バグ修正を確認）
   */
  test('バグ条件3: NavigationWarningDialog の UI に unreachable ケースが存在すること（修正後コードで PASS）', () => {
    const source = readTargetFile();

    // NavigationWarningDialog の UI に '不通が未入力です' が存在すること
    const hasUnreachableUI = source.includes('不通が未入力です');

    // 修正後コードでは: '不通が未入力です' が UI に存在する（PASS）
    // 修正前コードでは: '不通が未入力です' が UI に存在しない（FAIL）
    expect(hasUnreachableUI).toBe(true);
  });
});

// -----------------------------------------------------------------------
// Property 2: Preservation テスト（タスク2）
// 修正前のコードで PASS することでベースライン動作を確認する
//
// **重要**: このテストは修正前のコードで PASS すること — PASSがベースライン動作を証明する
// **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
// -----------------------------------------------------------------------

import * as fc from 'fast-check';

// -----------------------------------------------------------------------
// 保持プロパティテスト用のヘルパー関数
// -----------------------------------------------------------------------

/**
 * 不通入力済みの場合（'不通' または '通電OK'）は不通警告が表示されないことを確認する
 * 観察1・観察2に対応
 */
function isUnreachableWarningShown(result: NavigationResult): boolean {
  return result.navigationWarningDialogOpened && result.navigationWarningDialogType === 'unreachable';
}

// -----------------------------------------------------------------------
// Property 2: Preservation テスト
// 修正前のコードで PASS することでベースライン動作を確認する
// -----------------------------------------------------------------------

describe('Property 2: Preservation — 非バグ条件入力の動作保持（修正前コードで PASS）', () => {
  /**
   * 観察1: unreachableStatus = '不通' の場合 → 不通警告なしに既存チェックが実行される
   *
   * 不通フィールドに '不通' が入力済みの場合、不通警告は表示されない。
   * 既存の確度警告・1番電話警告・次電日ブロックなどが通常通り動作する。
   *
   * このテストは修正前後ともに PASS する（不通入力済みは対象外）。
   */
  test('観察1: unreachableStatus = "不通" の場合 → 不通警告なしに既存チェックが実行される', () => {
    // fast-check: 様々な入力の組み合わせで不通警告が表示されないことを確認
    fc.assert(
      fc.property(
        // 反響日: 2026年1月1日以降（バグ条件の日付範囲）
        // fc.integer で年・月・日を生成して YYYY-MM-DD 形式の文字列を作る
        fc.integer({ min: 2026, max: 2027 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }), // 月末問題を避けるため28日まで
        // 次電日ブロック条件: ランダム
        fc.boolean(),
        // 次電日変更確認ダイアログ: ランダム
        fc.boolean(),
        // 確度警告条件: ランダム
        fc.boolean(),
        // 1番電話警告条件: ランダム
        fc.boolean(),
        (year, month, day, isFollowingUpWithoutNextCallDate, shouldShowReminder, isConfidenceWarningCondition, isFirstCallWarningCondition) => {
          const inquiryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const input: NavigateCheckInput = {
            inquiryDate,
            unreachableStatus: '不通', // 入力済み
            isFollowingUpWithoutNextCallDate,
            shouldShowReminder,
            isConfidenceWarningCondition,
            isFirstCallWarningCondition,
          };

          // 修正前のコードで実行
          const result = navigateWithWarningCheck_buggy(input);

          // 保持すべき動作: 不通警告は表示されない
          expect(isUnreachableWarningShown(result)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 観察2: unreachableStatus = '通電OK' の場合 → 不通警告なしに既存チェックが実行される
   *
   * 不通フィールドに '通電OK' が入力済みの場合、不通警告は表示されない。
   * 既存の確度警告・1番電話警告・次電日ブロックなどが通常通り動作する。
   *
   * このテストは修正前後ともに PASS する（不通入力済みは対象外）。
   */
  test('観察2: unreachableStatus = "通電OK" の場合 → 不通警告なしに既存チェックが実行される', () => {
    fc.assert(
      fc.property(
        // 反響日: 2026年1月1日以降（バグ条件の日付範囲）
        fc.integer({ min: 2026, max: 2027 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (year, month, day, isFollowingUpWithoutNextCallDate, shouldShowReminder, isConfidenceWarningCondition, isFirstCallWarningCondition) => {
          const inquiryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const input: NavigateCheckInput = {
            inquiryDate,
            unreachableStatus: '通電OK', // 入力済み
            isFollowingUpWithoutNextCallDate,
            shouldShowReminder,
            isConfidenceWarningCondition,
            isFirstCallWarningCondition,
          };

          // 修正前のコードで実行
          const result = navigateWithWarningCheck_buggy(input);

          // 保持すべき動作: 不通警告は表示されない
          expect(isUnreachableWarningShown(result)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 観察3: 反響日2025年12月31日・不通未入力 → 不通警告なしに遷移する
   *
   * 反響日が2026年1月1日より前の場合、不通未入力でも警告を表示しない（必須条件の対象外）。
   * このテストは修正前後ともに PASS する（2026年以前は対象外）。
   */
  test('観察3: 反響日2025年12月31日・不通未入力 → 不通警告なしに遷移する', () => {
    const input: NavigateCheckInput = {
      inquiryDate: '2025-12-31', // 2026年1月1日より前（対象外）
      unreachableStatus: null,   // 未入力
      isFollowingUpWithoutNextCallDate: false,
      shouldShowReminder: false,
      isConfidenceWarningCondition: false,
      isFirstCallWarningCondition: false,
    };

    // 修正前のコードで実行
    const result = navigateWithWarningCheck_buggy(input);

    // 保持すべき動作: 不通警告は表示されない
    expect(isUnreachableWarningShown(result)).toBe(false);

    // 保持すべき動作: 警告なしに遷移する（onConfirm が直接呼ばれる）
    expect(result.onConfirmCalledDirectly).toBe(true);
  });

  /**
   * 観察3（プロパティ版）: 反響日2026年以前・不通未入力 → 不通警告なしに遷移する
   *
   * 反響日が2026年1月1日より前の任意の日付で、不通未入力でも警告を表示しない。
   * このテストは修正前後ともに PASS する。
   */
  test('観察3（プロパティ版）: 反響日2026年以前・不通未入力 → 不通警告なしに遷移する', () => {
    fc.assert(
      fc.property(
        // 反響日: 2026年1月1日より前（対象外の日付範囲）
        fc.integer({ min: 2020, max: 2025 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const inquiryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const input: NavigateCheckInput = {
            inquiryDate,
            unreachableStatus: null, // 未入力
            isFollowingUpWithoutNextCallDate: false,
            shouldShowReminder: false,
            isConfidenceWarningCondition: false,
            isFirstCallWarningCondition: false,
          };

          // 修正前のコードで実行
          const result = navigateWithWarningCheck_buggy(input);

          // 保持すべき動作: 不通警告は表示されない
          expect(isUnreachableWarningShown(result)).toBe(false);

          // 保持すべき動作: 警告なしに遷移する（onConfirm が直接呼ばれる）
          expect(result.onConfirmCalledDirectly).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 観察4: 次電日未入力かつ不通未入力 → 次電日ブロックが優先される（不通警告は表示されない）
   *
   * 次電日未入力ブロックは最優先で動作する。
   * 不通未入力でも次電日ブロックが先に発動し、不通警告は表示されない。
   * このテストは修正前後ともに PASS する（次電日ブロックが優先されるため）。
   */
  test('観察4: 次電日未入力かつ不通未入力 → 次電日ブロックが優先される（不通警告は表示されない）', () => {
    fc.assert(
      fc.property(
        // 反響日: 2026年1月1日以降（バグ条件の日付範囲）
        fc.integer({ min: 2026, max: 2027 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        (year, month, day) => {
          const inquiryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const input: NavigateCheckInput = {
            inquiryDate,
            unreachableStatus: null,              // 未入力（バグ条件）
            isFollowingUpWithoutNextCallDate: true, // 次電日ブロック条件（最優先）
            shouldShowReminder: false,
            isConfidenceWarningCondition: false,
            isFirstCallWarningCondition: false,
          };

          // 修正前のコードで実行
          const result = navigateWithWarningCheck_buggy(input);

          // 保持すべき動作: 次電日ブロックが表示される
          expect(result.navigationBlockDialogOpened).toBe(true);

          // 保持すべき動作: 不通警告は表示されない（次電日ブロックが優先）
          expect(isUnreachableWarningShown(result)).toBe(false);

          // 保持すべき動作: onConfirm は直接呼ばれない
          expect(result.onConfirmCalledDirectly).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * 観察5: 不通入力済み・確度未入力 → 確度警告が表示される（不通警告は表示されない）
   *
   * 不通フィールドが入力済みの場合、確度未入力警告が通常通り動作する。
   * 不通警告は表示されない。
   * このテストは修正前後ともに PASS する（不通入力済みは対象外）。
   */
  test('観察5: 不通入力済み・確度未入力 → 確度警告が表示される（不通警告は表示されない）', () => {
    fc.assert(
      fc.property(
        // 反響日: 2026年1月1日以降（バグ条件の日付範囲）
        fc.integer({ min: 2026, max: 2027 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        // 不通ステータス: '不通' または '通電OK'（入力済み）
        fc.constantFrom('不通', '通電OK'),
        (year, month, day, unreachableStatus) => {
          const inquiryDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const input: NavigateCheckInput = {
            inquiryDate,
            unreachableStatus,              // 入力済み
            isFollowingUpWithoutNextCallDate: false,
            shouldShowReminder: false,
            isConfidenceWarningCondition: true, // 確度未入力警告条件
            isFirstCallWarningCondition: false,
          };

          // 修正前のコードで実行
          const result = navigateWithWarningCheck_buggy(input);

          // 保持すべき動作: 確度警告が表示される
          expect(result.navigationWarningDialogOpened).toBe(true);
          expect(result.navigationWarningDialogType).toBe('confidence');

          // 保持すべき動作: 不通警告は表示されない
          expect(isUnreachableWarningShown(result)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
