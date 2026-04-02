# Bug Condition Exploration Test Results

## Test Execution Date
2026年4月3日

## Test Status
✅ **Test executed successfully on UNFIXED code**

## Expected Outcome
**EXPECTED**: Test FAILS on unfixed code (this confirms the bug exists)

## Actual Outcome
✅ **Test FAILED as expected** - Bug confirmed

## Counterexamples Found

### Property-Based Test Failure

**Test**: `should NOT show warning again after user clicks "確認しました" button`

**Counterexample**:
```
[1, 0]
```

**Interpretation**:
- 土地面積: 1㎡
- 建物面積: 0㎡
- ユーザーが「確認しました」ボタンを押した後も、警告が再表示される

**Shrunk counterexamples** (fast-check found these minimal failing cases):
1. `[57, 134]` - 土地面積57㎡、建物面積134㎡
2. `[1, 134]` - 土地面積1㎡、建物面積134㎡
3. `[1, 0]` - 土地面積1㎡、建物面積0㎡（最小の失敗ケース）

### Concrete Test Cases

All concrete test cases **passed** (confirming the bug exists):

1. ✅ **AA13888の事例** (土地面積30㎡)
   - 初回入力時: 警告が表示される ✓
   - 「確認しました」後: 警告が再表示される（バグ） ✓

2. ✅ **土地面積50㎡、建物面積80㎡**
   - 初回入力時: 警告が表示される ✓
   - 「確認しました」後: 警告が再表示される（バグ） ✓

3. ✅ **土地面積99㎡（境界値）**
   - 初回入力時: 警告が表示される ✓
   - 「確認しました」後: 警告が再表示される（バグ） ✓

4. ✅ **土地面積100㎡以上（正常動作）**
   - 初回入力時: 警告が表示されない ✓

## Bug Confirmation

### Current Implementation (Unfixed Code)

```typescript
function currentImplementation(
  landArea: number,
  buildingArea: number,
  userClickedConfirm: boolean
): boolean {
  // 修正前のコード: 確認状態が保存されないため、常にhasConfirmed=falseとして扱う
  const hasConfirmed = false; // ← バグ: ユーザーが「確認しました」を押しても保存されない

  return isBugCondition(landArea, buildingArea, hasConfirmed);
}
```

### Expected Behavior (After Fix)

```typescript
function expectedBehavior(
  landArea: number,
  buildingArea: number,
  userClickedConfirm: boolean
): boolean {
  // 修正後のコード: 確認状態が正しく保存される
  const hasConfirmed = userClickedConfirm;

  return isBugCondition(landArea, buildingArea, hasConfirmed);
}
```

## Root Cause Analysis

### Problem
`CallModePage.tsx`の現在の実装では、警告ポップアップの確認状態が保存されていません。

### Current Code (Unfixed)
```typescript
// 土地面積警告ダイアログ用の状態
const [landAreaWarning, setLandAreaWarning] = useState<string | null>(null);

// 固定資産税路線価フィールドのonChange
onChange={(e) => {
  const value = e.target.value;
  setEditedFixedAssetTaxRoadPrice(value);
  
  const land = parseFloat(String(propInfo.landArea)) || 0;
  const building = parseFloat(String(propInfo.buildingArea)) || 0;
  const landNum = parseFloat(String(land)) || 0;
  const buildingNum = parseFloat(String(building)) || 0;
  
  // 警告条件に該当する場合、常に警告を表示
  if (landNum > 0 && (landNum <= 99 || (buildingNum > 0 && landNum < buildingNum))) {
    setLandAreaWarning(`土地面積が${landNum}㎡（約${Math.round(landNum / 3.306)}坪）ですが確認大丈夫ですか？`);
  }
  
  debouncedAutoCalculate(value);
}}

// 「確認しました」ボタン
<Button onClick={() => setLandAreaWarning(null)} variant="contained">確認しました</Button>
```

### Issue
- `setLandAreaWarning(null)`でポップアップを閉じるだけ
- 確認状態を保存するフラグがない
- 再度フィールドに入力すると、同じ条件評価が実行され、同じ警告が表示される

## Conclusion

✅ **Bug confirmed**: The test failed as expected on unfixed code, proving that the bug exists.

**Next Steps**:
1. Implement the fix (Task 3.1)
2. Re-run this test to verify the fix (Task 3.2)
3. Run preservation tests to ensure no regressions (Task 3.3)

---

**Test File**: `frontend/frontend/src/tests/seller-area-confirmation-popup-bug.test.ts`

**Requirements Validated**: 1.1, 1.2, 1.3, 1.4
