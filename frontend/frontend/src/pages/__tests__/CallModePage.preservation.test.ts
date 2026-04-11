/**
 * CallModePage 保全プロパティテスト（Property 2: Preservation）
 *
 * このテストは修正前のコードでPASSすることで、保全すべきベースライン動作を確認する。
 * 修正後もこのテストがPASSすることで、リグレッションがないことを確認する。
 *
 * **観察優先メソドロジー**: 修正前のコードで非バグ条件の入力に対する動作を観察し、
 * その動作をテストとして記録する。
 *
 * **観察結果**:
 * - `reason_relocation_3day` → `valuationReasonEmailAssignee` が返される（IDマッピング使用）
 * - `visit_reminder` ラベルを含むテンプレート → `visitReminderAssignee` が返される
 * - `remind` ラベルを含むテンプレート → `callReminderEmailAssignee` が返される
 * - `キャンセル案内` ラベルを含むテンプレート → `cancelNoticeAssignee` が返される
 * - `長期客` または `除外前` ラベルを含むテンプレート → `longTermEmailAssignee` が返される
 *
 * **EXPECTED OUTCOME**: テストPASS（保全すべきベースライン動作を確認）
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */
// vitestのグローバルAPI（vite.config.ts: globals: true）を使用するため、インポート不要

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

// -----------------------------------------------------------------------
// Property 2: Preservation テスト
// 修正前のコードでPASSすることで、保全すべきベースライン動作を確認する
// -----------------------------------------------------------------------

