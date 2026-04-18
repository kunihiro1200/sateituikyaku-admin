# 設計ドキュメント：売主リスト近隣買主PDF希望価格追加

## 概要

売主通話モードページ（`/sellers/:id/call`）の近隣買主セクションで、PDFボタンを押して印刷プレビューを表示した際に「問合せ物件情報」列の下に「希望価格：～」を追加表示する機能を実装する。

現在の `buildPrintContent` 関数は `inquiry_price`（問合せ価格）のみを出力しており、画面上に表示されている `price_range_house` / `price_range_apartment` / `price_range_land` の希望価格帯情報がPDFに含まれていない。本機能でこのギャップを解消する。

### 変更対象ファイル

| ファイル | 変更内容 |
|---------|---------|
| `frontend/frontend/src/components/nearbyBuyersPrintUtils.ts` | `NearbyBuyer` インターフェースへのフィールド追加、`buildPrintContent` への `propertyType` 引数追加、希望価格表示ロジック追加 |
| `frontend/frontend/src/components/NearbyBuyersList.tsx` | `handlePrint` 内の `buildPrintContent` 呼び出しに `propertyType` を追加 |

---

## アーキテクチャ

本機能はフロントエンドのみの変更であり、バックエンドAPIの変更は不要。

```mermaid
flowchart TD
    A[NearbyBuyersList\nhandlePrint] -->|buyers + selectedBuyers\n+ isNameHidden + propertyType| B[buildPrintContent\nnearbyBuyersPrintUtils.ts]
    B --> C{propertyType判定}
    C -->|戸/戸建/戸建て| D[price_range_house]
    C -->|マ/マンション/アパート| E[price_range_apartment]
    C -->|土/土地| F[price_range_land]
    C -->|その他/未設定| G[house→apartment→land\nフォールバック]
    D --> H[希望価格文字列]
    E --> H
    F --> H
    G --> H
    H -->|値あり| I[問合せ物件情報セルに\n希望価格：{値} を追加]
    H -->|null/空文字| J[希望価格行を表示しない]
```

### 設計方針

- `buildPrintContent` は純粋関数として維持する（副作用なし）
- 希望価格フィールド選択ロジックは `nearbyBuyersPrintUtils.ts` 内に閉じ込める
- `NearbyBuyersList.tsx` 側の変更は最小限（`propertyType` を渡すだけ）
- `propertyType` は省略可能（`undefined` の場合はフォールバックロジックを適用）

---

## コンポーネントとインターフェース

### nearbyBuyersPrintUtils.ts の変更

#### NearbyBuyer インターフェース（変更後）

```typescript
export interface NearbyBuyer {
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
  // 追加フィールド
  price_range_house?: string | null;
  price_range_apartment?: string | null;
  price_range_land?: string | null;
}
```

#### buildPrintContent 関数シグネチャ（変更後）

```typescript
export const buildPrintContent = (
  buyers: NearbyBuyer[],
  selectedBuyerNumbers: Set<string>,
  isNameHidden: boolean,
  propertyType?: string | null  // 追加（省略可能）
): string
```

#### 希望価格取得ロジック（新規追加）

```typescript
/**
 * 物件種別に応じた希望価格文字列を取得する（純粋関数）
 * NearbyBuyersList.tsx の getDesiredPriceStr と同等のロジック
 */
const getDesiredPriceForPrint = (
  buyer: NearbyBuyer,
  propertyType?: string | null
): string | null => {
  const pt = (propertyType || '').trim();
  if (pt === '戸' || pt === '戸建' || pt === '戸建て') {
    return buyer.price_range_house ?? null;
  }
  if (pt === 'マ' || pt === 'マンション' || pt === 'アパート') {
    return buyer.price_range_apartment ?? null;
  }
  if (pt === '土' || pt === '土地') {
    return buyer.price_range_land ?? null;
  }
  // 種別不明またはundefined: house → apartment → land の順でフォールバック
  return buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land || null;
};
```

#### 問合せ物件情報セルの変更箇所

```typescript
// 変更前
const inquiryInfo = inquiryParts.join(' / ') || '-';

// 変更後
const inquiryInfo = inquiryParts.join(' / ') || '-';
const desiredPrice = getDesiredPriceForPrint(buyer, propertyType);
const desiredPriceLine = desiredPrice
  ? `<br><span style="font-size:11px;">希望価格：${desiredPrice}</span>`
  : '';

// セル内容
`${inquiryInfo}${desiredPriceLine}`
```

### NearbyBuyersList.tsx の変更

#### handlePrint 関数の変更箇所

