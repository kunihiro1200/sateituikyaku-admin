# 物件リスト検索バー全角対応 バグ修正デザイン

## Overview

物件リスト（`PropertyListingsPage.tsx`）の検索バーにおいて、全角文字（全角英数字・全角カタカナ・全角英字）で入力しても検索結果が0件になるバグを修正する。

現在の実装では `toLowerCase()` のみが適用されており、全角→半角の正規化処理が欠如している。`String.prototype.normalize('NFKC')` を検索クエリと検索対象フィールドの両方に適用することで、全角・半角を区別せず検索できるようにする。

## Glossary

- **Bug_Condition (C)**: 検索クエリに全角文字（全角英数字・全角カタカナ・全角英字）が含まれる条件
- **Property (P)**: 全角文字を正規化した後の検索結果が、対応する半角文字で検索した場合と同一になること
- **Preservation**: 半角英数字・ひらがな・漢字での既存の検索動作が修正後も変わらないこと
- **filteredListings**: `PropertyListingsPage.tsx` 内の `useMemo` フックで定義された、検索クエリとサイドバーフィルターを適用した物件リスト
- **NFKC正規化**: Unicode正規化形式の一つ。全角英数字・全角カタカナを対応する半角文字に変換する（例：「Ａ」→「A」、「１」→「1」、「ア」→「ｱ」）
- **searchQuery**: 検索バーに入力されたテキスト（`useState` で管理）

## Bug Details

### Bug Condition

検索バーに全角文字が入力された場合、`filteredListings` 内の検索ロジックが `toLowerCase()` のみを適用するため、全角文字と半角文字が一致しない。その結果、全角文字を含む検索クエリでは対応する物件がヒットしない。

**Formal Specification:**
```
FUNCTION isBugCondition(searchQuery)
  INPUT: searchQuery of type string
  OUTPUT: boolean

  RETURN searchQuery に全角英数字・全角カタカナ・全角英字が1文字以上含まれる
         AND normalize('NFKC') を適用していない
END FUNCTION
```

### Examples

- 「ＡＡ１２３４５」で検索 → 結果0件（期待値：「AA12345」と同じ結果）
- 「アイウ」で検索 → 結果0件（期待値：「ｱｲｳ」と同じ結果）
- 「ＡＢＣ」で検索 → 結果0件（期待値：「ABC」と同じ結果）
- 「１２３」で検索 → 結果0件（期待値：「123」と同じ結果）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 半角英数字（例：「AA12345」「123」）での検索は引き続き正常に動作すること
- 日本語（ひらがな・漢字）での検索は引き続き正常に動作すること
- 検索クエリが空の場合は全件表示されること
- サイドバーフィルターが選択されている状態での検索動作が変わらないこと

**スコープ:**
全角文字を含まない入力（半角英数字・ひらがな・漢字）はこの修正の影響を受けない。NFKC正規化はこれらの文字に対して変換を行わないため、既存の動作は完全に保持される。

## Hypothesized Root Cause

バグの根本原因は `filteredListings` 内の以下のコードにある：

```typescript
const query = searchQuery.toLowerCase();
listings = listings.filter(l =>
  l.property_number?.toLowerCase().includes(query) ||
  l.address?.toLowerCase().includes(query) ||
  l.seller_name?.toLowerCase().includes(query) ||
  l.seller_email?.toLowerCase().includes(query) ||
  l.buyer_name?.toLowerCase().includes(query)
);
```

1. **正規化処理の欠如**: `searchQuery` に `normalize('NFKC')` が適用されていないため、全角文字がそのまま比較に使われる
2. **検索対象フィールドの正規化欠如**: `l.property_number` 等のフィールド値にも `normalize('NFKC')` が適用されていないため、フィールド値に半角文字が含まれていても全角クエリとマッチしない
3. **`toLowerCase()` のみでは不十分**: 大文字・小文字の正規化は行われているが、全角・半角の正規化は行われていない

## Correctness Properties

Property 1: Bug Condition - 全角文字での検索が対応する半角文字と同じ結果を返す

_For any_ 検索クエリに全角文字が含まれる入力（isBugCondition が true を返す）において、修正後の `filteredListings` は、その全角文字を NFKC 正規化した半角文字で検索した場合と同一の結果を返すこと。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 全角文字を含まない入力での検索動作が変わらない

_For any_ 検索クエリに全角文字が含まれない入力（isBugCondition が false を返す）において、修正後の `filteredListings` は修正前と完全に同一の結果を返すこと。半角英数字・ひらがな・漢字・空クエリでの動作は一切変化しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

**Function**: `filteredListings`（`useMemo` 内）

**Specific Changes**:

