# 要件定義書

## はじめに

本機能は、社内管理システムの2つの画面に存在するURLフィールドを全てクリック可能なリンクとして表示する機能です。

対象画面：
1. **買主リスト詳細画面**（`BuyerDetailPage`）内の物件詳細カード（`PropertyInfoCard`コンポーネント）
2. **物件リスト詳細画面**（`PropertyListingDetailPage`）

現状の調査結果：
- `PropertyInfoCard`（買主詳細の物件カード）: `suumo_url`と`google_map_url`はリンク化済み。`storage_location`、`image_url`、`pdf_url`はインターフェース定義に含まれておらず、表示・リンク化されていない
- `PropertyListingDetailPage`（物件リスト詳細）: `google_map_url`、`suumo_url`、`storage_location`、`image_url`、`pdf_url`の全URLフィールドがすでにリンク化済み

したがって、本機能の主な対象は **`PropertyInfoCard`コンポーネントへの未表示URLフィールドの追加とリンク化** です。

---

## 用語集

- **PropertyInfoCard**: 買主リスト詳細画面に表示される物件詳細カードコンポーネント（`frontend/frontend/src/components/PropertyInfoCard.tsx`）
- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **BuyerDetailPage**: 買主リスト詳細画面（`frontend/frontend/src/pages/BuyerDetailPage.tsx`）
- **URL_Field**: `suumo_url`、`google_map_url`、`storage_location`、`image_url`、`pdf_url` のいずれかのURLフィールド
- **Link**: クリックすると新しいタブでURLを開くアンカー要素

---

## 要件

### 要件1: PropertyInfoCardへのURLフィールド追加

**ユーザーストーリー:** 担当者として、買主詳細画面の物件カードに表示されているURLを全てクリックして開きたい。そうすることで、物件詳細ページに移動せずに関連URLに素早くアクセスできる。

#### 受け入れ基準

1. THE `PropertyInfoCard` SHALL `storage_location`フィールドをインターフェース定義に追加し、APIレスポンスから取得する
2. THE `PropertyInfoCard` SHALL `image_url`フィールドをインターフェース定義に追加し、APIレスポンスから取得する
3. THE `PropertyInfoCard` SHALL `pdf_url`フィールドをインターフェース定義に追加し、APIレスポンスから取得する
4. WHEN `storage_location`が存在する場合、THE `PropertyInfoCard` SHALL `storage_location`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く
5. WHEN `image_url`が存在する場合、THE `PropertyInfoCard` SHALL `image_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く
6. WHEN `pdf_url`が存在する場合、THE `PropertyInfoCard` SHALL `pdf_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く
7. WHEN URLフィールドが存在しない（null または空文字）場合、THE `PropertyInfoCard` SHALL そのURLフィールドを表示しない

### 要件2: PropertyInfoCardの既存URLリンクの確認

**ユーザーストーリー:** 担当者として、買主詳細画面の物件カードにある全てのURLが一貫してリンク表示されていることを確認したい。

#### 受け入れ基準

1. WHEN `suumo_url`が存在する場合、THE `PropertyInfoCard` SHALL `suumo_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く（既存機能の確認）
2. WHEN `google_map_url`が存在する場合、THE `PropertyInfoCard` SHALL `google_map_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く（既存機能の確認）

### 要件3: PropertyListingDetailPageのURLリンクの確認

**ユーザーストーリー:** 担当者として、物件リスト詳細画面にある全てのURLをクリックして開きたい。

#### 受け入れ基準

1. WHEN `google_map_url`が存在する場合、THE `PropertyListingDetailPage` SHALL `google_map_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く（既存機能の確認）
2. WHEN `suumo_url`が存在する場合、THE `PropertyListingDetailPage` SHALL `suumo_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く（既存機能の確認）
3. WHEN `storage_location`が存在する場合、THE `PropertyListingDetailPage` SHALL `storage_location`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く（既存機能の確認）
4. WHEN `image_url`が存在する場合、THE `PropertyListingDetailPage` SHALL `image_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く（既存機能の確認）
5. WHEN `pdf_url`が存在する場合、THE `PropertyListingDetailPage` SHALL `pdf_url`をクリック可能なリンクとして表示し、クリック時に新しいタブでURLを開く（既存機能の確認）

### 要件4: リンクのセキュリティ要件

**ユーザーストーリー:** システム管理者として、外部URLへのリンクが安全に開かれることを確認したい。

#### 受け入れ基準

1. THE `PropertyInfoCard` SHALL 全ての外部URLリンクに `target="_blank"` および `rel="noopener noreferrer"` 属性を設定する
2. THE `PropertyListingDetailPage` SHALL 全ての外部URLリンクに `target="_blank"` および `rel="noopener noreferrer"` 属性を設定する（既存機能の確認）
