/**
 * タスク1: バグ条件の探索テスト
 *
 * このテストは未修正コードでバグの存在を証明するためのものです。
 * テストが失敗することが期待される結果です（バグの存在を確認）。
 *
 * バグ: isUnvaluated() 内の「未着手除外ロジック」がインライン展開されており、
 * isTodayCallNotStarted() の実装と乖離している。
 *
 * Validates: Requirements 1.1, 1.2
 */

import { isUnvaluated, isTodayCallNotStarted } from '../utils/sellerStatusFilters';

// 今日以前の日付を生成するヘルパー
const getYesterdayStr = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

describe('バグ条件の探索テスト（未修正コードで失敗することを確認）', () => {
  /**
   * テストケース1: status = '追客中' の重複表示バグ
   *
   * 条件:
   * - status = '追客中'
   * - inquiry_date = '2026-02-01'（2026/1/1以降）
   * - unreachable_status = ''（空欄）
   * - 査定額全て空
   * - next_call_date が今日以前
   *
   * 期待（修正後の正しい動作）:
   * - isTodayCallNotStarted() = true（未着手条件を満たす）
   * - isUnvaluated() = false（未着手が優先されるため未査定から除外される）
   *
   * バグ（未修正コード）: isTodayCallNotStarted() = true かつ isUnvaluated() = true
   * → 両カテゴリに重複表示される
   *
   * このテストは未修正コードでFAILすることでバグを証明する。
   * → 未修正コードでは isUnvaluated() が true を返すため、false を期待するこのテストはFAILする
   */
  test('テストケース1: 追客中 + 2026/1/1以降の反響日付 → isTodayCallNotStarted=true かつ isUnvaluated=false であること', () => {
    const seller = {
      status: '追客中',
      inquiry_date: '2026-02-01',
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
      // 郵送ステータス
      mailingStatus: '',
    };

    // isTodayCallNotStarted が true であることを確認（前提条件）
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // 期待（修正後の正しい動作）: isUnvaluated は false（未着手が優先されるべき）
    // バグ（未修正コード）: isUnvaluated が true になる（重複表示）
    // このテストは未修正コードでFAILすることでバグを証明する
    expect(isUnvaluated(seller)).toBe(false);
  });

  /**
   * テストケース2: status = '除外後追客中' の動作確認
   *
   * 条件:
   * - status = '除外後追客中'
   * - inquiry_date = '2026-02-01'（2026/1/1以降）
   * - unreachable_status = ''（空欄）
   * - 査定額全て空
   * - next_call_date が今日以前
   *
   * 正しい動作:
   * - isTodayCallNotStarted() = false（isTodayCall() が false → status !== '追客中'）
   * - isUnvaluated() = true（isTodayCallNotStarted() が false なので未査定から除外されない）
   *
   * 修正前のバグ（インライン展開の不整合）:
   * - isUnvaluated() のインライン展開では isTodayCallBase() を使用
   * - '除外後追客中' は isTodayCallBase() の対象（targetStatuses に含まれる）
   * - しかし isNotStarted の条件に (seller.status || '') === '追客中' があるため isNotStarted = false
   * - 結果: 修正前も isUnvaluated() は true を返す（インライン展開でも同じ結果）
   *
   * 修正後の動作:
   * - isTodayCallNotStarted() を直接呼び出すため、インライン展開との乖離がなくなる
   * - isTodayCallNotStarted() = false → isUnvaluated() は除外されず true を返す（正しい動作）
   */
  test('テストケース2: 除外後追客中 + 2026/1/1以降の反響日付 → isTodayCallNotStarted=false かつ isUnvaluated=true であること', () => {
    const seller = {
      status: '除外後追客中',
      inquiry_date: '2026-02-01',
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
      // 郵送ステータス
      mailingStatus: '',
    };

    // isTodayCallNotStarted は false（status が '追客中' でないため）
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 修正後の正しい動作: isUnvaluated は true
    // isTodayCallNotStarted() が false なので未査定から除外されない
    // '除外後追客中' は status.includes('追客中') を満たすため未査定の対象
    expect(isUnvaluated(seller)).toBe(true);
  });
});
