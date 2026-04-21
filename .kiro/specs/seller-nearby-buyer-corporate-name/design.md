# 設計ドキュメント: 近隣買主テーブルへの法人名列追加

## 概要

売主リストの近隣買主候補ページ（`NearbyBuyersList` コンポーネント）で「業者_土地」「業者_戸建」「業者_マンション」ボタンを押した際に表示される買主テーブル一覧に、買主名列の隣（右側）に「法人名」列を追加表示する。

法人名のデータソースは買主スプレッドシートのEE列（データベースカラム名: `corporate_name`）である。

### 変更の背景

現在のテーブルには買主名のみが表示されており、業者買主の所属法人を確認するには買主詳細ページを開く必要がある。法人名を一覧表示することで、担当者が業者買主の所属法人を素早く把握できるようになる。

本機能はバックエンドAPIの拡張（`getBuyersByAreas` の `.select()` に `corporate_name` を追加）とフロントエンドのテーブル表示変更の両方が必要である。

---

## アーキテクチャ

```mermaid
graph TD
    A[NearbyBuyersList.tsx] -->|GET /api/sellers/:id/nearby-buyers| B[backend/src/routes/sellers.ts]
    B -->|getBuyersByAreas| C[BuyerService.ts]
    C -->|.select() に corporate_name を追加| D[(Supabase DB: buyers テーブル)]
    D -->|corporate_name EE列| C
    C -->|各買主オブジェクトに corporate_name を含める| B
    B -->|buyers 配列に corporate_name を含める| A
    A -->|corporate_name ?? '-'| E[法人名列セル]
```

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `backend/src/services/BuyerService.ts` | `getBuyersByAreas` の `.select()` に `corporate_name` を追加 |
| `frontend/frontend/src/components/NearbyBuyersList.tsx` | `NearbyBuyer` インターフェースに `corporate_name` フィールドを追加、テーブルに「法人名」列を追加 |

---

## コンポーネントとインターフェース

### バックエンド: `BuyerService.getBuyersByAreas` の変更

**変更前の `.select()` ブロック（抜粋）**:
```typescript
const { data: allBuyers, error } = await this.supabase
  .from('buyers')
  .select(`
    buyer_id,
    buyer_number,
    name,
    latest_status,
    latest_viewing_date,
    inquiry_confidence,
    inquiry_source,
    distribution_type,
    distribution_areas,
    broker_inquiry,
    desired_area,
    desired_property_type,
    price_range_house,
    price_range_apartment,
    price_range_land,
    reception_date,
    email,
    phone_number,
    property_type,
    property_number,
    price,
    inquiry_hearing,
    viewing_result_follow_up
  `)
```

**変更後の `.select()` ブロック（抜粋）**:
```typescript
const { data: allBuyers, error } = await this.supabase
  .from('buyers')
  .select(`
    buyer_id,
    buyer_number,
    name,
    latest_status,
    latest_viewing_date,
    inquiry_confidence,
    inquiry_source,
    distribution_type,
    distribution_areas,
    broker_inquiry,
    desired_area,
    desired_property_type,
    price_range_house,
    price_range_apartment,
    price_range_land,
    reception_date,
    email,
    phone_number,
    property_type,
    property_number,
    price,
    inquiry_hearing,
    viewing_result_follow_up,
    corporate_name
  `)
```

また、メソッド末尾の `return sortedBuyers.map(buyer => ({ ... }))` に `corporate_name` を追加する:

**変更前**:
```typescript
return sortedBuyers.map(buyer => ({
  ...buyer,
  distribution_areas: this.parseDistributionAreas(buyer.distribution_areas || buyer.desired_area),
  inquiry_property_type: buyer.desired_property_type ?? null,
  inquiry_price: buyer.price ?? null,
  property_address: propertyAddressMap[buyer.property_number] ?? null,
  desired_type: buyer.desired_property_type ?? null,
}));
```

**変更後**:
```typescript
return sortedBuyers.map(buyer => ({
  ...buyer,
  distribution_areas: this.parseDistributionAreas(buyer.distribution_areas || buyer.desired_area),
  inquiry_property_type: buyer.desired_property_type ?? null,
  inquiry_price: buyer.price ?? null,
  property_address: propertyAddressMap[buyer.property_number] ?? null,
  desired_type: buyer.desired_property_type ?? null,
  corporate_name: buyer.corporate_name ?? null,
}));
```

### フロントエンド: `NearbyBuyer` インターフェースの変更

**変更前**:
```typescript
interface NearbyBuyer {
  buyer_number: string;
  name: string;
  distribution_areas: string[];
  latest_status: string;
  viewing_date: string;
  reception_date?: string;
  inquiry_hearing?: string;
  viewing_result_follow_up?: string;
  email?: string;
  phone_number?: string;
  property_address?: string | null;
  inquiry_property_type?: string | null;
  inquiry_price?: number | null;
  price_range_house?: string | null;
  price_range_apartment?: string | null;
  price_range_land?: string | null;
  desired_type?: string | null;
  broker_inquiry?: string | null;
  distribution_type?: string | null;
}
```

