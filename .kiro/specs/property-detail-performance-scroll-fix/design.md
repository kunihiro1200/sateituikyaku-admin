# Property Detail Performance & Scroll Fix Bugfix Design

## Overview

物件詳細画面（`PropertyListingDetailPage`）に存在する2つのバグを修正します。

1. **遷移速度の改善**: `useEffect` 内で `fetchPropertyData`・`fetchBuyers`・`fetchWorkTaskData`・`getActiveEmployees` が逐次実行されているため、全APIレスポンスが揃うまで画面表示が遅延している。`Promise.all` による並列化で解消する。

2. **物件概要バーのスクロール固定**: 「物件概要」`Paper` コンポーネントに `position: sticky` が設定されていないため、スクロール時に画面上部から消えてしまう。`position: sticky` と適切な `top` 値を追加して固定する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件
  - C1: 物件詳細画面の初期ロード時に4つのAPIが逐次実行される状態
  - C2: 物件詳細画面をスクロールした際に「物件概要」バーが固定されない状態
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作
- **Preservation**: 修正によって変更してはならない既存の動作
- **fetchPropertyData**: `PropertyListingDetailPage` 内で物件情報を取得する非同期関数
- **fetchBuyers**: 物件に紐づく買主リストを取得する非同期関数
- **fetchWorkTaskData**: 業務タスクデータを取得する非同期関数
- **getActiveEmployees**: アクティブな従業員リストを取得する非同期関数
- **物件概要バー**: `Paper` コンポーネントで実装された「物件概要」セクション（行1122付近）

## Bug Details

### Bug Condition

**Bug 1 - 逐次API呼び出し**

現在の `useEffect` は以下のように実装されており、各関数が順番に実行される（前の関数の完了を待たずに呼び出されているが、各関数内部でローディング状態を管理しているため実質的に独立した非同期処理となっている）。しかし `getActiveEmployees` は `.then()` チェーンで呼ばれており、並列化の恩恵を受けていない。

```typescript
useEffect(() => {
  if (propertyNumber) {
    fetchPropertyData();   // 逐次1
    fetchBuyers();         // 逐次2
    fetchWorkTaskData();   // 逐次3
  }
  getActiveEmployees().then(setActiveEmployees).catch(() => {}); // 逐次4
}, [propertyNumber]);
```

**Formal Specification:**
```
FUNCTION isBugCondition_C1(context)
  INPUT: context of type PageLoadContext
  OUTPUT: boolean

  RETURN context.isInitialLoad = true
         AND context.apiCallStrategy = 'sequential'
         AND COUNT(context.pendingApiCalls) >= 2
END FUNCTION
```

**Bug 2 - スクロール時の物件概要バー非固定**

```typescript
// 現在の実装（行1122）
<Paper sx={{ p: 1, mb: 2, bgcolor: '#f5f5f5' }}>
```

`position: sticky` が設定されていないため、スクロール時に流れてしまう。

**Formal Specification:**
```
FUNCTION isBugCondition_C2(element)
  INPUT: element of type PaperComponent
  OUTPUT: boolean

  RETURN element.id = 'property-header-paper'
         AND element.style.position != 'sticky'
         AND userHasScrolledDown = true
END FUNCTION
```

### Examples

**Bug 1:**
- 物件一覧から案件をクリック → 4つのAPIが順番に実行 → 合計レスポンス時間 = API1 + API2 + API3 + API4（例: 200ms + 150ms + 180ms + 120ms = 650ms）
- 期待値: `Promise.all` で並列実行 → 合計レスポンス時間 ≈ max(API1, API2, API3, API4)（例: 200ms）

**Bug 2:**
- 物件詳細画面を下にスクロール → 「物件概要」バーが画面上部から消える
- 期待値: スクロールしても「物件概要」バーが画面上部に固定されたまま

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 物件情報・買主リスト・業務タスクデータが正しく表示される（データの整合性は変わらない）
- 「物件概要」バーの編集ボタンをクリックすると編集モードに切り替わり、各フィールドを編集・保存できる
- 既存の上部ナビゲーションバー（`position: sticky, top: 0, zIndex: 200`）が正常に機能する
- APIの一部が失敗した場合、他のデータは引き続き表示され、エラーハンドリングが正常に動作する

