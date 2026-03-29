# 売主通話モードページ 訪問関連バグ修正 設計ドキュメント

## Overview

`CallModePage.tsx` に存在する2つのバグを修正する。

**バグ1**: 訪問予定日時を入力・保存した際に、`visitValuationAcquirer`（訪問査定取得者）が自動設定されない。
`employees` ステートが空の場合（ページロード直後など）、`onChange` ハンドラ内の `employees.find()` が `undefined` を返し、自動設定がスキップされる。

**バグ2**: 訪問統計セクションが表示されない。
`loadVisitStats` が `const` で行1742に定義されているが、`useEffect` は行965で呼び出している。
`const` はホイスティングされないため、`useEffect` のコールバック実行時点では `loadVisitStats` が参照できず、エラーが発生する。

修正対象ファイルは `frontend/frontend/src/pages/CallModePage.tsx` のみ。バックエンドの変更は不要。

## Glossary

- **Bug_Condition (C)**: バグを引き起こす入力・状態の条件
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作
- **Preservation**: 修正によって変更してはいけない既存の動作
- **handleSaveAppointment**: `CallModePage.tsx` 行1934付近に定義された、訪問予約情報を保存する関数
- **loadVisitStats**: `CallModePage.tsx` 行1742付近に定義された、訪問統計を取得する非同期関数
- **employees ステート**: `getActiveEmployees()` で取得したスタッフ一覧を保持するステート（ページロード直後は空配列の可能性あり）
- **editedVisitValuationAcquirer**: 訪問査定取得者の編集中の値を保持するステート

## Bug Details

### バグ1: 訪問査定取得者が自動設定されない

訪問予定日時の `onChange` ハンドラ（行4449付近）では `employees.find()` で現在のログインユーザーを検索しているが、`employees` ステートがまだ空の場合（バックグラウンドロード中）に `undefined` が返り、自動設定がスキップされる。

その結果、`handleSaveAppointment` は空の `editedVisitValuationAcquirer` をそのまま送信する。

**Formal Specification:**
```
FUNCTION isBugCondition_1(state)
  INPUT: state = { employees: Employee[], employee: AuthUser, editedVisitValuationAcquirer: string }
  OUTPUT: boolean

  RETURN editedVisitValuationAcquirer IS EMPTY
         AND employee.email IS NOT EMPTY
         AND employees.find(emp => emp.email === employee.email) IS undefined
END FUNCTION
```

### バグ2: 訪問統計が表示されない

`useEffect`（行965付近）が `loadVisitStats` を呼び出しているが、`loadVisitStats` の定義（行1742付近）は `useEffect` より後にある。
`const` はホイスティングされないため、`useEffect` のコールバックが実行される時点では `loadVisitStats` は `undefined` であり、`TypeError: loadVisitStats is not a function` が発生する。

**Formal Specification:**
```
FUNCTION isBugCondition_2(codeState)
  INPUT: codeState = { loadVisitStatsDefinitionLine: number, useEffectCallLine: number }
  OUTPUT: boolean

  RETURN useEffectCallLine < loadVisitStatsDefinitionLine
         AND loadVisitStats IS DECLARED WITH const
END FUNCTION
```

### Examples

**バグ1の例:**
- ページを開いた直後（`employees` がまだロードされていない）に訪問予定日時を入力 → `visitValuationAcquirer` が空のまま保存される
- `employees` ロード完了後に訪問予定日時を入力 → 正常に自動設定される（バグが再現しない）

**バグ2の例:**
- `visitDate` または `appointmentDate` が設定されている売主の通話モードページを開く → `loadVisitStats is not a function` エラーが発生し、訪問統計が表示されない
- `visitDate` が設定されていない売主の通話モードページを開く → `loadVisitStats` が呼ばれないため、エラーは発生しない

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `handleSaveAppointment` の既存の保存ロジック（`appointmentDate`、`assignedTo`、`appointmentNotes`）は変更しない
- 手動入力済みの `visitValuationAcquirer` は上書きしない（自動設定は空の場合のみ）
- `loadVisitStats` は `visitDate` または `appointmentDate` がある場合のみ実行される（条件は変更しない）
- `/api/sellers/visit-stats` エンドポイントへのリクエスト形式は変更しない

