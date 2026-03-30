# sidebar-today-call-combined-label バグ修正設計

## Overview

売主リストの通話モードページのサイドバー「当日TEL（内容）」カテゴリで、複数のコミュニケーション情報がある場合に1つしか表示されないバグを修正する。

現在の `getTodayCallWithInfoLabel()` 関数は優先順位に従って最初に見つかった1つの値のみを返す実装になっているが、正しくは全ての有効なコミュニケーション情報を `・` で結合して返すべきである。

修正対象: `frontend/frontend/src/utils/sellerStatusFilters.ts` の `getTodayCallWithInfoLabel()` 関数

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — コミュニケーション情報の複数フィールドに値が入力されている場合に、1つしか表示されない
- **Property (P)**: 期待される正しい動作 — 全ての有効なコミュニケーション情報を `・` で結合して表示する
- **Preservation**: 修正によって変更してはいけない既存の動作 — 1フィールドのみ入力の場合の表示、フォールバック表示、判定ロジック
- **getTodayCallWithInfoLabel()**: `frontend/frontend/src/utils/sellerStatusFilters.ts` 内の関数。売主データからコミュニケーション情報を取得し、サイドバーの「当日TEL（内容）」ラベルを生成する
- **isTodayCallWithInfo()**: コミュニケーション情報のいずれかに入力があるかどうかを判定する関数（修正対象外）
- **phone_contact_person**: 電話担当フィールド（表示順: 1番目）
- **preferred_contact_time**: 連絡取りやすい時間フィールド（表示順: 2番目）
- **contact_method**: 連絡方法フィールド（表示順: 3番目）

## Bug Details

### Bug Condition

バグは `phone_contact_person`、`preferred_contact_time`、`contact_method` のうち2つ以上のフィールドに値が入力されている場合に発生する。現在の実装は優先順位（`contact_method` > `preferred_contact_time` > `phone_contact_person`）に従って最初に見つかった1つの値のみを返し、残りの情報を無視する。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  contactMethod       := seller.contactMethod OR seller.contact_method OR ''
  preferredContactTime := seller.preferredContactTime OR seller.preferred_contact_time OR ''
  phoneContactPerson  := seller.phoneContactPerson OR seller.phone_contact_person OR ''

  isValid(v) := v != '' AND v.trim() != '' AND v.trim().toLowerCase() != 'null'

  validCount := COUNT(v IN [contactMethod, preferredContactTime, phoneContactPerson] WHERE isValid(v))

  RETURN validCount >= 2
END FUNCTION
```

### Examples

- **例1（バグ発生）**: `phone_contact_person = "I"`、`contact_method = "Eメール"` の両方に値がある場合
  - 現在（バグ）: `当日TEL(Eメール)` — `phone_contact_person` が無視される
  - 期待値: `当日TEL(I・Eメール)`

- **例2（バグ発生）**: `phone_contact_person = "Y"`、`preferred_contact_time = "午前中"` の両方に値がある場合
  - 現在（バグ）: `当日TEL(午前中)` — `phone_contact_person` が無視される
  - 期待値: `当日TEL(Y・午前中)`

- **例3（バグ発生）**: 3フィールド全てに値がある場合（`phone_contact_person = "I"`、`preferred_contact_time = "午前中"`、`contact_method = "Eメール"`）
  - 現在（バグ）: `当日TEL(Eメール)` — 2フィールドが無視される
  - 期待値: `当日TEL(I・午前中・Eメール)`

- **例4（バグなし）**: `contact_method = "Eメール"` のみに値がある場合
  - 現在: `当日TEL(Eメール)`
  - 期待値: `当日TEL(Eメール)` — 変化なし

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `contact_method` のみに値がある場合: `当日TEL(Eメール)` のように表示する（要件 3.1）
- `preferred_contact_time` のみに値がある場合: `当日TEL(午前中)` のように表示する（要件 3.2）
- `phone_contact_person` のみに値がある場合: `当日TEL(Y)` のように表示する（要件 3.3）
- コミュニケーション情報フィールドが全て空の場合: `当日TEL（内容）` をフォールバックとして表示する（要件 3.4）
- `isTodayCallWithInfo()` の判定ロジック（コミュニケーション情報のいずれかに入力があるかどうか）は変更しない（要件 3.5）
- サイドバーの「当日TEL（内容）」カテゴリへの売主の振り分けロジックは変更しない（要件 3.6）

**スコープ:**
`getTodayCallWithInfoLabel()` 関数のみを修正する。`isTodayCallWithInfo()`、`isTodayCall()`、`hasContactInfo()`、`getCategoryCounts()`、`filterSellersByCategory()` などの他の関数は一切変更しない。

## Hypothesized Root Cause

現在の実装は以下のように優先順位チェーンで最初に見つかった値のみを返している:

```typescript
// 現在の実装（バグあり）
if (isValid(contactMethod)) {
  return `当日TEL(${contactMethod})`;
}
if (isValid(preferredContactTime)) {
  return `当日TEL(${preferredContactTime})`;
}
if (isValid(phoneContactPerson)) {
  return `当日TEL(${phoneContactPerson})`;
}
return '当日TEL（内容）';
```

**根本原因**: 関数の設計が「優先順位で1つだけ返す」という仕様で実装されており、複数の値を結合して返すという要件が考慮されていなかった。

## Correctness Properties

Property 1: Bug Condition - 複数コミュニケーション情報の結合表示

_For any_ 売主データで2つ以上のコミュニケーション情報フィールドに有効な値が入力されている場合（isBugCondition が true を返す場合）、修正後の `getTodayCallWithInfoLabel()` 関数は全ての有効な値を表示順（電話担当・連絡取りやすい時間・連絡方法）で `・` 区切りで結合した `当日TEL(値1・値2)` または `当日TEL(値1・値2・値3)` の形式のラベルを返す。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 単一コミュニケーション情報の表示

_For any_ 売主データでコミュニケーション情報フィールドのうち1つだけに有効な値が入力されている場合（isBugCondition が false を返す場合）、修正後の `getTodayCallWithInfoLabel()` 関数は修正前と同じ `当日TEL(値)` の形式のラベルを返す。

**Validates: Requirements 2.5, 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/utils/sellerStatusFilters.ts`

