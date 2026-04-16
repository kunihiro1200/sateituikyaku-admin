# 近隣買主候補価格表示バグ 設計ドキュメント

## Overview

近隣買主候補画面（`/sellers/:id/nearby-buyers`）において、買主の「価格」列に誤った値が表示されるバグを修正する。

**バグの概要**: `buyers`テーブルの`price`カラムは**万円単位**（例: 2380）で保存されているが、フロントエンドの`NearbyBuyersList.tsx`が表示時にさらに`/ 10000`を適用するため、2380 ÷ 10000 = **0.238万円**という誤表示が発生している。

**修正方針**: `NearbyBuyersList.tsx`の価格表示ロジックから不要な`/ 10000`変換を除去し、万円単位の値をそのまま表示する。

---

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `inquiry_price`が万円単位で格納されているにもかかわらず、表示時にさらに`/ 10000`が適用される状態
- **Property (P)**: 期待される正しい動作 — 万円単位の`inquiry_price`をそのまま万円として表示する
- **Preservation**: 修正によって変えてはいけない既存の動作 — 価格以外の列の表示、null/0価格の表示、他の買主候補の表示
- **`inquiry_price`**: バックエンドの`BuyerService.getBuyersByAreas()`が`buyers.price`をそのままマッピングして返すフィールド。単位は**万円**
- **`buyers.price`**: `buyers`テーブルのカラム。スプレッドシートの「価格」列（万円単位）を`typeConversions: "number"`でそのまま数値として保存。単位は**万円**
- **`NearbyBuyersList.tsx`**: 近隣買主候補リストを表示するReactコンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）

---

## Bug Details

### Bug Condition

バグは`NearbyBuyersList.tsx`の価格表示セルで発生する。`inquiry_price`が万円単位（例: 2380）で渡されているにもかかわらず、`/ 10000`を適用して万円表示しているため、値が10000分の1になる。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type NearbyBuyer
  OUTPUT: boolean

  // inquiry_priceが万円単位で格納されており、
  // かつ表示時に / 10000 が適用されている場合にtrueを返す
  RETURN X.inquiry_price IS NOT NULL
         AND X.inquiry_price > 0
         AND display_applies_division_by_10000(X.inquiry_price)
END FUNCTION
```

**問題のコード箇所** (`NearbyBuyersList.tsx`):
```tsx
// ❌ バグあり: inquiry_priceは既に万円単位なのに / 10000 している
{buyer.inquiry_price ? `${(buyer.inquiry_price / 10000).toLocaleString()}万円` : '-'}
```

### Examples

- `inquiry_price = 2380`（万円単位）→ 表示: `0.238万円` ❌ → 正しくは `2,380万円`
- `inquiry_price = 1500`（万円単位）→ 表示: `0.15万円` ❌ → 正しくは `1,500万円`
- `inquiry_price = 500`（万円単位）→ 表示: `0.05万円` ❌ → 正しくは `500万円`
- `inquiry_price = null` → 表示: `-` ✅（変換なし、影響なし）

---

## Expected Behavior

### Preservation Requirements

**変えてはいけない動作:**
- 価格が`null`または`0`の買主候補は引き続き`-`と表示される
- 価格列以外（買主番号・名前・配布エリア・問合せ物件情報・ヒアリング/内覧結果・最新状況・内覧日）の表示は変わらない
- 近隣買主候補リスト全体の件数・ソート・選択・メール送信・SMS送信・PDF印刷機能は変わらない

**スコープ:**
`inquiry_price`が`null`または`0`の行、および価格列以外のすべての列は、この修正によって一切影響を受けない。

---

## Hypothesized Root Cause

コード調査により根本原因が**確定**している（仮説ではなく確定済み）:

1. **フロントエンドの誤った単位変換**: `NearbyBuyersList.tsx`の価格表示セルで`buyer.inquiry_price / 10000`を適用している
   - `buyers.price`カラムはスプレッドシートの「価格」列（万円単位）を`typeConversions: "number"`でそのまま数値として保存
   - `BuyerService.getBuyersByAreas()`は`inquiry_price: buyer.price ?? null`として万円単位のままマッピング
   - フロントエンドが`/ 10000`を適用することで2380 → 0.238になる

2. **他の画面との不整合**: `backend/src/routes/buyers.ts`では`price / 10000`で万円表示しているが、そちらは`price`が**円単位**のデータ（`property_listings`テーブル等）を扱っている。`buyers.price`は万円単位であり、同じ変換式を誤って流用した可能性がある。

3. **バックエンドは正常**: `BuyerService.getBuyersByAreas()`は`inquiry_price: buyer.price ?? null`として正しく万円単位の値を返している。修正はフロントエンドのみ。

---

## Correctness Properties

Property 1: Bug Condition - 万円単位価格の正しい表示

_For any_ `NearbyBuyer`において`inquiry_price`が正の数値（万円単位）である場合、修正後の`NearbyBuyersList`コンポーネントは`inquiry_price`の値をそのまま万円として表示し（例: 2380 → `2,380万円`）、`/ 10000`などの追加変換を行わないものとする。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - null/0価格の表示維持

_For any_ `NearbyBuyer`において`inquiry_price`が`null`または`0`である場合、修正後のコンポーネントは修正前と同じく`-`を表示し、動作が変わらないものとする。

**Validates: Requirements 3.1, 3.3**

---

## Fix Implementation

### Changes Required

**ファイル**: `frontend/frontend/src/components/NearbyBuyersList.tsx`

**変更箇所**: 価格表示セル（`<TableCell>`内）

**具体的な変更**:

```tsx
// ❌ 修正前（バグあり）
<TableCell>
  {buyer.inquiry_price ? `${(buyer.inquiry_price / 10000).toLocaleString()}万円` : '-'}
