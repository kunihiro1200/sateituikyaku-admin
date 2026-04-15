/**
 * Preservation Tests - 保持プロパティテスト（修正実装前）
 *
 * Property 2: Preservation - 非バグ条件の動作保持
 *
 * IMPORTANT: このテストは未修正コードで PASS することが期待される（ベースライン動作の確認）
 * 修正後も引き続き PASS することでリグレッションがないことを確認する
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { readFileSync } from 'fs';
import { join } from 'path';
import { calculatePropertyStatus } from '../utils/propertyListingStatusUtils';

// ============================================================
// テスト1: publish_scheduled_date が null または将来の日付の物件は「本日公開予定」にならない
// ============================================================
describe('Preservation Test 1: publish_scheduled_date が null または将来の日付の物件は「本日公開予定」にならない', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  /**
   * Validates: Requirements 3.1
   * atbb_status が「一般・公開前」で publish_scheduled_date が null → 「本日公開予定」にならない
   */
  it('atbb_status が「一般・公開前」で workTaskMap に null の公開予定日がある場合、「本日公開予定」にならない', () => {
    const listing = {
      property_number: 'PRES001',
      atbb_status: '一般・公開前',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    // publish_scheduled_date が null の workTaskMap
    const workTaskMap = new Map<string, Date | null>();
    workTaskMap.set('PRES001', null);

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「本日公開予定」にならないことを確認
    expect(status.key).not.toBe('today_publish');
  });

  it('atbb_status が「一般・公開前」で workTaskMap に物件番号が存在しない場合、「本日公開予定」にならない', () => {
    const listing = {
      property_number: 'PRES002',
      atbb_status: '一般・公開前',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    // 空の workTaskMap（物件番号が存在しない）
    const workTaskMap = new Map<string, Date | null>();

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「本日公開予定」にならないことを確認
    expect(status.key).not.toBe('today_publish');
  });

  /**
   * Validates: Requirements 3.1
   * atbb_status が「一般・公開前」で publish_scheduled_date が将来の日付 → 「本日公開予定」にならない
   */
  it('atbb_status が「一般・公開前」で publish_scheduled_date が明日の場合、「本日公開予定」にならない', () => {
    const listing = {
      property_number: 'PRES003',
      atbb_status: '一般・公開前',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    // publish_scheduled_date が明日の workTaskMap
    const workTaskMap = new Map<string, Date | null>();
    workTaskMap.set('PRES003', tomorrow);

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「本日公開予定」にならないことを確認
    expect(status.key).not.toBe('today_publish');
  });

  it('atbb_status が「専任・公開前」で publish_scheduled_date が将来の日付の場合、「本日公開予定」にならない', () => {
    const listing = {
      property_number: 'PRES004',
      atbb_status: '専任・公開前',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    // publish_scheduled_date が来週の workTaskMap
    const workTaskMap = new Map<string, Date | null>();
    workTaskMap.set('PRES004', nextWeek);

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「本日公開予定」にならないことを確認
    expect(status.key).not.toBe('today_publish');
  });

  it('atbb_status が「一般・公開前」で workTaskMap が undefined の場合、「本日公開予定」にならない', () => {
    const listing = {
      property_number: 'PRES005',
      atbb_status: '一般・公開前',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    // workTaskMap を渡さない（undefined）
    const status = calculatePropertyStatus(listing as any, undefined);

    // 「本日公開予定」にならないことを確認
    expect(status.key).not.toBe('today_publish');
  });
});

// ============================================================
// テスト2: atbb_status が「公開前」以外の物件は既存のステータス判定が適用される
// ============================================================
describe('Preservation Test 2: atbb_status が「公開前」以外の物件は既存のステータス判定が適用される', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const twoDaysAgo = new Date(today);
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  /**
   * Validates: Requirements 3.2
   * atbb_status が「一般・公開中」の物件 → 「一般公開中物件」または他の適切なステータス
   */
  it('atbb_status が「一般・公開中」の物件は「一般公開中物件」ステータスになる', () => {
    const listing = {
      property_number: 'PRES010',
      atbb_status: '一般・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: 'https://suumo.jp/test',  // Suumo URL あり
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    const workTaskMap = new Map<string, Date | null>();

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「一般公開中物件」ステータスになることを確認
    expect(status.key).toBe('general_public');
    expect(status.label).toBe('一般公開中物件');
  });

  /**
   * Validates: Requirements 3.2
   * atbb_status が「専任・公開中」の物件 → 担当者別専任公開中ステータス
   */
  it('atbb_status が「専任・公開中」で sales_assignee が「山本」の物件は「Y専任公開中」ステータスになる', () => {
    const listing = {
      property_number: 'PRES011',
      atbb_status: '専任・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: 'https://suumo.jp/test',  // Suumo URL あり
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: '山本',
      price_reduction_scheduled_date: null,
    };

    const workTaskMap = new Map<string, Date | null>();

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「Y専任公開中」ステータスになることを確認
    expect(status.key).toBe('exclusive_y');
    expect(status.label).toBe('Y専任公開中');
  });

  it('atbb_status が「専任・公開中」で sales_assignee が「生野」の物件は「生・専任公開中」ステータスになる', () => {
    const listing = {
      property_number: 'PRES012',
      atbb_status: '専任・公開中',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: 'https://suumo.jp/test',
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: '生野',
      price_reduction_scheduled_date: null,
    };

    const workTaskMap = new Map<string, Date | null>();

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    expect(status.key).toBe('exclusive_ikuno');
    expect(status.label).toBe('生・専任公開中');
  });

  /**
   * Validates: Requirements 3.2
   * confirmation が「未」の物件 → 「未完了」ステータス
   */
  it('confirmation が「未」の物件は「未完了」ステータスになる', () => {
    const listing = {
      property_number: 'PRES013',
      atbb_status: '一般・公開前',
      confirmation: '未',
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: null,
      report_assignee: null,
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    const workTaskMap = new Map<string, Date | null>();

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「未完了」ステータスになることを確認
    expect(status.key).toBe('incomplete');
    expect(status.label).toBe('未完了');
  });

  it('report_date が今日以前の物件は「未報告」ステータスになる', () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const listing = {
      property_number: 'PRES014',
      atbb_status: '一般・公開前',
      confirmation: null,
      general_mediation_private: null,
      single_listing: null,
      suumo_url: null,
      suumo_registered: null,
      offer_status: null,
      report_date: todayStr,  // 今日の日付
      report_assignee: '山本',
      sales_assignee: null,
      price_reduction_scheduled_date: null,
    };

    const workTaskMap = new Map<string, Date | null>();

    const status = calculatePropertyStatus(listing as any, workTaskMap);

    // 「未報告」ステータスになることを確認
    expect(status.key).toBe('unreported');
    expect(status.label).toContain('未報告');
  });
});

// ============================================================
// テスト3: /api/work-tasks のレスポンス形式が変わらないことを検証
// ============================================================
describe('Preservation Test 3: /api/work-tasks のレスポンス形式（{ data, total, limit, offset }）が変わらない', () => {
  /**
   * Validates: Requirements 3.4
   * バックエンドの workTasks.ts ルートファイルを読み込み、レスポンス形式を確認する
   */
  it('workTasks.ts ルートが { data, total, limit, offset } 形式でレスポンスを返すこと', () => {
    const workTasksRoutePath = join(
      __dirname,
      '../../../../backend/src/routes/workTasks.ts'
    );
    const sourceCode = readFileSync(workTasksRoutePath, 'utf-8');

    // レスポンスに data フィールドが含まれること
    expect(sourceCode).toContain('data: workTasks');

    // レスポンスに total フィールドが含まれること
    expect(sourceCode).toContain('total');

    // レスポンスに limit フィールドが含まれること
    expect(sourceCode).toContain('limit');

    // レスポンスに offset フィールドが含まれること
    expect(sourceCode).toContain('offset');
  });

  it('workTasks.ts ルートが res.json({ data, total, limit, offset }) 形式でレスポンスを返すこと', () => {
    const workTasksRoutePath = join(
      __dirname,
      '../../../../backend/src/routes/workTasks.ts'
    );
    const sourceCode = readFileSync(workTasksRoutePath, 'utf-8');

    // res.json({ data: workTasks, total, limit, offset }) の形式を確認
    expect(sourceCode).toMatch(/res\.json\(\s*\{/);
    expect(sourceCode).toContain('data: workTasks');
    expect(sourceCode).toContain('total,');
    expect(sourceCode).toContain('limit,');
    expect(sourceCode).toContain('offset,');
  });
});

// ============================================================
// テスト4: WorkTaskService.list() の他のカラムが引き続き返されることを検証
// ============================================================
describe('Preservation Test 4: WorkTaskService.list() の他のカラム（id, property_number など）が引き続き返される', () => {
  /**
   * Validates: Requirements 3.4
   * WorkTaskService.ts の list() メソッドの SELECT 句に id, property_number, property_address などが含まれることを確認する
   * 注意: list() メソッドは明示的なカラムリストを使用している（select('*') ではない）
   * getByPropertyNumber() は select('*') を使用しているため、list() メソッドの SELECT 句のみを対象にする
   */

  // list() メソッドの SELECT 句を抽出するヘルパー関数
  const getListSelectClause = (): string => {
    const workTaskServicePath = join(
      __dirname,
      '../../../../backend/src/services/WorkTaskService.ts'
    );
    const sourceCode = readFileSync(workTaskServicePath, 'utf-8');

    // list() メソッドのブロックを抽出（async list から次のメソッドまで）
    const listMethodMatch = sourceCode.match(/async list\([\s\S]*?(?=\s+\/\*\*|\s+async\s+\w+\s*\(|$)/);
    const listMethodCode = listMethodMatch ? listMethodMatch[0] : '';

    // list() メソッド内の .select('...') を抽出（'*' 以外）
    const selectMatch = listMethodCode.match(/\.select\(['"`]([^'"`*][^'"`]*)['"`]\)/);
    return selectMatch ? selectMatch[1] : '';
  };

  it('WorkTaskService.ts の list() メソッドの SELECT 句に id が含まれること', () => {
    const selectClause = getListSelectClause();
    expect(selectClause).toContain('id');
  });

  it('WorkTaskService.ts の list() メソッドの SELECT 句に property_number が含まれること', () => {
    const selectClause = getListSelectClause();
    expect(selectClause).toContain('property_number');
  });

  it('WorkTaskService.ts の list() メソッドの SELECT 句に property_address が含まれること', () => {
    const selectClause = getListSelectClause();
    expect(selectClause).toContain('property_address');
  });

  it('WorkTaskService.ts の list() メソッドの SELECT 句に seller_name が含まれること', () => {
    const selectClause = getListSelectClause();
    expect(selectClause).toContain('seller_name');
  });

  it('WorkTaskService.ts の list() メソッドの SELECT 句に created_at と updated_at が含まれること', () => {
    const selectClause = getListSelectClause();
    expect(selectClause).toContain('created_at');
    expect(selectClause).toContain('updated_at');
  });

  it('WorkTaskService.ts の list() メソッドの SELECT 句に on_hold が含まれること', () => {
    const selectClause = getListSelectClause();
    expect(selectClause).toContain('on_hold');
  });
});
