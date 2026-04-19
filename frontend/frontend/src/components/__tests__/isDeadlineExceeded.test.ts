/**
 * isDeadlineExceeded 純粋関数のテスト
 * タスク1.1, 1.2, 1.3 に対応
 */
import * as fc from 'fast-check';
import { isDeadlineExceeded } from '../../utils/deadlineUtils';

// ============================================================
// サブタスク 1.3: 具体例ユニットテスト
// ============================================================
describe('isDeadlineExceeded - 具体例テスト', () => {
  test('dueDate が deadline より後の場合は true を返す', () => {
    expect(isDeadlineExceeded('2025-08-10T12:00', '2025-08-05')).toBe(true);
  });

  test('dueDate が deadline と同日の場合は false を返す（同日は警告しない）', () => {
    expect(isDeadlineExceeded('2025-08-05T12:00', '2025-08-05')).toBe(false);
  });

  test('dueDate が deadline より前の場合は false を返す', () => {
    expect(isDeadlineExceeded('2025-08-04T12:00', '2025-08-05')).toBe(false);
  });

  test('dueDate が空文字の場合は false を返す', () => {
    expect(isDeadlineExceeded('', '2025-08-05')).toBe(false);
  });

  test('dueDate が null の場合は false を返す', () => {
    expect(isDeadlineExceeded(null, '2025-08-05')).toBe(false);
  });

  test('dueDate が undefined の場合は false を返す', () => {
    expect(isDeadlineExceeded(undefined, '2025-08-05')).toBe(false);
  });

  test('dueDate が無効な文字列の場合は false を返す', () => {
    expect(isDeadlineExceeded('invalid', '2025-08-05')).toBe(false);
  });

  test('deadline が空文字の場合は false を返す', () => {
    expect(isDeadlineExceeded('2025-08-10T12:00', '')).toBe(false);
  });

  test('deadline が null の場合は false を返す', () => {
    expect(isDeadlineExceeded('2025-08-10T12:00', null)).toBe(false);
  });

  test('deadline が undefined の場合は false を返す', () => {
    expect(isDeadlineExceeded('2025-08-10T12:00', undefined)).toBe(false);
  });

  test('時刻が異なっても日付部分のみで比較する（同日・時刻が遅くても false）', () => {
    expect(isDeadlineExceeded('2025-08-05T23:59', '2025-08-05')).toBe(false);
  });

  test('時刻が異なっても日付部分のみで比較する（翌日・時刻が早くても true）', () => {
    expect(isDeadlineExceeded('2025-08-06T00:01', '2025-08-05')).toBe(true);
  });
});

// ============================================================
// サブタスク 1.1: プロパティ1 - 締日超過判定の正確性
// Validates: Requirements 1.1, 1.2, 2.1, 2.2
// ============================================================
describe('isDeadlineExceeded - プロパティ1: 締日超過判定の正確性', () => {
  test('任意の有効な dueDate と deadline のペアに対して正確に判定する', () => {
    // NaN Date を除外するためにフィルタリング
    const validDate = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()));

    fc.assert(
      fc.property(
        validDate,
        validDate,
        (dueDateObj, deadlineObj) => {
          const dueDate = `${dueDateObj.toISOString().split('T')[0]}T12:00`;
          const deadline = deadlineObj.toISOString().split('T')[0];
          const result = isDeadlineExceeded(dueDate, deadline);
          const dueDateOnly = dueDate.split('T')[0];
          const expected = dueDateOnly > deadline;
          return result === expected;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ============================================================
// サブタスク 1.2: プロパティ2 - 無効入力に対する安全性
// Validates: Requirements 1.3, 1.4, 2.3, 2.4
// ============================================================
describe('isDeadlineExceeded - プロパティ2: 無効入力に対する安全性', () => {
  test('dueDate が無効な入力の場合は常に false を返す', () => {
    // NaN Date を除外するためにフィルタリング
    const validDate = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()));

    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(''),
          // パース不能な文字列（日付形式でないもの）
          fc.string().filter(s => {
            if (!s) return false;
            const d = new Date(s.split('T')[0]);
            return isNaN(d.getTime());
          })
        ),
        validDate,
        (invalidDueDate, deadlineObj) => {
          const deadline = deadlineObj.toISOString().split('T')[0];
          return isDeadlineExceeded(invalidDueDate as any, deadline) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deadline が無効な入力の場合は常に false を返す', () => {
    // NaN Date を除外するためにフィルタリング
    const validDate = fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
      .filter(d => !isNaN(d.getTime()));

    fc.assert(
      fc.property(
        validDate,
        fc.oneof(
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('')
        ),
        (dueDateObj, invalidDeadline) => {
          const dueDate = `${dueDateObj.toISOString().split('T')[0]}T12:00`;
          return isDeadlineExceeded(dueDate, invalidDeadline as any) === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  test('例外をスローしない（防御的実装）', () => {
    const inputs: Array<[any, any]> = [
      [null, null],
      [undefined, undefined],
      ['', ''],
      ['not-a-date', 'also-not-a-date'],
      ['2025-13-45T99:99', '2025-08-05'],
      ['2025-08-10T12:00', '2025-99-99'],
    ];
    for (const [dueDate, deadline] of inputs) {
      expect(() => isDeadlineExceeded(dueDate, deadline)).not.toThrow();
    }
  });
});
