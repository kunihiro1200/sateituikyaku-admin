/**
 * 保全プロパティテスト
 * Property 2: Preservation - 当日TEL_未着手非該当者の当日TEL分表示は変わらない
 *
 * 重要: このテストは未修正コードで PASS する — 保全すべきベースライン動作を確認する
 *
 * 観察優先メソドロジーに従う:
 * - 観察1: isTodayCall が true かつ isTodayCallNotStarted が false の売主は todayCall に含まれる
 * - 観察2: isTodayCallNotStarted 該当者は todayCallNotStarted カテゴリーに引き続き含まれる
 * - 観察3: todayCallWithInfo、visitDayBefore など他カテゴリーの結果は変わらない
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 */

import * as fc from 'fast-check';
import { filterSellersByCategory, isTodayCall, isTodayCallNotStarted } from './sellerStatusFilters';

// =============================================================================
// テスト用の売主データ作成ヘルパー
// =============================================================================

/**
 * isTodayCall の条件を満たすが isTodayCallNotStarted の条件を満たさない売主を作成する
 *
 * isTodayCallNotStarted が false になる条件（いずれか）:
 * 1. 不通カラムに値がある（unreachable_status が空でない）
 * 2. 反響日付が2026/1/1未満
 * 3. 状況が「追客中」完全一致でない（例: 「他決→追客」）
 * 4. 確度が「ダブり」「D」「AI査定」のいずれか
 */
const createTodayCallOnlySeller = (overrides: Record<string, unknown> = {}) => ({
  // isTodayCallBase の条件（isTodayCall の前提）
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
  // isTodayCallNotStarted を false にする条件: 不通あり
  unreachable_status: '不通',
  confidence_level: 'なし',
  inquiry_date: '2026-02-01',
  ...overrides,
});

// =============================================================================
// タスク2: 保全プロパティテスト
// =============================================================================

