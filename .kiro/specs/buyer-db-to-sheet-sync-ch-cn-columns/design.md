# buyer-db-to-sheet-sync-ch-cn-columns バグ修正設計

## Overview

買主リストに物件番号を登録した際、スプレッドシートのCH〜CN列（内覧前伝達事項・鍵等・売却理由・値下げ履歴・内覧の時の伝達事項・駐車場・内覧時駐車場）に値が反映されないバグの修正設計。

DBには正しく値が保存されており、`databaseToSpreadsheet` マッピングにも7フィールドは既に追加済みである。しかし `BuyerService.updateWithSync()` 内の物件番号登録時処理において、`property_listings` テーブルから取得するフィールドが `address/display_address/price/sales_assignee` の4フィールドのみであり、CH〜CN列に対応する7フィールドが取得されていない。

修正方針は、`updateWithSync()` の `property_listings` クエリに7フィールドを追加し、取得した値を `allowedData` に追加することで即時同期に乗せる。

## Glossary

- **Bug_Condition (C)**: 買主更新データに `property_number` が含まれ、かつ非null・非空文字の場合
- **Property (P)**: 物件番号登録後、スプレッドシートのCH〜CN列に `property_listings` から取得した対応フィールドの値が反映されること
- **Preservation**: 物件番号を含まない更新、および既存の同期フィールド（物件所在地・住居表示・価格・物件担当者）の動作が変わらないこと
- **updateWithSync**: `backend/src/services/BuyerService.ts` の `BuyerService.updateWithSync()` メソッド。買主データをDBに保存し、即時スプレッドシート同期を行う
- **allowedData**: `updateWithSync()` 内でスプレッドシート同期に渡すデータオブジェクト。`property_listings` から取得した値もここに追加される
- **databaseToSpreadsheet**: `backend/src/config/buyer-column-mapping.json` の同名セクション。DBフィールド名→スプレッドシート列名のマッピング（既に7フィールド追加済み）

## Bug Details

### Bug Condition

物件番号登録時、`updateWithSync()` が `property_listings` テーブルから取得するフィールドが不足しており、CH〜CN列に対応する7フィールドが `allowedData` に追加されない。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerUpdateInput
  OUTPUT: boolean

  // 買主更新データに property_number が含まれ、かつ非null・非空文字の場合にバグが発現
  RETURN X.property_number != null AND X.property_number != ''
END FUNCTION
```

### Examples

- 物件番号「AA1234」を登録 → `property_listings` に `pre_viewing_notes = "鍵は管理会社へ"` が存在するが、CH列（内覧前伝達事項）は空白のまま
- 物件番号「BB5678」を登録 → `property_listings` に `parking = "前面道路に路駐可"` が存在するが、CM列（駐車場）は空白のまま
- 物件番号が未登録の買主を更新 → バグ条件を満たさないため、既存の同期動作は変わらない（正常）
- 物件番号を登録したが `property_listings` に対応物件が存在しない → CH〜CN列は空白のまま（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 物件番号以外のフィールド（問合時ヒアリング・最新状況・次電日など）の即時同期は変わらず正常に動作する
- 物件番号登録時の既存同期フィールド（物件所在地・住居表示・価格・物件担当者）は引き続き正常に反映される
- 物件番号が未登録の場合、CH〜CN列は変更されない（空白のまま）
- 物件番号を登録したが `property_listings` に対応物件が存在しない場合、処理はエラーなく完了し、CH〜CN列は空白のまま
- スプシ→DB方向の全件同期（`spreadsheetToDatabaseExtended` マッピング）は変更されない

**Scope:**
`property_number` を含まない全ての更新リクエストは、この修正の影響を受けない。

## Hypothesized Root Cause

`BuyerService.updateWithSync()` の以下の箇所（`backend/src/services/BuyerService.ts`）：

```typescript
const { data: propertyListing, error: propertyError } = await this.supabase
  .from('property_listings')
  .select('address, display_address, price, sales_assignee')  // ← 7フィールドが欠落
  .eq('property_number', allowedData.property_number)
  .maybeSingle();

if (!propertyError && propertyListing) {
  allowedData.property_address = propertyListing.address ?? null;
  allowedData.display_address = propertyListing.display_address ?? null;
  allowedData.price = propertyListing.price ?? null;
  allowedData.property_assignee = propertyListing.sales_assignee ?? null;
  // ← pre_viewing_notes 〜 viewing_parking の追加が欠落
}
```

`select()` に7フィールドが含まれておらず、`allowedData` への追加処理も存在しない。

なお、`databaseToSpreadsheet` マッピング（`buyer-column-mapping.json`）には既に7フィールドが追加済みであるため、マッピング側の修正は不要。

## Correctness Properties

Property 1: Bug Condition - 物件番号登録時のCH〜CN列即時同期

_For any_ 買主更新入力 X において isBugCondition(X) が true（`property_number` が非null・非空文字）であり、かつ `property_listings` に対応物件が存在する場合、修正後の `updateWithSync` は `property_listings` から取得した `pre_viewing_notes/key_info/sale_reason/price_reduction_history/viewing_notes/parking/viewing_parking` の値をスプレッドシートのCH〜CN列に SHALL 反映する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

Property 2: Preservation - 物件番号を含まない更新の動作保持

_For any_ 買主更新入力 X において isBugCondition(X) が false（`property_number` が null または空文字）である場合、修正後の `updateWithSync` は修正前と同一の動作を SHALL 維持し、既存の同期フィールドおよびCH〜CN列に影響を与えない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/BuyerService.ts`

**Function**: `updateWithSync()`

**Specific Changes**:

