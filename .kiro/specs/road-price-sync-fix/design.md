# 固定資産税路線価フィールド スプレッドシート同期バグ修正 デザイン

## Overview

`sellers` テーブルの `fixed_asset_tax_road_price`（固定資産税路線価）カラムは、スプレッドシートの DD 列「固定資産税路線価」と双方向に同期されるべきだが、現在は同期されていない。

**バグの影響範囲**:
- スプレッドシート → DB 方向: `column-mapping.json` にマッピングが存在せず、`EnhancedAutoSyncService` の `syncSingleSeller` / `updateSingleSeller` にも処理がないため、スプシの値が DB に反映されない
- DB → スプレッドシート方向: `column-mapping.json` の `databaseToSpreadsheet` にマッピングが存在しないため、DB の値がスプシに書き戻されない

**修正方針**: 最小限の変更で双方向同期を追加する。DB カラムは既に存在し、`SellerService.supabase.ts` の `decryptSeller` にも含まれているため、フロントエンドからの直接保存は正常に動作している。

---

## Glossary

- **Bug_Condition (C)**: 「固定資産税路線価」フィールドが同期対象から除外されている状態（マッピング欠落 + 同期処理欠落）
- **Property (P)**: 固定資産税路線価の値がスプシ ↔ DB 間で正しく双方向同期される動作
- **Preservation**: 他の全フィールド（査定額、状況、次電日、コメント等）の同期動作が変更前と同一であること
- **fixed_asset_tax_road_price**: `sellers` テーブルの `NUMERIC` 型カラム。固定資産税路線価（円/㎡）を格納
- **syncSingleSeller**: `EnhancedAutoSyncService.ts` の新規売主作成時の同期メソッド
- **updateSingleSeller**: `EnhancedAutoSyncService.ts` の既存売主更新時の同期メソッド
- **column-mapping.json**: `backend/src/config/column-mapping.json`。スプシカラム名 ↔ DB カラム名のマッピング定義ファイル

---

## Bug Details

### Bug Condition

バグは「固定資産税路線価」フィールドに関する操作が発生したとき（スプシへの入力、または DB への保存後の書き戻し）に顕在化する。`column-mapping.json` にマッピングが存在せず、`EnhancedAutoSyncService` の同期処理にも含まれていないため、値が同期されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SyncOperation
  OUTPUT: boolean

  RETURN input.fieldName = '固定資産税路線価'
         AND (
           NOT '固定資産税路線価' IN spreadsheetToDatabase.keys
           OR NOT 'fixed_asset_tax_road_price' IN syncSingleSeller.processedFields
           OR NOT 'fixed_asset_tax_road_price' IN updateSingleSeller.processedFields
         )
