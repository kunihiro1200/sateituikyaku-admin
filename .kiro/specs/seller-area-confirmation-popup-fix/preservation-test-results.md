# Preservation Property Test Results

## Test Execution Date
2026年4月3日

## Test Status
✅ **All tests PASSED on UNFIXED code**

## Expected Outcome
**EXPECTED**: Tests PASS on unfixed code (this confirms baseline behavior to preserve)

## Actual Outcome
✅ **All 12 tests PASSED as expected** - Baseline behavior confirmed

## Test Summary

### Property 2.1: 土地面積が100㎡以上かつ建物面積以上の場合は警告を表示しない

**Status**: ✅ PASSED (4/4 tests)

**Tests**:
1. ✅ Property-based test (100 runs) - 警告が表示されないことを確認
2. ✅ Concrete case: 土地面積100㎡、建物面積80㎡
3. ✅ Concrete case: 土地面積150㎡、建物面積150㎡（同じ面積）
4. ✅ Concrete case: 土地面積200㎡、建物面積0㎡（建物なし）

**Validation**: 
- 土地面積が100㎡以上かつ建物面積以上の場合、警告ポップアップは表示されない
- この動作は修正前のコードで正しく動作している

---

### Property 2.2: 固定資産税路線価フィールドへの入力時、自動計算機能は引き続き実行される

**Status**: ✅ PASSED (3/3 tests)

**Tests**:
1. ✅ Property-based test (100 runs) - 自動計算が実行されることを確認
2. ✅ Concrete case: 固定資産税路線価100,000円/㎡、土地面積30㎡ → 土地評価額3,000,000円
3. ✅ Concrete case: 警告が表示される場合でも自動計算が実行される

**Validation**:
- 固定資産税路線価フィールドに入力した際、自動計算機能が正しく実行される
- 警告ポップアップが表示される場合でも、自動計算は実行される
- この動作は修正前のコードで正しく動作している

---

### Property 2.3: ページをリロードした場合、警告確認状態はリセットされる

**Status**: ✅ PASSED (2/2 tests)

**Tests**:
1. ✅ Property-based test (100 runs) - ページリロード後、確認状態がリセットされることを確認
2. ✅ Concrete case: 土地面積30㎡、ページリロード後も警告が表示される

**Validation**:
- ページをリロードした場合、警告確認状態がリセットされる
- sessionStorageはページリロード時に自動的にクリアされる
- この動作は修正前のコードでも修正後のコードでも同じ

**Note**: 
- sessionStorageの仕様により、ページリロード時に自動的にクリアされる
- 修正前のコードでは確認状態が保存されていないため、この動作は自然に保持される

---

### Property 2.4: 別の売主の通話モードページを開いた場合、警告確認状態はリセットされる

**Status**: ✅ PASSED (2/2 tests)

**Tests**:
1. ✅ Property-based test (100 runs) - 別の売主ページを開いた際、確認状態がリセットされることを確認
2. ✅ Concrete case: 売主1で確認済み → 売主2のページでも警告が表示される

**Validation**:
- 別の売主の通話モードページを開いた場合、警告確認状態がリセットされる
- sessionStorageのキーに売主IDが含まれるため、別の売主では新しいキーになる
- この動作は修正前のコードでも修正後のコードでも同じ

**Note**:
- sessionStorageのキーに売主IDが含まれる設計により、この動作は自然に保持される
- 修正実装時は、`landAreaWarningConfirmed_${sellerId}`のようなキー形式を使用する

---

### Formal Specification Test

**Status**: ✅ PASSED

**Tests**:
1. ✅ Requirement 3.1: 土地面積が100㎡以上かつ建物面積以上の場合は警告を表示しない
2. ✅ Requirement 3.2: 自動計算機能は引き続き実行される
3. ✅ Requirement 3.3: ページをリロードした場合、警告確認状態はリセットされる
4. ✅ Requirement 3.4: 別の売主の通話モードページを開いた場合、警告確認状態はリセットされる

---

## Test Execution Details

### Test Framework
- **Framework**: Jest + fast-check
- **Property-based tests**: 100 runs per property
- **Total tests**: 12 tests
- **Total property-based runs**: 400 runs (4 properties × 100 runs)

### Test Results
```
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
Time:        2.808 s
```

### Property-Based Test Coverage

**Property 2.1** (100 runs):
- Land area range: 100㎡～500㎡
- Building area range: 0㎡～500㎡
- Condition: landArea >= buildingArea
- Result: All 100 runs passed

**Property 2.2** (100 runs):
- Fixed asset tax road price range: 10,000円/㎡～500,000円/㎡
- Land area range: 1㎡～500㎡
- Result: All 100 runs passed

**Property 2.3** (100 runs):
- Land area range: 1㎡～99㎡
- Building area range: 0㎡～200㎡
- Condition: Warning condition met
- Result: All 100 runs passed

**Property 2.4** (100 runs):
- Land area range: 1㎡～99㎡
- Building area range: 0㎡～200㎡
- Condition: Warning condition met
- Result: All 100 runs passed

---

## Baseline Behavior Confirmation

### ✅ Confirmed Behaviors

1. **警告非表示条件**: 土地面積が100㎡以上かつ建物面積以上の場合、警告は表示されない
2. **自動計算機能**: 固定資産税路線価フィールドへの入力時、自動計算機能は正しく実行される
3. **ページリロード時のリセット**: ページをリロードした場合、警告確認状態はリセットされる
4. **売主変更時のリセット**: 別の売主の通話モードページを開いた場合、警告確認状態はリセットされる

### 📝 Implementation Notes

**修正実装時の注意点**:

1. **sessionStorageのキー形式**:
   - `landAreaWarningConfirmed_${sellerId}`のような形式を使用する
   - 売主IDを含めることで、売主ごとに独立した確認状態を管理できる

2. **ページリロード時の動作**:
   - sessionStorageはページリロード時に自動的にクリアされる
   - 追加の実装は不要

3. **売主変更時の動作**:
   - `useEffect`で`sellerId`の変化を監視する
   - 売主が変更された場合、`setLandAreaWarningConfirmed(false)`を実行する
   - 新しい売主の確認状態を`sessionStorage`から読み込む

4. **自動計算機能の保持**:
   - 警告ポップアップの表示/非表示に関係なく、自動計算機能は実行される
   - `debouncedAutoCalculate(value)`の呼び出しを維持する

---

## Conclusion

✅ **All preservation tests PASSED on unfixed code**

**Baseline behavior confirmed**:
- 既存の正常動作が正しく動作していることを確認
- 修正実装時は、これらの動作を保持する必要がある

**Next Steps**:
1. Implement the fix (Task 3.1)
2. Re-run bug condition exploration test to verify the fix (Task 3.2)
3. Re-run these preservation tests to ensure no regressions (Task 3.3)

---

**Test File**: `frontend/frontend/src/tests/seller-area-confirmation-popup-preservation.test.ts`

**Requirements Validated**: 3.1, 3.2, 3.3, 3.4

