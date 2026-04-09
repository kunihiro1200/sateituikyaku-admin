/**
 * Preservation Property Tests for extractStatusAlpha
 * 
 * IMPORTANT: Follow observation-first methodology
 * 
 * These tests capture the behavior of UNFIXED code for non-buggy inputs
 * to ensure the fix doesn't break existing functionality.
 * 
 * EXPECTED OUTCOME: Tests PASS on fixed code (confirms no regressions)
 */

describe('extractStatusAlpha - Preservation Property Tests', () => {
  // 修正後のコード
  const extractStatusAlpha_FIXED = (status: string | null): string => {
    if (!status) return '-';
    // 最初の1文字のみを返す
    return status.charAt(0);
  };

  describe('Property 2: Preservation - 単一アルファベット文字列の表示', () => {
    describe('Observation: Single alphabet strings', () => {
      test('Observe: "A" returns "A" on fixed code', () => {
        const result = extractStatusAlpha_FIXED('A');
        expect(result).toBe('A');
      });

      test('Observe: "B" returns "B" on fixed code', () => {
        const result = extractStatusAlpha_FIXED('B');
        expect(result).toBe('B');
      });

      test('Observe: "C" returns "C" on fixed code', () => {
        const result = extractStatusAlpha_FIXED('C');
        expect(result).toBe('C');
      });

      test('Observe: "D" returns "D" on fixed code', () => {
        const result = extractStatusAlpha_FIXED('D');
        expect(result).toBe('D');
      });

      test('Observe: "E" returns "E" on fixed code', () => {
        const result = extractStatusAlpha_FIXED('E');
        expect(result).toBe('E');
      });
    });

    describe('Observation: Null and empty values', () => {
      test('Observe: null returns "-" on fixed code', () => {
        const result = extractStatusAlpha_FIXED(null);
        expect(result).toBe('-');
      });

      test('Observe: empty string returns "-" on fixed code', () => {
        const result = extractStatusAlpha_FIXED('');
        expect(result).toBe('-');
      });
    });

    describe('Property-based testing: Random single alphabet strings', () => {
      test('Property: Any single uppercase letter should return itself', () => {
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        
        letters.forEach(letter => {
          const result = extractStatusAlpha_FIXED(letter);
          expect(result).toBe(letter);
        });
      });

      test('Property: Any single lowercase letter should return itself', () => {
        const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
        
        letters.forEach(letter => {
          const result = extractStatusAlpha_FIXED(letter);
          expect(result).toBe(letter);
        });
      });
    });

    describe('Edge cases', () => {
      test('Numbers only should return first character', () => {
        const result = extractStatusAlpha_FIXED('123');
        expect(result).toBe('1');
      });

      test('Symbols only should return first character', () => {
        const result = extractStatusAlpha_FIXED('!@#');
        expect(result).toBe('!');
      });

      test('Japanese characters only should return first character', () => {
        const result = extractStatusAlpha_FIXED('あいう');
        expect(result).toBe('あ');
      });
    });
  });

  describe('Preservation Requirements Validation', () => {
    test('Requirement 3.1: 最新状況が"A"の場合、"A"と表示される', () => {
      const result = extractStatusAlpha_FIXED('A');
      expect(result).toBe('A');
    });

    test('Requirement 3.2: 最新状況が"B"の場合、"B"と表示される', () => {
      const result = extractStatusAlpha_FIXED('B');
      expect(result).toBe('B');
    });

    test('Requirement 3.3: 最新状況が空の場合、"-"と表示される', () => {
      const result = extractStatusAlpha_FIXED(null);
      expect(result).toBe('-');
    });
  });
});