**Scope:**
- Bug 1の修正は `useEffect` 内のAPI呼び出し順序のみに影響する。各APIの処理内容・エラーハンドリング・ローディング状態管理は変更しない。
- Bug 2の修正は「物件概要」`Paper` コンポーネントの `sx` プロパティのみに影響する。他のコンポーネントのスタイルは変更しない。

## Hypothesized Root Cause

### Bug 1 - 逐次API呼び出し

1. **設計上の逐次実装**: `useEffect` 内で各 `fetch*` 関数を個別に呼び出しており、`Promise.all` でまとめていない。各関数は独立して非同期実行されるが、`getActiveEmployees` は `.then()` チェーンで呼ばれており、明示的な並列化がされていない。
2. **ローディング状態の分散管理**: `loading`・`buyersLoading` など各APIに対して個別のローディング状態があり、並列化を妨げる設計になっていない（並列化は可能）。

### Bug 2 - スクロール時の物件概要バー非固定

1. **`position: sticky` の未設定**: 行1122の `Paper` コンポーネントの `sx` に `position: 'sticky'` が含まれていない。
2. **`top` 値の未設定**: 上部ナビゲーションバーの高さ分（約48px程度）を `top` に指定する必要がある。
3. **`zIndex` の未設定**: 他のコンテンツの上に重なるよう `zIndex` を設定する必要がある。

## Correctness Properties

Property 1: Bug Condition - 並列API実行による高速化

_For any_ 物件詳細画面の初期ロード時において、`fetchPropertyData`・`fetchBuyers`・`fetchWorkTaskData`・`getActiveEmployees` の4つのAPI呼び出しが同時に開始される場合、修正後の `useEffect` は全APIを `Promise.all` で並列実行し、合計待機時間を最大のAPI応答時間まで短縮する。

**Validates: Requirements 2.1**

Property 2: Bug Condition - 物件概要バーのスクロール固定

_For any_ ユーザーが物件詳細画面を下にスクロールする操作において、「物件概要」`Paper` コンポーネントは `position: sticky` により画面上部に固定され、その下のコンテンツのみがスクロールする。

**Validates: Requirements 2.2**

Property 3: Preservation - データ表示の正確性

_For any_ 物件詳細データの取得完了後において、修正後のコードは物件情報・買主リスト・業務タスクデータを修正前と同一の内容で正しく表示する。

**Validates: Requirements 3.1, 3.4**

Property 4: Preservation - 既存UI機能の維持

_For any_ ユーザーが「物件概要」バーの編集ボタンをクリックする操作、または上部ナビゲーションバーを使用する操作において、修正後のコードは修正前と同一の動作を保持する。

**Validates: Requirements 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`

#### Bug 1 修正 - `useEffect` の並列化

**Function**: `useEffect`（行 248〜253付近）

**Specific Changes**:

1. **`Promise.all` による並列実行**: 4つのAPI呼び出しを `Promise.allSettled` でまとめて並列実行する。`Promise.allSettled` を使用することで、一部のAPIが失敗しても他のAPIの結果を取得できる（エラーハンドリングの保持）。

```typescript
// 修正前
useEffect(() => {
  if (propertyNumber) {
    fetchPropertyData();
    fetchBuyers();
    fetchWorkTaskData();
  }
  getActiveEmployees().then(setActiveEmployees).catch(() => {});
}, [propertyNumber]);

// 修正後
useEffect(() => {
  if (propertyNumber) {
    Promise.allSettled([
      fetchPropertyData(),
      fetchBuyers(),
      fetchWorkTaskData(),
      getActiveEmployees().then(setActiveEmployees).catch(() => {}),
    ]);
  }
}, [propertyNumber]);
```

#### Bug 2 修正 - 物件概要バーの `position: sticky`

**Location**: 行1122付近の `Paper` コンポーネント

**Specific Changes**:

1. **`position: sticky` の追加**: 上部ナビゲーションバーの下に固定されるよう `top` 値を設定する。ナビゲーションバーの `zIndex` が200のため、物件概要バーは `zIndex: 100` 程度に設定する。

```typescript
// 修正前
<Paper sx={{ p: 1, mb: 2, bgcolor: '#f5f5f5' }}>

