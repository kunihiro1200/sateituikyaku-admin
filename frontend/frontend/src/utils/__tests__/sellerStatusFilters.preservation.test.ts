/**
 * 保全プロパティテスト - 既存カテゴリーの動作維持
 *
 * **Feature: sidebar-assignee-display, Property 2: Preservation**
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * ⚠️ IMPORTANT: 観察優先メソドロジーに従う
 * このテストは修正前のコードで PASS することが期待される（ベースライン動作の確認）
 *
 * 目的:
 * - visit_assignee が空欄の売主に関する既存の分類動作を確認・記録する
 * - 修正後もこれらの動作が変わらないことを保証する
 */

import * as fc from 'fast-check';
import {
  isTodayCall,
  isTodayCallWithInfo,
  isUnvaluated,
  isMailingPending,
  isTodayCallNotStarted,
  isPinrichEmpty,
  filterSellersByCategory,
  getCategoryCounts,
} from '../sellerStatusFilters';

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/** 日本時間（JST）で今日の日付文字列を取得（YYYY-MM-DD形式） */
const getTodayStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** 昨日の日付文字列を取得 */
const getYesterdayStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jstTime.setUTCDate(jstTime.getUTCDate() - 1);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** 明日の日付文字列を取得 */
const getTomorrowStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  jstTime.setUTCDate(jstTime.getUTCDate() + 1);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** テスト用売主データファクトリー（visit_assignee は空欄がデフォルト） */
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
  inquiry_date: '2026-01-15',
  unreachable_status: '',
  pinrich_status: '',
  mailingStatus: '',
  valuationAmount1: null,
  valuationAmount2: null,
  valuationAmount3: null,
  ...overrides,
});

// ============================================================
// テスト1: 当日TEL分の保全（Requirements 3.1）
// ============================================================

describe('保全テスト1: 当日TEL分（visit_assignee が空欄の売主）', () => {
  /**
   * **Validates: Requirements 3.1**
   * visit_assignee が空欄の売主が「③当日TEL分」に正しく分類されることを確認
   */
  it('visit_assignee が空欄 + 追客中 + 次電日が今日以前 + コミュニケーション情報なし → isTodayCall = true', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
    });
    expect(isTodayCall(seller)).toBe(true);
  });

  it('visit_assignee が空欄でも、追客中でない場合は isTodayCall = false', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '契約済み',
      next_call_date: getYesterdayStr(),
    });
    expect(isTodayCall(seller)).toBe(false);
  });

  it('visit_assignee が空欄でも、次電日が未来の場合は isTodayCall = false', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getTomorrowStr(),
    });
    expect(isTodayCall(seller)).toBe(false);
  });

  it('visit_assignee が空欄でも、コミュニケーション情報がある場合は isTodayCall = false', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: 'Eメール',
    });
    expect(isTodayCall(seller)).toBe(false);
  });

  it('visit_assignee に値がある売主は isTodayCall = false（当日TEL分から除外）', () => {
    const seller = createSeller({
      visit_assignee: 'Y',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: '',
    });
    expect(isTodayCall(seller)).toBe(false);
  });

  it('visit_assignee が「外す」の売主は isTodayCall = true（担当なしと同じ扱い）', () => {
    const seller = createSeller({
      visit_assignee: '外す',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: '',
    });
    expect(isTodayCall(seller)).toBe(true);
  });

  it('filterSellersByCategory("todayCall") が visit_assignee 空欄の売主のみを返す', () => {
    const sellers = [
      createSeller({ id: '1', visit_assignee: '', status: '追客中', next_call_date: getYesterdayStr() }),
      createSeller({ id: '2', visit_assignee: 'Y', status: '追客中', next_call_date: getYesterdayStr() }),
      createSeller({ id: '3', visit_assignee: '', status: '追客中', next_call_date: getTomorrowStr() }),
    ];
    const result = filterSellersByCategory(sellers, 'todayCall');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

// ============================================================
// テスト2: 当日TEL（内容）の保全（Requirements 3.2）
// ============================================================

describe('保全テスト2: 当日TEL（内容）（visit_assignee が空欄でコミュニケーション情報あり）', () => {
  /**
   * **Validates: Requirements 3.2**
   * visit_assignee が空欄でコミュニケーション情報がある売主が「④当日TEL（内容）」に正しく分類されることを確認
   */
  it('contact_method あり → isTodayCallWithInfo = true, isTodayCall = false', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: 'Eメール',
    });
    expect(isTodayCallWithInfo(seller)).toBe(true);
    expect(isTodayCall(seller)).toBe(false);
  });

  it('preferred_contact_time あり → isTodayCallWithInfo = true, isTodayCall = false', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      preferred_contact_time: '午前中',
    });
    expect(isTodayCallWithInfo(seller)).toBe(true);
    expect(isTodayCall(seller)).toBe(false);
  });

  it('phone_contact_person あり → isTodayCallWithInfo = true, isTodayCall = false', () => {
    const seller = createSeller({
      visit_assignee: '',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      phone_contact_person: 'Y',
    });
    expect(isTodayCallWithInfo(seller)).toBe(true);
    expect(isTodayCall(seller)).toBe(false);
  });

  it('visit_assignee に値がある売主は isTodayCallWithInfo = false（除外）', () => {
    const seller = createSeller({
      visit_assignee: 'Y',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: 'Eメール',
    });
    expect(isTodayCallWithInfo(seller)).toBe(false);
  });

  it('filterSellersByCategory("todayCallWithInfo") がコミュニケーション情報あり・営担なしの売主のみを返す', () => {
    const sellers = [
      createSeller({ id: '1', visit_assignee: '', contact_method: 'Eメール', next_call_date: getYesterdayStr() }),
      createSeller({ id: '2', visit_assignee: 'Y', contact_method: 'Eメール', next_call_date: getYesterdayStr() }),
      createSeller({ id: '3', visit_assignee: '', contact_method: '', next_call_date: getYesterdayStr() }),
    ];
    const result = filterSellersByCategory(sellers, 'todayCallWithInfo');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });
});

