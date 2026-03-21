# call-mode-property-address-fix バグ修正設計

## Overview

通話モードページの物件住所欄に「未入力」という文字列が表示されるバグを修正する。

売主リストの同期（GAS `syncSellerList` → DB）において、スプレッドシートのR列（物件所在地）が空欄または「未入力」の状態で同期された場合、`properties.property_address` カラムに「未入力」という文字列が格納される。`backend/src/services/SellerService.supabase.ts` の `getSeller()` メソッドは、この「未入力」文字列を有効な住所として扱い、`sellers.property_address` へのフォールバックが正しく機能していない。

修正方針は、`getSeller()` 内の `isValidAddress()` 関数と `resolvedAddress` のフォールバックロジックを修正し、「未入力」を無効な値として扱い、`sellers.property_address` へ正しくフォールバックさせることである。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `properties.property_address` が「未入力」という文字列の場合に、`sellers.property_address` へのフォールバックが機能しないこと
- **Property (P)**: 期待される正しい動作 — `properties.property_address` が「未入力」の場合、`sellers.property_address` の値（または空欄）を返すこと
- **Preservation**: 修正によって変更してはならない既存動作 — `properties.property_address` に有効な住所がある場合はその値をそのまま返す動作
- **getSeller()**: `backend/src/services/SellerService.supabase.ts` 内のメソッド。売主IDを受け取り、`sellers` テーブルと `properties` テーブルを結合して売主情報を返す
- **isValidAddress()**: `getSeller()` 内のローカル関数。住所文字列が有効かどうかを判定する（現在は空文字と「未入力」をチェック）
- **resolvedAddress**: `getSeller()` 内で計算される最終的な物件住所。フォールバックロジックを経て決定される
- **sellers.property_address**: `sellers` テーブルの物件住所カラム。スプレッドシートR列から同期される
- **properties.property_address**: `properties` テーブルの物件住所カラム。`properties` テーブルに格納された物件住所

## Bug Details

### Bug Condition

バグは `properties.property_address` に「未入力」という文字列が格納されている場合に発現する。`getSeller()` の `isValidAddress()` 関数は「未入力」を無効な値として正しく判定しているが、`resolvedAddress` のフォールバックロジックが `sellers.property_address`（`decryptedSeller.propertyAddress`）を参照する前に `property.address` を参照しており、`properties` テーブルに `address` カラムが存在しないため `undefined` になる。その結果、最終フォールバックの `property.property_address || property.address` が「未入力」を返してしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { property_address: string | null, sellers_property_address: string | null }
  OUTPUT: boolean

  RETURN (input.property_address TRIM() == '未入力' OR input.property_address TRIM() == '')
         AND NOT (input.sellers_property_address IS NOT NULL
                  AND input.sellers_property_address TRIM() != ''
                  AND input.sellers_property_address TRIM() != '未入力')
         AND resolvedAddress(input) == '未入力'
END FUNCTION
```

### Examples

- `properties.property_address = '未入力'`、`sellers.property_address = '大分市中央町1-1-1'` → バグあり: 「未入力」が返される（期待: 「大分市中央町1-1-1」）
- `properties.property_address = '未入力'`、`sellers.property_address = null` → バグあり: 「未入力」が返される（期待: `null` または空欄）
- `properties.property_address = '未入力'`、`sellers.property_address = '未入力'` → バグあり: 「未入力」が返される（期待: `null` または空欄）
- `properties.property_address = '大分市中央町1-1-1'` → バグなし: 「大分市中央町1-1-1」が正しく返される（保全対象）

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `properties.property_address` に有効な住所（空欄でも「未入力」でもない文字列）が格納されている場合、その住所をそのまま返す
- `sellers.property_address` に有効な住所があり、`properties.property_address` が空欄の場合、`sellers.property_address` の値を返す
- 通話モードページで物件住所を手動編集・保存した場合、その変更は正しく保存・表示される

**スコープ:**
バグ条件（`properties.property_address` が「未入力」）に該当しない全ての入力は、この修正によって影響を受けてはならない。具体的には:
- `properties.property_address` に有効な住所がある場合
- `properties.property_address` が `null` または空文字の場合（既存のフォールバック動作を維持）

**注記:** 期待される正しい動作（バグ条件が成立する場合の動作）は、下記「Correctness Properties」セクションの Property 1 で定義する。

## Hypothesized Root Cause

現在の `getSeller()` の `resolvedAddress` ロジックを分析すると:

```typescript
const resolvedAddress =
  isValidAddress(property.property_address) ? property.property_address :
  isValidAddress(property.address) ? property.address :           // ← ここが問題
  isValidAddress(decryptedSeller.propertyAddress) ? decryptedSeller.propertyAddress :
  property.property_address || property.address;                  // ← ここも問題