</TableCell>

// ✅ 修正後
<TableCell>
  {buyer.inquiry_price ? `${buyer.inquiry_price.toLocaleString()}万円` : '-'}
</TableCell>
```

**変更の説明**:
- `/ 10000`を除去するだけ
- `inquiry_price`は既に万円単位なので、そのまま`toLocaleString()`でカンマ区切りにして`万円`を付けるだけでよい
- null/0チェックのロジックは変更しない

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを確認（探索的テスト）、次に修正後の正しい動作と保全を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `NearbyBuyersList`コンポーネントに`inquiry_price = 2380`のデータを渡し、表示が`0.238万円`になることを確認する。

**Test Cases**:
1. **標準価格テスト**: `inquiry_price = 2380`を渡す → 未修正コードでは`0.238万円`と表示される（FAIL）
2. **小数点価格テスト**: `inquiry_price = 500`を渡す → 未修正コードでは`0.05万円`と表示される（FAIL）
3. **大きな価格テスト**: `inquiry_price = 10000`を渡す → 未修正コードでは`1万円`と表示される（FAIL: 本来は`10,000万円`）
4. **null価格テスト**: `inquiry_price = null`を渡す → 未修正コードでも`-`と表示される（PASS: 影響なし）

**Expected Counterexamples**:
- `inquiry_price = 2380`のとき`2,380万円`ではなく`0.238万円`が表示される
- 原因: `/ 10000`の不要な変換

### Fix Checking

**Goal**: 修正後、`isBugCondition`が真のすべての入力で正しい表示になることを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE isBugCondition(buyer) DO
  result := renderPriceCell_fixed(buyer.inquiry_price)
  ASSERT result = `${buyer.inquiry_price.toLocaleString()}万円`
END FOR
```

### Preservation Checking

**Goal**: `inquiry_price`が`null`または`0`の場合、修正前後で動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL buyer WHERE NOT isBugCondition(buyer) DO
  ASSERT renderPriceCell_original(buyer.inquiry_price) = renderPriceCell_fixed(buyer.inquiry_price)
END FOR
```

**Testing Approach**: プロパティベーステストで多様な`inquiry_price`値（null、0、負数）を生成し、修正前後で同じ出力になることを確認する。

**Test Cases**:
1. **null価格の保全**: `inquiry_price = null` → 修正前後ともに`-`
2. **0価格の保全**: `inquiry_price = 0` → 修正前後ともに`-`（falsy値として扱われる）
3. **他列の保全**: 価格列以外のすべての列が修正後も同じ値を表示する

### Unit Tests

- `inquiry_price = 2380`のとき`2,380万円`と表示されることを確認
- `inquiry_price = null`のとき`-`と表示されることを確認
- `inquiry_price = 0`のとき`-`と表示されることを確認
- `inquiry_price = 1`（最小値）のとき`1万円`と表示されることを確認

### Property-Based Tests

- 任意の正の整数`n`に対して、`inquiry_price = n`のとき`${n.toLocaleString()}万円`と表示されることを確認（fast-check使用）
- 任意のnull/0/負数に対して、表示が`-`になることを確認

### Integration Tests

- 実際のAPIレスポンスデータを使って近隣買主候補画面を表示し、価格列が正しく表示されることを確認
- 買主番号7363（西田卓司）の価格が`2,380万円`と表示されることを確認