// ============================================================
// テスト3: 未査定・査定（郵送）・当日TEL_未着手・Pinrich空欄の保全（Requirements 3.4）
// ============================================================

describe('保全テスト3: 未査定・査定（郵送）・当日TEL_未着手・Pinrich空欄', () => {
  /**
   * **Validates: Requirements 3.4**
   */

  describe('未査定（isUnvaluated）', () => {
    it('追客中 + 査定額なし + 反響日付2025/12/8以降 + 営担なし → isUnvaluated = true', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        inquiry_date: '2025-12-10',
        valuationAmount1: null,
        valuationAmount2: null,
        valuationAmount3: null,
        mailingStatus: '',
      });
      expect(isUnvaluated(seller)).toBe(true);
    });

    it('反響日付が2025/12/8より前 → isUnvaluated = false', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        inquiry_date: '2025-12-07',
        valuationAmount1: null,
      });
      expect(isUnvaluated(seller)).toBe(false);
    });

    it('査定額がある場合 → isUnvaluated = false', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        inquiry_date: '2026-01-01',
        valuationAmount1: 10000000,
      });
      expect(isUnvaluated(seller)).toBe(false);
    });

    it('営担がある場合 → isUnvaluated = false', () => {
      const seller = createSeller({
        visitAssignee: 'Y',
        status: '追客中',
        inquiry_date: '2026-01-01',
        valuationAmount1: null,
      });
      expect(isUnvaluated(seller)).toBe(false);
    });
  });

  describe('査定（郵送）（isMailingPending）', () => {
    it('mailingStatus が「未」 → isMailingPending = true', () => {
      const seller = createSeller({ mailingStatus: '未' });
      expect(isMailingPending(seller)).toBe(true);
    });

    it('mailingStatus が「未」以外 → isMailingPending = false', () => {
      const seller = createSeller({ mailingStatus: '済' });
      expect(isMailingPending(seller)).toBe(false);
    });

    it('mailingStatus が空欄 → isMailingPending = false', () => {
      const seller = createSeller({ mailingStatus: '' });
      expect(isMailingPending(seller)).toBe(false);
    });
  });

  describe('当日TEL_未着手（isTodayCallNotStarted）', () => {
    it('当日TEL分の条件 + 不通が空欄 + 反響日付2026/1/1以降 → isTodayCallNotStarted = true', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        next_call_date: getYesterdayStr(),
        contact_method: '',
        unreachable_status: '',
        inquiry_date: '2026-01-15',
      });
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });

    it('不通カラムに値がある場合 → isTodayCallNotStarted = false', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        next_call_date: getYesterdayStr(),
        unreachable_status: '不通',
        inquiry_date: '2026-01-15',
      });
      expect(isTodayCallNotStarted(seller)).toBe(false);
    });

    it('反響日付が2026/1/1より前 → isTodayCallNotStarted = false', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        next_call_date: getYesterdayStr(),
        unreachable_status: '',
        inquiry_date: '2025-12-31',
      });
      expect(isTodayCallNotStarted(seller)).toBe(false);
    });
  });

  describe('Pinrich空欄（isPinrichEmpty）', () => {
    it('当日TEL分の条件 + Pinrichが空欄 → isPinrichEmpty = true', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        next_call_date: getYesterdayStr(),
        contact_method: '',
        pinrich_status: '',
      });
      expect(isPinrichEmpty(seller)).toBe(true);
    });

    it('Pinrichに値がある場合 → isPinrichEmpty = false', () => {
      const seller = createSeller({
        visit_assignee: '',
        status: '追客中',
        next_call_date: getYesterdayStr(),
        pinrich_status: '登録済み',
      });
      expect(isPinrichEmpty(seller)).toBe(false);
    });
  });
});

