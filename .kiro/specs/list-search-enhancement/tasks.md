# 実装計画：売主・買主・物件リスト検索強化

## 概要

売主リスト・買主リスト・物件リストの検索機能を強化する。
バックエンドのサービス層とフロントエンドのフィルタリングロジックを修正し、各リストで検索対象フィールドを拡張する。

## タスク

- [x] 1. 売主リスト検索強化（バックエンド）
  - [x] 1.1 `SellerService.supabase.ts` の `searchSellers()` スロウパスに `propertyAddress` フィールドを追加する
    - `decryptedSellers.filter()` の条件に `seller.propertyAddress` の部分一致を追加
    - ファイル: `backend/src/services/SellerService.supabase.ts`
    - _Requirements: 1.1, 1.3_

  - [ ]* 1.2 `searchSellers()` の `propertyAddress` 検索プロパティテストを書く
    - **Property 1: 売主検索の網羅性**
    - **Validates: Requirements 1.1, 1.3**
    - ファイル: `backend/src/services/__tests__/list-search-enhancement.property.test.ts`

- [x] 2. 売主リスト検索強化（フロントエンド）
  - [x] 2.1 `SellersPage.tsx` のプレースホルダーテキストを更新する
    - `placeholder="名前、住所、電話番号で検索"` → `"名前、住所、電話番号、物件住所で検索"`
    - ファイル: `frontend/frontend/src/pages/SellersPage.tsx`
    - _Requirements: 4.1_

- [x] 3. 買主リスト検索強化（フロントエンド）
  - [x] 3.1 `BuyersPage.tsx` のフロントエンドキャッシュフィルタリングロジックに `property_address` を追加する
    - `filtered.filter()` の条件に `b.property_address` の部分一致を追加
    - ファイル: `frontend/frontend/src/pages/BuyersPage.tsx`
    - _Requirements: 2.1, 2.3_

  - [x] 3.2 `BuyersPage.tsx` のプレースホルダーテキストを更新する
    - `placeholder` を `"買主番号、氏名、電話番号、メールアドレス、物件番号、物件住所で検索"` に変更
    - ファイル: `frontend/frontend/src/pages/BuyersPage.tsx`
    - _Requirements: 4.2_

  - [ ]* 3.3 買主フィルタリングロジックの `property_address` プロパティテストを書く
    - **Property 2: 買主検索の網羅性**
    - **Validates: Requirements 2.1, 2.3**
    - ファイル: `backend/src/services/__tests__/list-search-enhancement.property.test.ts`

- [x] 4. 買主リスト検索強化（バックエンド）
  - [x] 4.1 `BuyerService.ts` の `getAll()` 検索ロジックに `property_address` 対応を追加する
    - `property_listings` テーブルから住所一致の `property_number` を取得し、OR条件に追加
    - ファイル: `backend/src/services/BuyerService.ts`
    - _Requirements: 2.1, 2.3_

- [x] 5. チェックポイント
  - ここまでのテストが全て通ることを確認する。疑問点があればユーザーに確認する。

- [x] 6. 物件リスト検索強化（バックエンド）
  - [x] 6.1 `property_listings` テーブルに `seller_phone` カラムを追加するSQLマイグレーションファイルを作成する
    - `ALTER TABLE public.property_listings ADD COLUMN IF NOT EXISTS seller_phone TEXT;`
    - ファイル: `backend/add-seller-phone-to-property-listings.sql`
    - _Requirements: 3.1, 3.2_

  - [x] 6.2 `PropertyListingSyncService.ts` の同期処理で `seller_phone` を復号して保存するよう修正する
    - `sellers.phone_number` を `decrypt()` してから `property_listings.seller_phone` に保存
    - ファイル: `backend/src/services/PropertyListingSyncService.ts`
    - _Requirements: 3.1, 3.2_

  - [x] 6.3 `PropertyListingService.ts` の `getAll()` のSELECTクエリに `seller_phone` を追加し、検索条件にも追加する
    - SELECTフィールドリストに `seller_phone` を追加
    - `search` 条件の `or()` に `seller_phone.ilike.%${search}%` を追加
    - ファイル: `backend/src/services/PropertyListingService.ts`
    - _Requirements: 3.1, 3.2_

- [x] 7. 物件リスト検索強化（フロントエンド）
  - [x] 7.1 `PropertyListingsPage.tsx` の `PropertyListing` インターフェースに `seller_phone` フィールドを追加し、フィルタリングロジックに追加する
    - インターフェースに `seller_phone?: string` を追加
    - フィルタ条件に `seller_phone` の部分一致を追加
    - ファイル: `frontend/frontend/src/pages/PropertyListingsPage.tsx`
    - _Requirements: 3.1, 3.2_

  - [x] 7.2 `PropertyListingsPage.tsx` のプレースホルダーテキストを更新する
    - `placeholder` を `"物件番号、所在地、売主、売主電話番号、買主で検索"` に変更
    - ファイル: `frontend/frontend/src/pages/PropertyListingsPage.tsx`
    - _Requirements: 4.3_

  - [ ]* 7.3 物件フィルタリングロジックの `seller_phone` プロパティテストを書く
    - **Property 5: 物件リスト検索の網羅性**
    - **Validates: Requirements 3.1, 3.2**
    - ファイル: `backend/src/services/__tests__/list-search-enhancement.property.test.ts`

- [x] 8. 正規化ロジックのプロパティテスト
  - [ ]* 8.1 `normalizeSearch()` の冪等性プロパティテストを書く
    - **Property 3: 正規化の冪等性**
    - **Validates: Requirements 1.5, 2.5, 3.4**
    - ファイル: `backend/src/services/__tests__/list-search-enhancement.property.test.ts`

  - [ ]* 8.2 `normalizeSearch()` の全角→半角変換プロパティテストを書く
    - **Property 4: 全角→半角変換の正確性**
    - **Validates: Requirements 1.5, 2.5, 3.4**
    - ファイル: `backend/src/services/__tests__/list-search-enhancement.property.test.ts`

- [x] 9. 最終チェックポイント
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。

## 注意事項

- `*` 付きのサブタスクはオプションであり、MVPとしてスキップ可能
- `sellers.phone_number` は暗号化されているため、`property_listings.seller_phone` には必ず復号済みの値を保存すること（`encryption-key-protection.md` 参照）
- バックエンドは `backend/src/` のみ編集すること（`backend/api/` は公開物件サイト用のため触らない）
- 各タスクは前のタスクの成果物を前提として積み上げる形で実装する
