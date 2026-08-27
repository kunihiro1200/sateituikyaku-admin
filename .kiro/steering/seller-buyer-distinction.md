---
inclusion: auto
---

# 売主・買主の区別ルール（最重要）

## ⚠️ 絶対に間違えないこと

`sellers`テーブルには**売主も買主も混在している**。
どちらが「売りたい人」でどちらが「買いたい人」かは、**押したボタン**で判断する。

---

## 📋 判断基準

### 売りたい人（Seller）

**条件**: 「この物件と買主をマッチング」ボタンを押している

**データベースの判定**:
- `match_updated_at IS NOT NULL` ← **売りたいボタンを押した日時**
- `match_areas`、`match_property_types`、`match_price_min/max`、`match_timing` に値がある

**使用するフィールド**:
- `match_areas`: 売却物件のエリア
- `match_property_types`: 売却物件の種別
- `property_address`: 売却物件の住所
- `property_type`: 売却物件の種別（フォールバック）

---

### 買いたい人（Buyer）

**条件**: 「売主をマッチング（買いたい）」ボタンを押している

**データベースの判定**:
- `buy_match_areas` または `buy_match_property_types` に値がある
- 通常、`match_updated_at` は `NULL`（売りたいボタンは押していない）

**使用するフィールド**:
- `buy_match_areas`: 購入希望エリア
- `buy_match_property_types`: 購入希望種別
- `buy_match_area_free_text`: 購入希望エリア（自由入力）
- `buy_match_price_min/max`: 購入希望価格帯
- `buy_match_timing`: 購入希望時期

---

## 🔵 マッチングの方向

### パターン1: 売りたい人 → 買いたい人を探す

**メソッド**: `findBuyerCandidatesForSeller(sellerId)`

**条件**:
- 売りたい人の `match_areas`、`match_property_types`、`property_address`
- 買いたい人の `buy_match_areas`、`buy_match_property_types`

**候補テーブル**:
1. `buyers` テーブル（買主専用テーブル）
2. `sellers` テーブルの買いたい条件（`buy_match_areas` に値がある売主）

---

### パターン2: 買いたい人 → 売りたい人を探す

**メソッド**: `findSellerCandidatesForSellerBuyIntent(buyerSellerId)`

**条件**:
- 買いたい人の `buy_match_areas`、`buy_match_property_types`
- 売りたい人の `match_areas`、`match_property_types`、`property_address`

**候補テーブル**:
- `sellers` テーブルの売りたい条件（`match_updated_at IS NOT NULL`）

---

## 🚨 よくある間違い

### ❌ 間違い1: sellersテーブル = 売主だと思い込む

```typescript
// ❌ 間違い（sellersテーブルには買主も含まれる）
const sellers = await supabase.from('sellers').select('*');
// これは「売りたい人」だけではなく、「買いたい人」も含む
```

### ✅ 正しい方法

```typescript
// ✅ 正しい（売りたい人のみ取得）
const sellers = await supabase
  .from('sellers')
  .select('*')
  .not('match_updated_at', 'is', null); // 売りたいボタンを押している

// ✅ 正しい（買いたい人のみ取得）
const buyers = await supabase
  .from('sellers')
  .select('*')
  .or('buy_match_areas.not.is.null,buy_match_property_types.not.is.null');
```

---

### ❌ 間違い2: AA9364の「買いたい条件」が空だから買いたい条件がないと判断

**AA9364**:
- `match_updated_at`: `2026-08-27` ← **売りたいボタンを押している**
- `buy_match_areas`: `[]` ← 空
- `buy_match_property_types`: `[]` ← 空

**正しい判断**: AA9364は**売りたい人**（買いたい条件が空なのは当然）

---

### ❌ 間違い3: AA14856の「売りたい条件」が空だから売りたい条件がないと判断

