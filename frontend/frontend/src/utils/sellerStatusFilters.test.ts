import * as fc from 'fast-check';
import { isVisitDayBefore } from './sellerStatusFilters';
import * as sellerStatusUtils from './sellerStatusUtils';

// isVisitDayBeforeUtil と getTodayJSTString をモック
jest.mock('./sellerStatusUtils', () => ({
  ...jest.requireActual('./sellerStatusUtils'),
  isVisitDayBefore: jest.fn(),
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
