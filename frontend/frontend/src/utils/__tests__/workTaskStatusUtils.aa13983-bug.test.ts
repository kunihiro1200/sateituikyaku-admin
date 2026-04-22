/**
 * バグ条件探索テスト - AA13983 サイドバーカテゴリーバグ
 *
 * **Feature: business-list-aa13983-sidebar-category-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1**
 *
 * このテストは**未修正コードで FAIL** することが期待される。
 * FAIL = バグが存在することの証明。
 *
 * バグの根本原因（未修正）:
 * - WorkTask インターフェースに cw_request_email_site が未定義
 * - 条件3（サイト登録依頼してください）が cw_request_email_site を考慮していない
 * - cw_request_email_site = 'N'（依頼済み）でも条件3が適用されてしまう
 *
 * CRITICAL: このテストが FAIL したら、コードを修正しないこと。
 * FAIL は「バグが存在する」ことの証明であり、正しい結果。
 */

import { calculateTaskStatus } from '../workTaskStatusUtils';

// ============================================================
// テスト用ヘルパー
// ============================================================

/**
 * 最小限の WorkTask オブジェクトを生成するヘルパー
 * 指定したフィールドのみ上書きする
 */
const makeTask = (overrides: Record<string, any> = {}): any => ({
  id: 'test-id',
  property_number: 'AA13983',
  property_address: 'テスト住所',
  seller_name: 'テスト売主',
  sales_assignee: 'テスト担当',
  property_type: '',
  mediation_type: '',
  mediation_deadline: null,
  mediation_completed: null,
  mediation_notes: null,
  sales_contract_confirmed: null,
  sales_contract_deadline: null,
  binding_scheduled_date: null,
  binding_completed: null,
  on_hold: null,
  settlement_date: null,
  hirose_request_sales: null,
  cw_request_sales: null,
  employee_contract_creation: null,
  accounting_confirmed: null,
  cw_completed_email_sales: null,
  work_completed_chat_hirose: null,
  sales_contract_assignee: null,
  site_registration_requestor: null,
  distribution_date: null,
  publish_scheduled_date: null,
  site_registration_deadline: null,
  settlement_completed_chat: null,
  ledger_created: null,
  site_registration_confirm_request_date: null,
  site_registration_confirmed: null,
  ...overrides,
});

// ============================================================
// バグ条件テスト（未修正コードで FAIL することが期待される）
// ============================================================

