/**
 * バグ条件の探索テスト - 未査定カテゴリへの誤表示バグ
 *
 * **Feature: seller-sidebar-unassessed-category-bug, Property 1: Bug Condition**
 * **Validates: Requirements 1.1, 1.2**
 *
 * ⚠️ CRITICAL: このテストは未修正コードで必ず FAIL することが期待される（バグの存在を証明する）
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: バグが存在することを示す反例を発見する
 *
 * バグの概要:
 * `isTodayCallNotStarted(seller) = true` の場合、`isUnvaluated(seller)` は `false` を返すべきだが、
 * 現在のコードでは `true` を返してしまい、売主が「⑤未査定」カテゴリに誤って表示される。
 *
 * 根本原因（仮説）:
 * `isUnvaluated()` 内の `isTodayCallNotStarted()` 除外チェックが
 * `normalizedInquiryDate` の取得・nullチェックの後に置かれているため、
 * 何らかの条件で除外ロジックが正しく機能していない可能性がある。
 */

import { isTodayCallNotStarted, isUnvaluated } from '../sellerStatusFilters';

// ============================================================
// テスト用ヘルパー関数
// ============================================================

/**
 * 今日の日付文字列を取得（YYYY-MM-DD形式、JST基準）
 */
const getTodayStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * 昨日の日付文字列を取得（YYYY-MM-DD形式、JST基準）
 */
const getYesterdayStr = (): string => {
  const now = new Date();
  const jstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000));
  jstTime.setUTCDate(jstTime.getUTCDate() - 1);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * AA13953相当の売主データを作成するファクトリー関数
 *
 * 「当日TEL_未着手」の全条件を満たす売主:
 * - 状況=追客中（完全一致）
 * - 営担なし
 * - 不通=空欄
 * - 次電日=今日以前
 * - コミュニケーション情報なし
 * - 査定額なし
 * - 反響日付=2026/1/1以降
 */
const createTodayCallNotStartedSeller = (overrides: Record<string, any> = {}) => ({
  // 基本情報
  id: 'test-aa13953',
  sellerNumber: 'AA13953',
  name: 'テスト売主',

  // 状況: 追客中（完全一致）
  status: '追客中',

  // 営担: なし
  visitAssigneeInitials: '',
  visit_assignee: '',
  visitAssignee: '',

  // 不通: 空欄
  unreachableStatus: '',
  unreachable_status: '',

  // 次電日: 今日以前（昨日）
  nextCallDate: getYesterdayStr(),
  next_call_date: getYesterdayStr(),

  // コミュニケーション情報: 全て空
  contactMethod: '',
  contact_method: '',
  preferredContactTime: '',
  preferred_contact_time: '',
  phoneContactPerson: '',
  phone_contact_person: '',

  // 査定額: 全て空（未査定）
  valuationAmount1: null,
  valuationAmount2: null,
  valuationAmount3: null,
  manualValuationAmount1: null,
  manualValuationAmount2: null,
  manualValuationAmount3: null,

  // 査定不要ではない
  valuationMethod: '',
  valuation_method: '',

  // 確度: 通常（ダブり・D・AI査定ではない）
  confidence: '',
  confidenceLevel: '',
  confidence_level: '',

  // 除外日: 空
  exclusionDate: '',
  exclusion_date: '',

  // 反響日付: 2026-01-15（カットオフ日2026-01-01以降）
  inquiryDate: '2026-01-15',
  inquiry_date: '2026-01-15',

  ...overrides,
});

// ============================================================
// バグ条件探索テスト
// ============================================================

