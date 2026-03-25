# buyer-search-zenkaku-fix バグ修正設計

## Overview

買主詳細画面のヘッダーにある買主番号検索バーで、全角数字（例：「４３７０」）を入力してEnterキーを押しても正しい買主詳細画面に遷移できないバグを修正する。

`buyer_number` カラムはTEXT型で半角数字（例：「4370」）として保存されているため、全角数字のままURLパラメータとして使用すると一致しない。修正方針は、`BuyerDetailPage.tsx` の検索バー `onKeyDown` ハンドラーで、入力値を半角数字に変換してからナビゲーションする。バックエンドの変更は不要。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 全角数字（０-９）を含む文字列を検索バーに入力してEnterキーを押す
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作 — 全角数字を半角数字に変換した上でナビゲーションを実行する
- **Preservation**: 修正によって変更してはならない既存の動作 — 半角数字入力時の検索、クリアボタン、空入力時の無操作
- **handleKeyDown**: `BuyerDetailPage.tsx` の検索バー `TextField` に設定された `onKeyDown` ハンドラー。Enterキー押下時に `navigate()` を呼び出す
- **toHalfWidth**: 全角数字（０-９）を半角数字（0-9）に変換するユーティリティ関数（新規追加予定）
- **buyerNumberSearch**: 検索バーの入力値を保持するReactステート

## Bug Details

### Bug Condition

全角数字を含む文字列が検索バーに入力された状態でEnterキーが押されると、`handleKeyDown` ハンドラーは変換処理を行わずそのままの値でナビゲーションを実行する。`buyer_number` は半角数字で保存されているため、全角数字のURLパラメータでは一致しない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { key: string, searchValue: string }
  OUTPUT: boolean

  RETURN input.key = 'Enter'
         AND input.searchValue.trim() ≠ ''
         AND input.searchValue CONTAINS_ANY ['０','１','２','３','４','５','６','７','８','９']