**変更後**:
```typescript
interface NearbyBuyer {
  buyer_number: string;
  name: string;
  distribution_areas: string[];
  latest_status: string;
  viewing_date: string;
  reception_date?: string;
  inquiry_hearing?: string;
  viewing_result_follow_up?: string;
  email?: string;
  phone_number?: string;
  property_address?: string | null;
  inquiry_property_type?: string | null;
  inquiry_price?: number | null;
  price_range_house?: string | null;
  price_range_apartment?: string | null;
  price_range_land?: string | null;
  desired_type?: string | null;
  broker_inquiry?: string | null;
  distribution_type?: string | null;
  corporate_name?: string | null;  // 追加: EE列「法人名」
}
```

### フロントエンド: テーブルヘッダーの変更

「名前」列の直後（右側）に「法人名」列ヘッダーを追加する:

```tsx
<TableCell sx={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('name')}>
  名前{getSortIcon('name')}
</TableCell>
{/* 追加: 法人名列 */}
<TableCell>法人名</TableCell>
```

### フロントエンド: テーブル行の変更

各行の「名前」セルの直後に「法人名」セルを追加する:

```tsx
{/* 名前セルの直後に追加 */}
<TableCell>
  {buyer.corporate_name || '-'}
</TableCell>
```

---

## データモデル

### Supabase `buyers` テーブル（既存カラム）

| カラム名 | 型 | スプレッドシート列 | 説明 |
|---------|-----|-----------------|------|
| `corporate_name` | TEXT | EE列「法人名」 | 買主の所属法人名（null 許容） |

`corporate_name` カラムは既にデータベースに存在し、スプレッドシートのEE列「法人名」と同期されている。本機能ではデータベーススキーマの変更は不要であり、APIクエリとフロントエンド表示のみを変更する。

### APIレスポンス構造

`GET /api/sellers/:id/nearby-buyers` のレスポンスの `buyers` 配列の各要素に `corporate_name` フィールドが追加される:

**変更前**:
```typescript
{
  buyer_number: string;
  name: string;
  // ... 他のフィールド
}
```

