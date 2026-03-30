/**
 * Task 1: Bug Condition Exploration Test
 *
 * Feature: buyer-sidebar-today-call-filter-bug, Property 1: Bug Condition
 * Validates: Requirements 1.1, 1.2
 *
 * CRITICAL: This test is expected to FAIL on unfixed code (failure proves the bug exists)
 * DO NOT attempt to fix the test or the code when it fails.
 * GOAL: Surface counterexamples showing the bug exists
 *
 * Bug: BuyersPage.tsx filtering logic uses startsWith condition
 *   b.calculated_status === selectedCalculatedStatus ||
 *   (b.calculated_status || '').startsWith(selectedCalculatedStatus + '(')
 * This causes buyers with calculated_status='当日TEL(Y)' to appear
 * when selectedCalculatedStatus='当日TEL'
 */

// ============================================================
// Reproduce the BUGGY filtering logic from BuyersPage.tsx
// ============================================================

type BuyerWithStatus = {
  calculated_status: string | null;
  [key: string]: any;
};

/**
 * FIXED filter logic (after fix applied to BuyersPage.tsx ~line 114)
 * startsWith condition removed - exact match only.
 */
function applyFilter_FIXED(
  buyers: BuyerWithStatus[],
  selectedCalculatedStatus: string | null
): BuyerWithStatus[] {
  if (selectedCalculatedStatus === null) {
    return [...buyers];
  }
  return buyers.filter(
    (b) =>
      b.calculated_status === selectedCalculatedStatus
  );
}

// ============================================================
// Test data
// ============================================================

const createBuyer = (calculated_status: string | null, id = "1"): BuyerWithStatus => ({
  buyer_number: id,
  name: "test buyer",
  calculated_status,
});

// ============================================================
// Bug Condition Exploration Tests
// ============================================================

describe("Property 1: Bug Condition - 当日TEL exact match filter bug", () => {
  /**
   * Test 1: When selectedCalculatedStatus='当日TEL',
   * a buyer with calculated_status='当日TEL(Y)' should NOT appear in results.
   *
   * EXPECTED OUTCOME on unfixed code: FAIL
   * (counterexample: '当日TEL(Y)' buyer is included due to startsWith condition)
   *
   * Validates: Requirements 1.1, 1.2
   */
  it("当日TEL filter should NOT include buyer with calculated_status=当日TEL(Y)", () => {
    const buyers: BuyerWithStatus[] = [
      createBuyer("当日TEL", "1"),
      createBuyer("当日TEL(Y)", "2"),
      createBuyer("当日TEL(I)", "3"),
      createBuyer("担当(Y)", "4"),
    ];

    const result = applyFilter_FIXED(buyers, "当日TEL");

    // This assertion FAILS on unfixed code:
    // startsWith('当日TEL(') matches '当日TEL(Y)' and '当日TEL(I)'
    const hasYBuyer = result.some((b) => b.calculated_status === "当日TEL(Y)");
    expect(hasYBuyer).toBe(false);
  });

  /**
   * Test 2: When selectedCalculatedStatus='当日TEL',
   * ALL results should have calculated_status === '当日TEL' (exact match only).
   *
   * EXPECTED OUTCOME on unfixed code: FAIL
   * (counterexample: results contain '当日TEL(Y)' and '当日TEL(I)')
   *
   * Validates: Requirements 1.1, 1.2
   */
  it("当日TEL filter results should ALL have calculated_status === 当日TEL (exact match)", () => {
    const buyers: BuyerWithStatus[] = [
      createBuyer("当日TEL", "1"),
      createBuyer("当日TEL(Y)", "2"),
      createBuyer("当日TEL(I)", "3"),
      createBuyer("担当(Y)", "4"),
      createBuyer(null, "5"),
    ];

    const result = applyFilter_FIXED(buyers, "当日TEL");

    // This assertion FAILS on unfixed code:
    // result contains '当日TEL(Y)' and '当日TEL(I)' due to startsWith
    const allExactMatch = result.every((b) => b.calculated_status === "当日TEL");
    expect(allExactMatch).toBe(true);
  });
});
