# buyer-email-search-bug Bugfix Design

## Overview

買主リストの検索バーでメールアドレス検索ができないバグの修正。

`backend/src/services/BuyerService.ts` の `getAll()` メソッドにおいて、検索クエリの `or()` 条件に `email` フィールドが含まれていないため、キャッシュなし状態（初回ロード時など）でメールアドレスを検索しても該当する買主が表示されない。

修正は1行のみ：`or()` の条件文字列に `email.ilike.%${search}%` を追加する。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 - キャッシュなし状態でメールアドレスを検索クエリとして渡した場合
- **Property (P)**: 期待される動作 - emailフィールドを含む部分一致検索が実行され、該当する買主が返される
- **Preservation**: 修正によって変更してはならない既存動作 - 買主番号・氏名・電話番号・物件番号の検索動作
- **getAll()**: `backend/src/services/BuyerService.ts` の検索・ページネーション処理を担うメソッド
- **isBuyerNumber**: 4〜5桁の数字かどうかを判定する正規表現 `/^\d{4,5}$/`

## Bug Details

### Bug Condition

バグは、キャッシュなし状態で買主リストの検索バーにメールアドレスを入力したときに発生する。`getAll()` メソッドの `or()` 条件に `email` フィールドが含まれていないため、メールアドレスに一致する買主が返されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { search: string }
  OUTPUT: boolean

  RETURN input.search IS NOT NULL
         AND NOT /^\d{4,5}$/.test(input.search)
         AND input.search CONTAINS "@" OR looksLikeEmail(input.search)
         AND emailMatchExists(input.search, buyers)
END FUNCTION
```

### Examples

- `search = "test@example.com"` → 期待: 該当買主が返る / 実際: 0件（emailが検索対象外）
- `search = "example.com"` → 期待: emailにexample.comを含む買主が返る / 実際: 0件
- `search = "田中"` → 期待: 氏名に田中を含む買主が返る / 実際: 正常に返る（影響なし）
- `search = "12345"` → 期待: 買主番号12345の完全一致 / 実際: 正常に返る（影響なし）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- 4〜5桁の数字入力時は `buyer_number` の完全一致検索を行う
- 氏名（`name`）の部分一致検索が正常に動作する
- 電話番号（`phone_number`）の部分一致検索が正常に動作する
- 物件番号（`property_number`）の部分一致検索が正常に動作する
- キャッシュ済み状態でのフロントエンドのローカルフィルタリングは影響を受けない

**スコープ:**
メールアドレス以外の検索入力（買主番号・氏名・電話番号・物件番号）はこの修正によって一切影響を受けない。変更箇所は `or()` の条件文字列に `email.ilike.%${search}%` を追加する1箇所のみ。

## Hypothesized Root Cause

バグの原因は明確：

1. **検索フィールドの追加漏れ**: `getAll()` 実装時に `email` フィールドが `or()` 条件に含められなかった
   - `buyer_number`, `name`, `phone_number`, `property_number` は含まれている
   - `email` のみ欠落している

2. **フロントエンドとバックエンドの不一致**: フロントエンドのローカルフィルタリングではemailが検索対象に含まれているが、バックエンドのDBクエリには含まれていない。キャッシュ済み状態では正常に動作するため、バグが見落とされやすかった。

## Correctness Properties

Property 1: Bug Condition - メールアドレス検索で買主が返される

_For any_ 検索入力がメールアドレス形式（または `@` を含む文字列）であり、かつ対応する買主がDBに存在する場合、修正後の `getAll()` は該当する買主を返す。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存検索フィールドの動作が変わらない

_For any_ 検索入力がメールアドレス以外（買主番号・氏名・電話番号・物件番号）である場合、修正後の `getAll()` は修正前と同一の結果を返す。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerService.ts`

**Function**: `getAll()`

**Specific Changes**:

1. **emailフィールドの追加**: `or()` の条件文字列に `email.ilike.%${search}%` を追加する

**修正前:**
```typescript
query = query.or(
  `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,property_number.ilike.%${search}%`
);
```

**修正後:**
```typescript
query = query.or(
  `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,property_number.ilike.%${search}%`
);
```

変更箇所は1行のみ。他のロジックへの影響はない。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現し、次に修正後の動作と既存動作の保持を確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `getAll()` に `search` パラメータとしてメールアドレスを渡し、返却結果が0件になることを確認する。

**Test Cases**:
1. **メールアドレス完全一致テスト**: `search = "test@example.com"` で既存買主を検索 → 0件になることを確認（未修正コードで失敗）
2. **メールドメイン部分一致テスト**: `search = "example.com"` で検索 → 0件になることを確認（未修正コードで失敗）
3. **メールローカルパート検索テスト**: `search = "testuser"` でメールのローカルパートを検索 → 0件になることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- emailを含む買主が存在するにもかかわらず0件が返される
- 原因: `or()` 条件に `email.ilike` が含まれていない

### Fix Checking

**Goal**: 修正後、メールアドレス検索で正しく買主が返されることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getAll_fixed({ search: input.search })
  ASSERT result.data.length > 0
  ASSERT result.data.every(buyer => buyer.email.includes(input.search))
END FOR
```

### Preservation Checking

**Goal**: 修正後、既存の検索フィールド（買主番号・氏名・電話番号・物件番号）の動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getAll_original(input) = getAll_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。様々な検索文字列を自動生成し、修正前後で結果が一致することを確認する。

**Test Cases**:
1. **買主番号検索の保持**: 4〜5桁の数字で検索し、完全一致動作が変わらないことを確認
2. **氏名検索の保持**: 氏名の部分文字列で検索し、結果が変わらないことを確認
3. **電話番号検索の保持**: 電話番号の部分文字列で検索し、結果が変わらないことを確認
4. **物件番号検索の保持**: 物件番号の部分文字列で検索し、結果が変わらないことを確認

### Unit Tests

- `search` にメールアドレスを渡した際、生成されるクエリに `email.ilike` が含まれることを確認
- `search` が4〜5桁の数字の場合、`eq('buyer_number', search)` が使われることを確認（変更なし）
- `search` が氏名・電話番号・物件番号の場合、既存の `or()` 条件が維持されることを確認

### Property-Based Tests

- ランダムなメールアドレス文字列を生成し、修正後のクエリに `email.ilike` が含まれることを検証
- ランダムな非メールアドレス文字列（氏名・電話番号など）を生成し、修正前後でクエリ条件が同一であることを検証
- 多様な検索文字列パターンで、修正が既存フィールドの検索動作に影響しないことを検証

### Integration Tests

- メールアドレスで検索した際に実際のDBから正しい買主が返されることを確認
- 修正後も買主番号・氏名・電話番号・物件番号での検索が正常に動作することを確認
- `search` パラメータなしの場合（全件取得）が影響を受けないことを確認
