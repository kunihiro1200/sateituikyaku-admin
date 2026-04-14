# 設計ドキュメント：売主・買主・物件リスト検索強化

## 概要

売主リスト（/sellers）・買主リスト（/buyers）・物件リスト（/properties）の各一覧ページにおける検索機能を強化する。主な変更点は以下の通り：

- **売主リスト**: `property_address`（物件住所）フィールドを検索対象に追加
- **買主リスト**: `property_address`（物件住所）フィールドを検索対象に追加
- **物件リスト**: `seller_phone`（売主電話番号）フィールドを検索対象に追加
- 各ページのプレースホルダーテキストを更新

### 重要な制約

売主の `name`・`phone_number`・`email` はAES-256-GCMで暗号化されてDBに保存されている。これらのフィールドの検索は、バックエンドで全件取得→復号→フィルタリングの方式が必要。`property_address` は暗号化されていないため、DBレベルでの直接検索が可能。

---

## アーキテクチャ

### 全体構成

```
フロントエンド (frontend/frontend/src/pages/)
  ├── SellersPage.tsx         ← バックエンドAPI経由で検索
  ├── BuyersPage.tsx          ← フロントエンドキャッシュ + バックエンドAPI
  └── PropertyListingsPage.tsx ← フロントエンドキャッシュのみ（全件取得済み）

バックエンド (backend/src/)
  ├── routes/sellers.ts       ← GET /api/sellers/search
  ├── routes/buyers.ts        ← GET /api/buyers（searchパラメータ）
  └── services/
      ├── SellerService.supabase.ts  ← searchSellers() を修正
      ├── BuyerService.ts            ← getAll() / search() を修正
      └── PropertyListingService.ts  ← getAll() を修正（seller_phone追加）
```

### 検索方式の違い

| ページ | 検索方式 | 理由 |
|--------|---------|------|
| 売主リスト | バックエンドAPI（Enter/ボタン押下時） | 暗号化フィールドの復号が必要 |
| 買主リスト | フロントエンドキャッシュ優先、未ロード時はAPI | 全件キャッシュ済みの場合はフロント側でフィルタ |
| 物件リスト | フロントエンドキャッシュのみ | 全件取得済み、seller_phoneをDBから取得して保持 |

---

## コンポーネントとインターフェース

### 1. 売主リスト検索（バックエンド変更）

**変更ファイル**: `backend/src/services/SellerService.supabase.ts`

`searchSellers()` メソッドのスロウパス（暗号化フィールド検索）に `property_address` の部分一致を追加する。`property_address` は暗号化されていないため、DBクエリレベルでの事前フィルタリングも可能だが、既存のスロウパスのフィルタリングロジックに追加する形で実装する。

```typescript
// 変更前（スロウパスのフィルタ部分）
const results = decryptedSellers.filter(
  (seller) =>
    (seller.name && seller.name.toLowerCase().includes(lowerQuery)) ||
    (seller.address && seller.address.toLowerCase().includes(lowerQuery)) ||
    (seller.phoneNumber && seller.phoneNumber.toLowerCase().includes(lowerQuery)) ||
    (seller.email && seller.email.toLowerCase().includes(lowerQuery)) ||
    (seller.sellerNumber && seller.sellerNumber.toLowerCase().includes(lowerQuery))
);

// 変更後（property_address を追加）
const results = decryptedSellers.filter(
  (seller) =>
    (seller.name && seller.name.toLowerCase().includes(lowerQuery)) ||
    (seller.address && seller.address.toLowerCase().includes(lowerQuery)) ||
    (seller.phoneNumber && seller.phoneNumber.toLowerCase().includes(lowerQuery)) ||
    (seller.email && seller.email.toLowerCase().includes(lowerQuery)) ||
    (seller.sellerNumber && seller.sellerNumber.toLowerCase().includes(lowerQuery)) ||
    (seller.propertyAddress && seller.propertyAddress.toLowerCase().includes(lowerQuery))
);
```

また、`property_address` が暗号化されていないため、DBクエリ段階でも事前フィルタリングを追加することで、スロウパスの取得件数を絞り込める：

```typescript
// スロウパスのDBクエリに property_address の ilike 条件を追加
// ただし、暗号化フィールドとのOR検索のため、全件取得は維持しつつ
// property_address のみで一致する場合の高速パスを追加
```

**変更ファイル**: `frontend/frontend/src/pages/SellersPage.tsx`

プレースホルダーテキストを更新する：

```tsx
// 変更前
placeholder="名前、住所、電話番号で検索"

// 変更後
placeholder="名前、住所、電話番号、物件住所で検索"
```

### 2. 買主リスト検索（フロントエンド + バックエンド変更）

**変更ファイル**: `frontend/frontend/src/pages/BuyersPage.tsx`

