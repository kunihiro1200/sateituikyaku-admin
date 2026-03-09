# 当日TEL（担当）件数表示バグ修正 デザイン

## Overview

売主リストのサイドバーで「当日TEL（担当）」カテゴリの件数が表示されないバグを修正する。

根本原因は `SellerStatusSidebar.tsx` の `renderAllCategories()` 関数に以下のカテゴリボタンの呼び出しが欠けていること：
- `todayCallAssigned`（当日TEL（担当）合計）
- `visitScheduled`（訪問予定）
- `visitCompleted`（訪問済み）

また、担当者別サブカテゴリで `assigneeInitials` propが空の場合のフォールバックロジックが `visitAssigneeInitials` フィールドを参照しているが、このフィールドが存在しない売主では件数が0になる問題もある。

修正方針：`renderAllCategories()` に欠けているカテゴリボタンを追加し、担当者別フォールバックロジックを改善する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `renderAllCategories()` に `todayCallAssigned`・`visitScheduled`・`visitCompleted` のボタン呼び出しが存在しない状態
- **Property (P)**: 期待される正しい動作 — 各カテゴリボタンが表示され、正しい件数が表示される
- **Preservation**: 既存の `todayCall`・`todayCallWithInfo`・`unvaluated`・`mailingPending`・`todayCallNotStarted`・`pinrichEmpty` カテゴリの動作が変わらないこと
- **renderAllCategories**: `SellerStatusSidebar.tsx` 内の関数。サイドバーに全カテゴリボタンを描画する
- **isTodayCallAssigned**: `sellerStatusFilters.ts` 内の関数。営担あり + 次電日が今日以前の売主を判定する
- **isVisitScheduled**: `sellerStatusFilters.ts` 内の関数。営担あり + 訪問日が今日以降の売主を判定する
- **isVisitCompleted**: `sellerStatusFilters.ts` 内の関数。営担あり + 訪問日が昨日以前の売主を判定する
- **assigneeInitials**: サイドバーに渡されるスタッフイニシャル一覧のprop
- **visitAssigneeInitials**: 売主データの担当者イニシャルフィールド（`visit_assignee` のフォールバック）

## Bug Details

### Fault Condition

バグは `renderAllCategories()` 関数が呼び出されるたびに発現する。
`renderCategoryButton('todayCallAssigned', ...)` の呼び出しが存在しないため、
`isTodayCallAssigned` 条件を満たす売主が何人いても件数が表示されない。

**Formal Specification:**
```
FUNCTION isBugCondition(component)
  INPUT: component of type SellerStatusSidebar
  OUTPUT: boolean

  RETURN renderAllCategories() の出力に
         renderCategoryButton('todayCallAssigned', ...) の呼び出しが含まれない
         OR renderCategoryButton('visitScheduled', ...) の呼び出しが含まれない
         OR renderCategoryButton('visitCompleted', ...) の呼び出しが含まれない
END FUNCTION
```

### Examples

- **例1（当日TEL（担当）が非表示）**: 営担「Y」+ 次電日「2026-01-30」の売主が10人いる場合、サイドバーに「当日TEL（担当）」ボタンが表示されず、件数も表示されない
- **例2（訪問予定が非表示）**: 営担「Y」+ 訪問日「2026-02-10」（今日以降）の売主が5人いる場合、「訪問予定」ボタンが表示されない
- **例3（訪問済みが非表示）**: 営担「Y」+ 訪問日「2026-01-20」（昨日以前）の売主が3人いる場合、「訪問済み」ボタンが表示されない
- **例4（担当者別件数が0）**: `assigneeInitials` propが空で、売主データに `visitAssigneeInitials` フィールドがない場合、`visit_assignee` フィールドのみ参照されるが、フォールバックロジックが `visitAssigneeInitials` を優先するため件数が0になる可能性がある

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `isTodayCall` 関数のロジック（追客中 + 次電日が今日以前 + コミュニケーション情報が全て空 + 営担なし）
- `isTodayCallWithInfo` 関数のロジック（追客中 + 次電日が今日以前 + コミュニケーション情報のいずれかに入力あり + 営担なし）
- `isUnvaluated`・`isMailingPending`・`isTodayCallNotStarted`・`isPinrichEmpty` 関数のロジック
- `isTodayCallAssigned`・`isVisitScheduled`・`isVisitCompleted` 関数のロジック（これらは正しく実装済み）
- カテゴリクリック時のフィルタリング動作
- 担当者別サブカテゴリ（`当日TEL(Y)` など）の表示ロジック

