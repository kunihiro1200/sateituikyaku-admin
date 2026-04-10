/**
 * Property-Based Tests for 電話番号間違いボタン純粋関数
 *
 * Feature: seller-call-mode-wrong-number-button
 * テストライブラリ: fast-check
 *
 * DOM レンダリングを使わず、純粋関数のみをテストする。
 */

import * as fc from 'fast-check';
import {
  isTargetTemplateForWrongNumber,
  generateWrongNumberText,
  insertWrongNumberText,
} from '../pages/CallModePage';

// ---- Property 1: 対象テンプレート判定の正確性 ----
// **Validates: Requirements 1.1, 1.2, 1.3**
describe('Property 1: 対象テンプレート判定の正確性', () => {
  it('任意のラベル文字列に対して、isTargetTemplateForWrongNumber は「査定額案内メール」または「不通で電話時間確認」を含む場合にのみ true を返す', () => {
    fc.assert(
      fc.property(fc.string(), (label) => {
        const result = isTargetTemplateForWrongNumber(label);
        const expected =
          label.includes('査定額案内メール') || label.includes('不通で電話時間確認');
        return result === expected;
      }),
      { numRuns: 100 }
    );
  });
});

// ---- Property 2: 挿入文の電話番号置換 ----
// **Validates: Requirements 2.2**
describe('Property 2: 挿入文の電話番号置換', () => {
  it('任意の非空電話番号に対して、generateWrongNumberText はその電話番号を含み「（電話番号未登録）」を含まない', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim() !== ''),
        (phoneNumber) => {
          const result = generateWrongNumberText(phoneNumber);
          return result.includes(phoneNumber) && !result.includes('（電話番号未登録）');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Property 3: 未設定電話番号のフォールバック ----
// **Validates: Requirements 2.3**
describe('Property 3: 未設定電話番号のフォールバック', () => {
  it('空文字・null・undefined に対して、generateWrongNumberText は「（電話番号未登録）」を含む', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(''),
          fc.constant(null),
          fc.constant(undefined),
          fc.string().filter((s) => s.trim() === '')
        ),
        (phoneNumber) => {
          const result = generateWrongNumberText(phoneNumber as string | null | undefined);
          return result.includes('（電話番号未登録）');
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Property 4: トリガー直後への挿入 ----
// **Validates: Requirements 2.1, 2.7**
describe('Property 4: トリガー直後への挿入', () => {
  it('トリガーを含む本文に対して、insertWrongNumberText はトリガー直後に <br>+挿入文を追加する', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom('いふうです。', '"いふう"です。'),
        fc.string(),
        fc.string({ minLength: 1 }),
        (prefix, trigger, suffix, insertionText) => {
          const body = prefix + trigger + suffix;
          const result = insertWrongNumberText(body, insertionText);
          // トリガーの直後に <br>+挿入文が存在することを確認
          const triggerIdx = body.indexOf(trigger);
          const afterTrigger = trigger + `<br>${insertionText}`;
          const expectedSubstring = body.slice(0, triggerIdx) + afterTrigger;
          return result.startsWith(expectedSubstring);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---- Property 6: トリガー不在時の末尾挿入 ----
// **Validates: Requirements 2.5**
describe('Property 6: トリガー不在時の末尾挿入', () => {
  it('トリガーを含まない本文に対して、insertWrongNumberText は末尾に <br>+挿入文を追加する', () => {
    fc.assert(
      fc.property(
        fc
          .string()
          .filter((s) => !s.includes('いふうです。') && !s.includes('"いふう"です。')),
        fc.string({ minLength: 1 }),
        (body, insertionText) => {
          const result = insertWrongNumberText(body, insertionText);
          return result === body + `<br>${insertionText}`;
        }
      ),
      { numRuns: 100 }
    );
  });
});