describe('Property 1: Bug Condition - cw_request_email_siteに値がある場合に条件3が誤って適用されるバグ', () => {
  /**
   * テスト1: AA13983 再現テスト
   *
   * DBデータ:
   * - cw_request_email_site = 'N'（依頼済み）
   * - site_registration_requestor = null（空）
   * - site_registration_deadline = '2026-04-22'（設定済み）
   * - sales_contract_deadline = null（空）
   *
   * 期待動作: 「サイト登録依頼してください」で始まらない
   * 未修正コードでの実際の動作: 「サイト登録依頼してください 4/22」を返す（バグ）
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト1: AA13983再現 - cw_request_email_site="N"の場合、「サイト登録依頼してください」で始まらない', () => {
    const task = makeTask({
      site_registration_requestor: null,
      cw_request_email_site: 'N',
      site_registration_deadline: '2026-04-22',
      sales_contract_deadline: null,
      on_hold: null,
      distribution_date: null,
      publish_scheduled_date: null,
    });

    const result = calculateTaskStatus(task);

    // 期待: 「サイト登録依頼してください」で始まらない
    // 未修正コードでは「サイト登録依頼してください 4/22」が返るためFAIL
    expect(result).not.toMatch(/^サイト登録依頼してください/);
  });

  /**
   * テスト2: cw_request_email_site = 'Y' テスト
   *
   * 同条件で cw_request_email_site = 'Y'（依頼済み）の場合も同様にバグが発現する
   *
   * 期待動作: 「サイト登録依頼してください」で始まらない
   * 未修正コードでの実際の動作: 「サイト登録依頼してください 4/22」を返す（バグ）
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト2: cw_request_email_site="Y"の場合、「サイト登録依頼してください」で始まらない', () => {
    const task = makeTask({
      site_registration_requestor: null,
      cw_request_email_site: 'Y',
      site_registration_deadline: '2026-04-22',
      sales_contract_deadline: null,
      on_hold: null,
      distribution_date: null,
      publish_scheduled_date: null,
    });

    const result = calculateTaskStatus(task);

    // 期待: 「サイト登録依頼してください」で始まらない
    // 未修正コードでは「サイト登録依頼してください 4/22」が返るためFAIL
    expect(result).not.toMatch(/^サイト登録依頼してください/);
  });
});

// ============================================================
// 保持プロパティテスト（未修正コードで PASS することが期待される）
// ============================================================

describe('Property 2: Preservation - cw_request_email_siteが空の場合の既存動作の保持', () => {
  /**
   * 観察1: cw_request_email_site = null の場合、「サイト登録依頼してください 4/22」が返る
   *
   * cw_request_email_site が空（null）の場合、条件3が適用されて
   * 「サイト登録依頼してください」が返ることを確認する。
   * 修正後もこの動作が保持されることを検証する。
   *
   * **Validates: Requirements 3.1**
   */
  it('観察1: cw_request_email_site=nullの場合、「サイト登録依頼してください 4/22」が返る', () => {
    const task = makeTask({
      site_registration_requestor: null,
      cw_request_email_site: null,
      site_registration_deadline: '2026-04-22',
      sales_contract_deadline: null,
      on_hold: null,
      distribution_date: null,
      publish_scheduled_date: null,
    });

    const result = calculateTaskStatus(task);

    expect(result).toBe('サイト登録依頼してください 4/22');
  });

  /**
   * 観察2: site_registration_confirm_request_date が設定済みの場合、「サイト登録要確認」が返る
   *
   * **Validates: Requirements 3.2**
   */
  it('観察2: site_registration_confirm_request_dateが設定済みの場合、「サイト登録要確認」が返る', () => {
    const task = makeTask({
      site_registration_confirm_request_date: '2026-04-01',
      site_registration_confirmed: null,
      site_registration_deadline: '2026-04-22',
      site_registration_requestor: '田中',  // 条件3をスキップさせるため設定
      sales_contract_deadline: null,
    });

    const result = calculateTaskStatus(task);

    expect(result).toMatch(/^サイト登録要確認/);
  });

  /**
   * 観察3: sales_contract_confirmed = '確認中' の場合、「売買契約　営業確認中」が返る
   *
   * **Validates: Requirements 3.3**
   */
  it('観察3: sales_contract_confirmed="確認中"の場合、「売買契約　営業確認中」が返る', () => {
    const task = makeTask({
      sales_contract_confirmed: '確認中',
      sales_contract_deadline: '2026-05-01',
    });

    const result = calculateTaskStatus(task);

    expect(result).toMatch(/^売買契約　営業確認中/);
  });

  /**
   * 観察4: on_hold が設定済みの場合、「保留」が返る
   *
   * **Validates: Requirements 3.4**
   */
  it('観察4: on_holdが設定済みの場合、「保留」が返る', () => {
    const task = makeTask({
      on_hold: '2026-04-01',
      site_registration_deadline: null,  // 条件3・9をスキップさせるため空に設定
    });

    const result = calculateTaskStatus(task);

    expect(result).toBe('保留');
  });

  /**
   * 観察5: sales_contract_deadline が設定済みで依頼未の場合、「売買契約 依頼未」が返る
   *
   * **Validates: Requirements 3.5**
   */
  it('観察5: sales_contract_deadlineが設定済みで依頼未の場合、「売買契約 依頼未」が返る', () => {
    const task = makeTask({
      sales_contract_deadline: '2026-06-01',
      binding_scheduled_date: null,
      binding_completed: null,
      settlement_date: null,
      accounting_confirmed: null,
      on_hold: null,
      hirose_request_sales: null,
      cw_request_sales: null,
      employee_contract_creation: null,
    });

    const result = calculateTaskStatus(task);

    expect(result).toMatch(/^売買契約 依頼未/);
  });
});