// 修正後
<Paper sx={{ p: 1, mb: 2, bgcolor: '#f5f5f5', position: 'sticky', top: 48, zIndex: 100 }}>
```

**注意**: `top` の値はナビゲーションバーの実際の高さに合わせて調整が必要な場合がある。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `useEffect` のAPI呼び出し順序をモックしてタイミングを計測し、逐次実行されていることを確認する。スクロールイベントをシミュレートして物件概要バーが固定されないことを確認する。

**Test Cases**:
1. **逐次実行テスト**: 4つのAPIをモックし、`useEffect` 実行後に全APIが同時に呼び出されていないことを確認（未修正コードで失敗することを期待）
2. **スクロール固定テスト**: 物件概要 `Paper` の `position` スタイルが `sticky` でないことを確認（未修正コードで失敗することを期待）
3. **ローディング状態テスト**: 並列化後もローディングインジケーターが正しく表示されることを確認

**Expected Counterexamples**:
- 未修正コードでは `fetchPropertyData` の完了を待たずに `fetchBuyers` が呼ばれているが、`Promise.all` でまとめられていないため、ブラウザのネットワークタブで逐次的なリクエスト開始が確認できる
- 未修正コードでは `Paper` の `position` が `static`（デフォルト）のため、スクロール時に固定されない

### Fix Checking

**Goal**: 修正後のコードで全バグ条件が解消されていることを検証する。

**Pseudocode:**
```
FOR ALL context WHERE isBugCondition_C1(context) DO
  result := useEffect_fixed(context)
  ASSERT result.apiCallStrategy = 'parallel'
  ASSERT result.allApisStartedSimultaneously = true
END FOR

FOR ALL element WHERE isBugCondition_C2(element) DO
  result := render_fixed(element)
  ASSERT result.style.position = 'sticky'
  ASSERT result.style.top IS NOT NULL
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない入力に対して、修正前後で同一の動作を保持することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_C1(input) AND NOT isBugCondition_C2(input) DO
  ASSERT original_behavior(input) = fixed_behavior(input)
END FOR
```

**Testing Approach**: プロパティベーステストにより、様々な物件データ・ユーザー操作パターンで既存動作が保持されることを検証する。

**Test Cases**:
1. **データ表示保持テスト**: 並列化後も物件情報・買主リスト・業務タスクデータが正しく表示されることを確認
2. **編集機能保持テスト**: 「物件概要」バーの編集ボタンが引き続き機能することを確認
3. **ナビゲーションバー保持テスト**: 既存の上部ナビゲーションバーの `position: sticky` が引き続き正常に機能することを確認
4. **エラーハンドリング保持テスト**: APIの一部が失敗した場合に他のデータが表示されることを確認

### Unit Tests

- `useEffect` 内のAPI呼び出しが `Promise.allSettled` でまとめられていることをテスト
- 物件概要 `Paper` の `sx` に `position: 'sticky'` が含まれていることをテスト
- 各APIのエラーハンドリングが独立して動作することをテスト（一部失敗でも他は表示）

### Property-Based Tests

- ランダムな物件データで並列化後も全フィールドが正しく表示されることを検証
- ランダムなスクロール位置で物件概要バーが常に固定されていることを検証
- 様々なAPI応答パターン（成功・失敗の組み合わせ）でエラーハンドリングが正しく動作することを検証

### Integration Tests

- 物件一覧から詳細画面への遷移フロー全体で、ページロード時間が改善されることを確認
- スクロール操作を含む物件詳細画面の操作フロー全体で、物件概要バーが固定されることを確認
- 編集モードでのスクロール操作が正常に動作することを確認
