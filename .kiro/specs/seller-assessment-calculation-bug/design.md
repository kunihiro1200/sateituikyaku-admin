# 売主リスト査定額自動計算バグ Bugfix Design

## Overview

売主リストの通話モードページにおいて、査定額1（最低額）が土地価格と建物価格の合算を正しく反映せず、著しく低い値（例：¥1,200,000）が表示されるバグを修正する。

**バグの根本原因**: `calculate-valuation-amount1` APIエンドポイントが `fixedAssetTaxRoadPrice`（固定資産税路線価）をリクエストボディから受け取らずにDBから取得するが、DBの `fixed_asset_tax_road_price` カラムが `null` の場合、`seller.fixedAssetTaxRoadPrice || 0` により路線価が `0` として扱われる。その結果、土地価格が `0` になり、建物価格のみで査定額1が計算される。

**影響範囲**: `ValuationCalculatorService.calculateValuationAmount1()` の入力データ取得部分（`backend/src/routes/valuations.ts`）および `CallModePage.tsx` の `autoCalculateValuations` 関数。

## Glossary

- **Bug_Condition (C)**: `fixedAssetTaxRoadPrice` が `null` または `0` として計算に渡される状態 — 土地価格が `0` になり、建物価格のみで査定額1が計算される
- **Property (P)**: 正しい査定額1の計算 — 土地価格（`landArea × fixedAssetTaxRoadPrice / 0.6`）と建物価格の合算に基づいた正しい金額が返される
- **Preservation**: 既存の建物価格計算ロジック（減価償却）、査定額2・3の加算テーブル、手動入力査定額の優先順位が維持される
- **calculateValuationAmount1**: `backend/src/services/ValuationCalculatorService.ts` の関数 — 土地価格と建物価格を合算して査定額1を計算する
- **fixedAssetTaxRoadPrice**: 固定資産税路線価（円/㎡単位）— `sellers.fixed_asset_tax_road_price` カラムに保存される
- **autoCalculateValuations**: `frontend/frontend/src/pages/CallModePage.tsx` の関数 — 路線価入力時に査定額1/2/3を自動計算する

## Bug Details

### Bug Condition

バグは、`calculate-valuation-amount1` APIが呼ばれる時点で `sellers.fixed_asset_tax_road_price` が `null` の場合に発生する。`ValuationCalculatorService.calculateValuationAmount1()` 内で `seller.fixedAssetTaxRoadPrice || 0` により路線価が `0` として扱われ、土地価格が `0` になる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sellerId: string, fixedAssetTaxRoadPrice: number | null }
  OUTPUT: boolean

  RETURN input.fixedAssetTaxRoadPrice IS NULL
         OR input.fixedAssetTaxRoadPrice = 0
         AND seller.fixed_asset_tax_road_price IN DATABASE IS NULL
         AND calculateValuationAmount1 uses 0 as fixedAssetTaxRoadPrice