**Function**: `getTodayCallWithInfoLabel()`

**Specific Changes**:

1. **ロジックの変更**: 優先順位チェーンで最初の値のみを返す実装から、全ての有効な値を配列に収集して `・` で結合する実装に変更する

2. **表示順の定義**: 電話担当（`phone_contact_person`）→ 連絡取りやすい時間（`preferred_contact_time`）→ 連絡方法（`contact_method`）の順で結合する（要件 2.4 に基づく）

3. **フォールバックの維持**: 有効な値が1つもない場合は `当日TEL（内容）` を返す（既存動作を維持）

**修正後の実装イメージ:**
```typescript
export const getTodayCallWithInfoLabel = (seller: Seller | any): string => {
  const contactMethod = seller.contactMethod || seller.contact_method || '';
  const preferredContactTime = seller.preferredContactTime || seller.preferred_contact_time || '';
  const phoneContactPerson = seller.phoneContactPerson || seller.phone_contact_person || '';

  const isValid = (v: string): boolean => !!(v && v.trim() !== '' && v.trim().toLowerCase() !== 'null');

  // 表示順: 電話担当・連絡取りやすい時間・連絡方法
  const parts: string[] = [];
  if (isValid(phoneContactPerson)) parts.push(phoneContactPerson);
  if (isValid(preferredContactTime)) parts.push(preferredContactTime);
  if (isValid(contactMethod)) parts.push(contactMethod);

  if (parts.length === 0) {
    return '当日TEL（内容）';
  }

  return `当日TEL(${parts.join('・')})`;
};
```

**注意**: 表示順が現在の実装（`contact_method` 優先）から変更される（`phone_contact_person` 優先）。これは要件 2.4 の「表示順: 電話担当・連絡取りやすい時間・連絡方法」に基づく意図的な変更である。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず修正前のコードでバグを再現するテストを実行し、次に修正後のコードで正しい動作を確認する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: `getTodayCallWithInfoLabel()` に複数のコミュニケーション情報フィールドを持つ売主データを渡し、返り値が期待値と異なることを確認する。

**Test Cases**:
1. **電話担当 + 連絡方法テスト**: `phone_contact_person = "I"`、`contact_method = "Eメール"` → 現在は `当日TEL(Eメール)` を返す（バグ）
2. **電話担当 + 連絡取りやすい時間テスト**: `phone_contact_person = "Y"`、`preferred_contact_time = "午前中"` → 現在は `当日TEL(午前中)` を返す（バグ）
3. **連絡方法 + 連絡取りやすい時間テスト**: `contact_method = "Eメール"`、`preferred_contact_time = "午前中"` → 現在は `当日TEL(Eメール)` を返す（バグ）
4. **3フィールド全てテスト**: 全フィールドに値 → 現在は `当日TEL(Eメール)` を返す（バグ）

**Expected Counterexamples**:
- 複数フィールドに値があっても、最初に見つかった1つの値のみが返される
- 原因: 優先順位チェーンで最初の条件が true になった時点で return している

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して期待される動作を確認する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := getTodayCallWithInfoLabel_fixed(seller)
  ASSERT result contains ALL valid communication fields joined by '・'
  ASSERT result starts with '当日TEL('
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない入力（1フィールドのみ、または全て空）に対して修正前と同じ動作を確認する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT getTodayCallWithInfoLabel_original(seller) = getTodayCallWithInfoLabel_fixed(seller)
END FOR
```

**Testing Approach**: 単体テストで各ケースを網羅的に確認する。

**Test Cases**:
1. **単一フィールド保持テスト**: `contact_method` のみ → `当日TEL(Eメール)` が変わらないことを確認
2. **単一フィールド保持テスト**: `preferred_contact_time` のみ → `当日TEL(午前中)` が変わらないことを確認
3. **単一フィールド保持テスト**: `phone_contact_person` のみ → `当日TEL(Y)` が変わらないことを確認
4. **フォールバック保持テスト**: 全フィールド空 → `当日TEL（内容）` が変わらないことを確認

### Unit Tests

- 2フィールド組み合わせ（3パターン）の結合表示テスト
- 3フィールド全ての結合表示テスト
- 1フィールドのみの表示テスト（3パターン）
- 全フィールド空のフォールバックテスト
- `null` 文字列を含むフィールドの扱いテスト
- camelCase / snake_case 両方のフィールド名でのテスト

### Property-Based Tests

- ランダムなコミュニケーション情報の組み合わせで、有効なフィールドが全て結果に含まれることを確認
- 有効なフィールドが1つの場合、結果が修正前と同じであることを確認
- 結果が常に `当日TEL(` で始まるか `当日TEL（内容）` であることを確認

### Integration Tests

- サイドバーの「当日TEL（内容）」カテゴリに複数コミュニケーション情報を持つ売主が正しいラベルで表示されることを確認
- `getCategoryCounts()` の `todayCallWithInfoLabels` に結合ラベルが含まれることを確認
- `isTodayCallWithInfo()` の判定結果が修正前後で変わらないことを確認
