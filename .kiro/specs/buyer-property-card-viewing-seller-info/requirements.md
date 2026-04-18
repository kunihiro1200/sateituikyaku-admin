# 要件定義書

## はじめに

買主詳細画面（`BuyerDetailPage`）の中央列に表示される「物件詳細カード」（`PropertyInfoCard` コンポーネント）に、内覧情報セクションと売主情報セクションを追加表示する機能。

現在の物件詳細カードには「値下げ履歴」「理由」が表示されているが、その下に内覧時の鍵情報・駐車場・伝達事項・内覧可能日（セクション1）と、売主の名前・連絡先・メールアドレス・売却理由（セクション2）を追加する。

データは `property_listings` テーブルから取得する。売主情報（名前・連絡先・メールアドレス）は `PropertyListingSyncService` によって復号済みの値が `property_listings` テーブルに保存されているため、フロントエンドへの追加取得処理は不要。

---

## 用語集

- **PropertyInfoCard**: 買主詳細画面の中央列に表示される物件詳細カードコンポーネント（`frontend/frontend/src/components/PropertyInfoCard.tsx`）
- **BuyerDetailPage**: 買主詳細画面のページコンポーネント（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **PropertyListingService**: `property_listings` テーブルへのアクセスを担うバックエンドサービス（`backend/src/services/PropertyListingService.ts`）
- **property_listings**: 物件リストを管理するデータベーステーブル
- **内覧情報セクション**: `viewing_key`・`viewing_parking`・`viewing_notes`・`viewing_available_date` の4フィールドをまとめて表示するUIセクション
- **売主情報セクション**: `seller_name`・`seller_contact`・`seller_email`・`sale_reason` の4フィールドをまとめて表示するUIセクション
- **復号済み売主情報**: `PropertyListingSyncService` が `sellers` テーブルから取得・復号して `property_listings` に保存した売主名・連絡先・メールアドレス

---

## 要件

### 要件1：内覧情報セクションの表示

**ユーザーストーリー:** 担当者として、物件詳細カードで内覧時の鍵情報・駐車場・伝達事項・内覧可能日を確認したい。そうすることで、内覧準備を効率よく行える。

#### 受け入れ基準

1. WHEN `property_listings` テーブルの `viewing_key`・`viewing_parking`・`viewing_notes`・`viewing_available_date` のいずれか1つ以上に値が存在する場合、THE `PropertyInfoCard` SHALL 「値下げ履歴」「理由」の表示ブロックの直下に内覧情報セクションを表示する

2. THE `PropertyInfoCard` SHALL 内覧情報セクションに識別しやすい背景色（例: 薄い青系）を適用し、他のセクションと視覚的に区別できるようにする

3. WHEN `viewing_key` に値が存在する場合、THE `PropertyInfoCard` SHALL 内覧情報セクション内に「内覧時（鍵等）」ラベルとその値を表示する

4. WHEN `viewing_parking` に値が存在する場合、THE `PropertyInfoCard` SHALL 内覧情報セクション内に「内覧時駐車場」ラベルとその値を表示する

5. WHEN `viewing_notes` に値が存在する場合、THE `PropertyInfoCard` SHALL 内覧情報セクション内に「内覧の時の伝達事項」ラベルとその値を表示する

6. WHEN `viewing_available_date` に値が存在する場合、THE `PropertyInfoCard` SHALL 内覧情報セクション内に「内覧可能日」ラベルとその値を表示する

7. WHEN `viewing_key`・`viewing_parking`・`viewing_notes`・`viewing_available_date` の全てが null または空文字の場合、THE `PropertyInfoCard` SHALL 内覧情報セクション自体を表示しない

---

### 要件2：売主情報セクションの表示

**ユーザーストーリー:** 担当者として、物件詳細カードで売主の名前・連絡先・メールアドレス・売却理由を確認したい。そうすることで、売主への連絡を素早く行える。

#### 受け入れ基準

1. WHEN `property_listings` テーブルの `seller_name`・`seller_contact`・`seller_email`・`sale_reason` のいずれか1つ以上に値が存在する場合、THE `PropertyInfoCard` SHALL 内覧情報セクションの直下（内覧情報セクションが非表示の場合は「値下げ履歴」「理由」ブロックの直下）に売主情報セクションを表示する

2. THE `PropertyInfoCard` SHALL 売主情報セクションに内覧情報セクションとは異なる背景色（例: 薄いオレンジ系）を適用し、視覚的に区別できるようにする

3. WHEN `seller_name` に値が存在する場合、THE `PropertyInfoCard` SHALL 売主情報セクション内に「売主名前」ラベルとその値を表示する

4. WHEN `seller_contact` に値が存在する場合、THE `PropertyInfoCard` SHALL 売主情報セクション内に「連絡先」ラベルとその値を表示する

5. WHEN `seller_email` に値が存在する場合、THE `PropertyInfoCard` SHALL 売主情報セクション内に「メールアドレス」ラベルとその値を表示する

6. WHEN `sale_reason` に値が存在する場合、THE `PropertyInfoCard` SHALL 売主情報セクション内に「売却理由」ラベルとその値を表示する

7. WHEN `seller_name`・`seller_contact`・`seller_email`・`sale_reason` の全てが null または空文字の場合、THE `PropertyInfoCard` SHALL 売主情報セクション自体を表示しない

---

### 要件3：バックエンドAPIのデータ返却

**ユーザーストーリー:** システムとして、`/api/property-listings/:propertyNumber` エンドポイントが内覧情報・売主情報フィールドを返却する必要がある。

#### 受け入れ基準

1. WHEN `/api/property-listings/:propertyNumber` が呼び出される場合、THE `PropertyListingService` SHALL `viewing_key`・`viewing_parking`・`viewing_notes`・`viewing_available_date`・`seller_name`・`seller_contact`・`seller_email`・`sale_reason` を含むレスポンスを返す

2. THE `PropertyListingService` SHALL `property_listings` テーブルの全カラムを `SELECT *` で取得するため、追加のカラム指定なしに上記フィールドを返す（既存の `getByPropertyNumber` は `SELECT *` を使用しているため変更不要）

---

### 要件4：フロントエンドの型定義更新

**ユーザーストーリー:** 開発者として、`PropertyInfoCard` コンポーネントの型定義に新しいフィールドが追加されている必要がある。

#### 受け入れ基準

1. THE `PropertyInfoCard` SHALL `PropertyFullDetails` インターフェースに `viewing_key`・`viewing_parking`・`viewing_notes`・`viewing_available_date`・`seller_contact`・`sale_reason` フィールドを追加する（`seller_name`・`seller_email` は既存フィールドのため追加不要）

2. THE `PropertyInfoCard` SHALL 新規追加フィールドを全て `string | undefined` 型として定義する
