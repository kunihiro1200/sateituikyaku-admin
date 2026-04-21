# 業務リスト サイト登録確認トグルクリア バグ修正デザイン

## Overview

`WorkTaskDetailModal.tsx` の `EditableButtonSelect` コンポーネントは、現在選択中のオプションを再クリックしても値がクリアされない。`EditableYesNo` コンポーネントには同様のトグル処理（同じ値を再クリックで `null` にする）が既に実装されているが、`EditableButtonSelect` には実装されていない。

修正方針：`EditableButtonSelect` の `onClick` ハンドラに、現在値と同じオプションをクリックした場合に `null` を渡すトグルロジックを追加する。また、`null` 値がスプレッドシートに即時同期されるよう、既存の `writeBackToSpreadsheet` の `null` → 空文字変換動作を確認・活用する。

## Glossary

- **Bug_Condition (C)**: `EditableButtonSelect` で現在選択中のオプションを再クリックした場合 — `currentValue === clickedOption`
- **Property (P)**: バグ条件が成立した場合、フィールド値が `null`（空欄）になること
- **Preservation**: 異なるオプションへの切り替え・未選択状態からの選択・`EditableYesNo` の動作が変わらないこと
- **EditableButtonSelect**: `WorkTaskDetailModal.tsx` 内のボタン選択コンポーネント。`options` 配列のボタンを表示し、クリックで `handleFieldChange` を呼び出す
- **EditableYesNo**: 同ファイル内の Y/N 選択コンポーネント。既にトグル処理（`getValue(field) === 'Y' ? null : 'Y'`）が実装済み
- **handleFieldChange**: フィールド値を `editedData` state に反映し、保存時に `PUT /api/work-tasks/:propertyNumber` へ送信する関数
- **writeBackToSpreadsheet**: `WorkTaskSyncService.ts` の関数。DB更新後に非同期でスプレッドシートへ書き戻す。`null` 値は `value ?? ''` で空文字として書き込まれる

## Bug Details

### Bug Condition

`EditableButtonSelect` のボタンをクリックした際、クリックされたオプション値が現在のフィールド値と同一であっても、`handleFieldChange(field, opt)` に `opt` をそのまま渡してしまう。値のクリアが行われない。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X = { field: string, currentValue: string | null, clickedOption: string }
  OUTPUT: boolean

  RETURN X.currentValue IS NOT NULL
         AND X.currentValue = X.clickedOption
END FUNCTION
```

### Examples

- `site_registration_confirmed` が「他」の状態で「他」ボタンをクリック → 期待: `null`、実際: 「他」のまま
- `sales_assignee` が「山田」の状態で「山田」ボタンをクリック → 期待: `null`、実際: 「山田」のまま
- `floor_plan` が「クラウドワークス」の状態で「クラウドワークス」をクリック → 期待: `null`、実際: 「クラウドワークス」のまま
- `site_registration_confirmed` が `null` の状態で「確認中」をクリック → 期待: 「確認中」（バグ条件外、変更なし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `EditableButtonSelect` で現在選択されていないボタンをクリックした場合、そのボタンの値が設定される
- `EditableYesNo` コンポーネントの Y/N トグル動作は変わらない
- 別のオプションへの切り替え（例：「確認中」→「完了」）は正常に動作する
- フィールドが空欄（`null`）の状態でボタンをクリックすると、そのボタンの値が設定される
- 保存時のスプレッドシート書き戻し（`writeBackToSpreadsheet`）は引き続き動作する

**Scope:**
バグ条件（`currentValue === clickedOption`）が成立しない全ての操作は、この修正の影響を受けない。

## Hypothesized Root Cause

`EditableButtonSelect` の `onClick` ハンドラが以下のように実装されており、トグルロジックが欠落している：

```tsx
// 現在の実装（バグあり）
onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, opt); }}
```

一方、`EditableYesNo` には正しくトグルロジックが実装されている：

```tsx
// EditableYesNo の実装（正しい）
onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === 'Y' ? null : 'Y'); }}
```

`EditableButtonSelect` 実装時に `EditableYesNo` のトグルパターンが適用されなかったことが根本原因。

## Correctness Properties

Property 1: Bug Condition - 同じオプション再クリックで値がクリアされる

_For any_ `EditableButtonSelect` フィールドにおいて、現在選択中のオプション（`currentValue === clickedOption`）を再クリックした場合、修正後の `EditableButtonSelect` は `handleFieldChange(field, null)` を呼び出し、フィールド値を `null` に設定する。保存後、スプレッドシートの対応セルも空欄になる。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 異なるオプションクリック・他コンポーネントの動作が変わらない

_For any_ 操作において、バグ条件が成立しない場合（`currentValue !== clickedOption`、または `EditableYesNo` の操作、または他フィールドの操作）、修正後のコードは修正前と同一の動作をする。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`

