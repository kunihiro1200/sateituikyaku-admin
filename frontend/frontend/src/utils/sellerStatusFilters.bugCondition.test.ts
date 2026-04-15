/**
 * バグ条件の探索テスト
 * Property 1: Bug Condition
 * 当日TEL_未着手該当者が当日TEL分に含まれるバグ
 *
 * 重要: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
 * DO NOT attempt to fix the test or the code when it fails
 *
 * Validates: Requirements 1.1, 1.2
 */

import { filterSellersByCategory, isTodayCallNotStarted } from './sellerStatusFilters';

// =============================================================================
// テスト用の売主データ作成ヘルパー
// isTodayCallNotStarted の全条件を満たす売主を作成する
// =============================================================================

/**
 * isTodayCallNotStarted の全条件を満たす基本売主データ
 *
 * 条件:
 * - isTodayCall の条件を満たす（営担なし + 追客中 + 次電日今日以前 + コミュニケーション情報なし）
 * - 状況 = "追客中"（完全一致）
 * - 不通 = ""（空欄）
 * - 確度 ≠ "ダブり", "D", "AI査定"
 * - 反響日付 >= 2026/1/1
 */
const createTodayCallNotStartedSeller = (overrides: Record<string, unknown> = {}) => ({
  // isTodayCallBase の条件
  status: '追客中',
  next_call_date: '2026-01-01', // 今日以前（過去日付）
  // 営担なし
  visit_assignee: '',
  visitAssignee: '',
  visitAssigneeInitials: '',
  // コミュニケーション情報なし
  contact_method: '',
  preferred_contact_time: '',
  phone_contact_person: '',
  // isTodayCallNotStarted の追加条件
  unreachable_status: '',   // 不通なし
  confidence_level: 'なし', // ダブり/D/AI査定 以外
  inquiry_date: '2026-02-01', // 反響日付 >= 2026/1/1
  ...overrides,
});

// =============================================================================
// タスク1: バグ条件の探索テスト
// =============================================================================

describe('filterSellersByCategory - バグ条件探索テスト（Property 1: Bug Condition）', () => {
  // ---------------------------------------------------------------------------
  // テストケース1（基本ケース）
  // 状況=「追客中」、次電日=今日以前、コミュニケーション情報=全て空、
  // 営担=空、不通=空、反響日付=2026/2/1 の売主が todayCall に含まれることを確認
  //
  // 期待される正しい動作: todayCall に含まれない（isTodayCallNotStarted 該当者は除外）
  // 未修正コードの実際の動作: todayCall に含まれてしまう（バグ）
  // ---------------------------------------------------------------------------
  it('テストケース1（基本ケース）: isTodayCallNotStarted 該当者が todayCall に含まれないこと（未修正コードで FAIL）', () => {
    // **Validates: Requirements 1.1, 1.2**
    //
    // バグ条件:
    // - isTodayCallNotStarted(seller) === true
    // - filterSellersByCategory([seller], 'todayCall') にその売主が含まれている
    //
    // 期待される動作: todayCall に含まれない
    // 未修正コードの動作: todayCall に含まれてしまう（バグ）
    const seller = createTodayCallNotStartedSeller({
      inquiry_date: '2026-02-01', // 反響日付=2026/2/1
    });

    // まず isTodayCallNotStarted が true であることを確認（バグ条件の前提）
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // filterSellersByCategory の todayCall 結果を取得
    const result = filterSellersByCategory([seller], 'todayCall');

    // 期待される正しい動作: todayCall に含まれない
    // このアサーションは未修正コードで FAIL する（バグの存在を証明）
    expect(result).not.toContain(seller);
  });

  // ---------------------------------------------------------------------------
  // テストケース2（境界値）
  // 反響日付=2026/1/1（カットオフ日当日）の売主が todayCall に含まれることを確認
  //
  // 期待される正しい動作: todayCall に含まれない（isTodayCallNotStarted 該当者は除外）
  // 未修正コードの実際の動作: todayCall に含まれてしまう（バグ）
  // ---------------------------------------------------------------------------
  it('テストケース2（境界値）: 反響日付=2026/1/1（カットオフ日当日）の売主が todayCall に含まれないこと（未修正コードで FAIL）', () => {
    // **Validates: Requirements 1.1, 1.2**
    const seller = createTodayCallNotStartedSeller({
      inquiry_date: '2026-01-01', // 反響日付=2026/1/1（カットオフ日当日）
    });

    // まず isTodayCallNotStarted が true であることを確認（バグ条件の前提）
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // filterSellersByCategory の todayCall 結果を取得
    const result = filterSellersByCategory([seller], 'todayCall');

    // 期待される正しい動作: todayCall に含まれない
    // このアサーションは未修正コードで FAIL する（バグの存在を証明）
    expect(result).not.toContain(seller);
  });

  // ---------------------------------------------------------------------------
  // テストケース3（複数売主）
  // isTodayCallNotStarted 該当者と非該当者が混在するリストで、
  // 該当者が todayCall に含まれないことを確認
  //
  // 期待される正しい動作: 該当者は todayCall に含まれない
  // 未修正コードの実際の動作: 該当者も todayCall に含まれてしまう（バグ）
  // ---------------------------------------------------------------------------
  it('テストケース3（複数売主）: isTodayCallNotStarted 該当者と非該当者が混在するリストで、該当者が todayCall に含まれないこと（未修正コードで FAIL）', () => {
    // **Validates: Requirements 1.1, 1.2**

    // isTodayCallNotStarted 該当者（バグ条件を満たす）
    const notStartedSeller = createTodayCallNotStartedSeller({
      inquiry_date: '2026-02-01',
    });

    // isTodayCallNotStarted 非該当者（不通あり → isTodayCallNotStarted = false）
    const regularSeller = createTodayCallNotStartedSeller({
      unreachable_status: '不通', // 不通あり → isTodayCallNotStarted = false
      inquiry_date: '2026-02-01',
    });

    // 前提確認
    expect(isTodayCallNotStarted(notStartedSeller)).toBe(true);  // 該当者
    expect(isTodayCallNotStarted(regularSeller)).toBe(false);    // 非該当者

    // 混在リストで filterSellersByCategory を実行
    const sellers = [notStartedSeller, regularSeller];
    const result = filterSellersByCategory(sellers, 'todayCall');

    // 期待される正しい動作:
    // - notStartedSeller は todayCall に含まれない（isTodayCallNotStarted 該当者は除外）
    // - regularSeller は todayCall に含まれる（isTodayCall 該当者）
    //
    // このアサーションは未修正コードで FAIL する（バグの存在を証明）
    expect(result).not.toContain(notStartedSeller);
    expect(result).toContain(regularSeller);
  });
});
