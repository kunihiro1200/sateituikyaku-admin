/**
 * normalizePhoneNumber のプロパティベーステスト
 * Validates: Requirements 1.1, 1.2, 1.4, 1.5
 */
import * as fc from 'fast-check';
import { normalizePhoneNumber } from './phoneNormalizer';

describe('normalizePhoneNumber プロパティベーステスト', () => {
  /**
   * Property 1: 先頭「0」でない非空文字列 s に対して normalizePhoneNumber(s) === '0' + s
   * Validates: Requirements 1.1, 1.4, 1.5
   */
  test('Property 1: 先頭「0」でない非空文字列には「0」が付加される', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.length > 0 && !s.startsWith('0')),
        (s) => normalizePhoneNumber(s) === '0' + s
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: 先頭「0」の文字列 s に対して normalizePhoneNumber(s) === s
   * Validates: Requirements 1.2, 2.3
   */
  test('Property 2: 先頭「0」の文字列はそのまま返される（べき等性）', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s.startsWith('0')),
        (s) => normalizePhoneNumber(s) === s
      ),
      { numRuns: 100 }
    );
  });
});
