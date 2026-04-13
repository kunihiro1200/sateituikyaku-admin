# 売主査定額計算エリア優先度バグ修正 設計ドキュメント

## 概要

売主管理システムの査定額計算ロジックにバグがある。
「土地（当社調べ）」「建物（当社調べ）」フィールドに独自調査値が入力されている場合、
これらの値を優先して査定額計算に使用すべきだが、現状では通常の土地面積・建物面積フィールドから計算してしまっている。

**影響範囲**: `backend/src/routes/valuations.ts` の `calculate-valuation-amount1` エンドポイント

**修正方針**: `seller.property` がnullの場合のフォールバック処理に `landAreaVerified` と `buildingAreaVerified` を追加する。

---

## 用語集

- **Bug_Condition (C)**: バグが発生する条件 — `seller.property` がnullであり、かつ `seller.landAreaVerified` または `seller.buildingAreaVerified` に値が存在する場合
- **Property (P)**: 期待される動作 — 「当社調べ」フィールドの値が優先されて査定額計算に使用される
- **Preservation（保持）**: 修正によって変更してはならない既存の動作 — 「当社調べ」フィールドが空の場合の通常フィールドを使った計算
- **calculateValuationAmount1**: `backend/src/services/ValuationCalculatorService.ts` の関数。`PropertyInfo` を受け取り、`buildingAreaVerified || buildingArea` および `landAreaVerified || landArea` という優先順位で面積を使用する（この部分は正しく実装済み）
- **calculate-valuation-amount1エンドポイント**: `backend/src/routes/valuations.ts` の `POST /:sellerId/calculate-valuation-amount1`。`seller.property` がnullの場合に `PropertyInfo` を構築するフォールバック処理にバグがある
- **landAreaVerified / buildingAreaVerified**: `PropertyInfo` 型の「土地（当社調べ）」「建物（当社調べ）」フィールド。DBカラム名は `land_area_verified` / `building_area_verified`

---

## バグ詳細

### バグ条件

`seller.property` がnullの場合（propertiesテーブルにレコードがない売主）、
`calculate-valuation-amount1` エンドポイントは `seller` の直接フィールドから `PropertyInfo` を構築する。
この際、`landAreaVerified` と `buildingAreaVerified` が含まれていないため、
`ValuationCalculatorService.calculateValuationAmount1` に渡される `PropertyInfo` には
「当社調べ」フィールドが常に `undefined` となる。

**形式的仕様:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller（getSeller()で取得済み）
  OUTPUT: boolean

  RETURN seller.property IS NULL
         AND (seller.landAreaVerified IS NOT NULL
              OR seller.buildingAreaVerified IS NOT NULL)
