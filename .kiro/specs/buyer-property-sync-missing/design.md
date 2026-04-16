# buyer-property-sync-missing バグ修正デザイン

## Overview

買主リストのスプレッドシートにおいて、AT列（物件番号）に値が入力されているにもかかわらず、AY列（物件所在地）・BQ列（住居表示）・BR列（価格）が空白のままになるバグを修正する。

根本原因は2つ重なっている：

1. **マッピング欠落**: `buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `display_address`（住居表示）のマッピングが存在しない
2. **同期処理欠落**: `property_number` 保存時に `property_listings` テーブルから関連物件情報（`address`/`display_address`/`price`）を取得して `buyers` テーブルに書き込み、スプレッドシートに同期する処理が存在しない

修正方針は最小限の変更で両問題を解消し、既存の同期フローへの影響を最小化する。

## Glossary

- **Bug_Condition (C)**: `property_number` がDBに保存された際に、スプレッドシートのAY/BQ/BR列が更新されない条件
- **Property (P)**: `property_number` 保存時に `property_listings` から物件情報を取得し、スプレッドシートの対応列に反映されるべき動作
- **Preservation**: `property_number` を含まない通常フィールド更新の既存同期動作が変わらないこと
- **BuyerService.updateWithSync()**: `backend/src/services/BuyerService.ts` の買主データ更新＋スプレッドシート同期を行うメソッド
- **BuyerWriteService.updateFields()**: `backend/src/services/BuyerWriteService.ts` の複数フィールドをスプレッドシートに書き込むメソッド
- **BuyerColumnMapper.mapDatabaseToSpreadsheet()**: `backend/src/services/BuyerColumnMapper.ts` のDBフィールド名→スプレッドシート列名変換メソッド
- **databaseToSpreadsheet**: `buyer-column-mapping.json` のDB→スプレッドシート方向のマッピング定義
- **property_listings**: 物件情報を格納するSupabaseテーブル（`address`/`display_address`/`price` フィールドを持つ）

## Bug Details

### Bug Condition

バグは、DBから買主の `property_number` を入力・保存した際に発生する。`BuyerService.updateWithSync()` は更新されたフィールド（`property_number`）のみをスプレッドシートに書き戻すため、物件情報（`property_address`/`display_address`/`price`）は自動的に反映されない。さらに、仮に `display_address` が `buyers` テーブルに書き込まれたとしても、`databaseToSpreadsheet` マッピングに `display_address` が存在しないため、スプレッドシートへの書き込みがスキップされる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, value: any, buyerRecord: BuyerRecord }
  OUTPUT: boolean

  RETURN input.fieldName = 'property_number'
         AND input.value IS NOT NULL
         AND input.value != ''
         AND (
           buyers.property_address IS NULL OR buyers.property_address = ''
           OR buyers.display_address IS NULL OR buyers.display_address = ''
           OR buyers.price IS NULL
         )
END FUNCTION
```

### Examples

- **例1（バグ発生）**: DBで買主AA1234の `property_number` を "BB5678" に設定して保存 → スプレッドシートのAY列（物件所在地）・BQ列（住居表示）・BR列（価格）が空白のまま
- **例2（バグ発生）**: `property_listings` に `property_number="BB5678"`, `address="大分市中央1-1-1"`, `display_address="中央1-1-1"`, `price=23800000` が存在するにもかかわらず、買主スプレッドシートに反映されない
- **例3（バグ発生）**: `BuyerColumnMapper.mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" })` を呼び出すと、`display_address` のマッピングが存在しないため空のオブジェクト `{}` が返される
- **例4（正常動作）**: `property_number` を含まない `viewing_date` の更新 → 既存通り `●内覧日(最新）` 列のみ更新される（影響なし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `property_number` を含まない買主フィールド（`viewing_date`、`latest_status`、`next_call_date` など）の更新は、既存通り更新されたフィールドのみをスプレッドシートに同期し続ける
- `property_number` が空白または null の状態での買主データ更新は、物件情報の取得・同期を行わず、他のフィールドの同期は正常に動作し続ける
- スプレッドシート→DB方向の同期（`spreadsheetToDatabase` / `spreadsheetToDatabaseExtended` マッピング）は変更しない
- `databaseToSpreadsheet` マッピングの既存フィールド（`property_address`、`price` など）は引き続き正しくスプレッドシートに書き込まれる

