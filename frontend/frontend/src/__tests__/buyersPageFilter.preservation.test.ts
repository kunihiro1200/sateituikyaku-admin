/**
 * Task 2: Preservation Property Test (run BEFORE fix)
 *
 * Feature: buyer-sidebar-today-call-filter-bug, Property 2: Preservation
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5
 *
 * IMPORTANT: This test is expected to PASS on unfixed code
 * GOAL: Confirm baseline behavior that must be preserved after the fix
 *
 * These tests cover non-bug-condition inputs (isBugCondition returns false):
 *   - selectedCalculatedStatus = null (show all)
 *   - selectedCalculatedStatus = '担当(Y)' (no startsWith match exists)
 *   - selectedCalculatedStatus = '当日TEL(Y)' (exact match, same before/after fix)
 */

// ============================================================
// Reproduce the BUGGY filtering logic from BuyersPage.tsx
// (same logic used for preservation - these cases are unaffected by the bug)
// ============================================================

type BuyerWithStatus = {
  calculated_status: string | null;
  [key: string]: any;
};

function applyFilter_BUGGY(
  buyers: BuyerWithStatus[],
  selectedCalculatedStatus: string | null
): BuyerWithStatus[] {
  if (selectedCalculatedStatus === null) {
    return [...buyers];
  }
  return buyers.filter(
    (b) =>
      b.calculated_status === selectedCalculatedStatus ||
      (b.calculated_status || "").startsWith(selectedCalculatedStatus + "(")
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

const ALL_BUYERS: BuyerWithStatus[] = [
  createBuyer("当日TEL", "1"),
  createBuyer("当日TEL(Y)", "2"),
  createBuyer("当日TEL(I)", "3"),
  createBuyer("担当(Y)", "4"),
  createBuyer("担当(I)", "5"),
  createBuyer(null, "6"),
];

// ============================================================
// Preservation Property Tests
// ============================================================

describe("Property 2: Preservation - non-bug-condition behavior (PASS on unfixed code)", () => {
  /**
   * Test 1: selectedCalculatedStatus = null -> all buyers returned
   *
   * This is unaffected by the bug (null path returns all buyers).
   * Must continue to work after the fix.
   *
   * Validates: Requirements 3.2
   */
  it("null selectedCalculatedStatus returns all buyers", () => {
    const result = applyFilter_BUGGY(ALL_BUYERS, null);

    expect(result.length).toBe(ALL_BUYERS.length);
    expect(result).toEqual(ALL_BUYERS);
  });

  /**
   * Test 2: selectedCalculatedStatus = '担当(Y)' -> only '担当(Y)' buyers returned
   *
   * '担当(Y)' has no startsWith-matching buyers in the list,
   * so the buggy and fixed logic produce the same result.
   *
   * Validates: Requirements 3.1
   */
  it("担当(Y) filter returns only buyers with calculated_status === 担当(Y)", () => {
    const result = applyFilter_BUGGY(ALL_BUYERS, "担当(Y)");

    expect(result.length).toBe(1);
    expect(result[0].calculated_status).toBe("担当(Y)");
    expect(result.every((b) => b.calculated_status === "担当(Y)")).toBe(true);
  });

  /**
   * Test 3: selectedCalculatedStatus = '当日TEL(Y)' -> only '当日TEL(Y)' buyers returned
   *
   * '当日TEL(Y)' itself does not have startsWith-matching buyers
   * (no buyer has calculated_status starting with '当日TEL(Y)(').
   * So buggy and fixed logic produce the same result.
   *
   * Validates: Requirements 2.2
   */
  it("当日TEL(Y) filter returns only buyers with calculated_status === 当日TEL(Y)", () => {
    const result = applyFilter_BUGGY(ALL_BUYERS, "当日TEL(Y)");

    expect(result.length).toBe(1);
    expect(result[0].calculated_status).toBe("当日TEL(Y)");
    expect(result.every((b) => b.calculated_status === "当日TEL(Y)")).toBe(true);
  });
});
