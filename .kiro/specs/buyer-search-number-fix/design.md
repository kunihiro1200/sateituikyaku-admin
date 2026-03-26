# buyer-search-number-fix バグ修正設計

## Overview

買主詳細画面（BuyerDetailPage）のヘッダーにある買主番号検索バーで、買主番号を入力してEnterキーを押しても遷移しないバグを修正する。

根本原因は `handleNavigate` 関数が `/buyers/:id` への遷移でも必須フィールドのバリデーションチェックを実行し、未入力フィールドがある場合に遷移をブロックすることにある。修正方針は、検索バーの `onKeyDown` ハンドラーで `handleNavigate` の代わりに `navigate` を直接呼び出すことで、バリデーションチェックをバイパスする。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 必須フィールドが未入力の状態で検索バーに買主番号を入力してEnterキーを押す
- **handleNavigate**: バリデーションチェックを行い、必須フィールドが未入力の場合は遷移をブロックする関数
- **navigate**: React Routerの遷移関数。バリデーションチェックなしで直接遷移する
- **toHalfWidth**: 全角数字（０-９）を半角数字（0-9）に変換するユーティリティ関数（既に実装済み）
- **buyerNumberSearch**: 検索バーの入力値を保持するReactステート

## Bug Details

### Bug Condition

```
FUNCTION isBugCondition(X)
  INPUT: X of type { key: string, searchValue: string, hasMissingRequiredFields: boolean }
  OUTPUT: boolean

  RETURN X.key = 'Enter'
         AND X.searchValue.trim() ≠ ''
         AND X.hasMissingRequiredFields = true
END FUNCTION
```

### Root Cause

現在の `onKeyDown` ハンドラー:

```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter' && buyerNumberSearch.trim()) {
    handleNavigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
  }
}}
```

`handleNavigate` の実装:

```typescript
const handleNavigate = (url: string) => {
  if (url.includes('/desired-conditions')) {
    navigate(url);
    return;
  }
  const missing = checkMissingFields();
  if (missing.length > 0) {
    setPendingNavigationUrl(url);
    setPendingMissingLabels(missing);
    setValidationDialogOpen(true);  // ← ここでブロックされる
  } else {
    navigate(url);
  }
};
```

`/buyers/:id` への遷移は `/desired-conditions` を含まないため、バリデーションチェックが実行される。必須フィールドが未入力の場合、ダイアログが表示されて遷移がブロックされる。

## Expected Behavior

### Fix

検索バーの `onKeyDown` ハンドラーで `handleNavigate` の代わりに `navigate` を直接呼び出す。

```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter' && buyerNumberSearch.trim()) {
    navigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
  }
}}
```

これにより：
- 半角数字入力時: そのまま `/buyers/{番号}` へ遷移
- 全角数字入力時: `toHalfWidth` で変換後 `/buyers/{番号}` へ遷移
- バリデーションチェックはスキップ（別の買主への遷移なので不要）

### Preservation Requirements

- 検索バーが空の状態でEnterキーを押してもナビゲーションを実行しない（`buyerNumberSearch.trim()` が空文字の場合）
- クリアボタンの動作は変更しない
- 他のナビゲーション（買主一覧、希望条件ページなど）のバリデーション動作は変更しない

## Correctness Properties

Property 1: Fix Checking - 必須フィールド未入力時でも検索バーから遷移できる

_For all_ 入力において、必須フィールドが未入力の状態で検索バーに買主番号を入力してEnterキーを押した場合（isBugCondition が true を返す場合）、修正後のハンドラーはバリデーションチェックをスキップして `/buyers/{変換後の番号}` へ直接遷移する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation Checking - 空入力・クリアボタン・他のナビゲーションの動作維持

_For all_ 入力において、バグ条件が成立しない場合（空入力、Enterキー以外、クリアボタン）、修正後のコードは修正前と完全に同じ動作を行う。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Specific Change**: 検索バー `TextField` の `onKeyDown` ハンドラーで `handleNavigate` を `navigate` に変更する

```typescript
// 変更前
onKeyDown={(e) => {
  if (e.key === 'Enter' && buyerNumberSearch.trim()) {
    handleNavigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
  }
}}

// 変更後
onKeyDown={(e) => {
  if (e.key === 'Enter' && buyerNumberSearch.trim()) {
    navigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
  }
}}
```

**変更量**: 1行のみ（`handleNavigate` → `navigate`）