**AA14856**:
- `match_updated_at`: `null` ← 売りたいボタンは押していない
- `match_areas`: `[]` ← 空
- `match_property_types`: `[]` ← 空
- `buy_match_areas`: `['㊷別府駅周辺...']` ← **買いたい条件がある**
- `buy_match_property_types`: `['マンション']` ← **買いたい条件がある**

**正しい判断**: AA14856は**買いたい人**（売りたい条件が空なのは当然）

---

## 📊 具体例

### 例1: AA9364（売りたい）とAA14856（買いたい）のマッチング

**AA9364**:
- 売りたい: `match_updated_at` = `2026-08-27` ✅
- 物件住所: `別府市田の湯町10-31`
- 物件種別: `マ`（マンション）

**AA14856**:
- 買いたい: `buy_match_areas` = `['㊷別府駅周辺...']` ✅
- 買いたい: `buy_match_property_types` = `['マンション']` ✅

**マッチング判定**:
1. AA9364の物件住所「別府市田の湯町」とAA14856の買いたいエリア「㊷別府駅周辺（駅前本町、上田の湯町...）」が一致するか？
   - 「田の湯町」vs「上田の湯町」→ 共通部分「の湯町」（3文字）で一致 ✅
2. AA9364の物件種別「マンション」とAA14856の買いたい種別「マンション」が一致 ✅

**結果**: マッチングする ✅

---

### 例2: 8562とAA9364のマッチング（別府でマッチングすべきではない）

**8562**:
- 買いたい: 物件住所「別府市〇〇」

**AA9364**:
- 売りたい: 物件住所「別府市△△」

**マッチング判定**:
- 共通部分「別府」（2文字）→ ❌ 市区町村名なのでマッチングすべきではない
- 「別府市」以下の部分（「〇〇」と「△△」）が2文字以上一致している場合のみマッチング ✅

---

## 🔧 実装時のチェックリスト

マッチング機能を実装・修正する際は、以下を必ず確認：

- [ ] `sellers`テーブルには売主と買主が混在していることを理解しているか？
- [ ] 売りたい人の判定: `match_updated_at IS NOT NULL` を使っているか？
- [ ] 買いたい人の判定: `buy_match_areas` または `buy_match_property_types` に値があることを確認しているか？
- [ ] 売りたい人の条件: `match_*` フィールドを使っているか？
- [ ] 買いたい人の条件: `buy_match_*` フィールドを使っているか？
- [ ] 市区町村名（別府、大分など）を除外してマッチング判定しているか？

---

## 📝 マッチング条件の定義

### 売りたいマッチングの条件

**必須条件**（どちらか一つでも満たせばマッチング対象）:
1. **エリアが一致**
   - 売りたい人の `match_areas` と 買いたい人の `buy_match_areas` が1つ以上重なる
   - または、物件住所の市区町村名以下の部分が2文字以上一致

2. **種別が一致**
   - 売りたい人の `match_property_types`（または `property_type`）と 買いたい人の `buy_match_property_types` が一致

**除外条件**:
- 価格は条件ではない（チェックしない）
- 時期の陳腐化はチェックしない

---

## 🎯 まとめ

**最も重要なルール**:
1. `sellers`テーブル = 売主 **ではない**
2. `sellers`テーブル = 売主 + 買主（買い替え案件）が混在
3. どちらかは**押したボタン**で判断
   - 売りたい: `match_updated_at IS NOT NULL`
   - 買いたい: `buy_match_areas` または `buy_match_property_types` に値がある
4. 市区町村名（「別府」「大分」など）でマッチングしてはいけない
5. 「〇〇市」以下の2文字以上でマッチング

**このルールを徹底することで、マッチング機能の混乱を完全に防止できます。**

---

**最終更新日**: 2026年8月27日  
**作成理由**: KIROが何度も同じ間違いを繰り返すため、明確なルールを定義化  
**関連ファイル**: 
- `backend/src/services/MatchingIntentService.ts`
- `.kiro/steering/matching-button-architecture.md`