END FUNCTION
```

### Examples

- **例1（スプシ→DB、新規売主）**: スプシの DD 列に `50000`（円/㎡）が入力されている売主を `syncSingleSeller` で同期 → DB の `fixed_asset_tax_road_price` が `null` のまま（期待値: `50000`）
- **例2（スプシ→DB、既存売主更新）**: スプシの DD 列を `80000` に変更後、`updateSingleSeller` で更新 → DB の値が変わらない（期待値: `80000`）
- **例3（DB→スプシ）**: 通話モードページで `fixed_asset_tax_road_price = 60000` を保存 → スプシの DD 列が空欄のまま（期待値: `60000`）
- **エッジケース（空欄）**: スプシの DD 列が空欄 → DB の値をクリア（`null`）し、スプシも空欄のまま

---

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- 査定額（`valuation_amount_1/2/3`）の同期処理（手動入力優先ロジックを含む）
- 状況（`status`）、次電日（`next_call_date`）、コメント（`comments`）等の同期処理
- 暗号化フィールド（`name`, `phone_number`, `email`, `address`）の同期処理
- `column-mapping.json` の既存マッピング定義（追加のみ、変更・削除なし）
- フロントエンドからの直接保存（`PUT /api/sellers/:id`）の動作

**スコープ:**
`fixed_asset_tax_road_price` 以外の全フィールドは、この修正によって一切影響を受けてはならない。

---

## Hypothesized Root Cause

コードベースの調査により、根本原因は以下の 2 点と特定された：

1. **`column-mapping.json` のマッピング欠落**
   - `spreadsheetToDatabase` セクションに `"固定資産税路線価": "fixed_asset_tax_road_price"` が存在しない
   - `databaseToSpreadsheet` セクションに `"fixed_asset_tax_road_price": "固定資産税路線価"` が存在しない
   - `typeConversions` セクションに `"fixed_asset_tax_road_price": "number"` が存在しない

2. **`EnhancedAutoSyncService.ts` の同期処理欠落**
   - `syncSingleSeller` メソッドに `fixed_asset_tax_road_price` の処理ブロックが存在しない
   - `updateSingleSeller` メソッドに `fixed_asset_tax_road_price` の処理ブロックが存在しない

**確認済み事項（修正不要）:**
- `GoogleSheetsClient.readAll()` の取得範囲は `A2:ZZZ` であり、DD 列（列 108）は既に範囲内に含まれている
- DB カラム `sellers.fixed_asset_tax_road_price` は `NUMERIC` 型で既に存在する（マイグレーション `20260318_add_valuation_method_and_road_price_to_sellers.sql` 適用済み）
- `SellerService.supabase.ts` の `decryptSeller` には `fixedAssetTaxRoadPrice: seller.fixed_asset_tax_road_price` が既に含まれている

---

## Correctness Properties

Property 1: Bug Condition - 固定資産税路線価のスプシ→DB同期

_For any_ スプレッドシート行データ（`row`）において `row['固定資産税路線価']` に値が存在する場合（isBugCondition が true）、修正後の `syncSingleSeller` および `updateSingleSeller` は `sellers.fixed_asset_tax_road_price` に正しい数値を保存しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存フィールドの同期動作維持

_For any_ スプレッドシート行データにおいて `row['固定資産税路線価']` が存在しない（isBugCondition が false）、または `fixed_asset_tax_road_price` 以外のフィールドに関する同期操作では、修正後のコードは修正前のコードと完全に同一の結果を生成しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3**

---

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の 2 ファイルのみを変更する。

---

**File 1**: `backend/src/config/column-mapping.json`

**変更内容**:

1. **`spreadsheetToDatabase` セクションに追加**:
   ```json
   "固定資産税路線価": "fixed_asset_tax_road_price"
   ```

2. **`databaseToSpreadsheet` セクションに追加**:
   ```json
   "fixed_asset_tax_road_price": "固定資産税路線価"
   ```

3. **`typeConversions` セクションに追加**:
   ```json
   "fixed_asset_tax_road_price": "number"
   ```

---

**File 2**: `backend/src/services/EnhancedAutoSyncService.ts`

**`updateSingleSeller` メソッドへの追加**（査定額処理ブロックの近傍に追加）:
```typescript
// 固定資産税路線価を追加
const fixedAssetTaxRoadPrice = row['固定資産税路線価'];
const parsedFixedAssetTaxRoadPrice = this.parseNumeric(fixedAssetTaxRoadPrice);
if (parsedFixedAssetTaxRoadPrice !== null) {
  updateData.fixed_asset_tax_road_price = parsedFixedAssetTaxRoadPrice;
} else if (fixedAssetTaxRoadPrice === '' || fixedAssetTaxRoadPrice === null || fixedAssetTaxRoadPrice === undefined) {
  updateData.fixed_asset_tax_road_price = null;
}
```

**`syncSingleSeller` メソッドへの追加**（査定額処理ブロックの近傍に追加）:
```typescript
// 固定資産税路線価を追加
const fixedAssetTaxRoadPriceNew = row['固定資産税路線価'];
const parsedFixedAssetTaxRoadPriceNew = this.parseNumeric(fixedAssetTaxRoadPriceNew);
if (parsedFixedAssetTaxRoadPriceNew !== null) {
  encryptedData.fixed_asset_tax_road_price = parsedFixedAssetTaxRoadPriceNew;
}
```

**注意事項**:
- `fixed_asset_tax_road_price` は `NUMERIC` 型（円/㎡）。査定額のような万円→円変換は不要
- `updateSingleSeller` では空欄時に `null` でクリアする（要件 3.3 対応）
- `syncSingleSeller` では新規作成のため、値がある場合のみ設定する

---

## Testing Strategy

### Validation Approach

2 フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `column-mapping.json` と `EnhancedAutoSyncService.ts` を修正する前に、スプシの DD 列に値が入っている売主を対象に同期を実行し、DB に反映されないことを確認する。

**Test Cases**:
1. **新規売主同期テスト**: DD 列に `50000` が入っている行を `syncSingleSeller` で処理 → `fixed_asset_tax_road_price` が `null` のまま（未修正コードで失敗）
2. **既存売主更新テスト**: DD 列に `80000` が入っている行を `updateSingleSeller` で処理 → DB の値が変わらない（未修正コードで失敗）
3. **DB→スプシ書き戻しテスト**: DB に `fixed_asset_tax_road_price = 60000` がある売主を同期 → スプシの DD 列が空欄のまま（未修正コードで失敗）

**Expected Counterexamples**:
- `fixed_asset_tax_road_price` が `null` のまま同期される
- 原因: `column-mapping.json` にマッピングがなく、同期処理にも含まれていない

### Fix Checking

**Goal**: 修正後、バグ条件が成立する全入力で正しい動作を確認する。

**Pseudocode:**
```
FOR ALL row WHERE isBugCondition(row) DO
  result := syncSingleSeller_fixed(sellerNumber, row)
  ASSERT sellers.fixed_asset_tax_road_price = parseNumeric(row['固定資産税路線価'])