フロントエンドキャッシュ使用時のフィルタリングロジックに `property_address` を追加する：

```typescript
// 変更前
filtered = filtered.filter(b => {
  if (isBuyerNumber) return (b.buyer_number || '') === s;
  return (
    (b.buyer_number || '').toLowerCase().includes(s) ||
    (b.name || '').toLowerCase().includes(s) ||
    (b.phone_number || '').toLowerCase().includes(s) ||
    (b.email || '').toLowerCase().includes(s) ||
    (b.property_number || '').toLowerCase().includes(s)
  );
});

// 変更後（property_address を追加）
filtered = filtered.filter(b => {
  if (isBuyerNumber) return (b.buyer_number || '') === s;
  return (
    (b.buyer_number || '').toLowerCase().includes(s) ||
    (b.name || '').toLowerCase().includes(s) ||
    (b.phone_number || '').toLowerCase().includes(s) ||
    (b.email || '').toLowerCase().includes(s) ||
    (b.property_number || '').toLowerCase().includes(s) ||
    (b.property_address || '').toLowerCase().includes(s)
  );
});
```

プレースホルダーテキストを更新する：

```tsx
// 変更前
placeholder="検索（買主番号、氏名、電話番号、メールアドレス、物件番号）"

// 変更後
placeholder="買主番号、氏名、電話番号、メールアドレス、物件番号、物件住所で検索"
```

**変更ファイル**: `backend/src/services/BuyerService.ts`

バックエンドAPI経由の検索（キャッシュ未ロード時）でも `property_address` を検索対象に含める。`property_address` は `property_listings.address` から取得されるため、JOINまたはサブクエリが必要。

ただし、`buyers` テーブルには `property_address` カラムが存在しないため、`getAll()` の検索ロジックでは `property_number` を経由して `property_listings.address` を参照する必要がある。

実装方針：`getAll()` の検索時に `property_address` が指定された場合、まず `property_listings` テーブルから住所が一致する `property_number` を取得し、その `property_number` を持つ買主を返す。

```typescript
// getAll() の検索ロジック修正
if (search) {
  const isBuyerNumber = /^\d{4,5}$/.test(search);
  if (isBuyerNumber) {
    query = query.eq('buyer_number', search);
  } else {
    // まず property_listings から住所一致の property_number を取得
    const { data: matchingProperties } = await this.supabase
      .from('property_listings')
      .select('property_number')
      .ilike('address', `%${search}%`);
    
    const matchingPropertyNumbers = (matchingProperties || [])
      .map((p: any) => p.property_number)
      .filter(Boolean);
    
    if (matchingPropertyNumbers.length > 0) {
      query = query.or(
        `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,property_number.ilike.%${search}%,property_number.in.(${matchingPropertyNumbers.join(',')})`
      );
    } else {
      query = query.or(
        `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,property_number.ilike.%${search}%`
      );
    }
  }
}
```

### 3. 物件リスト検索（フロントエンド変更）

**変更ファイル**: `frontend/frontend/src/pages/PropertyListingsPage.tsx`

`PropertyListing` インターフェースに `seller_phone` フィールドを追加し、フィルタリングロジックに追加する：

```typescript
// インターフェース変更
interface PropertyListing {
  // ... 既存フィールド
  seller_phone?: string;  // 追加
}

// フィルタリングロジック変更
listings = listings.filter(l =>
  (l.property_number ? normalizeText(l.property_number) : '').includes(query) ||
  (l.address ? normalizeText(l.address) : '').includes(query) ||
  (l.display_address ? normalizeText(l.display_address) : '').includes(query) ||
  (l.seller_name ? normalizeText(l.seller_name) : '').includes(query) ||
  (l.seller_email ? normalizeText(l.seller_email) : '').includes(query) ||
  (l.buyer_name ? normalizeText(l.buyer_name) : '').includes(query) ||
  (l.seller_phone ? normalizeText(l.seller_phone) : '').includes(query)  // 追加
);
```

プレースホルダーテキストを更新する：

```tsx
// 変更前
placeholder="Search 物件（物件番号、所在地、売主、売主メール、買主）"

// 変更後
placeholder="物件番号、所在地、売主、売主電話番号、買主で検索"
```

**変更ファイル**: `backend/src/services/PropertyListingService.ts`

`getAll()` の SELECT クエリに `seller_phone` を追加し、検索条件にも追加する：

```typescript
// SELECT に seller_phone を追加
.select(`
  id,
  property_number,
  // ... 既存フィールド
  seller_name,
  seller_email,
  seller_phone,  // 追加
  buyer_name,
  // ...
`)

// 検索条件に seller_phone を追加
query = query.or(
  `property_number.ilike.%${search}%,address.ilike.%${search}%,display_address.ilike.%${search}%,seller_name.ilike.%${search}%,seller_email.ilike.%${search}%,seller_phone.ilike.%${search}%`
);
```

