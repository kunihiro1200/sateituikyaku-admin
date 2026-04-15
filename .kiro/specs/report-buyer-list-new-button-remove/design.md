# report-buyer-list-new-button-remove Bugfix Design

## Overview

報告ページ（`PropertyReportPage`）の買主リスト右上に表示されている「新規作成」ボタンを非表示にする。

`CompactBuyerListForProperty` コンポーネントに `showCreateButton?: boolean` プロパティを追加し、デフォルト `true`（後方互換性維持）とする。報告ページからは `false` を渡してボタンを非表示にする。物件詳細モーダル（`PropertyListingDetailModal`）の買主タブにある「新規作成」ボタンは独立した実装のため影響を受けない。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `CompactBuyerListForProperty` に `showCreateButton` が渡されていない（またはデフォルトの `true` のまま）状態で報告ページに表示されること
- **Property (P)**: 期待される正しい動作 — 報告ページでは「新規作成」ボタンが表示されないこと
- **Preservation**: 修正によって変更してはならない既存の動作 — 物件詳細モーダルの「新規作成」ボタン、買主一覧の表示・クリック動作
- **CompactBuyerListForProperty**: `frontend/frontend/src/components/CompactBuyerListForProperty.tsx` にある買主リストコンポーネント。報告ページで使用される
- **PropertyListingDetailModal**: `frontend/frontend/src/components/PropertyListingDetailModal.tsx` にある物件詳細モーダル。買主タブに独自の「新規作成」ボタンを持つ
- **showCreateButton**: 修正で追加する `CompactBuyerListForProperty` の新しいオプションプロパティ（`boolean`、デフォルト `true`）

## Bug Details

### Bug Condition

報告ページが `CompactBuyerListForProperty` を使用する際、「新規作成」ボタンの表示を制御するプロパティが存在しないため、常にボタンがレンダリングされる。報告ページは閲覧・報告用途であり、買主の新規作成操作は不要。

**Formal Specification:**
```
FUNCTION isBugCondition(context)
  INPUT: context of type RenderContext
  OUTPUT: boolean

  RETURN context.page == 'PropertyReportPage'
         AND context.component == 'CompactBuyerListForProperty'
         AND context.showCreateButton != false
         AND createButtonIsRendered(context)
END FUNCTION
```

### Examples

- 報告ページを開く → 買主リスト右上に「新規作成」ボタンが表示される（バグ）→ 表示されないべき
- `showCreateButton={false}` を渡す → ボタンが非表示になる（修正後の期待動作）
- 物件詳細モーダルの買主タブを開く → 「新規作成」ボタンが表示される（正常、変更なし）
- `showCreateButton` を渡さない（デフォルト） → ボタンが表示される（後方互換性維持）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 物件詳細モーダル（`PropertyListingDetailModal`）の買主タブにある「新規作成」ボタンは引き続き表示される
- 物件詳細モーダルの「新規作成」ボタンをクリックすると買主新規作成ページへ遷移する
- 報告ページで買主一覧が表示され、行クリックで買主詳細ページへ遷移する
- `showCreateButton` を渡さない既存の利用箇所ではボタンが引き続き表示される（後方互換性）

**スコープ:**
`showCreateButton` プロパティを渡さない全ての既存利用箇所は、このバグ修正の影響を受けない。`PropertyListingDetailModal` は `CompactBuyerListForProperty` を使用しておらず、独自のボタン実装を持つため完全に独立している。

## Hypothesized Root Cause

バグの原因は以下の通り：

1. **表示制御プロパティの欠如**: `CompactBuyerListForProperty` コンポーネントに「新規作成」ボタンの表示・非表示を制御するプロパティが存在しない。ボタンがハードコードされており、呼び出し元から制御できない。

2. **報告ページでの用途の違い**: 報告ページは閲覧・報告専用であり、買主の新規作成は不要。しかし、コンポーネントはその用途を考慮せず常にボタンを表示する。

3. **コンポーネントの再利用設計の不足**: 同じコンポーネントが異なる用途（報告ページ vs その他）で使われることを想定した設計になっていない。

## Correctness Properties

Property 1: Bug Condition - 報告ページで「新規作成」ボタンが非表示になる

_For any_ レンダリングコンテキストにおいて `showCreateButton={false}` が渡された場合、`CompactBuyerListForProperty` コンポーネントは「新規作成」ボタンをDOMにレンダリングしない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - showCreateButton未指定時のデフォルト動作が維持される