```

1. **`properties` テーブルに `address` カラムが存在しない**: `property.address` は常に `undefined` になる。`isValidAddress(undefined)` は `false` を返すため、このステップは常にスキップされる。これ自体はバグではないが、不要なチェックである。

2. **最終フォールバックが「未入力」を返す**: `isValidAddress(decryptedSeller.propertyAddress)` が `false`（`sellers.property_address` も「未入力」または `null`）の場合、最終フォールバック `property.property_address || property.address` が実行される。`property.property_address` が「未入力」（truthy な文字列）のため、「未入力」がそのまま返される。

3. **`sellers.property_address` フォールバックが機能しない場合**: `decryptedSeller.propertyAddress` が `null` または「未入力」の場合、`sellers.property_address` への有効なフォールバックが存在しない。

**根本原因**: 最終フォールバック `property.property_address || property.address` が `isValidAddress()` チェックを経由せず、「未入力」という文字列をそのまま返してしまう。

## Correctness Properties

Property 1: Bug Condition - 「未入力」が物件住所として返されない

_For any_ 入力において `properties.property_address` が「未入力」（または空欄）であり、かつ `sellers.property_address` に有効な住所が存在する場合、修正後の `getSeller()` は `sellers.property_address` の値を返し、「未入力」という文字列を返してはならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 有効な `properties.property_address` はそのまま返される

_For any_ 入力において `properties.property_address` に有効な住所（空欄でも「未入力」でもない文字列）が格納されている場合、修正後の `getSeller()` は修正前と同じ値を返し、既存の物件住所表示動作を保全しなければならない。

**Validates: Requirements 3.1, 3.2, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `getSeller()`

**Specific Changes**:

1. **最終フォールバックに `isValidAddress()` チェックを適用する**:
   - 現在: `property.property_address || property.address`（「未入力」をそのまま返す）
   - 修正後: `isValidAddress()` を通過した値のみを返し、全て無効な場合は `null` または空文字を返す

2. **不要な `property.address` 参照を削除する**:
   - `properties` テーブルに `address` カラムは存在しないため、`property.address` の参照を削除する
   - ステアリングドキュメント（`seller-table-column-definition.md`）に従い、`property_address` のみを使用する

**修正前のコード:**
```typescript
const resolvedAddress =
  isValidAddress(property.property_address) ? property.property_address :
  isValidAddress(property.address) ? property.address :
  isValidAddress(decryptedSeller.propertyAddress) ? decryptedSeller.propertyAddress :
  property.property_address || property.address;
```

**修正後のコード:**
```typescript
const resolvedAddress =
  isValidAddress(property.property_address) ? property.property_address :
  isValidAddress(decryptedSeller.propertyAddress) ? decryptedSeller.propertyAddress :
  null;
```

**変更の根拠:**
- `property.address` の参照を削除（`properties` テーブルに `address` カラムは存在しない）
- 最終フォールバックを `null` に変更（「未入力」という文字列を返さないようにする）
- `isValidAddress()` 関数自体は変更不要（既に「未入力」を正しく無効と判定している）

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される。まず未修正コードでバグを再現するテストを実行し、根本原因分析を確認・反証する。次に修正後のコードでバグが解消され、既存動作が保全されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認する。

**Test Plan**: `getSeller()` の `resolvedAddress` ロジックを単体でテストし、`properties.property_address = '未入力'` の場合に「未入力」が返されることを確認する。未修正コードで実行して失敗（バグの再現）を観察する。

**Test Cases**:
1. **基本バグ再現テスト**: `property_address = '未入力'`、`sellers.property_address = '大分市中央町1-1-1'` → 「未入力」が返されることを確認（未修正コードで失敗するはず）
2. **両方「未入力」テスト**: `property_address = '未入力'`、`sellers.property_address = '未入力'` → 「未入力」が返されることを確認（未修正コードで失敗するはず）
3. **sellers.property_address が null テスト**: `property_address = '未入力'`、`sellers.property_address = null` → 「未入力」が返されることを確認（未修正コードで失敗するはず）
4. **空文字テスト**: `property_address = ''`、`sellers.property_address = '大分市中央町1-1-1'` → 正しくフォールバックされるか確認

**Expected Counterexamples**:
- `property_address = '未入力'` の場合、最終フォールバック `property.property_address || property.address` が「未入力」を返す
- 原因: `property.address` が `undefined`（`properties` テーブルに `address` カラムが存在しない）のため、`property.property_address`（= '未入力'）が返される

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := getSeller_fixed(input)
  ASSERT result.property.address != '未入力'
  ASSERT result.property.address == input.sellers_property_address
         OR result.property.address == null
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getSeller_original(input).property.address
      == getSeller_fixed(input).property.address
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由:
- 有効な住所文字列を自動生成して多数のケースを検証できる
- 手動テストでは見落としがちなエッジケース（特殊文字、長い住所など）を検出できる
- 「有効な住所が変化しない」という保全性を強く保証できる

**Test Plan**: 未修正コードで有効な `property_address` を持つケースの動作を観察し、修正後も同じ動作が維持されることをプロパティベーステストで検証する。

**Test Cases**:
1. **有効な住所の保全**: `property_address = '大分市中央町1-1-1'` → 修正前後で同じ値が返されることを確認
2. **空欄フォールバックの保全**: `property_address = null`、`sellers.property_address = '大分市中央町1-1-1'` → 修正前後で同じ値が返されることを確認
3. **プロパティベーステスト**: ランダムな有効住所文字列を生成し、修正前後で同じ値が返されることを確認

### Unit Tests

- `isValidAddress()` 関数のテスト（「未入力」、空文字、null、有効な住所）
- `resolvedAddress` ロジックのテスト（各フォールバックパターン）
- `getSeller()` のモックテスト（`properties` テーブルと `sellers` テーブルのデータを組み合わせ）

### Property-Based Tests

- ランダムな有効住所文字列を生成し、`properties.property_address` に有効な値がある場合は常にその値が返されることを検証（Property 2）
- `properties.property_address` が「未入力」または空欄の場合、結果が「未入力」でないことを検証（Property 1）
- `sellers.property_address` に有効な値があり `properties.property_address` が無効な場合、`sellers.property_address` が返されることを検証

### Integration Tests

- 通話モードページで物件住所が「未入力」と表示されないことを確認（E2Eテスト）
- `getSeller()` API エンドポイントのレスポンスに「未入力」が含まれないことを確認
- スプレッドシート同期後に物件住所が正しく表示されることを確認