**スコープ:**
`renderAllCategories()` 関数の修正のみ。フィルタリングロジック（`sellerStatusFilters.ts`）は変更しない。

## Hypothesized Root Cause

コードを直接確認した結果、根本原因は以下の通り：

1. **renderAllCategories() の呼び出し欠落**: `SellerStatusSidebar.tsx` の `renderAllCategories()` 関数に `renderCategoryButton('todayCallAssigned', ...)` の呼び出しが存在しない。同様に `visitScheduled`・`visitCompleted` も欠落している。

2. **担当者別フォールバックロジックの問題**: `renderAssigneeCategories()` のフォールバックで `s.visitAssigneeInitials || s.visit_assignee || ''` を参照しているが、`visitAssigneeInitials` フィールドが存在しない売主では `visit_assignee` が使われる。ただし `isVisitAssignedTo` 関数も同じロジックを使っているため、実際には問題が発生しない可能性が高い。

3. **filterSellersByCategory の欠落**: `SellerStatusSidebar.tsx` 内のローカル `filterSellersByCategory` 関数に `todayCallAssigned`・`visitScheduled`・`visitCompleted` のケースが存在しない。

## Correctness Properties

Property 1: Fault Condition - 当日TEL（担当）・訪問予定・訪問済みカテゴリボタンの表示

_For any_ サイドバーコンポーネントが `renderAllCategories()` を呼び出す場合、修正後の関数は
`isTodayCallAssigned` 条件を満たす売主が1人以上いれば「当日TEL（担当）」ボタンを表示し、
`isVisitScheduled` 条件を満たす売主が1人以上いれば「訪問予定」ボタンを表示し、
`isVisitCompleted` 条件を満たす売主が1人以上いれば「訪問済み」ボタンを表示し、
それぞれ正しい件数を表示する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存カテゴリの動作維持

_For any_ 売主データに対して、修正後のコードは `isTodayCall`・`isTodayCallWithInfo`・
`isUnvaluated`・`isMailingPending`・`isTodayCallNotStarted`・`isPinrichEmpty` の
判定結果を変更せず、既存カテゴリの件数表示・フィルタリング動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/SellerStatusSidebar.tsx`

**Function**: `renderAllCategories()`

**Specific Changes**:

1. **当日TEL（担当）ボタンの追加**: `renderAllCategories()` に以下を追加
   ```tsx
   {renderCategoryButton('todayCallAssigned', '当日TEL（担当）', '#ff5722')}
   ```
   適切な位置（`todayCall` の前、またはステアリングドキュメントの順序に従う）

2. **訪問予定ボタンの追加**: `renderAllCategories()` に以下を追加
   ```tsx
   {renderCategoryButton('visitScheduled', '①訪問予定', '#2e7d32')}
   ```

3. **訪問済みボタンの追加**: `renderAllCategories()` に以下を追加
   ```tsx
   {renderCategoryButton('visitCompleted', '②訪問済み', '#1565c0')}
   ```

4. **filterSellersByCategory（ローカル）の修正**: `SellerStatusSidebar.tsx` 内のローカル `filterSellersByCategory` 関数に `todayCallAssigned`・`visitScheduled`・`visitCompleted` のケースを追加
   ```tsx
   case 'todayCallAssigned':
     return sellers.filter(isTodayCallAssigned);
   case 'visitScheduled':
     return sellers.filter(isVisitScheduled);
   case 'visitCompleted':
     return sellers.filter(isVisitCompleted);
   ```

5. **インポートの追加**: `isTodayCallAssigned`・`isVisitScheduled`・`isVisitCompleted` を `sellerStatusFilters` からインポートに追加（現在は `isVisitAssignedTo`・`isTodayCallAssignedTo` のみインポートされている）

**File**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

変更なし（フィルタリングロジックは正しく実装済み）

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後の動作と既存動作の維持を検証する。

### Exploratory Fault Condition Checking

**Goal**: 未修正コードでバグを確認し、根本原因分析を検証する。

**Test Plan**: `renderAllCategories()` の出力を検査し、`todayCallAssigned`・`visitScheduled`・`visitCompleted` のボタンが存在しないことを確認する。

**Test Cases**:
1. **当日TEL（担当）ボタン欠落テスト**: 営担あり + 次電日が今日以前の売主データでサイドバーをレンダリングし、「当日TEL（担当）」ボタンが存在しないことを確認（未修正コードで失敗するはず）
2. **訪問予定ボタン欠落テスト**: 営担あり + 訪問日が今日以降の売主データでサイドバーをレンダリングし、「訪問予定」ボタンが存在しないことを確認（未修正コードで失敗するはず）
3. **訪問済みボタン欠落テスト**: 営担あり + 訪問日が昨日以前の売主データでサイドバーをレンダリングし、「訪問済み」ボタンが存在しないことを確認（未修正コードで失敗するはず）
4. **件数0テスト**: `categoryCounts.todayCallAssigned = 5` を渡してもサイドバーに件数が表示されないことを確認（未修正コードで失敗するはず）

**Expected Counterexamples**:
- `renderAllCategories()` の出力に `todayCallAssigned` カテゴリのボタンが含まれない
- 原因: `renderCategoryButton('todayCallAssigned', ...)` の呼び出しが欠落している

### Fix Checking

**Goal**: 修正後、バグ条件を満たす全入力に対して期待される動作が得られることを検証する。

**Pseudocode:**
```
FOR ALL sellers WHERE sellers.some(isTodayCallAssigned) DO
  result := renderAllCategories(sellers)
  ASSERT result contains button with category='todayCallAssigned'
  ASSERT button shows correct count