END FUNCTION
```

### 具体例

**AA13965の場合（バグ発生）:**
- `seller.property` = null（propertiesテーブルにレコードなし）
- `seller.landAreaVerified` = 165.3（土地（当社調べ）に値あり）
- `seller.buildingAreaVerified` = 99.2（建物（当社調べ）に値あり）
- `seller.landArea` = 150.0（通常の土地面積）
- `seller.buildingArea` = 90.0（通常の建物面積）

**現在の動作（バグあり）:**
フォールバック処理で構築される `PropertyInfo`:
```typescript
{
  landArea: 150.0,      // seller.landArea
  buildingArea: 90.0,   // seller.buildingArea
  // landAreaVerified と buildingAreaVerified が含まれていない
}
```
→ `calculateValuationAmount1` は `landArea=150.0`, `buildingArea=90.0` で計算してしまう

**期待される動作（修正後）:**
フォールバック処理で構築される `PropertyInfo`:
```typescript
{
  landArea: 150.0,
  buildingArea: 90.0,
  landAreaVerified: 165.3,    // seller.landAreaVerified を追加
  buildingAreaVerified: 99.2, // seller.buildingAreaVerified を追加
}
```
→ `calculateValuationAmount1` は `landAreaVerified=165.3`, `buildingAreaVerified=99.2` で計算する

**「当社調べ」フィールドがない場合（バグなし）:**
- `seller.landAreaVerified` = null
- `seller.buildingAreaVerified` = null
- → `calculateValuationAmount1` は `landArea`, `buildingArea` を使用（変化なし）

---

## 期待される動作

### 保持要件

**変更しない動作:**
- 「土地（当社調べ）」「建物（当社調べ）」の両方がnullの場合、通常の土地面積・建物面積フィールドから査定額を計算する
- `seller.property` が存在する場合（propertiesテーブルにレコードがある場合）の動作は変更しない
- 査定額2・査定額3の計算ロジックは変更しない
- 売主情報の他フィールド（氏名、電話番号、住所など）は影響を受けない

**スコープ:**
バグ条件に該当しない入力（「当社調べ」フィールドが空、または `seller.property` が存在する場合）は
この修正によって完全に影響を受けない。

---

## 根本原因の仮説

コードを調査した結果、根本原因は以下の通り：

**`backend/src/routes/valuations.ts` の `calculate-valuation-amount1` エンドポイント（約140行目）:**

```typescript
// seller の直接フィールドから PropertyInfo を構築（バグあり）
propertyInfo = {
  id: '',
  sellerId: seller.id || '',
  address: seller.propertyAddress || '',
  propertyType: seller.propertyType || '',
  landArea: seller.landArea || 0,
  buildingArea: seller.buildingArea || 0,
  buildYear: seller.buildYear || 0,
  structure: seller.structure || '',
  floorPlan: seller.floorPlan || '',
  currentStatus: (seller as any).currentStatus || '',
  sellerSituation: (seller as any).currentStatus || '',
  // ❌ landAreaVerified と buildingAreaVerified が含まれていない
} as any;
```

`ValuationCalculatorService.calculateValuationAmount1` 自体は正しく実装されており、
`buildingAreaVerified || buildingArea` および `landAreaVerified || landArea` という優先順位を持つ。
しかし、呼び出し元のフォールバック処理で `landAreaVerified` と `buildingAreaVerified` が
`PropertyInfo` に含まれていないため、常に `undefined` として扱われてしまう。

---

## 正確性プロパティ

Property 1: バグ条件 — 「当社調べ」フィールドの優先使用

_For any_ `seller` において、`seller.property` がnullであり、かつ `seller.landAreaVerified` または `seller.buildingAreaVerified` に値が存在する場合（isBugCondition が true）、
修正後の `calculate-valuation-amount1` エンドポイントは「当社調べ」フィールドの値を優先して
`calculateValuationAmount1` に渡し、正しい査定額を返す。

**Validates: Requirements 2.1, 2.2**

Property 2: 保持 — 「当社調べ」フィールドがない場合の動作保持

_For any_ `seller` において、`seller.landAreaVerified` と `seller.buildingAreaVerified` が
どちらもnull/undefinedである場合（isBugCondition が false）、
修正後のエンドポイントは修正前と同じ結果を返し、通常の土地面積・建物面積フィールドを使った
既存の計算動作を保持する。

**Validates: Requirements 3.1, 3.2**

---

## 修正実装

### 変更が必要なファイル

**ファイル**: `backend/src/routes/valuations.ts`

**関数**: `POST /:sellerId/calculate-valuation-amount1` エンドポイント内のフォールバック処理

**具体的な変更:**

1. **`landAreaVerified` の追加**: `seller.landAreaVerified` を `PropertyInfo` に含める
2. **`buildingAreaVerified` の追加**: `seller.buildingAreaVerified` を `PropertyInfo` に含める

**修正前:**
```typescript
propertyInfo = {
  id: '',
  sellerId: seller.id || '',
  address: seller.propertyAddress || '',
  propertyType: seller.propertyType || '',
  landArea: seller.landArea || 0,
  buildingArea: seller.buildingArea || 0,
  buildYear: seller.buildYear || 0,
  structure: seller.structure || '',
  floorPlan: seller.floorPlan || '',
  currentStatus: (seller as any).currentStatus || '',
  sellerSituation: (seller as any).currentStatus || '',
} as any;
```

**修正後:**
```typescript
propertyInfo = {
  id: '',
  sellerId: seller.id || '',
  address: seller.propertyAddress || '',
  propertyType: seller.propertyType || '',
  landArea: seller.landArea || 0,
  buildingArea: seller.buildingArea || 0,
  landAreaVerified: (seller as any).landAreaVerified || undefined,    // 追加
  buildingAreaVerified: (seller as any).buildingAreaVerified || undefined, // 追加
  buildYear: seller.buildYear || 0,
  structure: seller.structure || '',
  floorPlan: seller.floorPlan || '',
  currentStatus: (seller as any).currentStatus || '',
  sellerSituation: (seller as any).currentStatus || '',
} as any;
```

**注意**: `ValuationCalculatorService.calculateValuationAmount1` 内の優先順位ロジック
（`buildingAreaVerified || buildingArea`）は正しく実装されているため、変更不要。

---

## テスト戦略

### 検証アプローチ

テスト戦略は2フェーズで実施する：
まず修正前のコードでバグを再現するカウンター例を確認し、
次に修正後のコードで正しい動作と既存動作の保持を検証する。

### 探索的バグ条件チェック

**目標**: 修正前のコードでバグを実証するカウンター例を確認する。根本原因分析を確認または反証する。

**テスト計画**: `calculate-valuation-amount1` エンドポイントに対して、
`seller.property` がnullで「当社調べ」フィールドに値がある売主データを使ってテストを実行する。
修正前のコードでテストを実行して失敗を観察し、根本原因を理解する。

**テストケース:**
1. **土地（当社調べ）のみ設定**: `landAreaVerified=165.3`, `landArea=150.0`, `buildingAreaVerified=null` の場合、`landAreaVerified` が使われることを確認（修正前は失敗）
2. **建物（当社調べ）のみ設定**: `buildingAreaVerified=99.2`, `buildingArea=90.0`, `landAreaVerified=null` の場合、`buildingAreaVerified` が使われることを確認（修正前は失敗）
3. **両方設定**: `landAreaVerified=165.3`, `buildingAreaVerified=99.2` の場合、両方が使われることを確認（修正前は失敗）
4. **AA13965相当**: 実際の物件データに相当するパラメータでテスト（修正前は失敗）

**期待されるカウンター例:**
- 「当社調べ」フィールドに値があるにもかかわらず、通常フィールドの値で計算された査定額が返される
- 原因: `PropertyInfo` フォールバック構築時に `landAreaVerified`/`buildingAreaVerified` が含まれていない

### 修正チェック

**目標**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を返すことを検証する。

**疑似コード:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := calculateValuationAmount1_fixed(seller)
  ASSERT result は landAreaVerified/buildingAreaVerified を使って計算された値である
END FOR
```