// ============================================================
// テスト4: getCategoryCounts の保全（Requirements 3.3）
// ============================================================

describe('保全テスト4: getCategoryCounts の動作確認', () => {
  /**
   * **Validates: Requirements 3.3**
   * サイドバーのカテゴリーカウントが正しく計算されることを確認
   */
  it('visit_assignee が空欄の売主のみの場合、todayCall と todayCallWithInfo が正しくカウントされる', () => {
    const sellers = [
      // 当日TEL分: 3件
      createSeller({ id: '1', visit_assignee: '', status: '追客中', next_call_date: getYesterdayStr() }),
      createSeller({ id: '2', visit_assignee: '', status: '追客中', next_call_date: getYesterdayStr() }),
      createSeller({ id: '3', visit_assignee: '', status: '追客中', next_call_date: getYesterdayStr() }),
      // 当日TEL（内容）: 2件
      createSeller({ id: '4', visit_assignee: '', status: '追客中', next_call_date: getYesterdayStr(), contact_method: 'Eメール' }),
      createSeller({ id: '5', visit_assignee: '', status: '追客中', next_call_date: getYesterdayStr(), phone_contact_person: 'Y' }),
      // 対象外: 次電日が未来
      createSeller({ id: '6', visit_assignee: '', status: '追客中', next_call_date: getTomorrowStr() }),
    ];

    const counts = getCategoryCounts(sellers);
    expect(counts.all).toBe(6);
    expect(counts.todayCall).toBe(3);
    expect(counts.todayCallWithInfo).toBe(2);
    expect(counts.todayCallAssigned).toBe(0);
  });

  it('visit_assignee がある売主は todayCall/todayCallWithInfo にカウントされない', () => {
    const sellers = [
      createSeller({ id: '1', visit_assignee: 'Y', status: '追客中', next_call_date: getYesterdayStr() }),
      createSeller({ id: '2', visit_assignee: 'I', status: '追客中', next_call_date: getYesterdayStr(), contact_method: 'Eメール' }),
    ];

    const counts = getCategoryCounts(sellers);
    expect(counts.todayCall).toBe(0);
    expect(counts.todayCallWithInfo).toBe(0);
    expect(counts.todayCallAssigned).toBe(2);
  });
});

// ============================================================
// Property-Based Test: isTodayCall と isTodayCallWithInfo の保全
// ============================================================

