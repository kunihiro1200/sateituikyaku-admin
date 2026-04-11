# seller-header-nav-reset Bugfix Design

## Overview

売主管理システムのヘッダーにある「売主リスト」ボタンを押しても、売主一覧のトップページ（全件表示状態）に戻らないバグの修正。

サイドバーでカテゴリーフィルターが適用された状態でヘッダーの「売主リスト」ボタンを押しても、`selectedCategory` ステートがリセットされず全件表示に戻れない。

修正方針は、`PageNavigation` コンポーネントの「売主リスト」ボタンクリック時に、`SellersPage` の `selectedCategory` を `'all'` にリセットするための仕組みを追加することである。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — `selectedCategory` が `'all'` 以外の状態でヘッダーの「売主リスト」ボタンが押されたとき
- **Property (P)**: 期待される正しい動作 — ボタン押下後に `selectedCategory` が `'all'` にリセットされ、全件表示状態の売主一覧が表示される
- **Preservation**: 修正によって変えてはいけない既存の動作 — サイドバーのカテゴリクリック、「全件表示」ボタン、検索・フィルター操作、他のナビゲーションボタン
- **PageNavigation**: `frontend/frontend/src/components/PageNavigation.tsx` にあるヘッダーナビゲーションコンポーネント
- **SellersPage**: `frontend/frontend/src/pages/SellersPage.tsx` にある売主一覧ページコンポーネント
- **selectedCategory**: `SellersPage` が保持するサイドバーフィルターの選択状態（`StatusCategory` 型）。`'all'` のとき全件表示
- **handleNav**: `PageNavigation` 内でナビゲーションを実行する関数

## Bug Details

### Bug Condition

バグは、`selectedCategory` が `'all'` 以外（例：`'todayCall'`）の状態で、ヘッダーの「売主リスト」ボタンが押されたときに発生する。`PageNavigation.handleNav('/')` は `navigate('/')` を呼ぶだけで、`SellersPage` の `selectedCategory` ステートをリセットしない。すでに `/` にいる場合はコンポーネントが再マウントされないため、フィルター状態が維持されたままになる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { currentPath: string, selectedCategory: StatusCategory, buttonClicked: string }
  OUTPUT: boolean

  RETURN input.buttonClicked === 'seller-list-header-nav'
         AND input.selectedCategory !== 'all'
         AND NOT categoryResetTriggered(input)
END FUNCTION
```

### Examples

- **例1（同一ページ）**: `selectedCategory = 'todayCall'` の状態でヘッダーの「売主リスト」ボタンを押す → フィルターがリセットされず「当日TEL分」のフィルタリング状態のまま表示される（バグ）
- **例2（別ページから）**: 売主詳細ページ（`/sellers/:id`）を表示中にヘッダーの「売主リスト」ボタンを押す → `/` に遷移するが、以前の `sessionStorage` に残ったカテゴリが復元される場合がある（バグ）
- **例3（正常ケース）**: `selectedCategory = 'all'` の状態でヘッダーの「売主リスト」ボタンを押す → 全件表示のまま変化なし（バグ条件に該当しない）
- **例4（エッジケース）**: `selectedCategory = 'visitAssigned:山田'` のような複合カテゴリの状態でボタンを押す → リセットされるべきだがリセットされない（バグ）

## Expected Behavior

### Preservation Requirements

**変えてはいけない動作:**
- サイドバーのカテゴリ（例：「当日TEL分」）をクリックしたとき、そのカテゴリでフィルタリングされた売主一覧が表示される
- 「← 全件表示」ボタンを押したとき、フィルターがリセットされて全件表示状態の売主一覧が表示される
- 売主一覧ページで検索やフィルターを操作したとき、指定した条件で売主一覧が絞り込まれる
- ヘッダーの「買主リスト」「物件リスト」など他のナビゲーションボタンを押したとき、それぞれの対応するページに遷移する

**スコープ:**
「売主リスト」ヘッダーボタン以外のすべての操作は、この修正によって完全に影響を受けないこと。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通りである：

1. **`PageNavigation` がステート管理を持たない**: `PageNavigation` は `navigate(path)` を呼ぶだけのプレゼンテーションコンポーネントであり、`SellersPage` の `selectedCategory` ステートを直接操作できない

2. **同一パスへの遷移でコンポーネントが再マウントされない**: すでに `/` にいる状態で `navigate('/')` を呼んでも React Router はコンポーネントを再マウントしないため、`selectedCategory` の初期化処理が走らない

3. **`sessionStorage` への依存**: `selectedCategory` の初期値は `sessionStorage` から復元されるが、ヘッダーナビゲーション時にこの値がクリアされない

4. **`onNavigate` コールバックが未活用**: `PageNavigation` には `onNavigate?: (url: string) => void` プロップが存在するが、`SellersPage` での使用時に渡されていない

## Correctness Properties

Property 1: Bug Condition - ヘッダー「売主リスト」ボタンがフィルターをリセットする

_For any_ 入力においてバグ条件が成立する（`isBugCondition` が true を返す）場合、修正後の「売主リスト」ボタンクリック処理は `selectedCategory` を `'all'` にリセットし、全件表示状態の売主一覧を表示しなければならない。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - バグ条件に該当しない操作の動作が変わらない

_For any_ 入力においてバグ条件が成立しない（`isBugCondition` が false を返す）場合、修正後のコードは修正前のコードと同じ動作をしなければならない。サイドバーのカテゴリクリック、「全件表示」ボタン、検索・フィルター操作、他のナビゲーションボタンの動作が保持される。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の変更を行う：

**File**: `frontend/frontend/src/pages/SellersPage.tsx`

**変更内容**:
1. **`PageNavigation` に `onNavigate` コールバックを渡す**: 「売主リスト」（`/`）へのナビゲーション時に `selectedCategory` を `'all'` にリセットし、`sessionStorage` の `selectedStatusCategory` もクリアする

```tsx
<PageNavigation
  onNavigate={(path) => {
    if (path === '/') {
      // 売主リストボタンが押されたらフィルターをリセット
      setSelectedCategory('all');
      setPage(0);
      sessionStorage.removeItem('selectedStatusCategory');
    }
    navigate(path);
  }}