END FOR

FOR ALL row WHERE isBugCondition(row) DO
  result := updateSingleSeller_fixed(sellerNumber, row)
  ASSERT sellers.fixed_asset_tax_road_price = parseNumeric(row['固定資産税路線価'])
END FOR
```

### Preservation Checking

**Goal**: 修正後、`fixed_asset_tax_road_price` 以外の全フィールドの同期動作が変わっていないことを確認する。

**Pseudocode:**
```
FOR ALL row WHERE NOT isBugCondition(row) DO
  ASSERT updateSingleSeller_original(row)[field] = updateSingleSeller_fixed(row)[field]
  FOR ALL field IN [status, next_call_date, comments, valuation_amount_1, ...]
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される。多数のランダムな売主データを生成し、`fixed_asset_tax_road_price` 以外の全フィールドが修正前後で同一であることを検証する。

**Test Cases**:
1. **査定額同期の保持**: 査定額（手動入力優先ロジック）が修正後も正しく動作することを確認
2. **状況・次電日・コメントの保持**: これらのフィールドが修正後も正しく同期されることを確認
3. **暗号化フィールドの保持**: `name`, `phone_number`, `email`, `address` の同期が変わらないことを確認
4. **空欄時のクリア動作**: `fixed_asset_tax_road_price` が空欄の場合、DB が `null` になることを確認

### Unit Tests

- `column-mapping.json` に `固定資産税路線価` のマッピングが存在することを確認
- `syncSingleSeller` が `fixed_asset_tax_road_price` を正しく設定することを確認
- `updateSingleSeller` が `fixed_asset_tax_road_price` を正しく更新・クリアすることを確認
- `parseNumeric` が路線価の数値を正しく変換することを確認

### Property-Based Tests

- ランダムな数値（0〜9,999,999）を `row['固定資産税路線価']` に設定し、DB に正しく保存されることを検証
- `fixed_asset_tax_road_price` 以外のフィールドをランダムに変化させ、修正前後で同一の結果になることを検証
- 空欄・null・undefined の各パターンで `null` クリアが正しく動作することを検証

### Integration Tests

- 実際のスプレッドシートの DD 列に値が入っている売主を対象に手動同期を実行し、DB に反映されることを確認
- 通話モードページで `fixed_asset_tax_road_price` を保存後、スプシの DD 列に反映されることを確認
- 他のフィールド（査定額、状況等）が引き続き正常に同期されることを確認
