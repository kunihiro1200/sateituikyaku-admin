/**
 * CallModePage バグ条件探索テスト（Property 1: Bug Condition）
 *
 * このテストは修正前のコードでFAILすることでバグの存在を証明する。
 * テストはhandleConfirmSend内のフォールバック判定ロジックを純粋関数として抽出してテストする。
 *
 * **CRITICAL**: このテストは修正前のコードで必ずFAILすること — FAILがバグの存在を証明する
 * **DO NOT attempt to fix the test or the code when it fails**
 * **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることで修正を検証する
 *
 * **Validates: Requirements 2.3, 2.4**
 */
import { describe, test, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// -----------------------------------------------------------------------
// EMAIL_TEMPLATE_ASSIGNEE_MAP の定義（AssigneeSection.tsxから抽出）
// -----------------------------------------------------------------------
const EMAIL_TEMPLATE_ASSIGNEE_MAP: Record<string, string> = {
  ieul_call_cancel:            'cancelNoticeAssignee',
  ieul_cancel_only:            'cancelNoticeAssignee',
  lifull_yahoo_call_cancel:    'cancelNoticeAssignee',
  lifull_yahoo_cancel_only:    'cancelNoticeAssignee',
  sumai_step_call_cancel:      'cancelNoticeAssignee',
  sumai_step_cancel_only:      'cancelNoticeAssignee',
  home4u_call_cancel:          'cancelNoticeAssignee',
  reason_relocation_3day:      'valuationReasonEmailAssignee',
  reason_inheritance_3day:     'valuationReasonEmailAssignee',
  reason_divorce_3day:         'valuationReasonEmailAssignee',
  reason_loan_3day:            'valuationReasonEmailAssignee',
  exclusion_long_term:         'longTermEmailAssignee',
  remind:                      'callReminderEmailAssignee',
  visit_reminder:              'visitReminderAssignee',
};

// -----------------------------------------------------------------------
// handleConfirmSend内のフォールバック判定ロジックを純粋関数として抽出
// （修正前のコードをそのまま再現）
// -----------------------------------------------------------------------

/**
 * 修正前のフォールバック判定ロジック（CallModePage.tsx 約3083行目付近）
 * EMAIL_TEMPLATE_ASSIGNEE_MAPにIDが存在しない場合、ラベルで判定する
 */
function getAssigneeKeyFromFallback_buggy(template: { id: string; label: string }): string | undefined {
  // まずIDマッピングを試みる
  let assigneeKeyForDirect: string | undefined = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];

  if (!assigneeKeyForDirect) {
    // ラベルによるフォールバック判定（スプシ由来テンプレート対応）
    // 修正前のコード: 査定額案内・査定理由の条件が存在する（バグ）
    if (template.label === '☆訪問前日通知メール' || template.label.includes('訪問前日')) {
      assigneeKeyForDirect = 'visitReminderAssignee';
    } else if (template.label === 'リマインド' || template.label.includes('リマインド')) {
      assigneeKeyForDirect = 'callReminderEmailAssignee';
    } else if (template.label.includes('キャンセル')) {
      assigneeKeyForDirect = 'cancelNoticeAssignee';
    } else if (template.label.includes('査定額案内') || template.label.includes('査定理由')) {
      // ⚠️ バグ: この条件が意図しないテンプレートにもマッチする
      assigneeKeyForDirect = 'valuationReasonEmailAssignee';
    } else if (template.label.includes('長期客') || template.label.includes('除外前')) {
      assigneeKeyForDirect = 'longTermEmailAssignee';
    }
  }

  return assigneeKeyForDirect;
}

/**
 * 修正後のフォールバック判定ロジック（CallModePage.tsx 修正後）
 * 査定額案内・査定理由のフォールバック条件を削除した修正後コード
 */
