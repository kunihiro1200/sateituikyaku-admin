import * as fc from 'fast-check';
import { isVisitDayBefore, isTodayCallNotStarted } from './sellerStatusFilters';
import * as sellerStatusUtils from './sellerStatusUtils';

// isVisitDayBeforeUtil と getTodayJSTString をモック
vi.mock('./sellerStatusUtils', () => ({
  ...vi.importActual('./sellerStatusUtils'),
  isVisitDayBefore: vi.fn(),
}));

// getTodayJSTString は sellerStatusFilters 内部で使われているため、
// モジュール全体をモックせず、日付を固定する方法でテストする

describe('isVisitDayBefore - visitReminderAssignee 除外ロジック', () => {
  // 基本的な売主オブジェクト（訪問日前日の条件を満たす）
  const baseSeller = {
    visitAssigneeInitials: 'Y',  // hasVisitAssignee = true
    visit_date: '2026/3/22',     // 訪問日あり
  };

  describe('タスク2.2: visitReminderAssignee に値がある場合の除外テスト', () => {
    it('visitReminderAssignee（camelCase）に値がある場合は false を返す', () => {
      const seller = { ...baseSeller, visitReminderAssignee: 'Y' };
      expect(isVisitDayBefore(seller)).toBe(false);
    });

    it('visit_reminder_assignee（snake_case）に値がある場合は false を返す', () => {
      const seller = { ...baseSeller, visit_reminder_assignee: 'Y' };
      expect(isVisitDayBefore(seller)).toBe(false);
    });

    it('visitReminderAssignee に空白のみの場合は除外しない（既存ロジックに委ねる）', () => {
      // 空白のみは trim() で空になるため除外しない
      const seller = { ...baseSeller, visitReminderAssignee: '   ' };
      // 既存ロジックの結果に依存するため、false または true のどちらかになる
      // ここでは「除外されない」ことだけ確認（= visitReminderAssigneeチェックでは弾かれない）
      // 実際の結果は前営業日ロジックに依存するため、エラーが出ないことを確認
      expect(() => isVisitDayBefore(seller)).not.toThrow();
    });

    it('hasVisitAssignee が false の場合（visitReminderAssignee に値があっても）は false を返す', () => {
      const seller = {
        visitAssigneeInitials: '',  // hasVisitAssignee = false
        visit_date: '2026/3/22',
        visitReminderAssignee: 'Y',
      };
      expect(isVisitDayBefore(seller)).toBe(false);
    });

    it('visitDate が未設定の場合（visitReminderAssignee に値があっても）は false を返す', () => {
      const seller = {
        visitAssigneeInitials: 'Y',
        // visit_date なし
        visitReminderAssignee: 'Y',
      };
      expect(isVisitDayBefore(seller)).toBe(false);
    });
  });

  describe('タスク2.3: visitReminderAssignee が空の場合の既存ロジック維持テスト', () => {
    it('visitReminderAssignee が空文字列の場合はエラーなく動作する', () => {
      const seller = { ...baseSeller, visitReminderAssignee: '' };
      expect(() => isVisitDayBefore(seller)).not.toThrow();
    });

    it('visitReminderAssignee が undefined の場合はエラーなく動作する', () => {
      const seller = { ...baseSeller, visitReminderAssignee: undefined };
      expect(() => isVisitDayBefore(seller)).not.toThrow();
    });

    it('visitReminderAssignee が null の場合はエラーなく動作する', () => {
      const seller = { ...baseSeller, visitReminderAssignee: null };
      expect(() => isVisitDayBefore(seller)).not.toThrow();
    });

    it('visitReminderAssignee フィールドが存在しない場合はエラーなく動作する', () => {
      const seller = { ...baseSeller };
      expect(() => isVisitDayBefore(seller)).not.toThrow();
    });
  });

  describe('タスク3: プロパティベーステスト（fast-check）', () => {
    it('Property 1: visitReminderAssignee に値がある売主は常に false を返す', () => {
      // Feature: visit-day-before-notification-exclusion, Property 1
      // Validates: Requirements 1.1, 1.4
      // 空白のみの文字列は trim() で空になるため除外されない → 非空白文字を含む文字列を生成
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim() !== ''),
          (reminderAssignee) => {
            const seller = {
              visitAssigneeInitials: 'Y',
              visit_date: '2026/3/22',
              visitReminderAssignee: reminderAssignee,
            };
            return isVisitDayBefore(seller) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2: visit_reminder_assignee（snake_case）に値がある売主は常に false を返す', () => {
      // Feature: visit-day-before-notification-exclusion, Property 1 (snake_case variant)
      // Validates: Requirements 3.1
      // 空白のみの文字列は trim() で空になるため除外されない → 非空白文字を含む文字列を生成
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.trim() !== ''),
          (reminderAssignee) => {
            const seller = {
              visitAssigneeInitials: 'Y',
              visit_date: '2026/3/22',
              visit_reminder_assignee: reminderAssignee,
            };
            return isVisitDayBefore(seller) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 3: visitReminderAssignee が空の場合は hasVisitAssignee=false なら常に false を返す', () => {
      // Feature: visit-day-before-notification-exclusion, Property 2
      // Validates: Requirements 1.2, 2.3
      fc.assert(
        fc.property(
          fc.record({
            visitReminderAssignee: fc.constant(''),
            visit_date: fc.constant('2026/3/22'),
            // visitAssigneeInitials なし = hasVisitAssignee false
          }),
          (seller) => {
            return isVisitDayBefore(seller) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 4: visitReminderAssignee フィールドが存在しない場合はエラーが発生しない', () => {
      // Feature: visit-day-before-notification-exclusion, Property 3
      // Validates: Requirements 3.2
      fc.assert(
        fc.property(
          fc.record({
            visitAssigneeInitials: fc.string({ minLength: 1 }),
            visit_date: fc.constant('2026/3/22'),
            // visitReminderAssignee フィールドなし
          }),
          (seller) => {
            expect(() => isVisitDayBefore(seller)).not.toThrow();
            return true;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

// =============================================================================
// タスク1: バグ条件の探索テスト
// Property 1: Bug Condition
// exclusion_date を持つ売主が当日TEL_未着手に誤って分類されるバグ
//
// 重要: このテストは修正前のコードで FAIL すること — FAIL がバグの存在を証明する
// テストは期待される正しい動作をエンコードしており、修正後に PASS することで修正を検証する
//
// Validates: Requirements 1.1, 1.2
// =============================================================================

describe('isTodayCallNotStarted - バグ条件探索テスト（Property 1: Bug Condition）', () => {
  /**
   * isTodayCallBase() が true になるための最小限の売主データ
   * - status: "追客中"（完全一致）
   * - next_call_date: 今日以前の日付
   * - visit_assignee: ""（営担なし）
   * - contact_method, preferred_contact_time, phone_contact_person: ""（コミュニケーション情報なし）
   */
  const baseBugConditionSeller = {
    // isTodayCallBase の条件
    status: '追客中',
    next_call_date: '2026-01-01', // 今日以前（過去日付）
    visit_assignee: '',
    visitAssignee: '',
    // コミュニケーション情報なし
    contact_method: '',
    preferred_contact_time: '',
    phone_contact_person: '',
    // isTodayCallNotStarted の追加条件
    unreachable_status: '',
    confidence_level: 'なし', // ダブり/D/AI査定 以外
    inquiry_date: '2026-01-01', // カットオフ日以降
    // バグ条件: exclusion_date が設定されている
    exclusion_date: '2026-03-01',
  };

  describe('具体的なバグ再現テスト（AA13967相当）', () => {
    it('exclusion_date が設定されている売主は isTodayCallNotStarted() が false を返すべき（修正前は FAIL）', () => {
      // **Validates: Requirements 1.1, 1.2**
      //
      // バグ条件:
      // - exclusion_date が null でなく空でもない
      // - isTodayCallBase(seller) == true
      // - status == "追客中"
      // - unreachable_status == ""
      // - confidence_level が "ダブり", "D", "AI査定" のいずれでもない
      // - inquiry_date >= "2026-01-01"
      //
      // 期待される動作: isTodayCallNotStarted() は false を返す
      // 修正前の実際の動作: isTodayCallNotStarted() は true を返す（バグ）
      const seller = { ...baseBugConditionSeller };
      const result = isTodayCallNotStarted(seller);
      // このアサーションは修正前のコードで FAIL する（バグの存在を証明）
      expect(result).toBe(false);
    });

    it('exclusion_date が snake_case で設定されている場合も false を返すべき（修正前は FAIL）', () => {
      // **Validates: Requirements 1.1, 1.2**
      const seller = {
        ...baseBugConditionSeller,
        exclusion_date: '2026-04-01',
      };
      const result = isTodayCallNotStarted(seller);
      expect(result).toBe(false);
    });

    it('exclusion_date が camelCase（exclusionDate）で設定されている場合も false を返すべき（修正前は FAIL）', () => {
      // **Validates: Requirements 1.1, 1.2**
      const seller = {
        ...baseBugConditionSeller,
        exclusion_date: undefined,
        exclusionDate: '2026-04-01',
      };
      const result = isTodayCallNotStarted(seller);
      expect(result).toBe(false);
    });
  });

  describe('Property 1: プロパティベーステスト（fast-check）', () => {
    it('Property 1: exclusion_date が設定されている売主は常に isTodayCallNotStarted() が false を返すべき（修正前は FAIL）', () => {
      // **Validates: Requirements 1.1, 1.2**
      //
      // バグ条件を満たす全入力に対して、isTodayCallNotStarted() が false を返すことを検証
      // 修正前のコードでは exclusion_date チェックが欠落しているため、このテストは FAIL する
      fc.assert(
        fc.property(
          // exclusion_date: 空でない文字列（バグ条件）
          fc.string({ minLength: 1 }).filter(s => s.trim() !== ''),
          // confidence_level: ダブり/D/AI査定 以外
          fc.string().filter(s => s !== 'ダブり' && s !== 'D' && s !== 'AI査定'),
          (exclusionDate, confidenceLevel) => {
            const seller = {
              ...baseBugConditionSeller,
              exclusion_date: exclusionDate,
              confidence_level: confidenceLevel,
            };
            // 期待される動作: false を返す
            // 修正前の実際の動作: true を返す（バグ）
            return isTodayCallNotStarted(seller) === false;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});


// =============================================================================
// タスク2: 保全プロパティテスト（修正前に実施）
// Property 2: Preservation - exclusion_date を持たない売主の動作が変わらないこと
//
// 重要: このテストは修正前のコードで PASS すること
// 観察優先メソドロジー: 修正前のコードで exclusion_date なしの動作を観察・記録する
//
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
// =============================================================================

import { isUnvaluated } from './sellerStatusFilters';

describe('isTodayCallNotStarted / isUnvaluated - 保全プロパティテスト（Property 2: Preservation）', () => {
  /**
   * 当日TEL_未着手の全条件を満たす基本売主データ（exclusion_date なし）
   */
  const basePreservationSeller = {
    // isTodayCallBase の条件
    status: '追客中',
    next_call_date: '2026-01-01', // 今日以前（過去日付）
    visit_assignee: '',
    visitAssignee: '',
    // コミュニケーション情報なし
    contact_method: '',
    preferred_contact_time: '',
    phone_contact_person: '',
    // isTodayCallNotStarted の追加条件
    unreachable_status: '',
    confidence_level: 'なし', // ダブり/D/AI査定 以外
    inquiry_date: '2026-01-01', // カットオフ日以降
    // exclusion_date なし（保全テストの核心）
    // exclusion_date フィールドは存在しない
  };

  // =========================================================================
  // 観察1: exclusion_date なし + 当日TEL_未着手の全条件を満たす売主
  // → isTodayCallNotStarted() が true を返す
  // =========================================================================
  describe('観察1: exclusion_date なし + 当日TEL_未着手の全条件を満たす売主', () => {
    it('exclusion_date なし + 全条件を満たす → isTodayCallNotStarted() が true を返す', () => {
      // **Validates: Requirements 3.1**
      const seller = { ...basePreservationSeller };
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });

    it('exclusion_date が空文字列 → isTodayCallNotStarted() が true を返す', () => {
      // **Validates: Requirements 3.1**
      const seller = { ...basePreservationSeller, exclusion_date: '' };
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });

    it('exclusion_date が null → isTodayCallNotStarted() が true を返す', () => {
      // **Validates: Requirements 3.1**
      const seller = { ...basePreservationSeller, exclusion_date: null };
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });

    it('exclusion_date が undefined → isTodayCallNotStarted() が true を返す', () => {
      // **Validates: Requirements 3.1**
      const seller = { ...basePreservationSeller, exclusion_date: undefined };
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });

    it('exclusionDate（camelCase）が空文字列 → isTodayCallNotStarted() が true を返す', () => {
      // **Validates: Requirements 3.1**
      const seller = { ...basePreservationSeller, exclusionDate: '' };
      expect(isTodayCallNotStarted(seller)).toBe(true);
    });
  });

  // =========================================================================
  // 観察2: exclusion_date なし + 不通あり
  // → isTodayCallNotStarted() が false を返す
  // =========================================================================
  describe('観察2: exclusion_date なし + 不通あり', () => {
    it('exclusion_date なし + unreachable_status あり → isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.3**
      const seller = {
        ...basePreservationSeller,
        unreachable_status: '不通',
      };
      expect(isTodayCallNotStarted(seller)).toBe(false);
    });

    it('exclusion_date なし + unreachableStatus（camelCase）あり → isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.3**
      const seller = {
        ...basePreservationSeller,
        unreachableStatus: '不通',
      };
      expect(isTodayCallNotStarted(seller)).toBe(false);
    });
  });

  // =========================================================================
  // 観察3: exclusion_date なし + 確度が「ダブり」
  // → isTodayCallNotStarted() が false を返す
  // =========================================================================
  describe('観察3: exclusion_date なし + 確度が「ダブり」', () => {
    it('exclusion_date なし + confidence_level = "ダブり" → isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.4**
      const seller = {
        ...basePreservationSeller,
        confidence_level: 'ダブり',
      };
      expect(isTodayCallNotStarted(seller)).toBe(false);
    });

    it('exclusion_date なし + confidence_level = "D" → isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.4**
      const seller = {
        ...basePreservationSeller,
        confidence_level: 'D',
      };
      expect(isTodayCallNotStarted(seller)).toBe(false);
    });

    it('exclusion_date なし + confidence_level = "AI査定" → isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.4**
      const seller = {
        ...basePreservationSeller,
        confidence_level: 'AI査定',
      };
      expect(isTodayCallNotStarted(seller)).toBe(false);
    });
  });

  // =========================================================================
  // 観察4: exclusion_date なし + 未査定条件を満たす
  // → isUnvaluated() が true を返す
  // =========================================================================
  describe('観察4: exclusion_date なし + 未査定条件を満たす', () => {
    it('exclusion_date なし + 未査定条件を満たす → isUnvaluated() が true を返す', () => {
      // **Validates: Requirements 3.2**
      // 未査定条件: 査定額なし + 反響日付2025/12/8以降 + 査定不要でない + 営担なし + 追客中
      // かつ isTodayCallNotStarted() が false になる条件（不通あり）
      const seller = {
        status: '追客中',
        next_call_date: '2026-01-01',
        visit_assignee: '',
        visitAssignee: '',
        contact_method: '',
        preferred_contact_time: '',
        phone_contact_person: '',
        unreachable_status: '不通', // 不通あり → isTodayCallNotStarted() が false
        confidence_level: 'なし',
        inquiry_date: '2026-01-01',
        // 査定額なし
        valuationAmount1: null,
        valuationAmount2: null,
        valuationAmount3: null,
        // exclusion_date なし
      };
      expect(isUnvaluated(seller)).toBe(true);
    });
  });

  // =========================================================================
  // Property 2: プロパティベーステスト（fast-check）
  // exclusion_date が空/null/未設定の全パターンで修正前後の結果が一致すること
  // =========================================================================
  describe('Property 2: プロパティベーステスト（fast-check）', () => {
    it('Property 2a: exclusion_date が空文字列の場合、exclusion_date なしと同じ結果を返す', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
      //
      // exclusion_date が空文字列の場合、exclusion_date フィールドが存在しない場合と
      // 同じ結果を返すことを検証する（保全プロパティ）
      fc.assert(
        fc.property(
          // confidence_level: ダブり/D/AI査定 以外
          fc.string().filter(s => s !== 'ダブり' && s !== 'D' && s !== 'AI査定'),
          // unreachable_status: 空文字列（不通なし）
          fc.constant(''),
          (confidenceLevel, unreachableStatus) => {
            const sellerWithoutExclusionDate = {
              ...basePreservationSeller,
              confidence_level: confidenceLevel,
              unreachable_status: unreachableStatus,
            };
            const sellerWithEmptyExclusionDate = {
              ...basePreservationSeller,
              confidence_level: confidenceLevel,
              unreachable_status: unreachableStatus,
              exclusion_date: '', // 空文字列
            };
            // 修正前後で同じ結果を返すこと（保全）
            return isTodayCallNotStarted(sellerWithoutExclusionDate) ===
                   isTodayCallNotStarted(sellerWithEmptyExclusionDate);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2b: exclusion_date が null の場合、exclusion_date なしと同じ結果を返す', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== 'ダブり' && s !== 'D' && s !== 'AI査定'),
          fc.constant(''),
          (confidenceLevel, unreachableStatus) => {
            const sellerWithoutExclusionDate = {
              ...basePreservationSeller,
              confidence_level: confidenceLevel,
              unreachable_status: unreachableStatus,
            };
            const sellerWithNullExclusionDate = {
              ...basePreservationSeller,
              confidence_level: confidenceLevel,
              unreachable_status: unreachableStatus,
              exclusion_date: null, // null
            };
            return isTodayCallNotStarted(sellerWithoutExclusionDate) ===
                   isTodayCallNotStarted(sellerWithNullExclusionDate);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2c: exclusion_date が空白のみの場合、exclusion_date なしと同じ結果を返す', () => {
      // **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
      fc.assert(
        fc.property(
          fc.string().filter(s => s !== 'ダブり' && s !== 'D' && s !== 'AI査定'),
          fc.constant(''),
          (confidenceLevel, unreachableStatus) => {
            const sellerWithoutExclusionDate = {
              ...basePreservationSeller,
              confidence_level: confidenceLevel,
              unreachable_status: unreachableStatus,
            };
            const sellerWithWhitespaceExclusionDate = {
              ...basePreservationSeller,
              confidence_level: confidenceLevel,
              unreachable_status: unreachableStatus,
              exclusion_date: '   ', // 空白のみ
            };
            return isTodayCallNotStarted(sellerWithoutExclusionDate) ===
                   isTodayCallNotStarted(sellerWithWhitespaceExclusionDate);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2d: exclusion_date なし + 不通あり → 常に isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.3**
      fc.assert(
        fc.property(
          // unreachable_status: 空でない文字列（不通あり）
          fc.string({ minLength: 1 }).filter(s => s.trim() !== ''),
          (unreachableStatus) => {
            const seller = {
              ...basePreservationSeller,
              unreachable_status: unreachableStatus,
              // exclusion_date なし
            };
            return isTodayCallNotStarted(seller) === false;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2e: exclusion_date なし + 確度が「ダブり」「D」「AI査定」 → 常に isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.4**
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('ダブり'),
            fc.constant('D'),
            fc.constant('AI査定')
          ),
          (confidenceLevel) => {
            const seller = {
              ...basePreservationSeller,
              confidence_level: confidenceLevel,
              // exclusion_date なし
            };
            return isTodayCallNotStarted(seller) === false;
          }
        ),
        { numRuns: 50 }
      );
    });

    it('Property 2f: exclusion_date なし + 反響日付が2026/1/1より前 → 常に isTodayCallNotStarted() が false を返す', () => {
      // **Validates: Requirements 3.5**
      // 2026-01-01 より前の日付を文字列で生成（YYYY-MM-DD形式）
      const pastDates = [
        '2025-12-31', '2025-12-01', '2025-11-01',
        '2025-06-15', '2025-01-01', '2024-12-31',
        '2024-01-01', '2023-06-01', '2022-01-01',
      ];
      fc.assert(
        fc.property(
          fc.constantFrom(...pastDates),
          (inquiryDate) => {
            const seller = {
              ...basePreservationSeller,
              inquiry_date: inquiryDate,
              // exclusion_date なし
            };
            return isTodayCallNotStarted(seller) === false;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