**変更後**:
```typescript
{
  buyer_number: string;
  name: string;
  // ... 他のフィールド
  corporate_name: string | null;  // 追加
}
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成り立つべき特性や動作のことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: APIレスポンスの全買主オブジェクトに corporate_name が含まれる

*任意の* 有効な売主IDに対して `GET /api/sellers/:id/nearby-buyers` を呼び出したとき、レスポンスの `buyers` 配列の全オブジェクトに `corporate_name` フィールドが含まれる（値は `string | null`）。

**Validates: Requirements 1.2, 1.3**

### Property 2: getBuyersByAreas の戻り値に corporate_name が含まれる

*任意の* エリア番号リストに対して `getBuyersByAreas` を呼び出したとき、戻り値の全オブジェクトに `corporate_name` フィールドが含まれる（値は `string | null`）。

**Validates: Requirements 2.2, 2.3**

### Property 3: 法人名列のレンダリング（値あり）

*任意の* `corporate_name` 値（null でない文字列）を持つ買主データに対して `NearbyBuyersList` をレンダリングしたとき、その値がテーブルの「法人名」列セルに表示される。

**Validates: Requirements 3.1, 3.2**

### Property 4: 法人名列のレンダリング（null または空文字）

*任意の* `corporate_name` が null または空文字の買主データに対して `NearbyBuyersList` をレンダリングしたとき、「法人名」列セルに「-」が表示される。

**Validates: Requirements 3.3**

### Property 5: 既存列の保全

*任意の* 買主データリストに対して `NearbyBuyersList` をレンダリングしたとき、既存の全列ヘッダー（買主番号・名前・配布エリア・問合せ物件情報・価格・希望価格・ヒアリング/内覧結果・最新状況・内覧日）が存在する。

**Validates: Requirements 4.3**

### Property 6: 業者フィルタートグル動作の保全

*任意の* フィルタータイプ（`'土地'` | `'戸建'` | `'マンション'`）に対して、同じフィルタータイプを2回適用したとき、フィルターが解除される（null に戻る）。また、異なるフィルタータイプを適用したとき、前のフィルターが解除されて新しいフィルターが適用される（排他切り替え）。

**Validates: Requirements 4.1**

### Property 7: 業者フィルターと価格帯フィルターのAND結合保全

*任意の* 買主データリスト、業者フィルター条件、価格帯フィルター条件に対して、フィルタリング結果は業者フィルターの結果と価格帯フィルターの結果の積集合（AND結合）と等しい。

**Validates: Requirements 4.2**

**プロパティ反省（冗長性の排除）**:
- Property 1 と Property 2 は異なるレイヤー（APIエンドポイント vs サービスメソッド）をテストしており、それぞれ独立した価値がある。
- Property 3 と Property 4 は同じ「法人名列のレンダリング」を値あり・なしで分けているが、これらは異なる条件分岐をテストしており、統合するよりも分けた方が明確。
- Property 6 と Property 7 は既存機能の保全テストであり、法人名追加後も動作が変わらないことを確認するために必要。

---

## エラーハンドリング

### バックエンド

| ケース | 対応 |
|-------|------|
| `corporate_name` カラムがデータベースに存在しない | Supabase が `null` を返す。`buyer.corporate_name ?? null` でフォールバック |
| `corporate_name` が null | そのまま `null` を返す（フロントエンドで「-」表示） |
| `corporate_name` が空文字 | そのまま空文字を返す（フロントエンドで「-」表示） |

### フロントエンド

| ケース | 対応 |
|-------|------|
| `buyer.corporate_name` が null | 「-」を表示 |
| `buyer.corporate_name` が空文字 | 「-」を表示（`buyer.corporate_name \|\| '-'` で処理） |
| `buyer.corporate_name` に値がある | その値をそのまま表示 |

---

## テスト戦略

### ユニットテスト（例ベース）

1. **`BuyerService.getBuyersByAreas` の `.select()` 静的解析**:
   - `corporate_name` が `.select()` ブロックに含まれることを確認
   - 既存の `nearby-buyer-fields-display-fix.exploration.test.ts` と同様のアプローチ

2. **`NearbyBuyersList` のレンダリング**:
   - `corporate_name` に値がある場合、その値が表示される
   - `corporate_name` が null の場合、「-」が表示される
   - `corporate_name` が空文字の場合、「-」が表示される

### プロパティベーステスト（fast-check 使用）

プロパティベーステストは `NearbyBuyersList` のレンダリングロジックと `BuyerService` の静的コード解析に適用する。

**ライブラリ**: `fast-check`（既存プロジェクトで使用済み）

**最小イテレーション数**: 100回

**テストタグ形式**: `Feature: seller-nearby-buyer-corporate-name, Property {番号}: {プロパティ内容}`

#### Property 3: 法人名列のレンダリング（値あり）
```typescript
// Feature: seller-nearby-buyer-corporate-name, Property 3: 法人名列のレンダリング（値あり）
fc.assert(fc.property(
  fc.string({ minLength: 1 }),
  (corporateName) => {
    const buyer = createMockBuyer({ corporate_name: corporateName });
    const rendered = renderNearbyBuyersRow(buyer);
    return rendered.includes(corporateName);
  }
));
```

#### Property 4: 法人名列のレンダリング（null または空文字）
```typescript
// Feature: seller-nearby-buyer-corporate-name, Property 4: 法人名列のレンダリング（null または空文字）
fc.assert(fc.property(
  fc.oneof(fc.constant(null), fc.constant('')),
  (corporateName) => {
    const buyer = createMockBuyer({ corporate_name: corporateName });
    const rendered = renderNearbyBuyersRow(buyer);
    return rendered.includes('-');
  }
));
```

#### Property 6: 業者フィルタートグル動作の保全
```typescript
// Feature: seller-nearby-buyer-corporate-name, Property 6: 業者フィルタートグル動作の保全
fc.assert(fc.property(
  fc.oneof(fc.constant('土地'), fc.constant('戸建'), fc.constant('マンション')),
  (filterType) => {
    // 同じボタンで解除
    const afterFirst = filterType;
    const afterSecond = afterFirst === filterType ? null : filterType;
    return afterSecond === null;
  }
));
```

#### Property 7: 業者フィルターと価格帯フィルターのAND結合保全
```typescript
// Feature: seller-nearby-buyer-corporate-name, Property 7: 業者フィルターと価格帯フィルターのAND結合保全
fc.assert(fc.property(
  fc.array(fc.record({ broker_inquiry: fc.string(), desired_type: fc.string(), price: fc.integer() })),
  fc.oneof(fc.constant('土地'), fc.constant('戸建'), fc.constant('マンション'), fc.constant(null)),
  fc.set(fc.oneof(fc.constant('under1000'), fc.constant('1000s'), fc.constant('2000s'))),
  (buyers, agencyFilter, priceRanges) => {
    const agencyFiltered = filterBuyersByAgency(buyers, agencyFilter);
    const bothFiltered = filterBuyersByPrice(agencyFiltered, new Set(priceRanges));
    const priceFiltered = filterBuyersByPrice(buyers, new Set(priceRanges));
    const andResult = agencyFiltered.filter(b => priceFiltered.includes(b));
    return bothFiltered.length === andResult.length;
  }
));
```

### インテグレーションテスト

- `GET /api/sellers/:id/nearby-buyers` のレスポンスの `buyers` 配列の各オブジェクトに `corporate_name` フィールドが含まれることを確認
- `corporate_name` が null の場合、`null` が返されることを確認