END FOR

FOR ALL sellers WHERE sellers.some(isVisitScheduled) DO
  result := renderAllCategories(sellers)
  ASSERT result contains button with category='visitScheduled'
END FOR

FOR ALL sellers WHERE sellers.some(isVisitCompleted) DO
  result := renderAllCategories(sellers)
  ASSERT result contains button with category='visitCompleted'
END FOR
```

### Preservation Checking

**Goal**: 修正後、既存カテゴリの動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL sellers DO
  ASSERT isTodayCall_original(seller) = isTodayCall_fixed(seller)
  ASSERT isTodayCallWithInfo_original(seller) = isTodayCallWithInfo_fixed(seller)
  ASSERT isUnvaluated_original(seller) = isUnvaluated_fixed(seller)
  ASSERT isMailingPending_original(seller) = isMailingPending_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由：
- 多様な売主データに対して自動的にテストケースを生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- フィルタリングロジックが変更されていないことを強力に保証できる

**Test Cases**:
1. **当日TEL分の保持**: 修正前後で `isTodayCall` の結果が同一であることを確認
2. **当日TEL（内容）の保持**: 修正前後で `isTodayCallWithInfo` の結果が同一であることを確認
3. **担当者別サブカテゴリの保持**: 修正前後で `isTodayCallAssignedTo` の結果が同一であることを確認
4. **カテゴリクリック動作の保持**: 既存カテゴリのクリック時にフィルタリングが正しく動作することを確認

### Unit Tests

- `renderAllCategories()` が `todayCallAssigned`・`visitScheduled`・`visitCompleted` ボタンを含むことをテスト
- 各カテゴリボタンが正しい件数を表示することをテスト
- `filterSellersByCategory`（ローカル）が新しいカテゴリを正しく処理することをテスト

### Property-Based Tests

- ランダムな売主データに対して `isTodayCallAssigned` の件数が正しくカウントされることを検証
- ランダムな売主データに対して既存カテゴリ（`isTodayCall`・`isTodayCallWithInfo`）の結果が変わらないことを検証
- 多様な `assigneeInitials` 設定に対して担当者別サブカテゴリが正しく表示されることを検証

### Integration Tests

- 売主リストページで「当日TEL（担当）」カテゴリをクリックし、正しい売主がフィルタリングされることを確認
- 「訪問予定」「訪問済み」カテゴリをクリックし、正しい売主がフィルタリングされることを確認
- 既存カテゴリ（当日TEL分・当日TEL（内容）など）が引き続き正しく動作することを確認
