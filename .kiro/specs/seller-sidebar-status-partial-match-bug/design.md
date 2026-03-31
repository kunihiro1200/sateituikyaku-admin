# 売主サイドバーステータス部分一致バグ修正 Design

## Overview

売主リストページのサイドバーステータス判定において、状況（当社）が「他決→追客」「専任→追客」などの売主が「当日TEL分」カテゴリに含まれないバグを修正します。

現在の実装では、`isTodayCallBase`関数が`targetStatuses`配列（`['追客中', '除外後追客中', '他決→追客']`）を使用して完全一致ベースの判定を行っていますが、これでは「専任→追客」などの新しいパターンに対応できません。

修正方針は、`status.includes('追客')`のように「追客」という文字列が含まれているかどうかで判定するように変更し、「追客不要」を含む場合は除外することで、より柔軟で保守性の高い実装にします。

## Glossary

- **Bug_Condition (C)**: 状況（当社）に「追客」が含まれるが、`targetStatuses`配列に定義されていないパターン（例: 「専任→追客」）
- **Property (P)**: 状況（当社）に「追客」が含まれる場合、「当日TEL分」の判定対象とすべき
- **Preservation**: 既存の「追客中」「除外後追客中」「他決→追客」の動作を維持し、「追客不要」を含む場合は除外する
- **isTodayCallBase**: `frontend/frontend/src/utils/sellerStatusFilters.ts`の関数で、当日TELの共通条件を判定する
- **targetStatuses**: 現在の実装で使用されている、追客対象ステータスの配列

## Bug Details

### Bug Condition

バグは、状況（当社）に「追客」という文字列が含まれているが、`targetStatuses`配列に定義されていないパターン（例: 「専任→追客」）の場合に発生します。`isTodayCallBase`関数は配列ベースの判定を行っているため、新しいパターンが追加されるたびに配列を更新する必要があり、保守性が低い状態です。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type Seller
  OUTPUT: boolean
  
  RETURN input.status CONTAINS '追客'
         AND input.status NOT IN ['追客中', '除外後追客中', '他決→追客']
         AND input.status NOT CONTAINS '追客不要'
         AND input.nextCallDate <= TODAY()
         AND NOT hasContactInfo(input)
         AND NOT hasVisitAssignee(input)