```typescript
// 変更前
printRoot.innerHTML = buildPrintContent(buyers, selectedBuyers, isNameHidden);

// 変更後
printRoot.innerHTML = buildPrintContent(buyers, selectedBuyers, isNameHidden, propertyType);
```

---

## データモデル

### 希望価格フィールドの取得元

希望価格フィールドはバックエンドAPIの `/api/sellers/:id/nearby-buyers` レスポンスから取得される。`NearbyBuyersList.tsx` の `NearbyBuyer` インターフェースには既に `price_range_house`、`price_range_apartment`、`price_range_land` が定義されており、APIレスポンスにも含まれている。

`nearbyBuyersPrintUtils.ts` の `NearbyBuyer` インターフェースにこれらのフィールドを追加することで、`buildPrintContent` 呼び出し時に型安全に渡せるようになる。

### 物件種別と希望価格フィールドのマッピング

| propertyType の値 | 使用するフィールド |
|-----------------|----------------|
| `"戸"` / `"戸建"` / `"戸建て"` | `price_range_house` |
| `"マ"` / `"マンション"` / `"アパート"` | `price_range_apartment` |
| `"土"` / `"土地"` | `price_range_land` |
| その他 / `undefined` / `null` | `price_range_house` → `price_range_apartment` → `price_range_land`（最初に値があるもの） |

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 物件種別に応じた希望価格フィールド選択

*For any* 買主データと物件種別文字列の組み合わせに対して、`getDesiredPriceForPrint` 関数は以下を満たす：
- `propertyType` が `"戸"` / `"戸建"` / `"戸建て"` のいずれかであれば、常に `price_range_house` の値を返す
- `propertyType` が `"マ"` / `"マンション"` / `"アパート"` のいずれかであれば、常に `price_range_apartment` の値を返す
- `propertyType` が `"土"` / `"土地"` のいずれかであれば、常に `price_range_land` の値を返す
- `propertyType` が上記以外または `undefined` / `null` であれば、`price_range_house` → `price_range_apartment` → `price_range_land` の順で最初に値があるフィールドを返す

**Validates: Requirements 1.3, 1.4, 1.5, 1.6**

### Property 2: 希望価格あり時のHTML出力

*For any* 希望価格フィールドに値が設定された買主データを含む `buildPrintContent` の呼び出しに対して、出力HTMLは「希望価格：{値}」という文字列を含む。

**Validates: Requirements 2.1, 2.3, 2.4**

### Property 3: 希望価格なし時のHTML出力

*For any* `price_range_house`、`price_range_apartment`、`price_range_land` が全て `null` または空文字の買主データを含む `buildPrintContent` の呼び出しに対して、出力HTMLは「希望価格：」という文字列を含まない。

**Validates: Requirements 2.2**

### Property 4: 既存列の維持

*For any* 買主データと引数の組み合わせに対して、`buildPrintContent` の出力HTMLは「買主番号」「名前」「受付日」「問合せ物件情報」「ヒアリング/内覧結果」「最新状況」の6列ヘッダーを全て含む。

**Validates: Requirements 4.1**

### Property 5: 名前非表示機能の維持

*For any* 買主データに対して、`isNameHidden=true` で `buildPrintContent` を呼び出した場合、出力HTMLは名前を黒塗りスタイル（`visibility:hidden` + 黒背景オーバーレイ）で表示する。

**Validates: Requirements 4.2**

---

## エラーハンドリング

### 希望価格フィールドが存在しない場合

`price_range_house`、`price_range_apartment`、`price_range_land` が全て `null`、`undefined`、または空文字の場合、希望価格行を表示しない（要件2.2）。`getDesiredPriceForPrint` が `null` を返すため、条件分岐で自然に処理される。

### propertyType が未設定の場合

`buildPrintContent` の `propertyType` 引数は省略可能（`undefined`）。この場合、フォールバックロジックが適用され、`price_range_house` → `price_range_apartment` → `price_range_land` の順で最初に値があるフィールドを使用する（要件1.6、4.4）。

### 後方互換性

`propertyType` 引数はオプショナルなため、既存の `buildPrintContent` 呼び出し元が引数を渡さなくても動作する。

---

## テスト戦略

### ユニットテスト（例ベース）

`nearbyBuyersPrintUtils.ts` の `buildPrintContent` は純粋関数であるため、ユニットテストが容易。

**テスト対象ケース:**