describe('Property 1: Bug Condition - 当日TEL_未着手の売主が未査定に誤って表示されるバグ', () => {
  /**
   * 前提確認: isTodayCallNotStarted が true を返すことを確認
   *
   * このテストが PASS することで、テストデータが正しく
   * 「当日TEL_未着手」の条件を満たしていることを確認する。
   */
  describe('前提確認: テストデータが当日TEL_未着手の条件を満たすこと', () => {
    it('AA13953相当（反響日付=2026-01-15）: isTodayCallNotStarted が true を返す', () => {
      const seller = createTodayCallNotStartedSeller();
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });

    it('境界値（反響日付=2026-01-01）: isTodayCallNotStarted が true を返す', () => {
      const seller = createTodayCallNotStartedSeller({
        inquiryDate: '2026-01-01',
        inquiry_date: '2026-01-01',
      });
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });
  });

  /**
   * テストケース1: AA13953相当（反響日付=2026-01-15）
   *
   * isTodayCallNotStarted = true の場合、isUnvaluated は false を返すべき
   *
   * ⚠️ 修正前: isUnvaluated が true を返す（バグ）→ テストが FAIL する
   * ✅ 修正後: isUnvaluated が false を返す → テストが PASS する
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('テスト1: AA13953相当（反響日付=2026-01-15）- isTodayCallNotStarted=true の場合、isUnvaluated は false を返すべき', () => {
    const seller = createTodayCallNotStartedSeller({
      inquiryDate: '2026-01-15',
      inquiry_date: '2026-01-15',
    });

    // 前提: isTodayCallNotStarted が true であることを確認
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // バグ条件: isTodayCallNotStarted=true の場合、isUnvaluated は false を返すべき
    // ⚠️ 修正前はこのアサーションが FAIL する（isUnvaluated が true を返すため）
    expect(isUnvaluated(seller)).toBe(false);
  });

  /**
   * テストケース2: 境界値テスト（反響日付=2026-01-01、カットオフ日ちょうど）
   *
   * カットオフ日ちょうどの売主でも同様にバグが発生することを確認
   *
   * ⚠️ 修正前: isUnvaluated が true を返す（バグ）→ テストが FAIL する
   * ✅ 修正後: isUnvaluated が false を返す → テストが PASS する
   *
   * **Validates: Requirements 1.1, 1.2**
   */
  it('テスト2: 境界値（反響日付=2026-01-01、カットオフ日ちょうど）- isTodayCallNotStarted=true の場合、isUnvaluated は false を返すべき', () => {
    const seller = createTodayCallNotStartedSeller({
      inquiryDate: '2026-01-01',
      inquiry_date: '2026-01-01',
    });

    // 前提: isTodayCallNotStarted が true であることを確認
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // バグ条件: isTodayCallNotStarted=true の場合、isUnvaluated は false を返すべき
    // ⚠️ 修正前はこのアサーションが FAIL する（isUnvaluated が true を返すため）
    expect(isUnvaluated(seller)).toBe(false);
  });

  /**
   * テストケース3: inquiry_date フィールド名（snake_case）でも同様に確認
   *
   * APIレスポンスは snake_case で返ってくる場合があるため、
   * snake_case フィールド名でも同じバグが発生することを確認する
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト3: inquiry_date（snake_case）フィールド使用時も同様にバグが発生する', () => {
    const seller = {
      ...createTodayCallNotStartedSeller(),
      // camelCase を削除して snake_case のみ使用
      inquiryDate: undefined,
      inquiry_date: '2026-01-15',
    };

    // 前提: isTodayCallNotStarted が true であることを確認
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // バグ条件: isUnvaluated は false を返すべき
    // ⚠️ 修正前はこのアサーションが FAIL する
    expect(isUnvaluated(seller)).toBe(false);
  });

  /**
   * テストケース4: 今日の日付を次電日として使用（境界値）
   *
   * 次電日=今日（今日以前の境界値）でも同様にバグが発生することを確認
   *
   * **Validates: Requirements 1.1**
   */
  it('テスト4: 次電日=今日（境界値）でも isTodayCallNotStarted=true の場合、isUnvaluated は false を返すべき', () => {
    const seller = createTodayCallNotStartedSeller({
      nextCallDate: getTodayStr(),
      next_call_date: getTodayStr(),
      inquiryDate: '2026-01-15',
      inquiry_date: '2026-01-15',
    });

    // 前提: isTodayCallNotStarted が true であることを確認
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // バグ条件: isUnvaluated は false を返すべき
    // ⚠️ 修正前はこのアサーションが FAIL する
    expect(isUnvaluated(seller)).toBe(false);
  });
});
