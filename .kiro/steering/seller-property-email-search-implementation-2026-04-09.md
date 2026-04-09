---
inclusion: manual
---

# 売主リスト・物件リストメールアドレス検索機能実装記録

## 実装日
2026年4月9日

## 実装した機能

売主リスト一覧と物件リスト一覧の検索バーに、メールアドレスでの検索機能を追加しました。

### 1. 売主リスト検索（暗号化フィールド）
**実装内容**:
- `backend/src/services/SellerService.supabase.ts`の`searchSellers()`メソッドを修正
- 復号化後のフィルタリング条件に`seller.email`を追加
- 検索範囲を100件から500件に拡大

**動作**:
- 全件取得 → 復号化 → フィルタリング
- 部分一致検索（大文字小文字を区別しない）

### 2. 物件リスト検索（平文フィールド）
**実装内容**:

#### バックエンド
- `backend/src/services/PropertyListingService.ts`の`getAll()`メソッドを修正
- SELECT文に`seller_email`を追加
- 検索条件（`.or()`）に`seller_email.ilike.%${search}%`を追加

**修正前**:
```typescript
.select(`
  ...
  seller_name,
  buyer_name,
  ...
`)

if (search) {
  query = query.or(`property_number.ilike.%${search}%,address.ilike.%${search}%,seller_name.ilike.%${search}%`);
}
```

**修正後**:
```typescript
.select(`
  ...
  seller_name,
  seller_email,  // ← 追加
  buyer_name,
  ...
`)

if (search) {
  query = query.or(`property_number.ilike.%${search}%,address.ilike.%${search}%,seller_name.ilike.%${search}%,seller_email.ilike.%${search}%`);
}
```

#### フロントエンド
- `frontend/frontend/src/pages/PropertyListingsPage.tsx`を修正
- 型定義に`seller_email`を追加
- クライアント側フィルタリング条件に`seller_email`を追加
- プレースホルダーテキストを更新

**修正前**:
```typescript
interface PropertyListing {
  ...
  seller_name?: string;
  buyer_name?: string;
  ...
}

listings = listings.filter(l =>
  l.property_number?.toLowerCase().includes(query) ||
  l.address?.toLowerCase().includes(query) ||
  l.seller_name?.toLowerCase().includes(query) ||
  l.buyer_name?.toLowerCase().includes(query)
);

placeholder="Search 物件（物件番号、所在地、売主、買主）"
```

**修正後**:
```typescript
interface PropertyListing {
  ...
  seller_name?: string;
  seller_email?: string;  // ← 追加
  buyer_name?: string;
  ...
}

listings = listings.filter(l =>
  l.property_number?.toLowerCase().includes(query) ||
  l.address?.toLowerCase().includes(query) ||
  l.seller_name?.toLowerCase().includes(query) ||
  l.seller_email?.toLowerCase().includes(query) ||  // ← 追加
  l.buyer_name?.toLowerCase().includes(query)
);

placeholder="Search 物件（物件番号、所在地、売主、売主メール、買主）"
```

## 根本原因

物件リスト検索が動作しなかった原因は**2つ**ありました：

### 1. バックエンドの問題
- `PropertyListingService.getAll()`メソッドのSELECT文に`seller_email`が含まれていなかった
- 検索条件（`.or()`）に`seller_email`が含まれていなかった

### 2. フロントエンドの問題（主な原因）
- フロントエンドは**クライアント側でフィルタリング**を行っている
- フィルタリング条件に`seller_email`が含まれていなかった

## 動作

### 売主リスト検索
- 検索バーにメールアドレスを入力すると、暗号化されたメールアドレスを復号化してから部分一致検索
- 例: 「keitaku.kenta@gmail.com」で検索 → AA13946が表示される

### 物件リスト検索
- 検索バーにメールアドレスを入力すると、平文のメールアドレスで部分一致検索
- 例: 「keitaku.kenta@gmail.com」で検索 → AA12680が表示される

## 関連ファイル

### バックエンド
- `backend/src/services/SellerService.supabase.ts` - 売主リスト検索
- `backend/src/services/PropertyListingService.ts` - 物件リスト検索

### フロントエンド
- `frontend/frontend/src/pages/PropertyListingsPage.tsx` - 物件リスト検索UI

### GAS
- `gas/property-listing-sync/PropertyListingSync.gs` - 物件リストスプレッドシート同期（既に「売主メールアドレス」→「seller_email」のマッピングが存在）

## コミット番号
- **4ce5983e** - 売主リスト検索にメールアドレス検索を追加（バックエンド）
- **c8fbc2e9** - 売主リスト検索にメールアドレス検索を追加（フロントエンド）
- **165a2b7d** - 物件リスト検索にメールアドレス検索を追加（searchByPropertyNumberメソッド）
- **5a9ca595** - PropertyListingSyncServiceにseller_email設定を追加
- **d0980510** - 物件リスト検索にseller_emailを追加（getAll メソッド）
- **27a9dabf** - 物件リスト検索にseller_emailフィルタリングを追加（フロントエンド）

## テスト確認事項
- [x] 売主リストでメールアドレス検索が動作する（AA13946で確認）
- [x] 物件リストでメールアドレス検索が動作する（AA12680で確認）
- [x] 部分一致検索が動作する（「keitaku」「gmail.com」など）
- [x] 既存の検索機能に影響がない

## 教訓

### 1. フロントエンドとバックエンドの両方を確認する
- フロントエンドがクライアント側フィルタリングを行っている場合、バックエンドだけを修正しても動作しない
- 必ずフロントエンドのフィルタリングロジックも確認する

### 2. SELECT文にカラムを含める
- バックエンドのSELECT文に必要なカラムが含まれていないと、フロントエンドでフィルタリングできない

### 3. デプロイ後の動作確認
- ブラウザキャッシュをクリアしてから動作確認する
- Vercelのデプロイが完全に反映されるまで数分かかることがある

---

**最終更新日**: 2026年4月9日
**作成理由**: 売主リスト・物件リストメールアドレス検索機能の実装記録