**Scope:**
- バグ1の修正は `handleSaveAppointment` 内のフォールバックロジックのみに影響する
- バグ2の修正は `loadVisitStats` の定義位置の移動のみ（ロジック変更なし）
- 上記以外の全ての動作は修正前後で同一でなければならない

## Hypothesized Root Cause

### バグ1の根本原因

1. **`employees` ステートの非同期ロード**: `getActiveEmployees()` はバックグラウンドで並列取得（行1332付近）されるため、ページロード直後は `employees` が空配列になる
2. **`onChange` ハンドラの依存**: 自動設定ロジックが `employees` ステートに依存しており、ステートが空の場合にフォールバックがない
3. **`handleSaveAppointment` にフォールバックなし**: 保存時に `editedVisitValuationAcquirer` が空でも、再取得・補完を試みない

### バグ2の根本原因

1. **`const` の TDZ（Temporal Dead Zone）**: `const` で宣言された変数は、宣言より前の行から参照できない（`var` と異なりホイスティングされない）
2. **定義順序の誤り**: `loadVisitStats`（行1742）が `useEffect`（行965）より後に定義されている
3. **実行時エラー**: `useEffect` のコールバックが実行される時点で `loadVisitStats` は TDZ にあり、`ReferenceError` または `TypeError` が発生する

## Correctness Properties

Property 1: Bug Condition - 訪問査定取得者の自動設定

_For any_ 保存操作において `editedVisitValuationAcquirer` が空であり、かつ `employee.email` が存在する場合、修正後の `handleSaveAppointment` は SHALL `employees` ステートまたは `getActiveEmployees()` の再呼び出しによってログインユーザーのイニシャルを取得し、`visitValuationAcquirer` に設定して保存する。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - 訪問統計の表示

_For any_ `visitDate` または `appointmentDate` が設定されている売主の通話モードページ表示において、修正後のコードは SHALL `loadVisitStats` を正常に呼び出し、`/api/sellers/visit-stats` から統計データを取得して表示する。

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation - 既存の保存ロジック

_For any_ 保存操作において `editedVisitValuationAcquirer` が既に入力されている場合、修正後の `handleSaveAppointment` は SHALL 手動入力値を優先し、自動設定ロジックを適用しない。また `appointmentDate`、`assignedTo`、`appointmentNotes` の保存動作は変更しない。

**Validates: Requirements 3.1, 3.2**

Property 4: Preservation - 訪問統計の非表示条件

_For any_ `visitDate` および `appointmentDate` が両方とも未設定の売主の通話モードページ表示において、修正後のコードは SHALL `loadVisitStats` を呼び出さない（修正前と同じ条件を維持する）。

**Validates: Requirements 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

#### 修正1: `loadVisitStats` の定義を `useEffect` より前に移動

**現状**: `loadVisitStats` は行1742付近（`const loadVisitStats = async () => {...}`）に定義されているが、これを呼び出す `useEffect` は行965付近にある。

**修正**: `loadVisitStats` の定義ブロック全体を、呼び出し元の `useEffect`（行965付近）より前の位置に移動する。ロジックの変更は一切行わない。

#### 修正2: `handleSaveAppointment` にフォールバックロジックを追加

**現状**: `handleSaveAppointment`（行1934付近）は `editedVisitValuationAcquirer` をそのまま送信する。

**修正**: 保存前に `editedVisitValuationAcquirer` が空の場合、以下の順序でフォールバックを試みる：