describe('filterSellersByCategory - 保全プロパティテスト（Property 2: Preservation）', () => {
  // ---------------------------------------------------------------------------
  // 観察1の検証: isTodayCall が true かつ isTodayCallNotStarted が false の売主は
  // todayCall に含まれる（未修正コードで PASS）
  // ---------------------------------------------------------------------------

  it('観察1（不通あり）: 不通ありの売主は isTodayCallNotStarted=false かつ todayCall に含まれること', () => {
    // **Validates: Requirements 3.2**
    //
    // 保全すべき動作:
    // - isTodayCall が true かつ isTodayCallNotStarted が false の売主は todayCall に含まれる
    // - 修正前後ともに変わらない
    const seller = createTodayCallOnlySeller({
      unreachable_status: '不通', // 不通あり → isTodayCallNotStarted = false
      inquiry_date: '2026-02-01',
    });

    // 前提確認
    expect(isTodayCall(seller)).toBe(true);
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 保全すべき動作: todayCall に含まれる
    const result = filterSellersByCategory([seller], 'todayCall');
    expect(result).toContain(seller);
  });

  it('観察1（反響日付が2025/12/31以前）: 反響日付が古い売主は isTodayCallNotStarted=false かつ todayCall に含まれること', () => {
    // **Validates: Requirements 3.2**
    const seller = createTodayCallOnlySeller({
      unreachable_status: '', // 不通なし
      inquiry_date: '2025-12-31', // 反響日付が2026/1/1未満 → isTodayCallNotStarted = false
    });

    // 前提確認
    expect(isTodayCall(seller)).toBe(true);
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 保全すべき動作: todayCall に含まれる
    const result = filterSellersByCategory([seller], 'todayCall');
    expect(result).toContain(seller);
  });

  it('観察1（状況が他決→追客）: 状況が「他決→追客」の売主は isTodayCallNotStarted=false かつ todayCall に含まれること', () => {
    // **Validates: Requirements 3.2**
    const seller = createTodayCallOnlySeller({
      status: '他決→追客', // 「追客中」完全一致でない → isTodayCallNotStarted = false
      unreachable_status: '',
      inquiry_date: '2026-02-01',
    });

    // 前提確認
    expect(isTodayCall(seller)).toBe(true);
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 保全すべき動作: todayCall に含まれる
    const result = filterSellersByCategory([seller], 'todayCall');
    expect(result).toContain(seller);
  });

  // ---------------------------------------------------------------------------
  // 観察2の検証: isTodayCallNotStarted 該当者は todayCallNotStarted カテゴリーに
  // 引き続き含まれる（未修正コードで PASS）
  // ---------------------------------------------------------------------------

  it('観察2: isTodayCallNotStarted 該当者は todayCallNotStarted カテゴリーに含まれること', () => {
    // **Validates: Requirements 3.1**
    const seller = createTodayCallOnlySeller({
      unreachable_status: '', // 不通なし
      inquiry_date: '2026-02-01', // 反響日付 >= 2026/1/1
      status: '追客中', // 完全一致
      confidence_level: 'なし',
    });

    // 前提確認
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // 保全すべき動作: todayCallNotStarted に含まれる
    const result = filterSellersByCategory([seller], 'todayCallNotStarted');
    expect(result).toContain(seller);
  });

  // ---------------------------------------------------------------------------
  // プロパティベーステスト: isTodayCallNotStarted が false かつ isTodayCall が true の
  // 全売主に対して、filterSellersByCategory(sellers, 'todayCall') がその売主を含む
  // （未修正コードで PASS）
  // ---------------------------------------------------------------------------

  it('プロパティテスト: isTodayCallNotStarted=false かつ isTodayCall=true の全売主が todayCall に含まれること（未修正コードで PASS）', () => {
    // **Validates: Requirements 3.2, 3.3**
    //
    // Property 2: Preservation
    // For any seller where isTodayCallNotStarted(seller) === false AND isTodayCall(seller) === true,
    // filterSellersByCategory(sellers, 'todayCall') must include that seller.
    //
    // このテストは未修正コードで PASS する（保全すべきベースライン動作を確認する）

    // 不通ありのバリエーション（isTodayCallNotStarted = false の確実な方法）
    const unreachableStatusArbitrary = fc.constantFrom('不通', '不通1', '不通2', '留守', '着信拒否');

    // 反響日付のバリエーション（2025/12/31以前 → isTodayCallNotStarted = false）
    const oldInquiryDateArbitrary = fc.constantFrom(
      '2025-12-31',
      '2025-12-01',
      '2025-06-01',
      '2024-01-01',
    );

    // 状況のバリエーション（「追客中」以外 → isTodayCallNotStarted = false）
    const nonExactStatusArbitrary = fc.constantFrom(
      '他決→追客',
      '除外後追客中',
    );

    // 確度のバリエーション（ダブり/D/AI査定 → isTodayCallNotStarted = false）
    const excludedConfidenceArbitrary = fc.constantFrom('ダブり', 'D', 'AI査定');

    // パターン1: 不通ありの売主（isTodayCallNotStarted = false）
    fc.assert(
      fc.property(
        unreachableStatusArbitrary,
        (unreachableStatus) => {
          const seller = createTodayCallOnlySeller({
            unreachable_status: unreachableStatus,
            inquiry_date: '2026-02-01',
            status: '追客中',
            confidence_level: 'なし',
          });

          // isTodayCall が true かつ isTodayCallNotStarted が false であることを確認
          if (!isTodayCall(seller) || isTodayCallNotStarted(seller)) {
            return true; // 前提条件を満たさない場合はスキップ
          }

          const result = filterSellersByCategory([seller], 'todayCall');
          return result.includes(seller);
        }
      ),
      { numRuns: 10 }
    );

    // パターン2: 反響日付が古い売主（isTodayCallNotStarted = false）
    fc.assert(
      fc.property(
        oldInquiryDateArbitrary,
        (inquiryDate) => {
          const seller = createTodayCallOnlySeller({
            unreachable_status: '',
            inquiry_date: inquiryDate,
            status: '追客中',
            confidence_level: 'なし',
          });

          // isTodayCall が true かつ isTodayCallNotStarted が false であることを確認
          if (!isTodayCall(seller) || isTodayCallNotStarted(seller)) {
            return true; // 前提条件を満たさない場合はスキップ
          }

          const result = filterSellersByCategory([seller], 'todayCall');
          return result.includes(seller);
        }
      ),
      { numRuns: 10 }
    );

    // パターン3: 状況が「追客中」完全一致でない売主（isTodayCallNotStarted = false）
    fc.assert(
      fc.property(
        nonExactStatusArbitrary,
        (status) => {
          const seller = createTodayCallOnlySeller({
            status,
            unreachable_status: '',
            inquiry_date: '2026-02-01',
            confidence_level: 'なし',
          });

          // isTodayCall が true かつ isTodayCallNotStarted が false であることを確認
          if (!isTodayCall(seller) || isTodayCallNotStarted(seller)) {
            return true; // 前提条件を満たさない場合はスキップ
          }

          const result = filterSellersByCategory([seller], 'todayCall');
          return result.includes(seller);
        }
      ),
      { numRuns: 10 }
    );

    // パターン4: 確度が除外対象の売主（isTodayCallNotStarted = false）
    fc.assert(
      fc.property(
        excludedConfidenceArbitrary,
        (confidenceLevel) => {
          const seller = createTodayCallOnlySeller({
            unreachable_status: '',
            inquiry_date: '2026-02-01',
            status: '追客中',
            confidence_level: confidenceLevel,
          });

          // isTodayCall が true かつ isTodayCallNotStarted が false であることを確認
          if (!isTodayCall(seller) || isTodayCallNotStarted(seller)) {
            return true; // 前提条件を満たさない場合はスキップ
          }

          const result = filterSellersByCategory([seller], 'todayCall');
          return result.includes(seller);
        }
      ),
      { numRuns: 10 }
    );
  });

  // ---------------------------------------------------------------------------
  // 観察3の検証: todayCallWithInfo、visitDayBefore など他カテゴリーの結果は変わらない
  // ---------------------------------------------------------------------------

  it('観察3（todayCallWithInfo）: コミュニケーション情報ありの売主は todayCallWithInfo に含まれること', () => {
    // **Validates: Requirements 3.5**
    const seller = {
      status: '追客中',
      next_call_date: '2026-01-01',
      visit_assignee: '',
      visitAssignee: '',
      visitAssigneeInitials: '',
      contact_method: 'Eメール', // コミュニケーション情報あり
      preferred_contact_time: '',
      phone_contact_person: '',
      unreachable_status: '',
      confidence_level: 'なし',
      inquiry_date: '2026-02-01',
    };

    // 保全すべき動作: todayCallWithInfo に含まれる
    const result = filterSellersByCategory([seller], 'todayCallWithInfo');
    expect(result).toContain(seller);
  });

  it('観察3（todayCall 以外のカテゴリー）: todayCall 以外のカテゴリーは影響を受けないこと', () => {
    // **Validates: Requirements 3.4, 3.5**
    //
    // todayCallNotStarted カテゴリーは todayCall の変更に影響されない
    const notStartedSeller = createTodayCallOnlySeller({
      unreachable_status: '',
      inquiry_date: '2026-02-01',
      status: '追客中',
      confidence_level: 'なし',
    });

    // 前提確認
    expect(isTodayCallNotStarted(notStartedSeller)).toBe(true);

    // todayCallNotStarted カテゴリーに含まれる（保全すべき動作）
    const notStartedResult = filterSellersByCategory([notStartedSeller], 'todayCallNotStarted');
    expect(notStartedResult).toContain(notStartedSeller);

    // all カテゴリーは全売主を返す（保全すべき動作）
    const allResult = filterSellersByCategory([notStartedSeller], 'all');
    expect(allResult).toContain(notStartedSeller);
  });

  // ---------------------------------------------------------------------------
  // 境界値テスト: 反響日付の境界値
  // ---------------------------------------------------------------------------

  it('境界値（反響日付=2025/12/31）: 反響日付が2025/12/31の売主は isTodayCallNotStarted=false かつ todayCall に含まれること', () => {
    // **Validates: Requirements 3.2**
    const seller = createTodayCallOnlySeller({
      unreachable_status: '',
      inquiry_date: '2025-12-31', // カットオフ日の前日 → isTodayCallNotStarted = false
      status: '追客中',
      confidence_level: 'なし',
    });

    // 前提確認
    expect(isTodayCall(seller)).toBe(true);
    expect(isTodayCallNotStarted(seller)).toBe(false);

    // 保全すべき動作: todayCall に含まれる
    const result = filterSellersByCategory([seller], 'todayCall');
    expect(result).toContain(seller);
  });

  it('境界値（反響日付=2026/1/1）: 反響日付が2026/1/1の売主は isTodayCallNotStarted=true かつ todayCallNotStarted に含まれること', () => {
    // **Validates: Requirements 3.1**
    const seller = createTodayCallOnlySeller({
      unreachable_status: '',
      inquiry_date: '2026-01-01', // カットオフ日当日 → isTodayCallNotStarted = true
      status: '追客中',
      confidence_level: 'なし',
    });

    // 前提確認
    expect(isTodayCallNotStarted(seller)).toBe(true);

    // 保全すべき動作: todayCallNotStarted に含まれる
    const notStartedResult = filterSellersByCategory([seller], 'todayCallNotStarted');
    expect(notStartedResult).toContain(seller);
  });
});