**Component**: `EditableButtonSelect`

**Specific Changes:**

1. **トグルロジックの追加**: `onClick` ハンドラで、クリックされたオプションが現在値と同じ場合に `null` を渡す

   ```tsx
   // 修正前
   onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, opt); }}

   // 修正後
   onClick={(e) => { (e.currentTarget as HTMLButtonElement).blur(); handleFieldChange(field, getValue(field) === opt ? null : opt); }}
   ```

2. **スプレッドシート同期**: 追加実装不要。既存の `writeBackToSpreadsheet` は `null` 値を `value ?? ''` で空文字として書き込むため、`null` を渡すと自動的にスプレッドシートのセルが空欄になる。

   ```typescript
   // WorkTaskSyncService.ts（既存・変更不要）
   values: [[value ?? '']],  // null → '' として書き込まれる
   ```

3. **バックエンド**: 変更不要。`PUT /api/work-tasks/:propertyNumber` は既に `null` 値を受け付け、DB更新後に `writeBackToSpreadsheet` を非同期で呼び出す。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現し根本原因を確認、次に修正後のコードでバグ修正と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `EditableButtonSelect` の `onClick` ハンドラをシミュレートし、同じオプションを再クリックした際に `handleFieldChange` が `null` ではなく同じ値で呼ばれることを確認する。

**Test Cases:**
1. **サイト登録確認トグルテスト**: `site_registration_confirmed` が「他」の状態で「他」をクリック → `handleFieldChange` が `('site_registration_confirmed', '他')` で呼ばれる（未修正では `null` にならない）
2. **営業担当トグルテスト**: `sales_assignee` が「山田」の状態で「山田」をクリック → 同様にクリアされない
3. **間取図トグルテスト**: `floor_plan` が「クラウドワークス」の状態で「クラウドワークス」をクリック → 同様にクリアされない

**Expected Counterexamples:**
- `handleFieldChange` が `null` ではなく元の値で呼ばれる
- 原因: `onClick` ハンドラに `getValue(field) === opt ? null : opt` のトグルロジックが存在しない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result ← EditableButtonSelect_fixed.onClick(X.clickedOption)
  ASSERT handleFieldChange が (X.field, null) で呼ばれた
  ASSERT getValue(X.field) = null
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同一の動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT EditableButtonSelect_original.onClick(X) = EditableButtonSelect_fixed.onClick(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様なフィールド・オプション・現在値の組み合わせを自動生成し、バグ条件外の動作が変わらないことを保証する。

**Test Cases:**
1. **異なるオプション選択の保持**: 「確認中」が選択中に「完了」をクリック → 「完了」が設定される（修正前後で同一）
2. **空欄からの選択の保持**: `null` 状態でいずれかのボタンをクリック → そのボタンの値が設定される
3. **EditableYesNo 動作の保持**: Y/N ボタンのトグル動作が変わらない

### Unit Tests

- `EditableButtonSelect` で同じオプションを再クリックした際に `handleFieldChange(field, null)` が呼ばれることを検証
- `EditableButtonSelect` で異なるオプションをクリックした際に `handleFieldChange(field, opt)` が呼ばれることを検証
- `null` 状態からオプションをクリックした際に値が設定されることを検証
- `EditableYesNo` の既存トグル動作が変わらないことを検証

### Property-Based Tests

- ランダムなフィールド名・オプション配列・現在値を生成し、バグ条件（`currentValue === clickedOption`）が成立する場合は常に `null` が返ることを検証
- バグ条件が成立しない場合（`currentValue !== clickedOption`）は常に `clickedOption` が返ることを検証
- 多様な `options` 配列（1〜5要素）に対して、全オプションのトグル動作が正しいことを検証

### Integration Tests

- `WorkTaskDetailModal` を開き、`site_registration_confirmed` に「他」を設定 → 保存 → 再度「他」をクリック → 保存 → DBとスプレッドシートが空欄になることを確認
- 「確認中」→「完了」への切り替えが正常に動作することを確認
- 空欄状態から「確認中」を選択して保存できることを確認
