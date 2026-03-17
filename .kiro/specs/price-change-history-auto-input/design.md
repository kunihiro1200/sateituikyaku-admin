# 設計書：物件価格変更時の値下げ履歴自動入力

## 概要

物件リスト詳細画面（`PropertyListingDetailPage`）の価格情報セクションにおいて、売買価格（`sales_price`）を変更して保存した際に、値下げ履歴フィールド（`price_reduction_history`）へ自動的に履歴エントリを先頭追記する機能。

実装はフロントエンドのみで完結する。`PropertyListingDetailPage.tsx` の `handleSavePrice` 関数内で、APIを呼び出す前に履歴エントリを生成して `editedData` に統合する。バックエンドの変更は不要。

---

## アーキテクチャ

### 変更対象

```
frontend/frontend/src/pages/PropertyListingDetailPage.tsx
  └── handleSavePrice()  ← ここに自動追記ロジックを追加
```

### 処理フロー

```
ユーザーが売買価格を変更して保存ボタンを押す
  ↓
handleSavePrice() が呼び出される
  ↓
editedData.sales_price と data.sales_price（保存前の値）を比較
  ↓
[価格が変更されている場合]
  useAuthStore から employee.initials を取得
  現在日時から月/日を取得
  変更前・変更後の価格を万円単位（切り捨て）に変換
  履歴エントリを生成: "{initials}{月}/{日}　{変更前}万→{変更後}万"
  既存の price_reduction_history の先頭に追加
  editedData.price_reduction_history を更新
  ↓
[価格が変更されていない場合]
  何もしない
  ↓
api.put('/api/property-listings/{propertyNumber}', editedData) を呼び出す
  ↓
保存完了
```

### 依存関係

- `useAuthStore`（`frontend/frontend/src/store/authStore.ts`）: `employee.initials` の取得
- 既存の `api.put` エンドポイント: 変更なし
- `PriceSection` コンポーネント: 変更なし（`handleSavePrice` は `PropertyListingDetailPage` 側に存在）

---

## コンポーネントとインターフェース

### 変更する関数: `handleSavePrice`