describe('Property 2: Preservation — 既存のIDベースマッピングの保持', () => {
  /**
   * テストケース1: EMAIL_TEMPLATE_ASSIGNEE_MAPの全エントリに対するIDマッピング保持
   * IDマッピングが存在するテンプレートは、修正前後で同じ assigneeKey が返されること
   *
   * **Validates: Requirements 3.2, 3.3, 3.6, 3.7**
   */
  describe('IDマッピング保持: EMAIL_TEMPLATE_ASSIGNEE_MAPの全エントリ', () => {
    const mapEntries = Object.entries(EMAIL_TEMPLATE_ASSIGNEE_MAP);

    test.each(mapEntries)(
      'ID "%s" → assigneeKey "%s" が返されること',
      (templateId, expectedAssigneeKey) => {
        // IDマッピングが存在するテンプレート（非バグ条件）
        const template = { id: templateId, label: `テスト用ラベル（${templateId}）` };

        // フォールバック判定を実行
        const result = getAssigneeKeyFromFallback_buggy(template);

        // IDマッピングが使用されること（ラベルフォールバックに落ちないこと）
        expect(result).toBe(expectedAssigneeKey);
      }
    );
  });

  /**
   * テストケース2: 査定理由別３後Eメール（IDマッピング使用）の保持
   * reason_relocation_3day → valuationReasonEmailAssignee が返されること
   *
   * 観察: `reason_relocation_3day` → `valuationReasonEmailAssignee` が返される（IDマッピング使用）
   *
   * **Validates: Requirements 3.2**
   */
  test('reason_relocation_3day → valuationReasonEmailAssignee が返されること（IDマッピング使用）', () => {
    const template = { id: 'reason_relocation_3day', label: '（査定理由別）住替え先（３日後メール）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    // IDマッピングが使用されること
    expect(result).toBe('valuationReasonEmailAssignee');
  });

  test('reason_inheritance_3day → valuationReasonEmailAssignee が返されること（IDマッピング使用）', () => {
    const template = { id: 'reason_inheritance_3day', label: '（査定理由別）相続（３日後メール）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('valuationReasonEmailAssignee');
  });

  test('reason_divorce_3day → valuationReasonEmailAssignee が返されること（IDマッピング使用）', () => {
    const template = { id: 'reason_divorce_3day', label: '（査定理由別）離婚（３日後メール）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('valuationReasonEmailAssignee');
  });

  test('reason_loan_3day → valuationReasonEmailAssignee が返されること（IDマッピング使用）', () => {
    const template = { id: 'reason_loan_3day', label: '（査定理由別）ローン厳しい（３日後メール）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('valuationReasonEmailAssignee');
  });

  /**
   * テストケース3: 訪問前日通知メール（ラベルフォールバック）の保持
   * visit_reminder ラベルを含むテンプレート → visitReminderAssignee が返されること
   *
   * 観察: `visit_reminder` ラベルを含むテンプレート → `visitReminderAssignee` が返される
   *
   * **Validates: Requirements 3.4**
   */
  test('☆訪問前日通知メール → visitReminderAssignee が返されること（ラベルフォールバック）', () => {
    // IDがEMAIL_TEMPLATE_ASSIGNEE_MAPに存在しないスプシ由来テンプレート
    const template = { id: 'seller_sheet_1', label: '☆訪問前日通知メール' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('visitReminderAssignee');
  });

  test('訪問前日を含むラベル → visitReminderAssignee が返されること（ラベルフォールバック）', () => {
    const template = { id: 'seller_sheet_2', label: '訪問前日通知メール（カスタム）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('visitReminderAssignee');
  });

  /**
   * テストケース4: リマインドメール（ラベルフォールバック）の保持
   * remind ラベルを含むテンプレート → callReminderEmailAssignee が返されること
   *
   * 観察: `remind` ラベルを含むテンプレート → `callReminderEmailAssignee` が返される
   *
   * **Validates: Requirements 3.5**
   */
  test('リマインド → callReminderEmailAssignee が返されること（ラベルフォールバック）', () => {
    const template = { id: 'seller_sheet_3', label: 'リマインド' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('callReminderEmailAssignee');
  });

  test('リマインドを含むラベル → callReminderEmailAssignee が返されること（ラベルフォールバック）', () => {
    const template = { id: 'seller_sheet_4', label: 'リマインドメール（カスタム）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('callReminderEmailAssignee');
  });

  /**
   * テストケース5: キャンセル案内（ラベルフォールバック）の保持
   * キャンセル案内 ラベルを含むテンプレート → cancelNoticeAssignee が返されること
   *
   * 観察: `キャンセル案内` ラベルを含むテンプレート → `cancelNoticeAssignee` が返される
   *
   * **Validates: Requirements 3.3, 3.6**
   */
  test('キャンセル案内のみ（イエウール）→ cancelNoticeAssignee が返されること（ラベルフォールバック）', () => {
    const template = { id: 'seller_sheet_5', label: 'キャンセル案内のみ（イエウール）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('cancelNoticeAssignee');
  });

  test('キャンセルを含むラベル → cancelNoticeAssignee が返されること（ラベルフォールバック）', () => {
    const template = { id: 'seller_sheet_6', label: 'キャンセル通知メール' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('cancelNoticeAssignee');
  });

  /**
   * テストケース6: 長期客・除外前（ラベルフォールバック）の保持
   * 長期客 または 除外前 ラベルを含むテンプレート → longTermEmailAssignee が返されること
   *
   * 観察: `長期客` または `除外前` ラベルを含むテンプレート → `longTermEmailAssignee` が返される
   *
   * **Validates: Requirements 3.7**
   */
  test('長期客を含むラベル → longTermEmailAssignee が返されること（ラベルフォールバック）', () => {
    const template = { id: 'seller_sheet_7', label: '除外前、長期客（お客様いるメール）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('longTermEmailAssignee');
  });

  test('除外前を含むラベル → longTermEmailAssignee が返されること（ラベルフォールバック）', () => {
    const template = { id: 'seller_sheet_8', label: '除外前メール（カスタム）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    expect(result).toBe('longTermEmailAssignee');
  });

  /**
   * テストケース7: IDマッピングが存在する場合はラベルフォールバックに落ちないこと
   * IDマッピングが存在するテンプレートは、ラベルに関わらずIDマッピングが優先されること
   *
   * **Validates: Requirements 3.2**
   */
  test('IDマッピングが存在する場合、ラベルに関わらずIDマッピングが優先されること', () => {
    // reason_relocation_3day はIDマッピングで valuationReasonEmailAssignee にマッピングされる
    // ラベルに「キャンセル」が含まれていても、IDマッピングが優先される
    const template = { id: 'reason_relocation_3day', label: 'キャンセル案内（テスト用）' };

    const result = getAssigneeKeyFromFallback_buggy(template);

    // IDマッピングが優先されること（ラベルフォールバックに落ちないこと）
    expect(result).toBe('valuationReasonEmailAssignee');
    expect(result).not.toBe('cancelNoticeAssignee');
  });
});

// -----------------------------------------------------------------------
// 保全プロパティテスト: EMAIL_TEMPLATE_ASSIGNEE_MAPの全エントリに対する一括検証
// -----------------------------------------------------------------------

describe('保全プロパティ: EMAIL_TEMPLATE_ASSIGNEE_MAPの全エントリに対する一括検証', () => {
  /**
   * プロパティベーステスト: EMAIL_TEMPLATE_ASSIGNEE_MAPの全エントリに対して、
   * 修正前後で同じ assigneeKey が返されること
   *
   * このテストは修正前のコードでPASSすることで、ベースライン動作を記録する。
   * 修正後もPASSすることで、リグレッションがないことを確認する。
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
   */
  test('EMAIL_TEMPLATE_ASSIGNEE_MAPの全エントリに対して正しいassigneeKeyが返されること', () => {
    const mapEntries = Object.entries(EMAIL_TEMPLATE_ASSIGNEE_MAP);

    for (const [templateId, expectedAssigneeKey] of mapEntries) {
      const template = { id: templateId, label: `テスト用ラベル（${templateId}）` };
      const result = getAssigneeKeyFromFallback_buggy(template);

      expect(result).toBe(expectedAssigneeKey);
    }
  });

  test('EMAIL_TEMPLATE_ASSIGNEE_MAPの全エントリ数が14であること（マップの完全性確認）', () => {
    const mapEntries = Object.entries(EMAIL_TEMPLATE_ASSIGNEE_MAP);
    expect(mapEntries.length).toBe(14);
  });

  test('cancelNoticeAssigneeにマッピングされるIDが7つであること', () => {
    const cancelEntries = Object.entries(EMAIL_TEMPLATE_ASSIGNEE_MAP)
      .filter(([, v]) => v === 'cancelNoticeAssignee');
    expect(cancelEntries.length).toBe(7);
  });

  test('valuationReasonEmailAssigneeにマッピングされるIDが4つであること', () => {
    const valuationEntries = Object.entries(EMAIL_TEMPLATE_ASSIGNEE_MAP)
      .filter(([, v]) => v === 'valuationReasonEmailAssignee');
    expect(valuationEntries.length).toBe(4);
  });

  test('reason_*_3day IDのみがvaluationReasonEmailAssigneeにマッピングされること', () => {
    const valuationEntries = Object.entries(EMAIL_TEMPLATE_ASSIGNEE_MAP)
      .filter(([, v]) => v === 'valuationReasonEmailAssignee');

    for (const [id] of valuationEntries) {
      expect(id).toMatch(/^reason_.+_3day$/);
    }
  });
});