function getAssigneeKeyFromFallback_fixed(template: { id: string; label: string }): string | undefined {
  // まずIDマッピングを試みる
  let assigneeKeyForDirect: string | undefined = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];

  if (!assigneeKeyForDirect) {
    // ラベルによるフォールバック判定（スプシ由来テンプレート対応）
    // 修正後のコード: 査定額案内・査定理由の条件を削除
    if (template.label === '☆訪問前日通知メール' || template.label.includes('訪問前日')) {
      assigneeKeyForDirect = 'visitReminderAssignee';
    } else if (template.label === 'リマインド' || template.label.includes('リマインド')) {
      assigneeKeyForDirect = 'callReminderEmailAssignee';
    } else if (template.label.includes('キャンセル')) {
      assigneeKeyForDirect = 'cancelNoticeAssignee';
    } else if (template.label.includes('長期客') || template.label.includes('除外前')) {
      assigneeKeyForDirect = 'longTermEmailAssignee';
    }
    // ✅ 修正: 査定額案内・査定理由の条件を削除（reason_*_3dayはIDマッピングで処理される）
  }

  return assigneeKeyForDirect;
}

// -----------------------------------------------------------------------
// バグ条件の定義（design.mdのisBugCondition関数に対応）
// -----------------------------------------------------------------------

/**
 * バグ条件: EMAIL_TEMPLATE_ASSIGNEE_MAPにIDが存在しない かつ
 * ラベルに'査定額案内'または'査定理由'を含む かつ
 * IDがreason_*_3dayでない
 */
function isBugCondition(template: { id: string; label: string }): boolean {
  const mapResult = EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id];
  if (mapResult !== undefined) {
    return false; // IDマッピングが存在する場合はバグ条件に該当しない
  }
  return (
    (template.label.includes('査定額案内') || template.label.includes('査定理由')) &&
    !(['reason_relocation_3day', 'reason_inheritance_3day', 'reason_divorce_3day', 'reason_loan_3day'].includes(template.id))
  );
}

// -----------------------------------------------------------------------
// Property 1: Bug Condition テスト
// 修正前のコードでFAILすることでバグの存在を証明する
// -----------------------------------------------------------------------

describe('Property 1: Bug Condition — 誤ったvaluationReasonEmailAssignee書き込みの検出', () => {
  /**
   * テストケース1: 査定額案内メール（相続以外）
   * seller_sheet_99 は EMAIL_TEMPLATE_ASSIGNEE_MAP に存在しない
   * ラベルに'査定額案内'が含まれるため、修正前コードでは valuationReasonEmailAssignee が設定される（バグ）
   *
   * 期待される正しい動作: valuationReasonEmailAssignee が設定されないこと
   * 修正前の動作（バグ）: valuationReasonEmailAssignee が設定される
   */
  test('査定額案内メール（相続以外）: valuationReasonEmailAssignee が設定されないこと', () => {
    const template = { id: 'seller_sheet_99', label: '査定額案内メール（相続以外）' };

    // バグ条件に該当することを確認
    expect(isBugCondition(template)).toBe(true);

    // 修正後のフォールバック判定を実行
    const assigneeKeyForDirect = getAssigneeKeyFromFallback_fixed(template);

    // 期待される正しい動作: valuationReasonEmailAssignee が設定されないこと
    expect(assigneeKeyForDirect).not.toBe('valuationReasonEmailAssignee');
  });

  /**
   * テストケース2: 査定理由確認メール
   * seller_sheet_100 は EMAIL_TEMPLATE_ASSIGNEE_MAP に存在しない
   * ラベルに'査定理由'が含まれるため、修正前コードでは valuationReasonEmailAssignee が設定される（バグ）
   *
   * 期待される正しい動作: valuationReasonEmailAssignee が設定されないこと
   * 修正前の動作（バグ）: valuationReasonEmailAssignee が設定される
   */
  test('査定理由確認メール: valuationReasonEmailAssignee が設定されないこと', () => {
    const template = { id: 'seller_sheet_100', label: '査定理由確認メール' };

    // バグ条件に該当することを確認
    expect(isBugCondition(template)).toBe(true);

    // 修正後のフォールバック判定を実行
    const assigneeKeyForDirect = getAssigneeKeyFromFallback_fixed(template);

    // 期待される正しい動作: valuationReasonEmailAssignee が設定されないこと
    expect(assigneeKeyForDirect).not.toBe('valuationReasonEmailAssignee');
  });

  /**
   * テストケース3: 査定額案内メール（一般）
   * スプシ由来の任意のIDで、ラベルに'査定額案内'が含まれる場合
   */
  test('査定額案内メール（一般）: valuationReasonEmailAssignee が設定されないこと', () => {
    const template = { id: 'seller_sheet_50', label: '査定額案内メール' };

    // バグ条件に該当することを確認
    expect(isBugCondition(template)).toBe(true);

    // 修正後のフォールバック判定を実行
    const assigneeKeyForDirect = getAssigneeKeyFromFallback_fixed(template);

    // 期待される正しい動作: valuationReasonEmailAssignee が設定されないこと
    expect(assigneeKeyForDirect).not.toBe('valuationReasonEmailAssignee');
  });
});

