/**
 * タスク2: 保全プロパティテスト（修正実装の前に）
 *
 * このテストは未修正コードで非バグ条件の入力（isTodayCallNotStarted(seller) === false）の
 * 動作を観察し、保全すべきベースライン動作を確認するためのものです。
 *
 * EXPECTED OUTCOME: テストがPASS（保全すべきベースライン動作を確認）
 *
 * 観察すべき動作:
 * 1. inquiry_date = '2025-12-10'（2026/1/1より前）の売主 → isUnvaluated() が true を返す（正常）
 * 2. inquiry_date = '2025-12-08'（基準日ちょうど）の売主 → isUnvaluated() が true を返す（正常）
 * 3. visit_assignee = 'Y' の売主 → isUnvaluated() が false を返す（正常）
 * 4. status = '追客中'、next_call_date が今日以前、コミュニケーション情報なし、営担なし → isTodayCall() が true を返す（正常）
 * 5. 未着手条件を満たさない売主で isUnvaluated() が true を返すケース
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import * as fc from 'fast-check';
import { isUnvaluated, isTodayCallNotStarted, isTodayCall, isMailingPending } from '../utils/sellerStatusFilters';

// 今日以前の日付を生成するヘルパー
const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// 今日の日付を生成するヘルパー
const getTodayStr = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('保全プロパティテスト: 未着手条件を満たさない売主の動作を保全する', () => {
  /**
   * 観察1: inquiry_date = '2025-12-10'（2026/1/1より前）の売主
   * → isUnvaluated() が true を返す（正常）
   *
   * 未着手条件（isTodayCallNotStarted）は反響日付が2026/1/1以降を要求するため、
   * 2025-12-10 の売主は未着手条件を満たさない。
   * 未査定の他の条件（追客中、査定額空、営担なし、基準日以降）を満たすため、
   * isUnvaluated() は true を返すべき。
   */
  test('観察1: inquiry_date = 2025-12-10（2026/1/1より前）→ isTodayCallNotStarted=false かつ isUnvaluated=true', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2025-12-10',
      unreachable_status: '',
      next_call_date: getYesterdayStr(),
      // 査定額全て空
      valuationAmount1: null,
      valuationAmount2: null,
      valuationAmount3: null,
      manualValuationAmount1: null,
      manualValuationAmount2: null,
      manualValuationAmount3: null,
      // コミュニケーション情報全て空
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
      // 営担なし
      visit_assignee: '',
      // 確度は除外対象でない
      confidence: '',
      // 除外日なし
      exclusion_date: '',
      mailingStatus: '',
    };

    // 前提条件: 未着手条件を満たさない（反響日付が2026/1/1より前）
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 保全すべき動作: 未査定として表示される
    expect(isUnvaluated(seller)).toBe(true);
  });

  /**
   * 観察2: inquiry_date = '2025-12-08'（基準日ちょうど）の売主
   * → isUnvaluated() が true を返す（正常）
   *
   * 未査定の基準日は2025/12/8以降。基準日ちょうどの売主は未査定として表示される。
   * 未着手条件は満たさない（反響日付が2026/1/1より前）。
   */
  test('観察2: inquiry_date = 2025-12-08（基準日ちょうど）→ isTodayCallNotStarted=false かつ isUnvaluated=true', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2025-12-08',
      unreachable_status: '',
      next_call_date: getYesterdayStr(),
      // 査定額全て空
      valuationAmount1: null,
      valuationAmount2: null,
      valuationAmount3: null,
      manualValuationAmount1: null,
      manualValuationAmount2: null,
      manualValuationAmount3: null,
      // コミュニケーション情報全て空
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
      // 営担なし
      visit_assignee: '',
      confidence: '',
      exclusion_date: '',
      mailingStatus: '',
    };

    // 前提条件: 未着手条件を満たさない（反響日付が2026/1/1より前）
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 保全すべき動作: 未査定として表示される（基準日ちょうど）
    expect(isUnvaluated(seller)).toBe(true);
  });

  /**
   * 観察3: visit_assignee = 'Y' の売主
   * → isUnvaluated() が false を返す（正常）
   *
   * 営担に入力がある場合、未査定として表示されない。
   * これは修正前後で変わらない動作。
   */
  test('観察3: visit_assignee = Y（営担あり）→ isUnvaluated=false', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2025-12-10',
      unreachable_status: '',
      next_call_date: getYesterdayStr(),
      // 査定額全て空
      valuationAmount1: null,
      valuationAmount2: null,
      valuationAmount3: null,
      manualValuationAmount1: null,
      manualValuationAmount2: null,
      manualValuationAmount3: null,
      // コミュニケーション情報全て空
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
      // 営担あり
      visit_assignee: 'Y',
      confidence: '',
      exclusion_date: '',
      mailingStatus: '',
    };

    // 保全すべき動作: 営担ありのため未査定として表示されない
    expect(isUnvaluated(seller)).toBe(false);
  });

  /**
   * 観察4: status = '追客中'、next_call_date が今日以前、コミュニケーション情報なし、営担なし
   * → isTodayCall() が true を返す（正常）
   *
   * 当日TEL分の条件を満たす売主は isTodayCall() が true を返す。
   * これは修正前後で変わらない動作。
   */
  test('観察4: 追客中 + 次電日が今日以前 + コミュニケーション情報なし + 営担なし → isTodayCall=true', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2025-12-10',
      unreachable_status: '',
      next_call_date: getYesterdayStr(),
      // 査定額全て空
      valuationAmount1: null,
      valuationAmount2: null,
      valuationAmount3: null,
      manualValuationAmount1: null,
      manualValuationAmount2: null,
      manualValuationAmount3: null,
      // コミュニケーション情報全て空
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
      // 営担なし
      visit_assignee: '',
      confidence: '',
      exclusion_date: '',
      mailingStatus: '',
    };

    // 保全すべき動作: 当日TEL分として表示される
    expect(isTodayCall(seller)).toBe(true);
  });

  /**
   * 観察5: 未着手条件を満たさない売主で isUnvaluated() が true を返すケース
   * （今日の日付を next_call_date に使用）
   */
  test('観察5: next_call_date が今日（境界値）→ isTodayCall=true かつ isUnvaluated=true（2025年の反響日付）', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2025-12-15',
      unreachable_status: '',
      next_call_date: getTodayStr(),
      // 査定額全て空
      valuationAmount1: null,
      valuationAmount2: null,
      valuationAmount3: null,
      manualValuationAmount1: null,
      manualValuationAmount2: null,
      manualValuationAmount3: null,
      // コミュニケーション情報全て空
      contact_method: '',
      preferred_contact_time: '',
      phone_contact_person: '',
      // 営担なし
      visit_assignee: '',
      confidence: '',
      exclusion_date: '',
      mailingStatus: '',
    };

    // 前提条件: 未着手条件を満たさない（反響日付が2026/1/1より前）
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 保全すべき動作: 未査定として表示される
    expect(isUnvaluated(seller)).toBe(true);
  });

  /**
   * プロパティベーステスト:
   * isTodayCallNotStarted(seller) === false の全ての入力で、
   * 修正前後の isUnvaluated() の結果が一致することを検証
   *
   * 具体的には: 2025年の反響日付（2026/1/1より前）を持つ売主は
   * 未着手条件を満たさないため、isUnvaluated() の結果は修正前後で変わらない。
   *
   * Validates: Requirements 3.1, 3.2
   */
  test('プロパティ: isTodayCallNotStarted=false の売主では isUnvaluated() が正しく動作する', () => {
    // 2025年の反響日付（2026/1/1より前）を持つ売主データを生成
    // これらは未着手条件を満たさないため、isUnvaluated() の動作が保全される
    const inquiry_dates_before_cutoff = [
      '2025-12-08', // 基準日ちょうど
      '2025-12-09',
      '2025-12-10',
      '2025-12-15',
      '2025-12-20',
      '2025-12-31',
    ];

    for (const inquiry_date of inquiry_dates_before_cutoff) {
      const seller = {
        status: '追客中',
        inquiry_date,
        unreachable_status: '',
        next_call_date: getYesterdayStr(),
        valuationAmount1: null,
        valuationAmount2: null,
        valuationAmount3: null,
        manualValuationAmount1: null,
        manualValuationAmount2: null,
        manualValuationAmount3: null,
        contact_method: '',
        preferred_contact_time: '',
        phone_contact_person: '',
        visit_assignee: '',
        confidence: '',
        exclusion_date: '',
        mailingStatus: '',
      };

      // 前提条件: 未着手条件を満たさない
      expect(isTodayCallNotStarted(seller)).toBe(false);

      // 保全すべき動作: 未査定として表示される（未着手条件を満たさないため）
      expect(isUnvaluated(seller)).toBe(true);
    }
  });

  /**
   * プロパティベーステスト（fast-check使用）:
   * isTodayCallNotStarted(seller) === false の入力で、
   * 未査定の他の条件を満たす売主は isUnvaluated() が true を返すことを検証
   *
   * Validates: Requirements 3.1, 3.2
   */
  test('プロパティ（fast-check）: 2025年の反響日付を持つ未査定条件の売主は isUnvaluated=true', () => {
    // 2025年の反響日付（2026/1/1より前）を持つ売主データを生成
    // 月: 12月のみ（基準日2025/12/8以降）
    const inquiry_date_arb = fc.integer({ min: 8, max: 31 }).map(
      (day) => `2025-12-${String(day).padStart(2, '0')}`
    );

    fc.assert(
      fc.property(inquiry_date_arb, (inquiry_date) => {
        const seller = {
          status: '追客中',
          inquiry_date,
          unreachable_status: '',
          next_call_date: getYesterdayStr(),
          valuationAmount1: null,
          valuationAmount2: null,
          valuationAmount3: null,
          manualValuationAmount1: null,
          manualValuationAmount2: null,
          manualValuationAmount3: null,
          contact_method: '',
          preferred_contact_time: '',
          phone_contact_person: '',
          visit_assignee: '',
          confidence: '',
          exclusion_date: '',
          mailingStatus: '',
        };

        // 前提条件: 未着手条件を満たさない（反響日付が2026/1/1より前）
        const notStarted = isTodayCallNotStarted(seller);
        expect(notStarted).toBe(false);

        // 保全すべき動作: 未査定として表示される
        return isUnvaluated(seller) === true;
      }),
      { numRuns: 50 }
    );
  });

  /**
   * 保全テスト: isMailingPending() の動作は修正前後で変わらない
   *
   * Validates: Requirements 3.3, 3.4
   */
  test('保全: mailingStatus = 未 → isMailingPending=true（修正前後で変わらない）', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2025-12-10',
      mailingStatus: '未',
      visit_assignee: '',
    };

    expect(isMailingPending(seller)).toBe(true);
  });

  test('保全: mailingStatus が空 → isMailingPending=false（修正前後で変わらない）', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2025-12-10',
      mailingStatus: '',
      visit_assignee: '',
    };

    expect(isMailingPending(seller)).toBe(false);
  });
});
