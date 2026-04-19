# Y/N選択フィールド トグル解除バグ 設計ドキュメント

## Overview

業務依頼画面（`WorkTaskDetailModal`）の `EditableYesNo` コンポーネントにおいて、選択済みのボタン（YまたはN）を再度クリックしても未選択状態に戻らないバグを修正する。

修正方針は最小限の変更に留める。`EditableYesNo` コンポーネントの `onClick` ハンドラーで、クリックされた値が現在の値と同じ場合は `null` を設定するトグルロジックを追加する。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — Y/N選択フィールドで既に選択済みの値と同じボタンをクリックした場合
- **Property (P)**: 期待される正しい動作 — 同じ値の再クリック時にフィールドが `null`（未選択）に戻ること
- **Preservation**: 修正によって変更してはならない既存の動作 — 未選択状態からの選択、異なる値への切り替え、保存処理
- **EditableYesNo**: `frontend/frontend/src/components/WorkTaskDetailModal.tsx` 内で定義されたY/N選択UIコンポーネント
- **handleFieldChange**: フィールド値の変更を `editedData` ステートに反映する関数
- **getValue**: `editedData` または元データ `data` からフィールドの現在値を取得する関数

## Bug Details

### Bug Condition

バグは、ユーザーがY/N選択フィールドで既に選択済みのボタンを再度クリックした際に発生する。`EditableYesNo` コンポーネントの `onClick` ハンドラーが常に固定値（`'Y'` または `'N'`）を `handleFieldChange` に渡すだけで、現在値との比較によるトグル処理が存在しない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { field: string, clickedValue: 'Y' | 'N' }
  OUTPUT: boolean

  currentValue := getValue(input.field)

  RETURN currentValue === input.clickedValue
         AND currentValue IS NOT NULL