END FUNCTION
```

### Examples

- **例1（バグ再現）**: AA13983、土地面積220㎡、路線価21,700円/㎡、建物面積100㎡、木造1983年築
  - DBの `fixed_asset_tax_road_price` が `null` の場合
  - 土地価格: `0`（路線価が0として扱われる）
  - 建物価格: `104,400 × 100 × 0.1 = 1,044,000`（築42年で残存10%）
  - 合計: `1,044,000`
  - `basePrice = Math.round(1,044,000 × 1.2 / 10000) = 125`（万円）
  - `finalPrice = 125`（< 1000万円なので加算なし）
  - `roundedPrice = Math.floor(1,250,000 / 100,000) × 100,000 = 1,200,000` ← **バグ値**

- **例2（正常）**: 同じ条件で路線価が正しく渡された場合
  - 土地価格: `220 × 21,700 / 0.6 = 7,956,667`
  - 建物価格: `1,044,000`
  - 合計: `9,000,667`
  - `basePrice = Math.round(9,000,667 × 1.2 / 10000) = 1080`（万円）
  - `finalPrice = 1080 + 300 = 1380`（≥ 1000万円なので+300万）
  - `roundedPrice = 13,800,000` ← **正しい値**

- **例3（バグ連動）**: 査定額1が¥1,200,000の場合
  - `amount1InManYen = 120`（≤ 1000）
  - 査定額2: `(120 + 200) × 10000 = 3,200,000`
  - 査定額3: `(120 + 400) × 10000 = 5,200,000`（bugfix.mdの¥6,200,000は概算）

- **例4（エッジケース）**: 路線価が正しく渡されても `landArea = 0` の場合
  - 土地価格: `0`（正常動作 — 土地面積が0なら土地価格は0）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 土地面積または固定資産税路線価が0または未入力の場合、土地価格を0として計算する（既存の正常動作）
- 建物面積が0の場合、建物価格を0として計算する
- 木造・築33年以上の建物の場合、建物価格を基準価格の10%として計算する
- 鉄骨・軽量鉄骨・築40年以上の建物の場合、建物価格を基準価格の10%として計算する
- 査定額1が1,000万円未満の場合、査定額2に+200万円、査定額3に+400万円を加算する
- 手動入力された査定額が存在する場合、自動計算値より優先して表示する
- 計算根拠の表示内容（土地価格・建物価格の内訳テキスト）を変更しない

**Scope:**
`fixedAssetTaxRoadPrice` が正しく渡されている場合（`> 0`）の計算結果は変更しない。また、建物価格の計算ロジック（減価償却テーブル、構造別計算式）は変更しない。

## Hypothesized Root Cause

コードを調査した結果、以下の根本原因を特定した：

1. **フロントエンドの `autoCalculateValuations` 関数でリクエストボディに `fixedAssetTaxRoadPrice` を含めていない**
   - `CallModePage.tsx` の `autoCalculateValuations` 関数:
     ```typescript
     // 路線価をDBに保存
     await api.put(`/api/sellers/${id}`, { fixedAssetTaxRoadPrice: parseFloat(roadPrice) });
     // 計算APIを呼び出す（fixedAssetTaxRoadPriceを渡していない）
     const response1 = await api.post(`/api/sellers/${id}/calculate-valuation-amount1`);
     ```
   - バックエンドは `req.body.fixedAssetTaxRoadPrice` が `undefined` の場合、DBから取得した値を使う
   - DBへの保存が成功していれば問題ないが、保存失敗時や初回計算時に問題が発生する可能性

2. **バックエンドの `calculateValuationAmount1` で `fixedAssetTaxRoadPrice` が `null` の場合に `0` として扱われる**
   - `ValuationCalculatorService.calculateValuationAmount1()`:
     ```typescript
     const fixedAssetTaxRoadPrice = seller.fixedAssetTaxRoadPrice || 0;
     ```
   - `seller.fixedAssetTaxRoadPrice` が `null` の場合、`null || 0 = 0` となり土地価格が `0` になる

3. **DBの `fixed_asset_tax_road_price` カラムが `null` のまま計算が実行される**
   - スプレッドシートから同期されていない場合、または手動入力前に計算が実行された場合
   - `autoCalculateValuations` では路線価を保存してから計算するが、保存の成功確認が不十分

4. **`fixedAssetTaxRoadPrice` が `null` の場合のエラーハンドリングがない**
   - 路線価が `null` の場合、計算を中断してエラーを返すべきだが、`0` として計算を続行している

## Correctness Properties

Property 1: Bug Condition - 路線価が正しく計算に反映される

_For any_ 売主レコードにおいて、`fixedAssetTaxRoadPrice > 0` かつ `landArea > 0` の場合、`calculateValuationAmount1` は土地価格（`landArea × fixedAssetTaxRoadPrice / 0.6`）と建物価格の合算に基づいた正しい査定額1を返す SHALL。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 路線価が0または未入力の場合の動作維持

_For any_ 売主レコードにおいて、`fixedAssetTaxRoadPrice = 0` または `landArea = 0` の場合、`calculateValuationAmount1` は土地価格を `0` として計算し、建物価格のみで査定額1を返す（既存の正常動作を維持する）。

**Validates: Requirements 3.1, 3.2**

## Fix Implementation

### Changes Required

**根本原因の修正方針**: `autoCalculateValuations` 関数で `fixedAssetTaxRoadPrice` をリクエストボディに含めて渡すことで、DBへの保存と計算の間の競合状態を排除する。また、バックエンドで `fixedAssetTaxRoadPrice` が `null` の場合のバリデーションを追加する。

---

**File 1**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: `autoCalculateValuations`

**Specific Changes**:
1. **`calculate-valuation-amount1` のリクエストボディに `fixedAssetTaxRoadPrice` を追加**:
   ```typescript
   // 修正前
   const response1 = await api.post(`/api/sellers/${id}/calculate-valuation-amount1`);
   
   // 修正後
   const response1 = await api.post(`/api/sellers/${id}/calculate-valuation-amount1`, {
     fixedAssetTaxRoadPrice: parseFloat(roadPrice),
   });
   ```
   - これにより、DBへの保存と計算の間の競合状態を排除できる
   - バックエンドは `req.body.fixedAssetTaxRoadPrice` を優先するため、DBの値に依存しなくなる

---

**File 2**: `backend/src/routes/valuations.ts`

**Function**: `POST /:sellerId/calculate-valuation-amount1`

**Specific Changes**:
2. **`fixedAssetTaxRoadPrice` が `null` かつリクエストボディにも含まれていない場合のバリデーション追加**:
   ```typescript
   // 修正後: fixedAssetTaxRoadPriceが取得できない場合のエラーハンドリング
   const effectiveRoadPrice = fixedAssetTaxRoadPrice ?? seller.fixedAssetTaxRoadPrice;
   if (!effectiveRoadPrice || effectiveRoadPrice <= 0) {
     return res.status(400).json({
       error: {
         code: 'VALIDATION_ERROR',
         message: '固定資産税路線価が設定されていません。路線価を入力してから査定額を計算してください。',
         retryable: false,
       },
     });
   }
   seller.fixedAssetTaxRoadPrice = effectiveRoadPrice;
   ```

---

**File 3**: `backend/src/services/ValuationCalculatorService.ts`

**Function**: `calculateValuationAmount1`

**Specific Changes**:
3. **`fixedAssetTaxRoadPrice` が `0` の場合のログ追加（デバッグ用）**:
   ```typescript
   const fixedAssetTaxRoadPrice = seller.fixedAssetTaxRoadPrice || 0;
   if (fixedAssetTaxRoadPrice === 0) {
     console.warn('⚠️ fixedAssetTaxRoadPrice is 0 or null, land price will be 0');
   }
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず修正前のコードでバグを再現するテストを実行し、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: `fixedAssetTaxRoadPrice = null` の場合に査定額1が著しく低い値になることを確認する。修正前のコードで実行し、バグの存在を証明する。

