---
inclusion: manual
---

# 物件リストの売主名取得ルール（絶対に守るべきルール）

## ⚠️ 最重要ルール

**物件リスト（property_listings）の売主名は、必ず`property_listings`テーブルから取得すること。**

**`sellers`テーブルから取得してはいけない。**

---

## 理由

1. **物件リストの物件は`sellers`テーブルに存在しない**
   - 物件リストは独立したデータ
   - `sellers`テーブルは売主リスト専用

2. **`sellers`テーブルから取得すると間違った名前が表示される**
   - 例: AA9368で「下村　和子様」と表示されるべきところ、「古澤 准一様」と表示される
   - 「古澤 准一様」は別の売主の名前

3. **過去に何度も同じ間違いを繰り返している**
   - KIROは毎回`sellers`テーブルから取得しようとする
   - このステアリングファイルで明確にルールを定義する

---

## ✅ 正しい実装

### 売主名の取得方法

```typescript
// property_listings テーブルから取得
const { data: property } = await supabase
  .from('property_listings')
  .select('property_number, seller_name, owner_info, seller_email, seller_contact')
  .eq('property_number', propertyNumber)
  .single();

// 売主名のフォールバックロジック
const resolveSellerName = (sellerName: string | null | undefined, ownerInfo: string | null | undefined): string | null => {
  const trimmed = (sellerName || '').trim();
  const isBlankOrSamaOnly = !trimmed || trimmed === '様';
  return isBlankOrSamaOnly ? (ownerInfo || null) : trimmed;
};

const effectiveSellerName = resolveSellerName(property.seller_name, property.owner_info);
```

### フォールバックロジック

1. **O列（seller_name）**が空または"様"のみの場合
2. **BL列（owner_info）**の値を使用

---

## ❌ 間違った実装（絶対にしてはいけない）

```typescript
// ❌ 間違い: sellers テーブルから取得
const { data: seller } = await supabase
  .from('sellers')
  .select('name')
  .eq('seller_number', propertyNumber)
  .single();

// ❌ 間違い: SellerService を使用
const seller = await sellerService.getSeller(sellerId);
```

**理由**: 物件リストの物件は`sellers`テーブルに存在しないため、間違った売主の名前が取得される。

---

## 📋 適用箇所

以下のエンドポイント・処理で、必ず`property_listings`テーブルから売主名を取得すること：

### 1. メールテンプレート取得
- **エンドポイント**: `/api/email-templates/property/merge`
- **ファイル**: `backend/src/routes/emailTemplates.ts`
- **用途**: 物件リストからメールテンプレートを選択する際

### 2. 売主へのメール送信
- **エンドポイント**: `/api/emails/by-seller-number/:sellerNumber/send-template-email`
- **ファイル**: `backend/src/routes/emails.ts`
- **用途**: 物件リストから売主にメールを送信する際

### 3. Gmail配信メール送信
- **エンドポイント**: `/api/property-listings/:propertyNumber/send-distribution-emails`
- **ファイル**: `backend/src/routes/propertyListings.ts`
- **用途**: 買主への配信メール送信時に売主情報を取得

### 4. CHAT送信
- **エンドポイント**: `/api/property-listings/:propertyNumber/send-chat-to-assignee`
- **ファイル**: `backend/src/routes/propertyListings.ts`
- **用途**: 物件担当へのCHAT送信時に売主情報を表示

### 5. GAS（Google Apps Script）
- **ファイル**: `gas/property-listing-sync/PropertyListingSync.gs`
- **用途**: スプレッドシート同期時に売主名をフォールバック

---

## 🔍 確認方法

売主名を取得する処理を実装する際、以下を確認：

1. **`sellers`テーブルを使用していないか？**
   - `from('sellers')` が含まれていないか確認
   - `SellerService` を使用していないか確認

2. **`property_listings`テーブルから取得しているか？**
   - `from('property_listings')` を使用しているか確認
   - `seller_name`と`owner_info`を取得しているか確認

3. **フォールバックロジックが実装されているか？**
   - `seller_name`が空の場合に`owner_info`を使用しているか確認

---

## 📝 過去の失敗事例

### 2026年5月12日
- **問題**: AA9368で「下村　和子様」と表示されるべきところ、「古澤 准一様」と表示される
- **原因**: `/api/email-templates/property/merge`エンドポイントが`sellers`テーブルから売主名を取得していた
- **修正**: `property_listings`テーブルから取得するように変更

### 以前（日付不明）
- **問題**: 同様の問題が発生
- **原因**: KIROが毎回`sellers`テーブルから取得しようとする
- **対策**: このステアリングファイルを作成

---

## まとめ

**物件リストの売主名は、必ず`property_listings`テーブルから取得すること。**

**`sellers`テーブルは使用しない。**

**このルールを絶対に守ること。**

---

**最終更新日**: 2026年5月12日
**作成理由**: KIROが毎回`sellers`テーブルから売主名を取得しようとする問題を防ぐため