**重要**: `property_listings` テーブルには現在 `seller_phone` カラムが存在しない。以下の2つのアプローチが考えられる：

**アプローチA（推奨）: `property_listings` テーブルに `seller_phone` カラムを追加**

```sql
ALTER TABLE public.property_listings
ADD COLUMN IF NOT EXISTS seller_phone TEXT;
COMMENT ON COLUMN public.property_listings.seller_phone IS '売主電話番号（復号済み）';
```

`PropertyListingSyncService` で売主データを同期する際に、`sellers.phone_number` を復号して `property_listings.seller_phone` に保存する。

**アプローチB: 検索時に `sellers` テーブルをJOINして取得**

`PropertyListingService.getAll()` の検索時に、`sellers` テーブルから電話番号が一致する `seller_number` を取得し、その `seller_number` を持つ物件を返す。ただし、売主の電話番号は暗号化されているため、全件取得→復号→フィルタリングが必要となり、パフォーマンスへの影響が大きい。

**採用方針**: アプローチAを採用する。`property_listings.seller_name` と同様に、復号済みの電話番号をカラムとして保持することで、高速な検索が可能になる。

---

## データモデル

### 既存テーブル構造（関連部分）

**`sellers` テーブル**

| カラム | 型 | 暗号化 | 説明 |
|--------|-----|--------|------|
| `seller_number` | TEXT | なし | 売主番号（例: AA12345） |
| `name` | TEXT | **あり** | 売主名 |
| `phone_number` | TEXT | **あり** | 電話番号 |
| `email` | TEXT | **あり** | メールアドレス |
| `address` | TEXT | なし | 売主住所 |
| `property_address` | TEXT | なし | 物件住所（R列「物件所在地」） |

**`buyers` テーブル**

| カラム | 型 | 説明 |
|--------|-----|------|
| `buyer_number` | TEXT | 買主番号 |
| `name` | TEXT | 氏名 |
| `phone_number` | TEXT | 電話番号 |
| `email` | TEXT | メールアドレス |
| `property_number` | TEXT | 物件番号 |
| `property_address` | TEXT | 物件住所（`property_listings.address` から取得） |

**`property_listings` テーブル**

| カラム | 型 | 説明 |
|--------|-----|------|
| `property_number` | TEXT | 物件番号 |
| `address` | TEXT | 所在地 |
| `display_address` | TEXT | 住居表示 |
| `seller_name` | TEXT | 売主名（復号済み） |
| `seller_email` | TEXT | 売主メール（復号済み） |
| `seller_phone` | TEXT | 売主電話番号（復号済み、要追加） |
| `buyer_name` | TEXT | 買主名 |

### 正規化ロジック

全ページで共通の正規化処理を適用する：

```typescript
// 全角英数字・スペースを半角に変換（NFKC正規化）
function normalizeSearch(str: string): string {
  return str
    .normalize('NFKC')
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    .replace(/　/g, ' ')
    .trim();
}
```

---

## 正確性プロパティ

*プロパティとは、システムの全ての有効な実行において成立すべき特性や振る舞いのことです。プロパティは人間が読める仕様と機械で検証可能な正確性保証の橋渡しをします。*

### Property 1: 売主検索の網羅性

*For any* 検索クエリと売主データセットに対して、`searchSellers()` が返す結果は、売主番号・名前・電話番号・メールアドレス・売主住所・物件住所のいずれかにクエリが部分一致する売主のみを含む

**Validates: Requirements 1.1, 1.3**

### Property 2: 買主検索の網羅性

*For any* 検索クエリと買主データセットに対して、フロントエンドのフィルタリングロジックが返す結果は、買主番号・氏名・電話番号・メールアドレス・物件番号・物件住所のいずれかにクエリが部分一致する買主のみを含む

**Validates: Requirements 2.1, 2.3**

### Property 3: 正規化の冪等性

*For any* 文字列に対して、`normalizeSearch()` を2回適用した結果は1回適用した結果と等しい

**Validates: Requirements 1.5, 2.5, 3.4**

### Property 4: 全角→半角変換の正確性

*For any* 全角英数字・全角スペースを含む文字列に対して、`normalizeSearch()` を適用した結果は対応する半角文字のみを含む

**Validates: Requirements 1.5, 2.5, 3.4**

### Property 5: 物件リスト検索の網羅性

*For any* 検索クエリと物件データセットに対して、フロントエンドのフィルタリングロジックが返す結果は、物件番号・所在地・住居表示・売主名・売主メール・買主名・売主電話番号のいずれかにクエリが部分一致する物件のみを含む

**Validates: Requirements 3.1, 3.2**