describe('Property-Based Test: isTodayCall と isTodayCallWithInfo の保全', () => {
  /**
   * **Validates: Requirements 3.1, 3.2**
   *
   * For any 売主データにおいて、visit_assignee が空欄の場合:
   * - isTodayCall と isTodayCallWithInfo は排他的（両方 true にはならない）
   * - コミュニケーション情報の有無によって正しく分類される
   */
  it('visit_assignee が空欄の売主で isTodayCall と isTodayCallWithInfo は排他的', () => {
    const contactInfoArb = fc.record({
      contact_method: fc.oneof(fc.constant(''), fc.constant('Eメール'), fc.constant('電話')),
      preferred_contact_time: fc.oneof(fc.constant(''), fc.constant('午前中'), fc.constant('午後')),
      phone_contact_person: fc.oneof(fc.constant(''), fc.constant('Y'), fc.constant('I')),
    });

    fc.assert(
      fc.property(
        contactInfoArb,
        ({ contact_method, preferred_contact_time, phone_contact_person }) => {
          const seller = createSeller({
            visit_assignee: '',
            status: '追客中',
            next_call_date: getYesterdayStr(),
            contact_method,
            preferred_contact_time,
            phone_contact_person,
          });

          const todayCall = isTodayCall(seller);
          const todayCallWithInfo = isTodayCallWithInfo(seller);

          // 両方 true にはならない（排他的）
          expect(Boolean(todayCall) && Boolean(todayCallWithInfo)).toBe(false);

          // コミュニケーション情報がある場合は todayCallWithInfo = true
          const hasInfo = contact_method !== '' || preferred_contact_time !== '' || phone_contact_person !== '';
          if (hasInfo) {
            expect(Boolean(todayCallWithInfo)).toBe(true);
            expect(Boolean(todayCall)).toBe(false);
          } else {
            expect(Boolean(todayCall)).toBe(true);
            expect(Boolean(todayCallWithInfo)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('visit_assignee に値がある売主は isTodayCall も isTodayCallWithInfo も false', () => {
    const assigneeArb = fc.string({ minLength: 1, maxLength: 3 }).filter(
      s => s.trim() !== '' && s.trim() !== '外す'
    );

    fc.assert(
      fc.property(
        assigneeArb,
        fc.oneof(fc.constant(''), fc.constant('Eメール')),
        (assignee, contactMethod) => {
          const seller = createSeller({
            visit_assignee: assignee,
            status: '追客中',
            next_call_date: getYesterdayStr(),
            contact_method: contactMethod,
          });

          // 営担がある場合は両方 false
          expect(isTodayCall(seller)).toBe(false);
          expect(isTodayCallWithInfo(seller)).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('visit_assignee が「外す」の売主は担当なしと同じ扱い（isTodayCall の対象になりうる）', () => {
    const seller = createSeller({
      visit_assignee: '外す',
      status: '追客中',
      next_call_date: getYesterdayStr(),
      contact_method: '',
    });
    // 「外す」は担当なしと同じ → 当日TEL分の対象
    expect(isTodayCall(seller)).toBe(true);
  });

  it('ランダムな売主データで todayCall と todayCallWithInfo の合計は todayCallBase の件数と一致する', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            visit_assignee: fc.oneof(
              fc.constant(''),
              fc.constant('外す'),
              fc.constant('Y'),
              fc.constant('I')
            ),
            status: fc.oneof(fc.constant('追客中'), fc.constant('契約済み'), fc.constant('他決')),
            next_call_date: fc.oneof(
              fc.constant(getYesterdayStr()),
              fc.constant(getTomorrowStr()),
              fc.constant(getTodayStr())
            ),
            contact_method: fc.oneof(fc.constant(''), fc.constant('Eメール')),
            preferred_contact_time: fc.constant(''),
            phone_contact_person: fc.constant(''),
            inquiry_date: fc.constant('2026-01-15'),
            unreachable_status: fc.constant(''),
            pinrich_status: fc.constant(''),
            mailingStatus: fc.constant(''),
            valuationAmount1: fc.constant(null),
            valuationAmount2: fc.constant(null),
            valuationAmount3: fc.constant(null),
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (sellers) => {
          const todayCallCount = sellers.filter(isTodayCall).length;
          const todayCallWithInfoCount = sellers.filter(isTodayCallWithInfo).length;

          // todayCall と todayCallWithInfo は排他的なので、重複はない
          const combined = sellers.filter(s => isTodayCall(s) || isTodayCallWithInfo(s));
          expect(combined.length).toBe(todayCallCount + todayCallWithInfoCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
