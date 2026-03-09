/**
 * バグ条件の探索テスト - 担当者別カテゴリー未表示バグ
 * 
 * **Feature: sidebar-assignee-display, Property 1: Fault Condition**
 * **Validates: Requirements 1.1, 1.2, 1.3**
 * 
 * ⚠️ CRITICAL: このテストは修正前のコードで FAIL することが期待される（バグの存在を確認）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を見つける
 * 
 * バグの根本原因（仮説）:
 * 1. StatusCategory型が動的カテゴリーID（visitAssigned:Y等）をサポートしていない
 * 2. filterSellersByCategory関数が動的カテゴリーIDを処理できない
 * 3. SellerStatusSidebar.tsxに担当者別カテゴリー生成ロジックが存在しない
 */

import * as fc from 'fast-check';
import {
  StatusCategory,
  filterSellersByCategory,
  isTodayCall,
  isTodayCallWithInfo,
  isTodayCallAssigned,
} from '../sellerStatusFilters';

// テスト用の今日の日付（JST）
const getTodayStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 昨日の日付文字列を取得
const getYesterdayStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  jstTime.setUTCDate(jstTime.getUTCDate() - 1);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 明日の日付文字列を取得
const getTomorrowStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  jstTime.setUTCDate(jstTime.getUTCDate() + 1);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * テスト用売主データファクトリー
 */
const createSeller = (overrides: Record<string, any> = {}) => ({
  id: 'test-id-1',
  sellerNumber: 'AA99001',
  name: 'テスト売主',
  status: '追客中',
  next_call_date: getYesterdayStr(),
  visit_assignee: '',
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  inquiry_date: '2026-01-01',
  ...overrides,
});

