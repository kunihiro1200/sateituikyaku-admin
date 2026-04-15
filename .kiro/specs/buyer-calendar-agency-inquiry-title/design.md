# デザインドキュメント

## 概要

`BuyerViewingResultPage` のカレンダー送信機能において、`buyer.broker_inquiry === '業者問合せ'` の場合にカレンダーイベントタイトル末尾へ `buyer.name`（氏名・会社名）をスペース区切りで追加する。

変更対象は `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` のみ。バックエンド変更は不要。

---

## アーキテクチャ

### 変更範囲

```
frontend/frontend/src/pages/BuyerViewingResultPage.tsx
  ├── generateCalendarTitle()  ← 変更なし（既存ロジックを維持）
  ├── applyAgencyInquiryTitle()  ← 新規追加（業者問合せ時のタイトル加工）
  └── handleCalendarButtonClick()  ← title 生成後に applyAgencyInquiryTitle を適用
```

`generateCalendarTitle` は既存の立会判定ロジックを持つため変更しない。業者問合せ用の加工は独立した純粋関数として分離する。

---

## コンポーネントとインターフェース

### 新規関数: `applyAgencyInquiryTitle`

```typescript
/**
 * 業者問合せ時にカレンダータイトル末尾に氏名・会社名を追加する
 * @param baseTitle - generateCalendarTitle で生成した基本タイトル
 * @param brokerInquiry - buyer.broker_inquiry の値
 * @param buyerName - buyer.name の値
 * @returns 加工後のタイトル文字列
 */
export function applyAgencyInquiryTitle(
  baseTitle: string,
  brokerInquiry: string | undefined | null,
  buyerName: string | undefined | null
): string
```

### `handleCalendarButtonClick` の変更箇所

```typescript
// 変更前
const title = generateCalendarTitle(
  buyer.viewing_mobile,
  buyer.viewing_type_general,
  property?.address,
  buyer.name
);

// 変更後
const baseTitle = generateCalendarTitle(
  buyer.viewing_mobile,
  buyer.viewing_type_general,
  property?.address,
  buyer.name
);
const title = applyAgencyInquiryTitle(baseTitle, buyer.broker_inquiry, buyer.name);
```

---

## データモデル

既存の `Buyer` インターフェースは `[key: string]: any` の動的型のため、追加フィールド定義は不要。

使用するフィールド:
- `buyer.broker_inquiry`: `string | null | undefined` — 業者問合せフィールド（DBカラム名）
- `buyer.name`: `string | null | undefined` — 氏名・会社名フィールド（DBカラム名）

---

## 正確性プロパティ

*プロパティとは、システムのすべての有効な実行において成立すべき特性または振る舞いのことです。プロパティは人間が読める仕様と機械検証可能な正確性保証の橋渡しをします。*

### Property 1: 業者問合せかつ name が非空の場合、タイトルに name がスペース区切りで追加される

*For any* 基本タイトル文字列と非空の buyerName に対して、`broker_inquiry === '業者問合せ'` の場合、`applyAgencyInquiryTitle` の戻り値は `{baseTitle} {buyerName}` と等しい。

**Validates: Requirements 1.1, 1.4**

### Property 2: name が空/null の場合はタイトルを変更しない

*For any* 基本タイトル文字列に対して、`broker_inquiry === '業者問合せ'` であっても `buyerName` が空文字・null・空白のみの文字列の場合、`applyAgencyInquiryTitle` の戻り値は `baseTitle` と等しい。

**Validates: Requirements 1.2**

### Property 3: broker_inquiry が '業者問合せ' 以外の任意の値の場合はタイトルを変更しない

*For any* 基本タイトル文字列と任意の buyerName に対して、`broker_inquiry` が `'業者問合せ'` 以外の値（null、空文字、その他の文字列）の場合、`applyAgencyInquiryTitle` の戻り値は `baseTitle` と等しい。

**Validates: Requirements 1.3**

---

## エラーハンドリング

- `broker_inquiry` が `undefined` / `null` の場合: 既存動作を維持（タイトル変更なし）
- `name` が `undefined` / `null` / 空文字 / 空白のみの場合: タイトル変更なし
- 上記はすべて `applyAgencyInquiryTitle` 内で安全に処理する

---

## テスト戦略

### 単体テスト（example-based）

- `broker_inquiry === '業者問合せ'` かつ `name = '山田太郎'` → タイトル末尾に ` 山田太郎` が追加される
- `broker_inquiry === '業者問合せ'` かつ `name = ''` → タイトル変更なし
- `broker_inquiry === '業者問合せ'` かつ `name = null` → タイトル変更なし
- `broker_inquiry === null` かつ `name = '山田太郎'` → タイトル変更なし
- `broker_inquiry === '直接問合せ'` かつ `name = '山田太郎'` → タイトル変更なし
- `handleCalendarButtonClick` 内で `text` パラメータ以外（`details`、`location`、`dates`、`add`）が変わらないこと（要件 1.5）

### プロパティテスト（property-based）

ライブラリ: **fast-check**（TypeScript/React プロジェクトに適合）

各プロパティテストは最低 100 イテレーション実行する。

```typescript
// タグ形式: Feature: buyer-calendar-agency-inquiry-title, Property {N}: {property_text}

// Property 1: 業者問合せかつ name が非空の場合、タイトルに name がスペース区切りで追加される
fc.assert(fc.property(
  fc.string(), // baseTitle
  fc.string({ minLength: 1 }).filter(s => s.trim().length > 0), // 非空 buyerName
  (baseTitle, buyerName) => {
    const result = applyAgencyInquiryTitle(baseTitle, '業者問合せ', buyerName);
    return result === `${baseTitle} ${buyerName}`;
  }
), { numRuns: 100 });

// Property 2: name が空/null の場合はタイトルを変更しない
fc.assert(fc.property(
  fc.string(), // baseTitle
  fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined), fc.string().map(s => s.replace(/\S/g, ' '))), // 空/null/空白のみ
  (baseTitle, emptyName) => {
    const result = applyAgencyInquiryTitle(baseTitle, '業者問合せ', emptyName);
    return result === baseTitle;
  }
), { numRuns: 100 });

// Property 3: broker_inquiry が '業者問合せ' 以外の場合はタイトルを変更しない
fc.assert(fc.property(
  fc.string(), // baseTitle
  fc.string(), // buyerName
  fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''), fc.string().filter(s => s !== '業者問合せ')), // '業者問合せ' 以外
  (baseTitle, buyerName, brokerInquiry) => {
    const result = applyAgencyInquiryTitle(baseTitle, brokerInquiry, buyerName);
    return result === baseTitle;
  }
), { numRuns: 100 });
```