```typescript
// editedVisitValuationAcquirer が空の場合のフォールバック
let acquirer = editedVisitValuationAcquirer;
if (!acquirer && employee?.email) {
  // 1. employees ステートから検索
  const staffFromState = employees.find(emp => emp.email === employee.email);
  if (staffFromState) {
    acquirer = staffFromState.initials || staffFromState.name || staffFromState.email;
  } else {
    // 2. getActiveEmployees() を呼び出して再検索
    try {
      const freshEmployees = await getActiveEmployees();
      const freshStaff = freshEmployees.find(emp => emp.email === employee.email);
      if (freshStaff) {
        acquirer = freshStaff.initials || freshStaff.name || freshStaff.email;
      } else {
        // 3. employee.initials を使用
        acquirer = employee.initials || '';
      }
    } catch {
      acquirer = employee.initials || '';
    }
  }
}
```

その後、`visitValuationAcquirer: acquirer || null` として送信する。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `employees` ステートが空の状態で `handleSaveAppointment` を呼び出し、`visitValuationAcquirer` が空のまま送信されることを確認する。また `loadVisitStats` が `useEffect` より後に定義されている状態で呼び出しを試み、エラーが発生することを確認する。

**Test Cases**:
1. **バグ1 - employees空の場合**: `employees = []` の状態で訪問予定日時を設定して保存 → `visitValuationAcquirer` が空で送信される（未修正コードで失敗）
2. **バグ1 - employees有りの場合**: `employees` にデータがある状態で保存 → 正常に自動設定される（未修正コードでも成功）
3. **バグ2 - loadVisitStats呼び出し**: `visitDate` がある状態でコンポーネントをマウント → `loadVisitStats is not a function` エラーが発生（未修正コードで失敗）

**Expected Counterexamples**:
- `visitValuationAcquirer` が空のまま API に送信される
- `loadVisitStats` の呼び出しで `TypeError` または `ReferenceError` が発生する

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待通りの動作をすることを検証する。

**Pseudocode:**
```
FOR ALL state WHERE isBugCondition_1(state) DO
  result := handleSaveAppointment_fixed(state)
  ASSERT result.visitValuationAcquirer IS NOT EMPTY
END FOR

FOR ALL state WHERE isBugCondition_2(state) DO
  result := mountComponent_fixed(state)
  ASSERT loadVisitStats WAS CALLED WITHOUT ERROR
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL state WHERE NOT isBugCondition_1(state) DO
  ASSERT handleSaveAppointment_original(state) = handleSaveAppointment_fixed(state)
END FOR

FOR ALL state WHERE NOT isBugCondition_2(state) DO
  ASSERT mountComponent_original(state) = mountComponent_fixed(state)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。様々な `employees` ステートと `editedVisitValuationAcquirer` の組み合わせを生成し、手動入力値が常に優先されることを検証する。

**Test Cases**:
1. **手動入力値の保持**: `editedVisitValuationAcquirer = "Y"` の場合、修正後も `"Y"` がそのまま送信される
2. **appointmentDate の保持**: 修正前後で `appointmentDate` の保存動作が同一である
3. **assignedTo の保持**: 修正前後で `assignedTo` の保存動作が同一である
4. **visitDate なしの場合**: `visitDate` が未設定の場合、`loadVisitStats` が呼ばれない

### Unit Tests

- `employees` が空の場合に `getActiveEmployees()` フォールバックが動作することをテスト
- `employees` にデータがある場合に `employees.find()` が使用されることをテスト
- `editedVisitValuationAcquirer` が手動入力済みの場合にフォールバックが適用されないことをテスト
- `loadVisitStats` が `useEffect` から正常に呼び出せることをテスト

### Property-Based Tests

- ランダムな `employees` 配列と `employee.email` の組み合わせで、`visitValuationAcquirer` が常に非空になることを検証
- `editedVisitValuationAcquirer` が非空の場合、常にその値が優先されることを検証
- `visitDate` の有無に関わらず、`appointmentDate`・`assignedTo`・`appointmentNotes` の保存動作が変わらないことを検証

### Integration Tests

- `employees` ロード前に訪問予定日時を入力して保存 → `visitValuationAcquirer` が正しく設定されることを確認
- `visitDate` がある売主の通話モードページを開く → 訪問統計が正常に表示されることを確認
- `visitDate` がない売主の通話モードページを開く → 訪問統計セクションが表示されないことを確認
