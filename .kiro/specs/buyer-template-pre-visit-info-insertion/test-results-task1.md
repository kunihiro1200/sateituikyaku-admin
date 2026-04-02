# Task 1: Bug Condition Exploration Test Results

## Test Execution Date
2025-01-XX (実行日時を記録)

## Test File
`frontend/frontend/src/__tests__/buyer-template-pre-visit-info-insertion-bug-exploration.test.tsx`

## Test Results (Unfixed Code)

### Summary
- **Total Tests**: 6
- **Failed**: 4 (Expected - proves bug exists)
- **Passed**: 2 (Expected - non-buggy cases)

### Detailed Results

#### ✗ Test 1: バグ条件: 物件リストテーブルの「内覧前伝達事項」が取得されない
**Status**: FAILED (Expected)
**Validates**: Requirements 1.1, 1.3

**Counterexample Found**:
```
Expected: "駐車場は敷地内に2台分あります"
Received: ""
```

**Analysis**:
- Current implementation uses `buyer.pre_viewing_notes` (empty)
- Expected implementation should use `linkedProperties[0]?.pre_viewing_notes` (contains data)
- This confirms the root cause: wrong data source is being referenced

---

#### ✗ Test 2: バグ条件: Gmail送信時に「内覧前伝達事項」が取得されない（戸建て・マンション）
**Status**: FAILED (Expected)
**Validates**: Requirements 1.2

**Counterexample Found**:
```
Expected: "鍵は管理会社に預けています"
Received: ""
```

**Analysis**:
- Same issue as Test 1
- Affects Gmail sending with "資料請求メール（戸、マ）" template

---

#### ✗ Test 3: バグ条件: SMS送信時に「内覧前伝達事項」が取得されない（土地・売主要許可）
**Status**: FAILED (Expected)
**Validates**: Requirements 1.1

**Counterexample Found**:
```
Expected: "現地は私道を通ります"
Received: ""
```

**Analysis**:
- Same issue as Test 1
- Affects SMS sending with "land_need_permission" template

---

#### ✗ Test 4: エッジケース: 複数物件が紐づいている場合、最初の物件の「内覧前伝達事項」が使用される
**Status**: FAILED (Expected)
**Validates**: Requirements 3.5

**Counterexample Found**:
```
Expected: "最初の物件の内覧前伝達事項"
Received: ""
```

**Analysis**:
- Same issue as Test 1
- Confirms that even with multiple properties, the first property's data should be used

---

#### ✓ Test 5: バグ条件を満たさない: 「内覧前伝達事項」が空の場合
**Status**: PASSED (Expected)
**Validates**: Requirements 2.4

**Analysis**:
- When `pre_viewing_notes` is empty, both implementations return empty string
- No regression in this case

---

#### ✓ Test 6: バグ条件を満たさない: 物件が紐づいていない場合
**Status**: PASSED (Expected)

**Analysis**:
- When no properties are linked, both implementations return empty string
- No regression in this case

---

## Root Cause Confirmation

The test results confirm the hypothesized root cause:

**Current Implementation (Incorrect)**:
```typescript
// BuyerDetailPage.tsx (lines 1069, 1117)
preViewingNotes={buyer.pre_viewing_notes || ''}
```

**Expected Implementation (Correct)**:
```typescript
// BuyerDetailPage.tsx (should be)
preViewingNotes={linkedProperties[0]?.pre_viewing_notes || ''}
```

## Counterexamples Summary

All failing tests show the same pattern:
- **Current Result**: Empty string (from `buyer.pre_viewing_notes`)
- **Expected Result**: Non-empty string (from `linkedProperties[0]?.pre_viewing_notes`)

This proves that:
1. The bug exists in the current code
2. The root cause is using the wrong data source
3. The fix should change `buyer.pre_viewing_notes` to `linkedProperties[0]?.pre_viewing_notes`

## Next Steps

1. ✅ Task 1 Complete: Bug condition exploration test written and run
2. ⏭️ Task 2: Write preservation property tests (BEFORE implementing fix)
3. ⏭️ Task 3: Implement the fix
4. ⏭️ Task 4: Verify all tests pass after fix

## Notes

- The test is designed to FAIL on unfixed code (current state)
- After implementing the fix in Task 3, this same test should PASS
- No new test should be written in Task 3.2 - we will re-run this same test