END FUNCTION
```

### Examples

- **例1（バグあり）**: `cw_request_email_site` が `'Y'` の状態で「Y」ボタンをクリック → 値は `'Y'` のまま変わらない（期待: `null` に戻る）
- **例2（バグあり）**: `on_hold` が `'N'` の状態で「N」ボタンをクリック → 値は `'N'` のまま変わらない（期待: `null` に戻る）
- **例3（正常）**: 未選択状態で「Y」ボタンをクリック → 値が `'Y'` になる（変更なし）
- **例4（正常）**: `'Y'` 選択済みの状態で「N」ボタンをクリック → 値が `'N'` に切り替わる（変更なし）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 未選択状態から「Y」または「N」をクリックした場合、その値が設定されること
- 「Y」選択済みの状態から「N」をクリックした場合、値が「N」に切り替わること
- 「N」選択済みの状態から「Y」をクリックした場合、値が「Y」に切り替わること
- 保存ボタンクリック時に変更後の値（`'Y'`、`'N'`、または `null`）がAPIに送信されること
- ボタンの表示スタイル（`contained` / `outlined`）が現在値に応じて正しく切り替わること

**スコープ:**
Y/Nボタンのクリック以外の操作（テキストフィールド入力、日付選択、ボタングループ選択、保存・キャンセル処理）は本修正の影響を受けない。

## Hypothesized Root Cause

バグの根本原因は以下の通り：

1. **トグルロジックの欠如**: `EditableYesNo` コンポーネントの `onClick` が `() => handleFieldChange(field, 'Y')` のように常に固定値を渡しており、現在値との比較処理が存在しない

2. **handleFieldChange の設計**: `handleFieldChange` は渡された値をそのまま `editedData` に設定するだけで、同値チェックを行わない（これ自体は正しい設計だが、呼び出し側でトグル判定が必要）

3. **EditableButtonSelect との非対称性**: 同じファイル内の `EditableButtonSelect` コンポーネントも同様のパターンで実装されており、トグル解除は想定されていない設計になっている

## Correctness Properties

Property 1: Bug Condition - 同値再クリックによるトグル解除

_For any_ Y/N選択フィールドにおいて、現在の値と同じボタンをクリックした場合（isBugCondition が true を返す場合）、修正後の `EditableYesNo` コンポーネントは SHALL フィールドの値を `null` に設定し、ボタンが未選択状態（outlined スタイル）で表示される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 異なる値クリック・未選択からの選択の動作保持

_For any_ Y/N選択フィールドにおいて、現在の値と異なるボタンをクリックした場合、または未選択状態からボタンをクリックした場合（isBugCondition が false を返す場合）、修正後のコンポーネントは SHALL 修正前と同じ動作（クリックした値を設定）を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

**Component**: `EditableYesNo`（行487付近）

**Specific Changes**:

1. **トグルロジックの追加**: 各ボタンの `onClick` ハンドラーで、クリックされた値が現在値と同じ場合は `null` を、異なる場合はその値を渡すように変更する

**変更前:**
```tsx
onClick={() => handleFieldChange(field, 'Y')}
// ...
onClick={() => handleFieldChange(field, 'N')}
```

**変更後:**
```tsx
onClick={() => handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y')}
// ...
onClick={() => handleFieldChange(field, getValue(field) === 'N' ? null : 'N')}
```

変更箇所は2行のみで、他のロジックへの影響はない。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず未修正コードでバグを再現するテストを実行し、根本原因を確認する。次に修正後のコードでバグが解消され、既存動作が保持されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `EditableYesNo` コンポーネントをレンダリングし、選択済み状態から同じボタンをクリックした際に値が変わらないことを確認する。

**Test Cases**:
1. **Y選択済みからYクリック**: `getValue` が `'Y'` を返す状態で「Y」ボタンをクリック → 値が `'Y'` のまま（未修正コードでは `null` にならない）
2. **N選択済みからNクリック**: `getValue` が `'N'` を返す状態で「N」ボタンをクリック → 値が `'N'` のまま（未修正コードでは `null` にならない）

**Expected Counterexamples**:
- `handleFieldChange` が `null` ではなく `'Y'` または `'N'` で呼ばれる
- 原因: `onClick` ハンドラーに現在値との比較ロジックがない

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後のコンポーネントが期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := EditableYesNo_fixed.onClick(input.clickedValue)
  ASSERT handleFieldChange was called with (input.field, null)
  ASSERT getValue(input.field) === null
  ASSERT button displays as 'outlined' (unselected)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正前後で動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT EditableYesNo_original.onClick(input) = EditableYesNo_fixed.onClick(input)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される。理由：
- 多様な初期値（`null`、`'Y'`、`'N'`）とクリック値の組み合わせを自動生成できる
- 手動テストでは見落としがちなエッジケースを網羅できる
- 修正が既存動作を壊していないことを強く保証できる

**Test Cases**:
1. **未選択からYクリック保持**: `null` 状態で「Y」クリック → `'Y'` が設定される（修正前後で同じ）
2. **未選択からNクリック保持**: `null` 状態で「N」クリック → `'N'` が設定される（修正前後で同じ）
3. **Y選択済みからNクリック保持**: `'Y'` 状態で「N」クリック → `'N'` に切り替わる（修正前後で同じ）
4. **N選択済みからYクリック保持**: `'N'` 状態で「Y」クリック → `'Y'` に切り替わる（修正前後で同じ）

### Unit Tests

- `EditableYesNo` コンポーネントの各クリックパターン（6通り: 初期値3 × クリック値2）をテスト
- `handleFieldChange` が正しい引数で呼ばれることを `jest.fn()` でアサート
- ボタンの `variant` が現在値に応じて正しく切り替わることをテスト

### Property-Based Tests

- ランダムな初期値（`null`、`'Y'`、`'N'`）を生成し、同値クリック時は常に `null` が設定されることを検証（Property 1）
- ランダムな初期値と異なるクリック値の組み合わせを生成し、クリックした値がそのまま設定されることを検証（Property 2）

### Integration Tests

- `WorkTaskDetailModal` を実際にレンダリングし、Y/Nフィールドのトグル操作後に保存ボタンをクリックして `null` がAPIに送信されることを確認
- 複数のY/Nフィールドを操作した後の保存処理が正常に動作することを確認