1. **`select()` クエリへの7フィールド追加**:
   ```typescript
   // 修正前
   .select('address, display_address, price, sales_assignee')
   
   // 修正後
   .select('address, display_address, price, sales_assignee, pre_viewing_notes, key_info, sale_reason, price_reduction_history, viewing_notes, parking, viewing_parking')
   ```

2. **`allowedData` への7フィールド追加**:
   ```typescript
   // 修正前（既存4フィールドのみ）
   allowedData.property_address = propertyListing.address ?? null;
   allowedData.display_address = propertyListing.display_address ?? null;
   allowedData.price = propertyListing.price ?? null;
   allowedData.property_assignee = propertyListing.sales_assignee ?? null;
   
   // 修正後（7フィールドを追加）
   allowedData.property_address = propertyListing.address ?? null;
   allowedData.display_address = propertyListing.display_address ?? null;
   allowedData.price = propertyListing.price ?? null;
   allowedData.property_assignee = propertyListing.sales_assignee ?? null;
   allowedData.pre_viewing_notes = propertyListing.pre_viewing_notes ?? null;
   allowedData.key_info = propertyListing.key_info ?? null;
   allowedData.sale_reason = propertyListing.sale_reason ?? null;
   allowedData.price_reduction_history = propertyListing.price_reduction_history ?? null;
   allowedData.viewing_notes = propertyListing.viewing_notes ?? null;
   allowedData.parking = propertyListing.parking ?? null;
   allowedData.viewing_parking = propertyListing.viewing_parking ?? null;
   ```

**注意**: `databaseToSpreadsheet` マッピング（`backend/src/config/buyer-column-mapping.json`）は既に修正済みのため変更不要。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグの存在を確認するカウンターエグザンプルを発見し、次に修正後のコードで正しく動作することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `updateWithSync()` が `property_listings` から7フィールドを取得しないことを確認し、バグの存在を証明する。

**Test Plan**: `BuyerService.updateWithSync()` のソースコードを静的解析し、`property_listings` の `select()` クエリに7フィールドが含まれないことを確認する。また、`BuyerColumnMapper.mapDatabaseToSpreadsheet()` に7フィールドを渡した場合に正しくマッピングされることを確認する（マッピング側は既に修正済みのため PASS するはず）。

**Test Cases**:
1. **静的解析テスト**: `updateWithSync()` の `select()` クエリに `pre_viewing_notes` が含まれないことを確認（未修正コードで FAIL）
2. **マッピング確認テスト**: `mapDatabaseToSpreadsheet({ pre_viewing_notes: "テスト" })` が `{ "内覧前伝達事項": "テスト" }` を返すことを確認（マッピング修正済みのため PASS）
3. **allowedData確認テスト**: `updateWithSync()` 実行後に `allowedData` に `pre_viewing_notes` が含まれないことを確認（未修正コードで FAIL）
4. **エッジケーステスト**: `property_listings` に対応物件が存在しない場合、CH〜CN列が空白のまま処理が完了することを確認

**Expected Counterexamples**:
- `updateWithSync()` の `select()` クエリに `pre_viewing_notes` 等が含まれない
- `allowedData` に7フィールドが追加されないため、`writeService.updateFields()` に渡されない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全入力に対して期待動作が実現されることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result ← updateWithSync_fixed(X)
  ASSERT spreadsheet[CH列] = property_listings[X.property_number].pre_viewing_notes
  ASSERT spreadsheet[CI列] = property_listings[X.property_number].key_info
  ASSERT spreadsheet[CJ列] = property_listings[X.property_number].sale_reason
  ASSERT spreadsheet[CK列] = property_listings[X.property_number].price_reduction_history
  ASSERT spreadsheet[CL列] = property_listings[X.property_number].viewing_notes
  ASSERT spreadsheet[CM列] = property_listings[X.property_number].parking
  ASSERT spreadsheet[CN列] = property_listings[X.property_number].viewing_parking
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全入力に対して、修正前後で動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT updateWithSync_original(X) = updateWithSync_fixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。`property_number` を含まない任意の更新データを生成し、修正前後で `allowedData` の内容が同一であることを確認する。

**Test Cases**:
1. **既存フィールド保持テスト**: `property_number` を含まない更新で、`property_address/display_address/price/property_assignee` が変化しないことを確認
2. **CH〜CN列非影響テスト**: `property_number` を含まない更新で、CH〜CN列が変化しないことを確認
3. **物件なしエッジケーステスト**: `property_number` を含むが `property_listings` に対応物件が存在しない場合、処理がエラーなく完了することを確認

### Unit Tests

- `updateWithSync()` の `select()` クエリに7フィールドが含まれることを確認
- `property_listings` から取得した7フィールドが `allowedData` に追加されることを確認
- `property_listings` に対応物件が存在しない場合のエラーハンドリングを確認
- `mapDatabaseToSpreadsheet()` に7フィールドを渡した場合の変換結果を確認

### Property-Based Tests

- 任意の `property_number` を持つ買主更新データに対して、修正後の `updateWithSync()` が `allowedData` に7フィールドを含むことを確認
- `property_number` を含まない任意の更新データに対して、`allowedData` にCH〜CN列フィールドが追加されないことを確認
- 任意の `property_listings` データに対して、`mapDatabaseToSpreadsheet()` が正しくCH〜CN列名にマッピングすることを確認

### Integration Tests

- 物件番号登録後、スプレッドシートのCH〜CN列に値が反映されることをE2Eで確認
- 物件番号登録後、既存の同期フィールド（物件所在地・住居表示・価格・物件担当者）も引き続き正常に反映されることを確認
- 物件番号を含まない更新後、CH〜CN列が変化しないことを確認