1. `propertyType="戸建"` の場合、`price_range_house` の値が「希望価格：」として出力される
2. `propertyType="マンション"` の場合、`price_range_apartment` の値が出力される
3. `propertyType="土地"` の場合、`price_range_land` の値が出力される
4. `propertyType` が未設定で `price_range_house` に値がある場合、`price_range_house` が使われる
5. `propertyType` が未設定で `price_range_house` が空、`price_range_apartment` に値がある場合、`price_range_apartment` が使われる
6. 全希望価格フィールドが `null` の場合、「希望価格：」が出力されない
7. `isNameHidden=true` の場合、名前が黒塗りスタイルで出力される（既存機能の回帰）
8. 既存の6列ヘッダーが全て出力される（既存機能の回帰）

### プロパティベーステスト（fast-check 使用）

TypeScript/React プロジェクトのため、[fast-check](https://fast-check.io/) を使用する。各プロパティテストは最低100回のイテレーションで実行する。

**Property 1: 物件種別に応じた希望価格フィールド選択**

```typescript
// Feature: seller-nearby-buyer-pdf-desired-price, Property 1: 物件種別に応じた希望価格フィールド選択
fc.assert(fc.property(
  fc.record({
    price_range_house: fc.option(fc.string(), { nil: null }),
    price_range_apartment: fc.option(fc.string(), { nil: null }),
    price_range_land: fc.option(fc.string(), { nil: null }),
  }),
  fc.oneof(
    fc.constant('戸'), fc.constant('戸建'), fc.constant('戸建て'),
    fc.constant('マ'), fc.constant('マンション'), fc.constant('アパート'),
    fc.constant('土'), fc.constant('土地'),
    fc.string(), // その他の種別
    fc.constant(undefined),
  ),
  (buyer, propertyType) => {
    const result = getDesiredPriceForPrint(buyer as NearbyBuyer, propertyType);
    const pt = (propertyType || '').trim();
    if (pt === '戸' || pt === '戸建' || pt === '戸建て') {
      return result === (buyer.price_range_house ?? null);
    }
    if (pt === 'マ' || pt === 'マンション' || pt === 'アパート') {
      return result === (buyer.price_range_apartment ?? null);
    }
    if (pt === '土' || pt === '土地') {
      return result === (buyer.price_range_land ?? null);
    }
    // フォールバック
    const expected = buyer.price_range_house || buyer.price_range_apartment || buyer.price_range_land || null;
    return result === expected;
  }
), { numRuns: 100 });
```

**Property 2 & 3: 希望価格のHTML出力**

```typescript
// Feature: seller-nearby-buyer-pdf-desired-price, Property 2: 希望価格あり時のHTML出力
fc.assert(fc.property(
  fc.array(fc.record({
    buyer_number: fc.string({ minLength: 1 }),
    name: fc.string(),
    price_range_house: fc.string({ minLength: 1 }), // 値あり
    // ... 他フィールド
  })),
  (buyers) => {
    const selected = new Set(buyers.map(b => b.buyer_number));
    const html = buildPrintContent(buyers as NearbyBuyer[], selected, false, '戸建');
    return buyers.every(b => html.includes(`希望価格：${b.price_range_house}`));
  }
), { numRuns: 100 });

// Feature: seller-nearby-buyer-pdf-desired-price, Property 3: 希望価格なし時のHTML出力
fc.assert(fc.property(
  fc.array(fc.record({
    buyer_number: fc.string({ minLength: 1 }),
    name: fc.string(),
    price_range_house: fc.constant(null),
    price_range_apartment: fc.constant(null),
    price_range_land: fc.constant(null),
    // ... 他フィールド
  })),
  (buyers) => {
    const selected = new Set(buyers.map(b => b.buyer_number));
    const html = buildPrintContent(buyers as NearbyBuyer[], selected, false, undefined);
    return !html.includes('希望価格：');
  }
), { numRuns: 100 });
```

**Property 4 & 5: 既存機能の維持**

```typescript
// Feature: seller-nearby-buyer-pdf-desired-price, Property 4: 既存列の維持
fc.assert(fc.property(
  fc.array(fc.record({ buyer_number: fc.string({ minLength: 1 }), name: fc.string() /* ... */ })),
  fc.boolean(),
  fc.option(fc.string(), { nil: undefined }),
  (buyers, isNameHidden, propertyType) => {
    const selected = new Set(buyers.map(b => b.buyer_number));
    const html = buildPrintContent(buyers as NearbyBuyer[], selected, isNameHidden, propertyType);
    return ['買主番号', '名前', '受付日', '問合せ物件情報', 'ヒアリング/内覧結果', '最新状況']
      .every(header => html.includes(header));
  }
), { numRuns: 100 });
```