**Test Plan**: `ValuationCalculatorService.calculateValuationAmount1()` に `fixedAssetTaxRoadPrice = null` の売主データを渡し、返り値が期待値（土地価格込みの正しい査定額）と大きく乖離することを確認する。

**Test Cases**:
1. **AA13983相当のデータ（路線価null）**: 土地面積220㎡、路線価null、建物面積100㎡、木造1983年築 → 査定額1が¥1,200,000になることを確認（バグ再現）
2. **路線価0のケース**: 路線価=0の場合も同様に土地価格が0になることを確認
3. **路線価が正しく渡された場合**: 路線価=21,700の場合、査定額1が¥13,800,000になることを確認（正常動作）
4. **フロントエンドのAPIコール**: `autoCalculateValuations` がリクエストボディに `fixedAssetTaxRoadPrice` を含めていないことを確認（バグ条件）

**Expected Counterexamples**:
- `fixedAssetTaxRoadPrice = null` の場合、`calculateValuationAmount1` が `¥1,200,000` を返す（期待値 `¥13,800,000` と大きく乖離）
- 原因: `seller.fixedAssetTaxRoadPrice || 0` により路線価が `0` として扱われ、土地価格が `0` になる

### Fix Checking

**Goal**: 修正後のコードで、`fixedAssetTaxRoadPrice > 0` の場合に正しい査定額1が計算されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  // fixedAssetTaxRoadPriceをリクエストボディに含めて計算
  result := calculateValuationAmount1_fixed(input)
  ASSERT result = landPrice(input) + buildingPrice(input) を基にした正しい査定額
  ASSERT result >= 10,000,000  // 1000万円以上（AA13983の場合）
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、`fixedAssetTaxRoadPrice = 0` または `landArea = 0` の場合の既存動作が変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT calculateValuationAmount1_original(input) = calculateValuationAmount1_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストで多様な入力値（路線価、土地面積、建物面積、築年、構造）を生成し、修正前後で同じ結果になることを検証する。

**Test Cases**:
1. **路線価=0の保全**: 路線価=0の場合、修正前後で同じ結果（土地価格=0）になることを確認
2. **土地面積=0の保全**: 土地面積=0の場合、修正前後で同じ結果になることを確認
3. **建物価格計算の保全**: 減価償却ロジック（木造33年、鉄骨40年）が変わらないことを確認
4. **加算テーブルの保全**: 査定額2・3の加算テーブルが変わらないことを確認

### Unit Tests

- `calculateValuationAmount1` に `fixedAssetTaxRoadPrice = null` を渡した場合のバグ再現テスト
- `calculateValuationAmount1` に `fixedAssetTaxRoadPrice = 21700` を渡した場合の正常動作テスト
- AA13983相当のデータで期待値（¥13,800,000）が返されることを確認するテスト
- `fixedAssetTaxRoadPrice = 0` の場合、土地価格が0になることを確認するテスト

### Property-Based Tests

- 任意の `fixedAssetTaxRoadPrice > 0` と `landArea > 0` に対して、査定額1が `(landArea × fixedAssetTaxRoadPrice / 0.6 + buildingPrice) × 1.2` に基づいた値になることを検証
- 任意の `fixedAssetTaxRoadPrice = 0` または `landArea = 0` に対して、修正前後で同じ結果になることを検証（保全）
- 任意の建物情報（築年、構造、面積）に対して、建物価格計算が修正前後で同じになることを検証（保全）

### Integration Tests

- `autoCalculateValuations` 関数が `fixedAssetTaxRoadPrice` をリクエストボディに含めて計算APIを呼び出すことを確認
- 路線価を入力してから査定額が正しく計算・表示されることをE2Eで確認
- 手動入力査定額が存在する場合、自動計算をスキップすることを確認