**場所**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`（Line 267付近）

**現在の実装**:
```typescript
const handleSavePrice = async () => {
  if (!propertyNumber || Object.keys(editedData).length === 0) return;
  try {
    await api.put(`/api/property-listings/${propertyNumber}`, editedData);
    // ...
  }
};
```

**変更後の実装**:
```typescript
const handleSavePrice = async () => {
  if (!propertyNumber || Object.keys(editedData).length === 0) return;

  // 価格変更の検出と履歴エントリの自動生成
  const newSalesPrice = editedData.sales_price;
  const oldSalesPrice = propertyData?.sales_price; // 保存前の値

  if (newSalesPrice !== undefined && newSalesPrice !== oldSalesPrice && newSalesPrice !== null) {
    const initials = employee?.initials ?? '';
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}/${now.getDate()}`;
    const oldMan = Math.floor((oldSalesPrice ?? 0) / 10000);
    const newMan = Math.floor(newSalesPrice / 10000);
    const entry = `${initials}${dateStr}　${oldMan}万→${newMan}万`;

    const existing = editedData.price_reduction_history !== undefined
      ? editedData.price_reduction_history
      : (propertyData?.price_reduction_history ?? '');
    const updated = existing ? `${entry}\n${existing}` : entry;

    editedData = { ...editedData, price_reduction_history: updated };
  }

  try {
    await api.put(`/api/property-listings/${propertyNumber}`, editedData);
    // ...
  }
};
```

### 追加するimport

```typescript
import { useAuthStore } from '../store/authStore';
```

### `useAuthStore` の使用

```typescript
const { employee } = useAuthStore();
```

---

## データモデル

### 関連するDBカラム（変更なし）

| カラム名 | 型 | 説明 |
|---------|-----|------|
| `sales_price` | INTEGER（円単位） | 売買価格 |
| `price_reduction_history` | TEXT | 値下げ履歴（改行区切りのテキスト） |

### 履歴エントリのフォーマット

```
{initials}{月}/{日}　{変更前価格}万→{変更後価格}万
```

| 要素 | 取得元 | 例 |
|------|--------|-----|
| `{initials}` | `employee?.initials ?? ''` | `K` |
| `{月}/{日}` | `new Date()` から生成 | `3/17` |
| `{変更前価格}万` | `Math.floor(oldSalesPrice / 10000)` | `1850万` |
| `{変更後価格}万` | `Math.floor(newSalesPrice / 10000)` | `1350万` |
| 区切り文字 | 固定（全角スペース） | `　` |

### 先頭追記のロジック

```
既存の履歴が空の場合:
  price_reduction_history = entry

既存の履歴がある場合:
  price_reduction_history = entry + "\n" + existing
```

### 万円変換ルール

- 変換式: `Math.floor(price / 10000)`
- `null` / `undefined` の場合: `0` として扱う（`0万`）
- 四捨五入ではなく切り捨て

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。形式的に「何をすべきか」を述べる仕様であり、人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### プロパティ1: 価格変更時のみ履歴エントリが先頭に追加される

*任意の* 変更前価格・変更後価格・既存の履歴テキスト・イニシャルに対して、変更前と変更後の価格が異なり、かつ変更後が null でない場合、`generatePriceHistoryEntry` の結果の先頭行は新しい履歴エントリであり、既存の履歴テキストが後続に保持されている。逆に、変更前と変更後が同じ場合は履歴は変化しない。

**Validates: Requirements 1.1, 1.3, 1.5, 2.2, 5.1, 5.3**

### プロパティ2: 生成される履歴エントリのフォーマットが正しい

*任意の* イニシャル（空文字を含む）・変更前価格・変更後価格に対して、生成される履歴エントリは正規表現 `/^\S*\d+\/\d+　\d+万→\d+万$/` にマッチする。

**Validates: Requirements 1.2, 1.4, 4.2**

### プロパティ3: 万円変換は常に切り捨て整数

*任意の* 非負整数の円単位価格に対して、万円変換結果は `Math.floor(price / 10000)` と等しく、整数値である。

**Validates: Requirements 3.1, 3.3**

---

## エラーハンドリング

### `employee` が null の場合（未ログイン）

- `employee?.initials ?? ''` により空文字として処理
- 履歴エントリは生成される（イニシャルなし）
- エラーは発生しない

### `sales_price` が null に変更された場合

- 要件1.7に従い、自動追記を行わない
- `newSalesPrice !== null` の条件チェックで除外

### API呼び出し失敗

- 既存の `try/catch` でハンドリング済み
- 履歴エントリの生成はAPI呼び出し前に行われるため、API失敗時は保存されない（整合性が保たれる）

---

## テスト戦略

### ユニットテスト（具体例・エッジケース）

以下の具体例をテストする:

1. **基本ケース**: `18,500,000円 → 13,500,000円` の変更で `K3/17　1850万→1350万` が生成される
2. **既存履歴あり**: 既存の履歴テキストの先頭に新エントリが追加される
3. **価格未変更**: `editedData.sales_price === data.sales_price` の場合、履歴は変わらない
4. **null → 有価格**: 変更前が `null` の場合、`0万` として記録される
5. **有価格 → null**: 変更後が `null` の場合、追記しない
6. **イニシャルなし**: `employee.initials` が空の場合、`3/17　1850万→1350万` になる

### プロパティベーステスト（全入力に対する普遍的な性質）

プロパティベーステストには **fast-check**（TypeScript向けPBTライブラリ）を使用する。各テストは最低100回実行する。

各テストには以下のタグコメントを付与する:
```
// Feature: price-change-history-auto-input, Property {番号}: {プロパティテキスト}
```

**プロパティ1のテスト**:
```typescript
// Feature: price-change-history-auto-input, Property 1: 価格変更時に履歴エントリが先頭に追加される
fc.assert(fc.property(
  fc.record({
    oldPrice: fc.integer({ min: 1, max: 1_000_000_000 }),
    newPrice: fc.integer({ min: 1, max: 1_000_000_000 }).filter(p => p !== oldPrice),
    existingHistory: fc.string(),
    initials: fc.string({ maxLength: 5 }),
  }),
  ({ oldPrice, newPrice, existingHistory, initials }) => {
    const result = generatePriceHistoryEntry(oldPrice, newPrice, initials, existingHistory);
    const lines = result.split('\n');
    // 先頭行が新エントリ
    expect(lines[0]).toMatch(/^\S*\d+\/\d+　\d+万→\d+万$/);
    // 既存履歴が後続に保持される
    if (existingHistory) {
      expect(result).toContain(existingHistory);
    }
  }
), { numRuns: 100 });
```

**プロパティ3のテスト**:
```typescript
// Feature: price-change-history-auto-input, Property 3: 万円変換は切り捨て
fc.assert(fc.property(
  fc.integer({ min: 0, max: 1_000_000_000 }),
  (price) => {
    const result = toMan(price);
    expect(result).toBe(Math.floor(price / 10000));
    expect(Number.isInteger(result)).toBe(true);
  }
), { numRuns: 100 });
```

## テスト戦略

### デュアルテストアプローチ

ユニットテストとプロパティベーステストの両方を使用する。ユニットテストは具体的な例・エッジケース・エラー条件を検証し、プロパティテストは全入力に対する普遍的な性質を検証する。両者は補完的であり、どちらも必要。

### ユニットテスト（具体例・エッジケース）

以下の具体例をテストする:

1. **基本ケース**: `18,500,000円 → 13,500,000円` の変更で `K3/17　1850万→1350万` が生成される
2. **既存履歴あり**: 既存の履歴テキストの先頭に新エントリが追加される
3. **価格未変更**: `editedData.sales_price === data.sales_price` の場合、履歴は変わらない
4. **null → 有価格（エッジケース）**: 変更前が `null` の場合、`0万` として記録される（要件1.6）
5. **有価格 → null（エッジケース）**: 変更後が `null` の場合、追記しない（要件1.7）
6. **イニシャルなし（エッジケース）**: `employee.initials` が空の場合、`3/17　1850万→1350万` になる（要件1.4）
7. **9,999円以下（エッジケース）**: 変換後が `0万` になる（要件3.2）

### プロパティベーステスト（全入力に対する普遍的な性質）

プロパティベーステストには **fast-check**（TypeScript向けPBTライブラリ）を使用する。各テストは最低100回実行する。

各テストには以下のタグコメントを付与する:
```
// Feature: price-change-history-auto-input, Property {番号}: {プロパティテキスト}
```

**プロパティ1のテスト**:
```typescript
// Feature: price-change-history-auto-input, Property 1: 価格変更時のみ履歴エントリが先頭に追加される
fc.assert(fc.property(
  fc.record({
    oldPrice: fc.integer({ min: 1, max: 1_000_000_000 }),
    newPrice: fc.integer({ min: 1, max: 1_000_000_000 }),
    existingHistory: fc.string(),
    initials: fc.string({ maxLength: 5 }),
  }),
  ({ oldPrice, newPrice, existingHistory, initials }) => {
    if (oldPrice === newPrice) {
      // 価格未変更: 履歴は変化しない
      const result = buildUpdatedHistory(oldPrice, newPrice, initials, existingHistory);
      expect(result).toBe(existingHistory);
    } else {
      // 価格変更: 先頭に新エントリが追加される
      const result = buildUpdatedHistory(oldPrice, newPrice, initials, existingHistory);
      const lines = result.split('\n');
      expect(lines[0]).toMatch(/^\S*\d+\/\d+　\d+万→\d+万$/);
      if (existingHistory) expect(result).toContain(existingHistory);
    }
  }
), { numRuns: 100 });
```

**プロパティ2のテスト**:
```typescript
// Feature: price-change-history-auto-input, Property 2: 生成される履歴エントリのフォーマットが正しい
fc.assert(fc.property(
  fc.record({
    initials: fc.oneof(fc.constant(''), fc.string({ maxLength: 5 })),
    oldPrice: fc.integer({ min: 0, max: 1_000_000_000 }),
    newPrice: fc.integer({ min: 1, max: 1_000_000_000 }),
  }),
  ({ initials, oldPrice, newPrice }) => {
    const entry = generatePriceHistoryEntry(oldPrice, newPrice, initials);
    expect(entry).toMatch(/^\S*\d+\/\d+　\d+万→\d+万$/);
  }
), { numRuns: 100 });
```

**プロパティ3のテスト**:
```typescript
// Feature: price-change-history-auto-input, Property 3: 万円変換は常に切り捨て整数
fc.assert(fc.property(
  fc.integer({ min: 0, max: 1_000_000_000 }),
  (price) => {
    const result = toMan(price);
    expect(result).toBe(Math.floor(price / 10000));
    expect(Number.isInteger(result)).toBe(true);
  }
), { numRuns: 100 });
```

### テスト対象の純粋関数の抽出

テスト容易性のため、以下のロジックを純粋関数として抽出することを推奨する:

```typescript
// 万円変換
export function toMan(price: number): number {
  return Math.floor(price / 10000);
}

// 履歴エントリ生成（日付は引数で注入してテスト可能にする）
export function generatePriceHistoryEntry(
  oldPrice: number | null | undefined,
  newPrice: number,
  initials: string,
  dateStr: string  // "3/17" 形式
): string {
  const oldMan = toMan(oldPrice ?? 0);
  const newMan = toMan(newPrice);
  return `${initials}${dateStr}　${oldMan}万→${newMan}万`;
}

// 履歴の先頭追記
export function buildUpdatedHistory(
  oldPrice: number | null | undefined,
  newPrice: number | null | undefined,
  initials: string,
  existingHistory: string,
  dateStr: string
): string {
  if (newPrice === null || newPrice === undefined) return existingHistory;
  if (oldPrice === newPrice) return existingHistory;
  const entry = generatePriceHistoryEntry(oldPrice, newPrice, initials, dateStr);
  return existingHistory ? `${entry}\n${existingHistory}` : entry;
}
```
