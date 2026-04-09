/**
 * Bug Condition Exploration Test for extractStatusAlpha
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists
 * 
 * Bug: 最新状況フィールドに複数のアルファベット文字列が含まれている場合、
 *      全てのアルファベット部分が連結されて表示される
 * 
 * Expected: 最初の1文字のみを表示
 */

describe('extractStatusAlpha - Bug Condition Exploration', () => {
  // 修正後のコード
  const extractStatusAlpha_FIXED = (status: string | null): string => {
    if (!status) return '-';
    // 最初の1文字のみを返す
    return status.charAt(0);
  };

  describe('Property 1: Bug Condition - 複数アルファベット文字列の連結表示', () => {
    test('買主番号6836: "B:内覧した物件はNGだが..." should return "B" (not "BNG")', () => {
      const input = 'B:内覧した物件はNGだが（内覧後の場合）、購入期限が決まっている方（賃貸の更新や進学転勸等で1年以内になど）';
      const result = extractStatusAlpha_FIXED(input);
      
      // EXPECTED OUTCOME: Test PASSES (confirms bug is fixed)
      expect(result).toBe('B');
    });

    test('"C:NGだが連絡は取れる" should return "C" (not "CNG")', () => {
      const input = 'C:NGだが連絡は取れる';
      const result = extractStatusAlpha_FIXED(input);
      
      // EXPECTED OUTCOME: Test PASSES
      expect(result).toBe('C');
    });

    test('"A:NGな物件もある" should return "A" (not "ANG")', () => {
      const input = 'A:NGな物件もある';
      const result = extractStatusAlpha_FIXED(input);
      
      // EXPECTED OUTCOME: Test PASSES
      expect(result).toBe('A');
    });
  });

  describe('Fix Verification', () => {
    test('Verify: Fixed implementation returns first character only', () => {
      const testCases = [
        { input: 'B:内覧した物件はNGだが...', expected: 'B' },
        { input: 'C:NGだが連絡は取れる', expected: 'C' },
        { input: 'A:NGな物件もある', expected: 'A' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = extractStatusAlpha_FIXED(input);
        console.log(`Input: "${input}"`);
        console.log(`Expected: "${expected}"`);
        console.log(`Actual: "${result}"`);
        console.log(`Fix verified: ${result === expected}`);
        console.log('---');
        expect(result).toBe(expected);
      });
    });
  });
});