1. **正規化ヘルパー関数の追加**: コンポーネント外（またはファイル先頭）に正規化関数を定義する
   ```typescript
   // 全角→半角の正規化（NFKC）+ 小文字化
   const normalizeText = (text: string): string =>
     text.normalize('NFKC').toLowerCase();
   ```

2. **検索クエリの正規化**: `searchQuery.toLowerCase()` を `normalizeText(searchQuery)` に変更する

3. **検索対象フィールドの正規化**: 各フィールドの `.toLowerCase()` を `normalizeText(...)` に変更する

**修正前:**
```typescript
const query = searchQuery.toLowerCase();
listings = listings.filter(l =>
  l.property_number?.toLowerCase().includes(query) ||
  l.address?.toLowerCase().includes(query) ||
  l.seller_name?.toLowerCase().includes(query) ||
  l.seller_email?.toLowerCase().includes(query) ||
  l.buyer_name?.toLowerCase().includes(query)
);
```

**修正後:**
```typescript
const query = normalizeText(searchQuery);
listings = listings.filter(l =>
  (l.property_number ? normalizeText(l.property_number) : '').includes(query) ||
  (l.address ? normalizeText(l.address) : '').includes(query) ||
  (l.seller_name ? normalizeText(l.seller_name) : '').includes(query) ||
  (l.seller_email ? normalizeText(l.seller_email) : '').includes(query) ||
  (l.buyer_name ? normalizeText(l.buyer_name) : '').includes(query)
);
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグが再現することを確認し、根本原因分析を検証する。

**Test Plan**: `normalizeText` 関数を使わない現在の実装に対して、全角文字を含む検索クエリでフィルタリングを実行し、結果が0件になることを確認する。

**Test Cases**:
1. **全角英数字テスト**: 物件番号「AA12345」を持つ物件に対して「ＡＡ１２３４５」で検索 → 0件になることを確認（未修正コードで失敗）
2. **全角カタカナテスト**: 売主名「アイウ商事」を持つ物件に対して「アイウ」で検索 → 0件になることを確認（未修正コードで失敗）
3. **全角英字テスト**: 所在地「ABC町」を持つ物件に対して「ＡＢＣ」で検索 → 0件になることを確認（未修正コードで失敗）
4. **混在テスト**: 「ＡＡ12345」（全角・半角混在）で検索 → 0件になることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- 全角文字を含むクエリでは `includes()` が false を返し、フィルタリングで全件除外される
- 原因：`toLowerCase()` は全角・半角の変換を行わないため、「Ａ」と「A」は一致しない

### Fix Checking

**Goal**: 修正後のコードで、全角文字を含む検索クエリが正しく動作することを検証する。

**Pseudocode:**
```
FOR ALL searchQuery WHERE isBugCondition(searchQuery) DO
  result := filteredListings_fixed(searchQuery, listings)
  expected := filteredListings_fixed(normalize(searchQuery), listings)
  ASSERT result = expected
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、全角文字を含まない検索クエリの動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL searchQuery WHERE NOT isBugCondition(searchQuery) DO
  ASSERT filteredListings_original(searchQuery) = filteredListings_fixed(searchQuery)
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される理由：
- 半角英数字・ひらがな・漢字など多様な入力パターンを自動生成できる
- NFKC正規化が変換しない文字（ひらがな・漢字）に対して副作用がないことを網羅的に確認できる
- エッジケース（空文字・記号・混在文字列）を自動的にカバーできる

**Test Cases**:
1. **半角英数字保持テスト**: 「AA12345」「123」での検索結果が修正前後で同一であることを確認
2. **日本語保持テスト**: 「東京都」「田中」などのひらがな・漢字での検索結果が修正前後で同一であることを確認
3. **空クエリ保持テスト**: 空文字列での検索が全件返すことを確認
4. **サイドバーフィルター組み合わせテスト**: サイドバーフィルター選択中に半角クエリで検索した場合の動作が変わらないことを確認

### Unit Tests

- `normalizeText` 関数の単体テスト（全角英数字・全角カタカナ・全角英字の変換を確認）
- 全角クエリで対応する物件がヒットすることを確認
- 半角クエリの動作が修正前後で変わらないことを確認
- 空クエリで全件返すことを確認

### Property-Based Tests

- ランダムな半角英数字クエリを生成し、修正前後で同一結果になることを検証（Preservation）
- ランダムな全角英数字クエリを生成し、対応する半角クエリと同一結果になることを検証（Bug Condition）
- ランダムなひらがな・漢字クエリを生成し、NFKC正規化が影響しないことを検証

### Integration Tests

- 実際の物件リストページで全角文字を検索バーに入力し、対応する物件が表示されることを確認
- サイドバーフィルターを選択した状態で全角文字を検索し、正しく動作することを確認
- 全角・半角混在クエリ（例：「ＡＡ12345」）での検索が正しく動作することを確認
