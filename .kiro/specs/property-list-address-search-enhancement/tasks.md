# 実装計画: 物件リスト住所検索拡張（住居表示フィールド追加）

## 概要

物件一覧ページの検索バーで「住居表示」（`display_address`）フィールドも検索対象に追加する。
変更箇所はフロントエンドのフィルタリングロジックとバックエンドの検索クエリの2点のみ。

## タスク

- [x] 1. バックエンド: `PropertyListingService.getAll()` の修正
  - [x] 1.1 SELECT句に `display_address` カラムを追加する
    - `backend/src/services/PropertyListingService.ts` の `getAll()` メソッド内のSELECT句に `display_address` を追加
    - _要件: 2.3_

  - [x] 1.2 検索クエリのOR条件に `display_address` を追加する
    - `search` パラメータが指定された場合のORクエリに `display_address.ilike.%${search}%` を追加
    - 変更前: `property_number.ilike.%${search}%,address.ilike.%${search}%,seller_name.ilike.%${search}%,seller_email.ilike.%${search}%`
    - 変更後: `property_number.ilike.%${search}%,address.ilike.%${search}%,display_address.ilike.%${search}%,seller_name.ilike.%${search}%,seller_email.ilike.%${search}%`
    - _要件: 2.1, 2.2_

- [x] 2. フロントエンド: `PropertyListingsPage.tsx` のフィルタリングロジック修正
  - [x] 2.1 `filteredListings` の `useMemo` 内に `display_address` の検索条件を追加する
    - `frontend/frontend/src/pages/PropertyListingsPage.tsx` の検索フィルタリング部分を修正
    - `display_address` フィールドに `normalizeText` を適用し、null/undefined の場合は空文字として扱う
    - _要件: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 2.2 プロパティテスト: `display_address` による検索一致
    - **プロパティ1: display_address による検索一致**
    - `display_address` に検索文字列を含む物件がフィルタリング結果に必ず含まれることを検証
    - `fast-check` を使用して最低100回のイテレーションで検証
    - **検証対象: 要件 1.1, 1.2**

  - [ ]* 2.3 プロパティテスト: `address` と `display_address` の OR 条件
    - **プロパティ2: address と display_address の OR 条件**
    - `address` のみ一致・`display_address` のみ一致・両方一致する物件がすべて結果に含まれ、どちらにも一致しない物件は含まれないことを検証
    - **検証対象: 要件 1.2, 3.1**

  - [ ]* 2.4 プロパティテスト: `display_address` への `normalizeText` 適用
    - **プロパティ3: display_address への normalizeText 適用**
    - 全角文字の検索文字列が半角の `display_address` に一致することを検証（全角・半角の違いを吸収）
    - **検証対象: 要件 1.3**

  - [ ]* 2.5 ユニットテスト: `display_address` が null/undefined の場合のエラーなし
    - `display_address` が `null` または `undefined` の物件でフィルタリング時にエラーが発生しないことを検証
    - _要件: 1.4_

- [x] 3. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- バックエンドの変更対象は `backend/src/services/PropertyListingService.ts`（社内管理システム用）のみ
- `backend/api/` 配下の公開物件サイト用ファイルは変更しない
- 各タスクは要件との対応が明確になるよう実装すること