END FUNCTION
```

### Examples

- **AA13755**: 状況（当社）= 「他決→追客」、次電日 = 2026-03-31（今日）→ 現在は「当日TEL分」に含まれない（バグ）
- **仮想例**: 状況（当社）= 「専任→追客」、次電日 = 2026-03-31（今日）→ 現在は「当日TEL分」に含まれない（バグ）
- **正常例**: 状況（当社）= 「追客中」、次電日 = 2026-03-31（今日）→ 「当日TEL分」に含まれる（正常）
- **除外例**: 状況（当社）= 「追客不要」、次電日 = 2026-03-31（今日）→ 「当日TEL分」に含まれない（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 状況（当社）が「追客中」の売主は引き続き「当日TEL分」に含まれる
- 状況（当社）が「除外後追客中」の売主は引き続き「当日TEL分」に含まれる
- 状況（当社）に「追客不要」が含まれる売主は引き続き「当日TEL分」から除外される
- コミュニケーション情報のいずれかに値がある売主は「当日TEL（内容）」に分類される
- 営担に値がある売主は「当日TEL（担当）」に分類される

**Scope:**
状況（当社）に「追客」が含まれない売主（「他決」「専任」「除外」など）は、引き続き「当日TEL分」から除外されます。

## Hypothesized Root Cause

根本原因は以下の通りです：

1. **配列ベースの判定**: `targetStatuses`配列を使用した完全一致ベースの判定により、新しいパターン（「専任→追客」など）が追加されるたびに配列を更新する必要がある

2. **保守性の低さ**: 配列に定義されていないパターンは自動的に除外されるため、バグが発生しやすい

3. **部分一致の未使用**: `status.includes('追客')`のような部分一致判定を使用していないため、柔軟性が低い

## Correctness Properties

Property 1: Bug Condition - 追客パターンの柔軟な判定

_For any_ 売主データにおいて、状況（当社）に「追客」という文字列が含まれ（「追客不要」を除く）、次電日が今日以前、コミュニケーション情報が全て空、営担が空の場合、修正後の`isTodayCallBase`関数はtrueを返し、当該売主を「当日TEL分」カテゴリに含むべきである。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存パターンの動作維持

_For any_ 売主データにおいて、状況（当社）が「追客中」「除外後追客中」「他決→追客」のいずれかであり、次電日が今日以前、コミュニケーション情報が全て空、営担が空の場合、修正後の`isTodayCallBase`関数は引き続きtrueを返し、既存の動作を維持すべきである。

**Validates: Requirements 3.1, 3.2**

Property 3: Preservation - 追客不要の除外

_For any_ 売主データにおいて、状況（当社）に「追客不要」が含まれる場合、修正後の`isTodayCallBase`関数はfalseを返し、当該売主を「当日TEL分」カテゴリから除外すべきである。

**Validates: Requirements 3.6**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `isTodayCallBase`

**Specific Changes**:
1. **配列ベースの判定を削除**: `targetStatuses`配列と`targetStatuses.some(s => status.includes(s))`を削除

2. **部分一致判定に変更**: `status.includes('追客')`で「追客」が含まれるかどうかを判定

3. **追客不要の除外**: `status.includes('追客不要')`で「追客不要」を含む場合は除外

4. **コメントの更新**: 新しいロジックを説明するコメントを追加

**修正前のコード**:
```typescript
const isTodayCallBase = (seller: Seller | any): boolean => {
  // 状況（当社）が対象ステータスかチェック
  const status = seller.status || seller.situation_company || '';
  const targetStatuses = ['追客中', '除外後追客中', '他決→追客'];
  const isTargetStatus = typeof status === 'string' && targetStatuses.some(s => status.includes(s));
  
  if (!isTargetStatus) {
    return false;
  }
  
  // 次電日が空でないかつ今日以前かチェック
  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  if (!nextCallDate) return false;
  
  return isTodayOrBefore(nextCallDate);
};
```

**修正後のコード**:
```typescript
const isTodayCallBase = (seller: Seller | any): boolean => {
  // 状況（当社）に「追客」が含まれるかチェック（「追客不要」を除く）
  const status = seller.status || seller.situation_company || '';
  
  // 「追客」が含まれない場合は対象外
  if (typeof status !== 'string' || !status.includes('追客')) {
    return false;
  }
  
  // 「追客不要」が含まれる場合は対象外
  if (status.includes('追客不要')) {
    return false;
  }
  
  // 次電日が空でないかつ今日以前かチェック
  const nextCallDate = seller.nextCallDate || seller.next_call_date;
  if (!nextCallDate) return false;
  
  return isTodayOrBefore(nextCallDate);
};
```

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチを採用します：まず、修正前のコードで反例を収集し、バグを確認します。次に、修正後のコードで全てのパターンが正しく動作することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードで反例を収集し、バグの存在を確認する。

**Test Plan**: 様々な状況（当社）パターンの売主データを作成し、`isTodayCallBase`関数を実行して、期待される結果と実際の結果を比較します。修正前のコードでは、「他決→追客」「専任→追客」などのパターンが正しく判定されないことを確認します。

**Test Cases**:
1. **他決→追客パターン**: 状況（当社）= 「他決→追客」、次電日 = 今日 → 修正前はfalse（バグ）、修正後はtrue
2. **専任→追客パターン**: 状況（当社）= 「専任→追客」、次電日 = 今日 → 修正前はfalse（バグ）、修正後はtrue
3. **追客中パターン**: 状況（当社）= 「追客中」、次電日 = 今日 → 修正前後ともにtrue（正常）
4. **追客不要パターン**: 状況（当社）= 「追客不要」、次電日 = 今日 → 修正前後ともにfalse（正常）

**Expected Counterexamples**:
- 「他決→追客」「専任→追客」などのパターンが`targetStatuses`配列に含まれていないため、`isTodayCallBase`がfalseを返す
- 原因: 配列ベースの判定により、新しいパターンが自動的に除外される

### Fix Checking

**Goal**: 修正後のコードで、状況（当社）に「追客」が含まれる全てのパターンが正しく判定されることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := isTodayCallBase_fixed(seller)
  ASSERT result = true
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、既存の動作が維持されることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT isTodayCallBase_original(seller) = isTodayCallBase_fixed(seller)
END FOR
```

**Testing Approach**: Property-based testingを使用して、様々な状況（当社）パターンで既存の動作が維持されることを検証します。

**Test Plan**: 修正前のコードで正しく動作していたパターン（「追客中」「除外後追客中」「追客不要」など）を観察し、修正後も同じ結果を返すことを確認します。

**Test Cases**:
1. **追客中の保持**: 状況（当社）= 「追客中」、次電日 = 今日 → 修正前後ともにtrue
2. **除外後追客中の保持**: 状況（当社）= 「除外後追客中」、次電日 = 今日 → 修正前後ともにtrue
3. **追客不要の除外**: 状況（当社）= 「追客不要」、次電日 = 今日 → 修正前後ともにfalse
4. **追客なしの除外**: 状況（当社）= 「他決」、次電日 = 今日 → 修正前後ともにfalse

### Unit Tests

- 様々な状況（当社）パターンで`isTodayCallBase`関数をテスト
- 「追客」が含まれるパターン（「追客中」「他決→追客」「専任→追客」など）がtrueを返すことを確認
- 「追客不要」が含まれるパターンがfalseを返すことを確認
- 「追客」が含まれないパターン（「他決」「専任」など）がfalseを返すことを確認

### Property-Based Tests

- ランダムな状況（当社）文字列を生成し、「追客」が含まれる場合はtrueを返すことを検証
- 「追客不要」が含まれる場合はfalseを返すことを検証
- 既存のパターン（「追客中」「除外後追客中」）の動作が維持されることを検証

### Integration Tests

- 売主リストページで様々な状況（当社）パターンの売主を表示
- サイドバーの「当日TEL分」カテゴリに正しく分類されることを確認
- 「追客不要」を含む売主が除外されることを確認