/>
```

この変更により：
- `PageNavigation` 自体の変更は不要（既存の `onNavigate` プロップを活用）
- 同一ページ（`/`）にいる場合でも `selectedCategory` が `'all'` にリセットされる
- 別ページから遷移する場合も `sessionStorage` がクリアされるため、フィルター状態が復元されない

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず修正前のコードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現するカウンターサンプルを確認し、根本原因分析を検証する。

**Test Plan**: `SellersPage` をレンダリングし、サイドバーでカテゴリを選択した後、`PageNavigation` の「売主リスト」ボタンをクリックして `selectedCategory` が変化しないことを確認する。

**Test Cases**:
1. **同一ページフィルターリセットテスト**: `selectedCategory = 'todayCall'` の状態で「売主リスト」ボタンをクリック → `selectedCategory` が `'all'` にならないことを確認（修正前は失敗する）
2. **複合カテゴリリセットテスト**: `selectedCategory = 'visitAssigned:山田'` の状態で「売主リスト」ボタンをクリック → リセットされないことを確認（修正前は失敗する）
3. **sessionStorageリセットテスト**: `sessionStorage` に `selectedStatusCategory` が保存された状態でボタンをクリック → クリアされないことを確認（修正前は失敗する）

**Expected Counterexamples**:
- ボタンクリック後も `selectedCategory` が `'todayCall'` のまま維持される
- 原因：`PageNavigation` が `navigate('/')` を呼ぶだけで `selectedCategory` ステートを操作しないため

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleSellerListNavClick_fixed(input)
  ASSERT result.selectedCategory === 'all'
  ASSERT result.page === 0
  ASSERT sessionStorage.getItem('selectedStatusCategory') === null
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleNav_original(input) = handleNav_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由：
- 多様なカテゴリ状態（`'all'`、`'todayCall'`、`'visitAssigned:X'` など）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存動作が保持されることを強く保証できる

**Test Cases**:
1. **サイドバークリック保持テスト**: サイドバーのカテゴリクリックが修正後も正常に動作することを確認
2. **「全件表示」ボタン保持テスト**: 既存の「← 全件表示」ボタンが修正後も正常に動作することを確認
3. **他のナビゲーション保持テスト**: 「買主リスト」「物件リスト」ボタンが修正後も正常に動作することを確認
4. **検索・フィルター保持テスト**: 検索バーやフィルタードロップダウンが修正後も正常に動作することを確認

### Unit Tests

- `PageNavigation` の `onNavigate` コールバックが `'/'` パスで呼ばれたとき `selectedCategory` が `'all'` にリセットされることをテスト
- `selectedCategory` が `'all'` の状態でボタンを押したとき、状態が変化しないことをテスト（冪等性）
- `sessionStorage` の `selectedStatusCategory` がクリアされることをテスト

### Property-Based Tests

- ランダムな `StatusCategory` 値（`'all'` 以外）を生成し、「売主リスト」ボタンクリック後に常に `'all'` にリセットされることを検証
- ランダムなナビゲーションパス（`'/'` 以外）を生成し、`selectedCategory` が変化しないことを検証（保持チェック）
- 多様なカテゴリ状態でサイドバークリックが正常に動作することを検証

### Integration Tests

- サイドバーでカテゴリを選択 → ヘッダーの「売主リスト」ボタンをクリック → 全件表示に戻ることを確認
- 売主詳細ページ → ヘッダーの「売主リスト」ボタンをクリック → フィルターなしの全件表示で売主一覧が表示されることを確認
- 通話モードページ → ヘッダーの「売主リスト」ボタンをクリック → フィルターなしの全件表示で売主一覧が表示されることを確認