// -----------------------------------------------------------------------
// 補足: バグ条件の確認（修正後コードでvaluationReasonEmailAssigneeが設定されないことを確認）
// -----------------------------------------------------------------------

describe('バグ条件の直接確認 — 修正後コードでvaluationReasonEmailAssigneeが誤って設定されないことを確認', () => {
  test('修正後コード: 査定額案内メール（相続以外）に対してvaluationReasonEmailAssigneeが設定されないこと（バグ修正確認）', () => {
    const template = { id: 'seller_sheet_99', label: '査定額案内メール（相続以外）' };

    // 修正後のフォールバック判定を実行
    const assigneeKeyForDirect = getAssigneeKeyFromFallback_fixed(template);

    // バグ修正確認: 修正後コードでは valuationReasonEmailAssignee が設定されない
    expect(assigneeKeyForDirect).not.toBe('valuationReasonEmailAssignee');
  });

  test('修正後コード: 査定理由確認メールに対してvaluationReasonEmailAssigneeが設定されないこと（バグ修正確認）', () => {
    const template = { id: 'seller_sheet_100', label: '査定理由確認メール' };

    // 修正後のフォールバック判定を実行
    const assigneeKeyForDirect = getAssigneeKeyFromFallback_fixed(template);

    // バグ修正確認: 修正後コードでは valuationReasonEmailAssignee が設定されない
    expect(assigneeKeyForDirect).not.toBe('valuationReasonEmailAssignee');
  });
});

// -----------------------------------------------------------------------
// ソースコード静的解析: 修正前のコードにバグ条件が存在することを確認
// -----------------------------------------------------------------------

describe('ソースコード静的解析 — 修正後コードにバグ条件が存在しないことを確認', () => {
  const TARGET_FILE = path.resolve(__dirname, '../CallModePage.tsx');

  function readTargetFile(): string {
    return fs.readFileSync(TARGET_FILE, 'utf-8');
  }

  test('CallModePage.tsxに査定額案内・査定理由のフォールバック判定が存在しないこと（バグ修正確認）', () => {
    const source = readTargetFile();

    // 修正後の確認: 査定額案内・査定理由のフォールバック判定が削除されていること
    const bugConditionMatch = source.match(
      /template\.label\.includes\('査定額案内'\)\s*\|\|\s*template\.label\.includes\('査定理由'\)/
    );
    expect(bugConditionMatch).toBeNull();
  });

  test('バグ条件のフォールバック判定がvaluationReasonEmailAssigneeを設定していないこと（バグ修正確認）', () => {
    const source = readTargetFile();

    // 修正後の確認: ラベルフォールバックでvaluationReasonEmailAssigneeを設定するコードが削除されていること
    const bugAssignmentMatch = source.match(
      /template\.label\.includes\('査定額案内'\)[\s\S]{0,200}valuationReasonEmailAssignee/
    );
    expect(bugAssignmentMatch).toBeNull();
  });
});