### 保持チェック

**目標**: バグ条件が成立しない全ての入力に対して、修正後の関数が修正前と同じ結果を返すことを検証する。

**疑似コード:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT calculateValuationAmount1_original(seller) = calculateValuationAmount1_fixed(seller)
END FOR
```

**テストアプローチ**: 保持チェックにはプロパティベーステストを推奨する。理由：
- 入力ドメイン全体にわたって多数のテストケースを自動生成できる
- 手動ユニットテストでは見逃しがちなエッジケースを検出できる
- バグ条件に該当しない全ての入力に対して動作が変わらないことを強く保証できる

**テストケース:**
1. **「当社調べ」なし（両方null）**: 修正前後で同じ査定額が返されることを確認
2. **`seller.property` が存在する場合**: フォールバック処理を通らないため影響なし
3. **通常フィールドのみ設定**: `landArea`, `buildingArea` のみの場合、修正前後で同じ結果

### ユニットテスト

- `seller.property` がnullで `landAreaVerified` に値がある場合のフォールバック処理テスト
- `seller.property` がnullで `buildingAreaVerified` に値がある場合のフォールバック処理テスト
- `seller.property` がnullで両方nullの場合のフォールバック処理テスト（保持）
- `seller.property` が存在する場合のテスト（影響なし確認）

### プロパティベーステスト

- ランダムな `landAreaVerified` / `buildingAreaVerified` の値を生成し、「当社調べ」フィールドが優先されることを検証
- ランダムな `landArea` / `buildingArea` の値を生成し、「当社調べ」フィールドがnullの場合に通常フィールドが使われることを検証（保持）
- 多数のシナリオにわたって修正前後の動作が一致することを検証（バグ条件外）

### 統合テスト

- AA13965相当の物件データを使ったエンドツーエンドの査定額計算テスト
- `seller.property` がnullの売主に対する `calculate-valuation-amount1` APIエンドポイントテスト
- 修正後も `seller.property` が存在する売主の査定額計算が正しく動作することを確認
