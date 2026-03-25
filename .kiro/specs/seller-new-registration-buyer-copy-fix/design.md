# 売主新規登録 買主コピー修正 Bugfix Design

## Overview

売主新規登録画面（`/sellers/new`）の「買主コピー」機能で、既存の買主番号（例: 7211）を入力すると「該当する買主が見つかりません」と表示され、バックエンドで500 Internal Server Errorが発生するバグを修正する。

根本原因は2つある：

1. **バックエンド（型不一致）**: `BuyerService.search()` が数字のみのクエリに対して `buyer_number.eq.7211`（数値）でSupabaseクエリを発行するが、`buyer_number` カラムはTEXT型のため型不一致で500エラーが発生する。

2. **フロントエンド（フィールド名不一致）**: `BuyerService.search()` が返すレスポンスのフィールド名はスネークケース（`buyer_number`）だが、フロントエンドの `buyerCopyOptions` の型定義はキャメルケース（`buyerNumber`）を期待しているため、`option.buyerNumber` が `undefined` になる。

修正方針は最小限の変更で両方の問題を解消する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 買主コピーフィールドに数字のみの買主番号を入力したとき
- **Property (P)**: 期待される正しい動作 — 該当する買主が返され、Autocompleteの選択肢に正しく表示される
- **Preservation**: 修正によって変更してはならない既存の動作（文字列検索、2文字未満の入力制限、売主コピー機能など）
- **BuyerService.search()**: `backend/src/services/BuyerService.ts` の `search` メソッド — 買主を検索して返す
- **buyerCopyOptions**: `frontend/frontend/src/pages/NewSellerPage.tsx` の状態変数 — Autocompleteの選択肢として使用される買主リスト
- **buyer_number**: `buyers` テーブルの主キー（TEXT型）— 例: `"7211"`

## Bug Details

### Bug Condition

バグは買主コピーフィールドに数字のみの買主番号（例: 7211）を入力したときに発生する。`BuyerService.search()` が数字のみのクエリを数値として扱い、TEXT型カラムとの型不一致で500エラーが発生する。さらに、バックエンドが正常にデータを返せた場合でも、フロントエンドがスネークケースのフィールド名（`buyer_number`）をキャメルケース（`buyerNumber`）として参照するため、選択肢が正しく表示されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type string (検索クエリ)
  OUTPUT: boolean

  RETURN /^\d+$/.test(input)
         AND input.length >= 2