_For any_ レンダリングコンテキストにおいて `showCreateButton` が渡されない（またはデフォルト `true`）場合、`CompactBuyerListForProperty` コンポーネントは修正前と同じく「新規作成」ボタンをレンダリングし、既存の動作を保持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/components/CompactBuyerListForProperty.tsx`

**Specific Changes**:

1. **インターフェースへのプロパティ追加**: `CompactBuyerListForPropertyProps` に `showCreateButton?: boolean` を追加する
   - デフォルト値は `true`（後方互換性維持）

2. **コンポーネント引数の更新**: デストラクチャリングに `showCreateButton = true` を追加する

3. **条件付きレンダリングの適用**: 「新規作成」ボタンを `{showCreateButton && <Button ...>新規作成</Button>}` で囲む

**File**: 報告ページ（`PropertyReportPage` を使用しているファイル）

4. **プロパティの受け渡し**: `CompactBuyerListForProperty` の呼び出し箇所に `showCreateButton={false}` を追加する

**変更不要なファイル**:
- `PropertyListingDetailModal.tsx` — 独自のボタン実装を持つため変更不要

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後の動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `CompactBuyerListForProperty` をレンダリングし、「新規作成」ボタンが常に表示されることを確認する。

**Test Cases**:
1. **デフォルトレンダリングテスト**: `showCreateButton` なしでコンポーネントをレンダリング → ボタンが表示される（未修正コードでは常にtrue）
2. **報告ページ相当テスト**: 報告ページと同じ呼び出し方でレンダリング → ボタンが表示される（バグの再現）

**Expected Counterexamples**:
- `showCreateButton={false}` を渡してもボタンが非表示にならない（修正前）
- 原因: プロパティが存在しないためコンポーネントが制御を受け付けない

### Fix Checking

**Goal**: `showCreateButton={false}` を渡したとき、ボタンがレンダリングされないことを検証する。

**Pseudocode:**
```
FOR ALL context WHERE isBugCondition(context) DO
  result := render(CompactBuyerListForProperty, { showCreateButton: false, ...props })
  ASSERT NOT buttonExistsInDOM(result, '新規作成')
END FOR
```

### Preservation Checking

**Goal**: `showCreateButton` を渡さない（またはデフォルト `true`）場合、修正前と同じ動作が維持されることを検証する。

**Pseudocode:**
```
FOR ALL context WHERE NOT isBugCondition(context) DO
  result_original := render(CompactBuyerListForProperty_original, { ...props })
  result_fixed    := render(CompactBuyerListForProperty_fixed, { ...props })
  ASSERT buttonExistsInDOM(result_original, '新規作成') == buttonExistsInDOM(result_fixed, '新規作成')
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。様々なprops組み合わせで後方互換性を検証できる。

**Test Cases**:
1. **デフォルト動作の保持**: `showCreateButton` なしでレンダリング → ボタンが表示されることを確認
2. **明示的 `true` の動作**: `showCreateButton={true}` でレンダリング → ボタンが表示されることを確認
3. **買主一覧クリック動作の保持**: `showCreateButton={false}` でも行クリックが機能することを確認
4. **物件詳細モーダルの独立性**: `PropertyListingDetailModal` の買主タブが引き続き「新規作成」ボタンを表示することを確認

### Unit Tests

- `showCreateButton={false}` のとき「新規作成」ボタンが存在しないこと
- `showCreateButton={true}`（またはデフォルト）のとき「新規作成」ボタンが存在すること
- `showCreateButton={false}` でも買主テーブルが正常にレンダリングされること
- `showCreateButton={false}` でも行クリックで `window.open` が呼ばれること

### Property-Based Tests

- ランダムな `buyers` 配列と `showCreateButton=false` の組み合わせで、常にボタンが非表示になることを検証
- ランダムな `buyers` 配列と `showCreateButton=true`（またはデフォルト）の組み合わせで、常にボタンが表示されることを検証
- 様々な `propertyNumber` 値で、`showCreateButton` の動作が一貫していることを検証

### Integration Tests

- 報告ページを開いたとき、買主リストに「新規作成」ボタンが表示されないこと
- 物件詳細モーダルの買主タブを開いたとき、「新規作成」ボタンが表示されること
- 報告ページで買主行をクリックしたとき、買主詳細ページへ遷移すること