**Scope:**
`property_number` フィールドの更新以外のすべての入力は、この修正によって完全に影響を受けない。具体的には：
- `property_number` を含まないフィールド更新
- `property_number` が null/空文字の場合の更新
- スプレッドシートからDBへの同期処理

## Hypothesized Root Cause

根本原因の分析に基づき、以下の2つの問題が重なっている：

1. **`databaseToSpreadsheet` マッピング欠落**: `buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `"display_address": "住居表示"` が存在しない。`spreadsheetToDatabaseExtended` には `"住居表示": "display_address"` が定義されているが、逆方向のマッピングが追加されていない。

2. **`property_number` 保存時の物件情報同期処理欠落**: `BuyerService.updateWithSync()` は `allowedData`（更新されたフィールドのみ）をそのままスプレッドシートに書き戻す。`property_number` が更新されても、`property_listings` テーブルから関連物件情報を取得して `buyers` テーブルの `property_address`/`display_address`/`price` を更新し、スプレッドシートに同期する処理が存在しない。

3. **`buyers` テーブルへの物件情報書き込み処理欠落**: `property_number` 保存時に `buyers.property_address`/`buyers.display_address`/`buyers.price` を更新する処理も存在しない可能性がある。

## Correctness Properties

Property 1: Bug Condition - property_number保存時の物件情報スプレッドシート同期

_For any_ 買主更新入力において `property_number` が非null・非空文字で保存される場合、修正後の `BuyerService.updateWithSync()` は `property_listings` テーブルから対応する `address`/`display_address`/`price` を取得し、スプレッドシートのAY列（物件所在地）・BQ列（住居表示）・BR列（価格）に反映する SHALL。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Bug Condition - display_addressマッピング

_For any_ `display_address` フィールドを含むDBレコードを `BuyerColumnMapper.mapDatabaseToSpreadsheet()` に渡す場合、修正後の関数は `display_address` を `住居表示` 列にマッピングして返す SHALL。

**Validates: Requirements 2.4**

Property 3: Preservation - 非property_numberフィールド更新の既存動作維持

_For any_ `property_number` を含まない買主フィールド更新において、修正後の `BuyerService.updateWithSync()` は修正前と同一の動作（更新されたフィールドのみをスプレッドシートに同期）を維持する SHALL。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正：

**File 1**: `backend/src/config/buyer-column-mapping.json`

**Specific Changes**:
1. **`databaseToSpreadsheet` セクションに `display_address` マッピングを追加**:
   ```json
   "display_address": "住居表示"
   ```
   既存の `"price": "価格"` の近くに追加する（BQ列に対応）

---

**File 2**: `backend/src/services/BuyerService.ts`

**Function**: `updateWithSync()`

**Specific Changes**:
2. **`property_number` 更新時の物件情報取得・同期処理を追加**:
   - `allowedData` に `property_number` が含まれ、かつ値が非null・非空文字の場合
   - `property_listings` テーブルから `address`/`display_address`/`price` を取得
   - 取得した値を `buyers` テーブルの `property_address`/`display_address`/`price` に書き込む
   - `allowedData` に `property_address`/`display_address`/`price` を追加してスプレッドシートに同期

3. **追加処理のタイミング**: DB更新（`supabase.from('buyers').update()`）の前に物件情報を取得し、`allowedData` に追加する。これにより既存の同期フロー（`writeService.updateFields(buyerNumber, allowedData)`）がそのまま機能する。

4. **`property_number` が null/空文字の場合**: 物件情報の取得・同期をスキップし、既存動作を維持する。

5. **`property_listings` に対応する物件が存在しない場合**: エラーにせず、物件情報の同期をスキップして `property_number` のみを保存する。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：まず未修正コードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の維持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認・反証する。根本原因が反証された場合は再仮説が必要。

**Test Plan**: `BuyerColumnMapper.mapDatabaseToSpreadsheet()` に `display_address` を含むレコードを渡し、マッピング結果を確認する。また `BuyerService.updateWithSync()` で `property_number` を更新した際に物件情報がスプレッドシートに反映されないことを確認する。

**Test Cases**:
1. **display_addressマッピングテスト**: `mapDatabaseToSpreadsheet({ display_address: "中央1-1-1" })` を呼び出し、結果に `住居表示` キーが存在しないことを確認（未修正コードで失敗するはず）
2. **property_number保存時の同期テスト**: `updateWithSync()` で `property_number` を更新した際、`writeService.updateFields()` に渡される `updates` に `property_address`/`display_address`/`price` が含まれないことを確認（未修正コードで失敗するはず）
3. **スプレッドシート列マッピング確認**: `BuyerColumnMapper` の `dbToSpreadsheet` マップに `display_address` キーが存在しないことを確認

**Expected Counterexamples**:
- `mapDatabaseToSpreadsheet({ display_address: "..." })` が `{}` を返す（`住居表示` キーなし）
- `updateWithSync()` 後のスプレッドシートに `property_address`/`display_address`/`price` が反映されない

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := updateWithSync_fixed(input.buyerId, { property_number: input.value })
  ASSERT spreadsheet.AY_column = property_listings[input.value].address
  ASSERT spreadsheet.BQ_column = property_listings[input.value].display_address
  ASSERT spreadsheet.BR_column = property_listings[input.value].price
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同一の動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateWithSync_original(input) = updateWithSync_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な入力パターン（様々なフィールド名・値の組み合わせ）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- `property_number` を含まないすべての更新パターンで動作が変わらないことを強く保証できる

**Test Cases**:
1. **非property_numberフィールド更新の保存テスト**: `viewing_date`、`latest_status`、`next_call_date` などを更新した際、`writeService.updateFields()` に渡される `updates` に `property_address`/`display_address`/`price` が含まれないことを確認
2. **property_number=nullの更新テスト**: `property_number: null` で更新した際、物件情報の取得処理がスキップされることを確認
3. **既存マッピング動作テスト**: `mapDatabaseToSpreadsheet({ property_address: "大分市..." })` が引き続き `{ "物件所在地": "大分市..." }` を返すことを確認

### Unit Tests

- `BuyerColumnMapper.mapDatabaseToSpreadsheet()` に `display_address` を含むレコードを渡した際、`住居表示` キーが返されることをテスト
- `BuyerService.updateWithSync()` で `property_number` を更新した際、`property_listings` からの物件情報取得が呼び出されることをテスト（モック使用）
- `property_number` が null/空文字の場合、物件情報取得がスキップされることをテスト
- `property_listings` に対応物件が存在しない場合、エラーにならずに処理が継続されることをテスト

### Property-Based Tests

- ランダムなDBフィールド名・値の組み合わせを生成し、`property_number` を含まない更新では `property_address`/`display_address`/`price` が `allowedData` に追加されないことを検証
- ランダムな `property_number` 値を生成し、`property_listings` に存在する場合は物件情報が同期され、存在しない場合はスキップされることを検証
- `mapDatabaseToSpreadsheet()` に任意のDBレコードを渡した際、`display_address` が存在すれば必ず `住居表示` にマッピングされることを検証

### Integration Tests

- DBで `property_number` を更新した際、スプレッドシートのAY/BQ/BR列が正しく更新されるエンドツーエンドテスト
- `property_number` を含まないフィールド更新後、スプレッドシートの物件情報列が変更されないことを確認
- `property_listings` に存在しない `property_number` を設定した際、他のフィールドの同期が正常に動作することを確認