END FUNCTION
```

### Examples

- 入力: `"7211"` → バックエンドが `buyer_number.eq.7211`（数値）でクエリ → 500エラー → 「該当する買主が見つかりません」
- 入力: `"7211"` → 仮にバックエンドが成功しても → `option.buyerNumber` が `undefined` → Autocompleteに表示されない
- 入力: `"田中"` → `ilike` 検索 → 正常動作（バグ条件に該当しない）
- 入力: `"7"` → 2文字未満のため検索自体が実行されない（バグ条件に該当しない）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 文字列を含む検索クエリ（例: 「田中」）での `ilike` 検索は引き続き動作する
- 2文字未満の入力では検索を実行しない（フロントエンドの制御）
- 売主コピー機能（`/api/sellers/search`）は今回の修正の影響を受けない
- 買主コピーで買主を選択した後、名前・電話番号・メールアドレスがフォームにコピーされる動作は維持される

**スコープ:**
数字のみのクエリ以外の全ての入力（文字列クエリ、2文字未満の入力、売主コピー操作）は今回の修正によって影響を受けない。

## Hypothesized Root Cause

根本原因は確定済みであり、以下の2点：

1. **バックエンド: Supabaseクエリの型不一致**
   - `BuyerService.search()` の `buyerNumberMatch` 変数が `/^\d+$/.test(query)` が真の場合に `buyer_number.eq.${query}` を生成する
   - Supabaseは `eq` フィルタに渡された値を数値として解釈する
   - `buyer_number` カラムはTEXT型のため、数値との比較で型不一致エラー（500）が発生する
   - **修正**: `buyer_number.eq.'${query}'` のようにシングルクォートで囲むか、`.eq('buyer_number', query)` の形式で文字列として渡す

2. **フロントエンド: フィールド名のケース不一致**
   - `BuyerService.search()` が返すレスポンスのフィールド名はスネークケース（`buyer_number`, `phone_number`）
   - `NewSellerPage.tsx` の `buyerCopyOptions` の型定義は `{buyerNumber: string; name: string}` （キャメルケース）
   - `getOptionLabel={(option) => \`${option.buyerNumber} - ${option.name}\`}` で `option.buyerNumber` が `undefined` になる
   - **修正**: フロントエンドの型定義とアクセスをスネークケースに合わせるか、バックエンドでキャメルケースに変換して返す

## Correctness Properties

Property 1: Bug Condition - 数字のみの買主番号で買主が正しく検索される

_For any_ 検索クエリ input において、`isBugCondition(input)` が true（数字のみかつ2文字以上）の場合、修正後の `BuyerService.search()` は `buyer_number` をTEXT型として正しく比較し、該当する買主のリストを返す。フロントエンドはそのレスポンスを正しく解釈し、Autocompleteの選択肢に買主番号と名前を表示する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 数字以外のクエリでの既存動作が維持される

_For any_ 検索クエリ input において、`isBugCondition(input)` が false（文字列を含む、または2文字未満）の場合、修正後のコードは修正前のコードと同じ動作をする。具体的には、文字列クエリでは `ilike` 検索が実行され、2文字未満では検索が実行されない。

**Validates: Requirements 3.1, 3.2, 3.4**

## Fix Implementation

### Changes Required

**修正1: バックエンド**

**File**: `backend/src/services/BuyerService.ts`

**Function**: `search()`

**Specific Changes**:
1. **型不一致の修正**: 数字のみのクエリに対して `buyer_number.eq.${query}` ではなく、Supabaseの `.eq()` メソッドを使って文字列として渡す形式に変更する

現在のコード（問題箇所）:
```typescript
const buyerNumberMatch = /^\d+$/.test(query)
  ? `buyer_number.eq.${query}`
  : `buyer_number.ilike.%${query}%`;
```

修正後のコード:
```typescript
const buyerNumberMatch = /^\d+$/.test(query)
  ? `buyer_number.eq.${query}`  // ← この形式はTEXT型に対して数値比較になる
  : `buyer_number.ilike.%${query}%`;
```

→ `.or()` の文字列フィルタ形式では型を明示できないため、数字クエリの場合は別途 `.eq()` を使う方式に変更する。

**修正2: フロントエンド**

**File**: `frontend/frontend/src/pages/NewSellerPage.tsx`

**Specific Changes**:
1. **型定義の修正**: `buyerCopyOptions` の型を `{buyerNumber: string; name: string}` から `{buyer_number: string; name: string}` に変更する
2. **参照箇所の修正**: `option.buyerNumber` を `option.buyer_number` に変更する（`getOptionLabel`、`isOptionEqualToValue`、`handleBuyerCopySelect`）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する。まず修正前のコードでバグを再現するテストを書き、次に修正後のコードで正しく動作することを確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: 数字のみのクエリ（例: `"7211"`）で `BuyerService.search()` を呼び出し、Supabaseが500エラーを返すことを確認する。

**Test Cases**:
1. **数字のみの買主番号検索**: `search("7211")` を呼び出し → 500エラーが発生することを確認（修正前のコードで失敗）
2. **4桁の数字**: `search("1234")` を呼び出し → 500エラーが発生することを確認（修正前のコードで失敗）
3. **5桁の数字**: `search("12345")` を呼び出し → 500エラーが発生することを確認（修正前のコードで失敗）
4. **フロントエンドのフィールド名**: APIレスポンスの `buyer_number` フィールドを `option.buyerNumber` でアクセス → `undefined` になることを確認

**Expected Counterexamples**:
- `search("7211")` が500エラーを返す（Supabaseの型不一致）
- `option.buyerNumber` が `undefined` になる（フィールド名の不一致）

### Fix Checking

**Goal**: 修正後のコードで、バグ条件に該当する入力が正しく処理されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := BuyerService_fixed.search(input)
  ASSERT result is array (not error)
  ASSERT result[0].buyer_number is string
  ASSERT option.buyer_number is accessible (not undefined)
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件に該当しない入力が修正前と同じ動作をすることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT BuyerService_original.search(input) = BuyerService_fixed.search(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な文字列クエリを自動生成して既存動作が維持されることを確認できる
- 手動テストでは見落としがちなエッジケースを検出できる

**Test Cases**:
1. **文字列クエリの保持**: `search("田中")` が修正前後で同じ結果を返すことを確認
2. **混合クエリの保持**: `search("田中123")` が修正前後で同じ結果を返すことを確認
3. **売主コピー機能への影響なし**: `/api/sellers/search` エンドポイントが引き続き正常動作することを確認

### Unit Tests

- 数字のみのクエリで `BuyerService.search()` が正しくTEXT型比較を行うことをテスト
- 文字列クエリで `ilike` 検索が引き続き動作することをテスト
- フロントエンドの `buyerCopyOptions` 型定義が `buyer_number` フィールドを正しく参照することをテスト

### Property-Based Tests

- ランダムな数字文字列（2〜10桁）を生成し、`BuyerService.search()` が500エラーを返さないことを確認
- ランダムな文字列クエリを生成し、修正前後で同じ動作をすることを確認
- 様々な買主番号形式で検索し、レスポンスの `buyer_number` フィールドが常に文字列であることを確認

### Integration Tests

- 売主新規登録画面で買主番号（例: 7211）を入力し、Autocompleteに選択肢が表示されることを確認
- 買主を選択後、名前・電話番号・メールアドレスがフォームにコピーされることを確認
- 文字列クエリ（例: 「田中」）でも引き続き検索できることを確認