END FUNCTION
```

### Examples

- 入力「４３７０」→ Enter → `/buyers/４３７０` へ遷移 → 買主が見つからない（バグあり）
- 入力「１２３４５」→ Enter → `/buyers/１２３４５` へ遷移 → 買主が見つからない（バグあり）
- 入力「4370」→ Enter → `/buyers/4370` へ遷移 → 正常表示（バグなし）
- 入力「」→ Enter → ナビゲーション実行しない（バグなし）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 半角数字（例：「4370」）を入力してEnterキーを押した場合、そのまま `/buyers/4370` へ遷移する
- 検索バーのクリアボタン（ClearIcon）をクリックすると `buyerNumberSearch` がクリアされる
- 検索バーが空の状態でEnterキーを押してもナビゲーションを実行しない

**スコープ:**
全角数字を含まない入力（半角数字のみ、空文字）に対しては、修正前と完全に同じ動作を維持する。

## Hypothesized Root Cause

現在の `onKeyDown` ハンドラーの実装:

```typescript
onKeyDown={(e) => {
  if (e.key === 'Enter' && buyerNumberSearch.trim()) {
    navigate(`/buyers/${buyerNumberSearch.trim()}`);
  }
}}
```

**根本原因**: `buyerNumberSearch.trim()` の値をそのままURLに使用しており、全角→半角の変換処理が存在しない。

1. **変換処理の欠如**: 全角数字（０-９）を半角数字（0-9）に変換するロジックが実装されていない
2. **入力値の直接使用**: ユーザーが入力した値を変換せずにそのままナビゲーションに使用している
3. **バックエンド側での対応なし**: バックエンドは半角数字のみを想定しており、全角数字のルックアップは行っていない

## Correctness Properties

Property 1: Bug Condition - 全角数字入力時の自動変換ナビゲーション

_For any_ 入力において、全角数字（０-９）を含む文字列が検索バーに入力されてEnterキーが押された場合（isBugCondition が true を返す場合）、修正後の handleKeyDown は全角数字を対応する半角数字（0-9）に変換した上で `/buyers/{変換後の値}` へナビゲーションを実行する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 半角数字入力時の動作維持

_For any_ 入力において、全角数字を含まない文字列（半角数字のみ、または空文字）が検索バーに入力された場合（isBugCondition が false を返す場合）、修正後の handleKeyDown は修正前と完全に同じ動作を行い、既存の検索・クリア・空入力時の無操作の挙動を維持する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Specific Changes**:

1. **全角→半角変換関数の追加**: コンポーネント外（またはファイル上部）に `toHalfWidth` 関数を追加する
   ```typescript
   // 全角数字を半角数字に変換する
   const toHalfWidth = (str: string): string => {
     return str.replace(/[０-９]/g, (ch) =>
       String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
     );
   };
   ```

2. **onKeyDown ハンドラーの修正**: `navigate()` 呼び出し前に `toHalfWidth()` を適用する
   ```typescript
   onKeyDown={(e) => {
     if (e.key === 'Enter' && buyerNumberSearch.trim()) {
       navigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
     }
   }}
   ```

**変更箇所の特定:**
- `toHalfWidth` 関数: `BUYER_FIELD_SECTIONS` 定数定義の前あたりに追加
- `onKeyDown` ハンドラー: 検索バー `TextField` の `onKeyDown` プロップ（現在 `navigate` を直接呼び出している箇所）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず修正前のコードでバグを再現するテストを書いてバグの存在を確認し、次に修正後のコードでバグが解消されかつ既存動作が維持されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `onKeyDown` ハンドラーのロジックを単体でテストし、全角数字入力時に変換なしでナビゲーションが呼ばれることを確認する。修正前のコードで実行して失敗を観察する。

**Test Cases**:
1. **全角数字のみ**: 「４３７０」を入力してEnterキーをシミュレート → `navigate('/buyers/４３７０')` が呼ばれる（修正前は変換されない）
2. **全角数字を含む文字列**: 「１２３４５」を入力してEnterキーをシミュレート → `navigate('/buyers/１２３４５')` が呼ばれる（修正前は変換されない）
3. **半角数字**: 「4370」を入力してEnterキーをシミュレート → `navigate('/buyers/4370')` が呼ばれる（修正前後で同じ）

**Expected Counterexamples**:
- 全角数字入力時、`navigate` に渡される値が半角変換されていない
- 原因: `toHalfWidth` 変換処理が存在しない

### Fix Checking

**Goal**: 修正後のコードで、全角数字入力時に正しく半角変換されてナビゲーションが実行されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleKeyDown_fixed(input)
  ASSERT navigate が '/buyers/' + toHalfWidth(input.searchValue.trim()) で呼ばれた
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、全角数字を含まない入力に対して修正前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleKeyDown_original(input) = handleKeyDown_fixed(input)
END FOR
```

**Testing Approach**: `toHalfWidth` 関数は純粋関数であるため、プロパティベーステストで多数の入力を生成して検証するのに適している。

**Test Cases**:
1. **半角数字の保持**: 半角数字のみの文字列は変換後も同じ値になることを確認
2. **空文字の保持**: 空文字は変換後も空文字のままであることを確認
3. **Enterキー以外の無視**: Enterキー以外のキーイベントではナビゲーションが実行されないことを確認

### Unit Tests

- `toHalfWidth('４３７０')` → `'4370'` を返すことを確認
- `toHalfWidth('4370')` → `'4370'` を返すことを確認（半角は変換しない）
- `toHalfWidth('')` → `''` を返すことを確認
- `toHalfWidth('１２３４５６７８９０')` → `'1234567890'` を返すことを確認
- Enterキー押下時に `toHalfWidth` が適用された値で `navigate` が呼ばれることを確認
- 空文字入力時にEnterキーを押しても `navigate` が呼ばれないことを確認

### Property-Based Tests

- ランダムな半角数字文字列に対して `toHalfWidth` を適用しても値が変わらないことを確認（Preservation）
- 全角数字（０-９）の各文字が対応する半角数字（0-9）に変換されることを確認（Fix）
- `toHalfWidth` の冪等性: `toHalfWidth(toHalfWidth(x)) = toHalfWidth(x)` を確認

### Integration Tests

- 全角数字「４３７０」を検索バーに入力してEnterキーを押すと、`/buyers/4370` へ遷移することを確認
- 半角数字「4370」を検索バーに入力してEnterキーを押すと、`/buyers/4370` へ遷移することを確認（既存動作の維持）
- クリアボタンをクリックすると検索バーがクリアされることを確認（既存動作の維持）