describe('Property 1: Fault Condition - 担当者別カテゴリー未表示バグ', () => {
  /**
   * テスト1: visit_assignee="Y" の売主が存在する場合、
   * filterSellersByCategory が 'visitAssigned:Y' カテゴリーを処理できることを確認
   * 
   * ⚠️ 修正前は FAIL する（StatusCategory型が動的カテゴリーIDをサポートしていないため）
   * 
   * **Validates: Requirements 1.1**
   */
  describe('テスト1: 担当者カテゴリーフィルタリング（visitAssigned:Y）', () => {
    it('visit_assignee="Y" の売主が存在する場合、filterSellersByCategory("visitAssigned:Y") が該当売主を返す', () => {
      const sellers = [
        createSeller({ id: '1', visit_assignee: 'Y' }),
        createSeller({ id: '2', visit_assignee: 'I' }),
        createSeller({ id: '3', visit_assignee: '' }),
      ];

      // ⚠️ 修正前: filterSellersByCategory は 'visitAssigned:Y' を処理できず、全件または空を返す
      // ✅ 修正後: visit_assignee="Y" の売主のみを返す
      const dynamicCategory = 'visitAssigned:Y' as StatusCategory;
      const result = filterSellersByCategory(sellers, dynamicCategory);

      // 修正後の期待値: visit_assignee="Y" の売主のみ（1件）
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('visit_assignee="I" の売主が存在する場合、filterSellersByCategory("visitAssigned:I") が該当売主を返す', () => {
      const sellers = [
        createSeller({ id: '1', visit_assignee: 'Y' }),
        createSeller({ id: '2', visit_assignee: 'I' }),
        createSeller({ id: '3', visit_assignee: '' }),
      ];

      const dynamicCategory = 'visitAssigned:I' as StatusCategory;
      const result = filterSellersByCategory(sellers, dynamicCategory);

      // 修正後の期待値: visit_assignee="I" の売主のみ（1件）
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it('visit_assignee="外す" の売主は担当カテゴリーに含まれない', () => {
      const sellers = [
        createSeller({ id: '1', visit_assignee: '外す' }),
        createSeller({ id: '2', visit_assignee: 'Y' }),
      ];

      const dynamicCategory = 'visitAssigned:外す' as StatusCategory;
      const result = filterSellersByCategory(sellers, dynamicCategory);

      // 「外す」は担当なしと同じ扱いなので0件
      expect(result).toHaveLength(0);
    });
  });

  /**
   * テスト2: visit_assignee="Y" かつ next_call_date が今日以前の売主が存在する場合、
   * filterSellersByCategory が 'todayCallAssigned:Y' カテゴリーを処理できることを確認
   * 
   * ⚠️ 修正前は FAIL する（動的カテゴリーIDをサポートしていないため）
   * 
   * **Validates: Requirements 1.2**
   */
  describe('テスト2: 当日TELサブカテゴリーフィルタリング（todayCallAssigned:Y）', () => {
    it('visit_assignee="Y" かつ next_call_date が今日以前の売主が存在する場合、filterSellersByCategory("todayCallAssigned:Y") が該当売主を返す', () => {
      const sellers = [
        // 当日TEL(Y)対象: 営担Y + 次電日が昨日
        createSeller({ id: '1', visit_assignee: 'Y', next_call_date: getYesterdayStr() }),
        // 当日TEL(Y)対象外: 営担Y + 次電日が明日
        createSeller({ id: '2', visit_assignee: 'Y', next_call_date: getTomorrowStr() }),
        // 当日TEL(I)対象: 営担I + 次電日が昨日
        createSeller({ id: '3', visit_assignee: 'I', next_call_date: getYesterdayStr() }),
        // 担当なし
        createSeller({ id: '4', visit_assignee: '', next_call_date: getYesterdayStr() }),
      ];

      // ⚠️ 修正前: filterSellersByCategory は 'todayCallAssigned:Y' を処理できない
      // ✅ 修正後: visit_assignee="Y" かつ next_call_date が今日以前の売主のみを返す
      const dynamicCategory = 'todayCallAssigned:Y' as StatusCategory;
      const result = filterSellersByCategory(sellers, dynamicCategory);

      // 修正後の期待値: id='1' の売主のみ（1件）
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it('visit_assignee="I" かつ next_call_date が今日以前の売主が存在する場合、filterSellersByCategory("todayCallAssigned:I") が該当売主を返す', () => {
      const sellers = [
        createSeller({ id: '1', visit_assignee: 'Y', next_call_date: getYesterdayStr() }),
        createSeller({ id: '2', visit_assignee: 'I', next_call_date: getYesterdayStr() }),
        createSeller({ id: '3', visit_assignee: 'I', next_call_date: getTomorrowStr() }),
      ];

      const dynamicCategory = 'todayCallAssigned:I' as StatusCategory;
      const result = filterSellersByCategory(sellers, dynamicCategory);

      // 修正後の期待値: id='2' の売主のみ（1件）
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });

  /**
   * テスト3: 複数の担当者（Y と I）が存在する場合、
   * それぞれの担当者カテゴリーが独立して機能することを確認
   * 
   * ⚠️ 修正前は FAIL する（動的カテゴリーIDをサポートしていないため）
   * 
   * **Validates: Requirements 1.3**
   */
  describe('テスト3: 複数担当者の個別カテゴリー（Y と I）', () => {
    it('visit_assignee="Y" と visit_assignee="I" の両方が存在する場合、それぞれのカテゴリーが独立して機能する', () => {
      const sellers = [
        createSeller({ id: '1', visit_assignee: 'Y' }),
        createSeller({ id: '2', visit_assignee: 'Y' }),
        createSeller({ id: '3', visit_assignee: 'I' }),
        createSeller({ id: '4', visit_assignee: '' }),
      ];

      const categoryY = 'visitAssigned:Y' as StatusCategory;
      const categoryI = 'visitAssigned:I' as StatusCategory;

      const resultY = filterSellersByCategory(sellers, categoryY);
      const resultI = filterSellersByCategory(sellers, categoryI);

      // 修正後の期待値: Y担当は2件、I担当は1件
      expect(resultY).toHaveLength(2);
      expect(resultI).toHaveLength(1);

      // Y担当のIDを確認
      const yIds = resultY.map((s: any) => s.id).sort();
      expect(yIds).toEqual(['1', '2']);

      // I担当のIDを確認
      expect(resultI[0].id).toBe('3');
    });

    it('担当なし（空文字）の売主はどの担当カテゴリーにも含まれない', () => {
      const sellers = [
        createSeller({ id: '1', visit_assignee: '' }),
        createSeller({ id: '2', visit_assignee: 'Y' }),
      ];

      // 空文字カテゴリーは存在しないはず
      const emptyCategory = 'visitAssigned:' as StatusCategory;
      const result = filterSellersByCategory(sellers, emptyCategory);

      // 空文字の担当者は0件
      expect(result).toHaveLength(0);
    });
  });

  /**
   * Property-Based Test: ランダムな visit_assignee 値でのフィルタリング
   * 
   * For any 有効な visit_assignee 値（空文字・「外す」以外）を持つ売主データに対して、
   * filterSellersByCategory('visitAssigned:{assignee}') は
   * その担当者の売主のみを返さなければならない
   * 
   * ⚠️ 修正前は FAIL する（動的カテゴリーIDをサポートしていないため）
   * 
   * **Validates: Requirements 1.1, 1.3**
   */
  describe('Property-Based Test: 任意の担当者イニシャルでのフィルタリング', () => {
    it('任意の有効な担当者イニシャルに対して、visitAssigned:{assignee} カテゴリーが正しくフィルタリングする', () => {
      // 有効なイニシャル（空文字・「外す」以外の1-3文字の英字または日本語）
      const validAssigneeArb = fc.string({ minLength: 1, maxLength: 3 }).filter(
        s => s.trim() !== '' && s.trim() !== '外す'
      );

      fc.assert(
        fc.property(
          validAssigneeArb,
          fc.array(
            fc.record({
              id: fc.uuid(),
              visit_assignee: fc.oneof(
                fc.constant(''),
                fc.constant('外す'),
                validAssigneeArb,
              ),
              next_call_date: fc.constant(getYesterdayStr()),
              status: fc.constant('追客中'),
              contact_method: fc.constant(''),
              preferred_contact_time: fc.constant(''),
              phone_contact_person: fc.constant(''),
              inquiry_date: fc.constant('2026-01-01'),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (targetAssignee, sellers) => {
            const dynamicCategory = `visitAssigned:${targetAssignee}` as StatusCategory;
            const result = filterSellersByCategory(sellers, dynamicCategory);

            // 結果は targetAssignee と一致する売主のみであるべき
            const expectedCount = sellers.filter(
              s => s.visit_assignee === targetAssignee
            ).length;

            expect(result).toHaveLength(expectedCount);

            // 全ての結果が targetAssignee を持つことを確認
            result.forEach((s: any) => {
              expect(s.visit_assignee).toBe(targetAssignee);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});

/**
 * 保全テスト: 既存カテゴリーへの影響がないことを確認
 * 
 * visit_assignee が空欄の売主に関する既存の分類動作が
 * 修正前後で変わらないことを確認する
 * 
 * ⚠️ このテストは修正前も PASS するはず（既存動作の確認）
 */
describe('既存カテゴリーへの影響確認（修正前後で変わらないこと）', () => {
  it('visit_assignee が空欄の売主は isTodayCall で正しく判定される', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
    });

    // 営担なし + 追客中 + 次電日が今日以前 + コミュニケーション情報なし → 当日TEL分
    expect(isTodayCall(seller)).toBe(true);
  });

  it('visit_assignee が空欄でコミュニケーション情報がある売主は isTodayCallWithInfo で正しく判定される', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: 'Eメール',
      preferred_contact_time: '',
      phone_contact_person: '',
    });

    // 営担なし + 追客中 + 次電日が今日以前 + コミュニケーション情報あり → 当日TEL（内容）
    expect(isTodayCallWithInfo(seller)).toBe(true);
    expect(isTodayCall(seller)).toBe(false);
  });

  it('visit_assignee に値がある売主は isTodayCall で false を返す（当日TEL分から除外）', () => {
    const seller = createSeller({
      visit_assignee: 'Y',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
    });

    // 営担あり → 当日TEL分から除外
    expect(isTodayCall(seller)).toBe(false);
    expect(isTodayCallWithInfo(seller)).toBe(false);
  });

  it('visit_assignee に値があり次電日が今日以前の売主は isTodayCallAssigned で true を返す', () => {
    const seller = createSeller({
      visit_assignee: 'Y',
      next_call_date: getYesterdayStr(),
    });

    // 営担あり + 次電日が今日以前 → 当日TEL（担当）
    expect(isTodayCallAssigned(seller)).toBe(true);
  });
});