---

## エラーハンドリング

### 売主検索

- 検索クエリが空の場合: 通常の一覧取得（`fetchSellers()`）にフォールバック
- バックエンドAPIエラー: `console.error` でログ出力、ローディング状態を解除
- 復号エラー: 個別の売主をスキップして処理継続（既存の実装を維持）

### 買主検索

- キャッシュ未ロード時のAPIエラー: 既存のエラーハンドリングを維持
- `property_listings` JOINクエリのエラー: フォールバックとして `property_address` なしの検索を実行

### 物件リスト検索

- `seller_phone` が `null` / `undefined` の場合: 空文字列として扱い、検索対象から除外
- 全件ロード中の検索: 「検索中...」を表示（既存の実装を維持）

---

## テスト戦略

### ユニットテスト

以下の具体的なケースをユニットテストでカバーする：

1. `normalizeSearch()` / `normalizeText()` の正規化テスト
   - 全角英数字 → 半角変換
   - 全角スペース → 半角スペース変換
   - 空文字列の処理

2. `searchSellers()` の `property_address` 検索テスト
   - 物件住所に一致する売主が返ること
   - 物件住所に一致しない売主が返らないこと

3. 買主フィルタリングロジックの `property_address` テスト
   - 物件住所に一致する買主が返ること

4. 物件フィルタリングロジックの `seller_phone` テスト
   - 売主電話番号に一致する物件が返ること

5. プレースホルダーテキストの確認テスト（各ページ）

### プロパティベーステスト

プロパティベーステストには [fast-check](https://github.com/dubzzz/fast-check)（TypeScript/JavaScript向け）を使用する。各プロパティテストは最低100回のイテレーションで実行する。

**Property 1 & 2 & 5: 検索結果の網羅性**

```typescript
// タグ: Feature: list-search-enhancement, Property 1: 売主検索の網羅性
it('searchSellers returns only matching sellers', () => {
  fc.assert(
    fc.property(
      fc.string({ minLength: 1, maxLength: 20 }),
      fc.array(fc.record({
        name: fc.string(),
        phoneNumber: fc.string(),
        email: fc.string(),
        address: fc.string(),
        propertyAddress: fc.string(),
        sellerNumber: fc.string(),
      })),
      (query, sellers) => {
        const lowerQuery = query.toLowerCase();
        const results = sellers.filter(s =>
          (s.name || '').toLowerCase().includes(lowerQuery) ||
          (s.phoneNumber || '').toLowerCase().includes(lowerQuery) ||
          (s.email || '').toLowerCase().includes(lowerQuery) ||
          (s.address || '').toLowerCase().includes(lowerQuery) ||
          (s.propertyAddress || '').toLowerCase().includes(lowerQuery) ||
          (s.sellerNumber || '').toLowerCase().includes(lowerQuery)
        );
        // 結果が全て条件を満たすことを確認
        return results.every(s =>
          (s.name || '').toLowerCase().includes(lowerQuery) ||
          (s.phoneNumber || '').toLowerCase().includes(lowerQuery) ||
          (s.email || '').toLowerCase().includes(lowerQuery) ||
          (s.address || '').toLowerCase().includes(lowerQuery) ||
          (s.propertyAddress || '').toLowerCase().includes(lowerQuery) ||
          (s.sellerNumber || '').toLowerCase().includes(lowerQuery)
        );
      }
    ),
    { numRuns: 100 }
  );
});
```

**Property 3 & 4: 正規化の冪等性と正確性**

```typescript
// タグ: Feature: list-search-enhancement, Property 3: 正規化の冪等性
it('normalizeSearch is idempotent', () => {
  fc.assert(
    fc.property(
      fc.string(),
      (str) => {
        const once = normalizeSearch(str);
        const twice = normalizeSearch(once);
        return once === twice;
      }
    ),
    { numRuns: 100 }
  );
});

// タグ: Feature: list-search-enhancement, Property 4: 全角→半角変換の正確性
it('normalizeSearch converts fullwidth to halfwidth', () => {
  fc.assert(
    fc.property(
      fc.stringOf(fc.constantFrom(...'ＡＢＣａｂｃ０１２　'.split(''))),
      (str) => {
        const normalized = normalizeSearch(str);
        // 全角文字が含まれていないことを確認
        return !/[Ａ-Ｚａ-ｚ０-９　]/.test(normalized);
      }
    ),
    { numRuns: 100 }
  );
});
```

### 統合テスト

- 売主検索APIエンドポイント（`GET /api/sellers/search?q=物件住所`）の動作確認
- 買主一覧APIエンドポイント（`GET /api/buyers?search=物件住所`）の動作確認
- 物件一覧APIエンドポイント（`GET /api/property-listings?search=電話番号`）の動作確認
