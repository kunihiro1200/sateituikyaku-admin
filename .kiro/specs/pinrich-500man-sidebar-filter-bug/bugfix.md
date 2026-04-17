# バグ修正要件ドキュメント

## はじめに

買主リストのサイドバーに表示される「Pinrich500万以上登録未３２」カテゴリをクリックすると、
本来は条件を満たす買主一覧が表示されるべきところ、空のリストが表示されるバグ。

**影響範囲**: 買主リストページ（`/buyers`）のサイドバーフィルター機能

**根本原因の調査結果**:

`fetchAllBuyers()` メソッド（`backend/src/services/BuyerService.ts`）の `BUYER_COLUMNS` に
`pinrich_500man_registration` カラムが含まれていない。また `property_listings` から `price`
（`inquiry_property_price` として使用）が取得されていない。

その結果、`getBuyersByStatus('pinrich500manUnregistered')` のフィルタ条件：
- `buyer.pinrich_500man_registration` → 常に `undefined`（取得されていない）
- `buyer.inquiry_property_price` → 常に `null`（`price` が取得されていない）

の2つが常に偽となり、条件を満たす買主が1件も返らない。

---

## バグ分析

### 現在の動作（不具合）

1.1 WHEN ユーザーがサイドバーの「Pinrich500万以上登録未」カテゴリをクリックする THEN
システムは空の買主リスト（0件）を表示する

1.2 WHEN バックエンドの `getBuyersByStatus('pinrich500manUnregistered')` が呼び出される THEN
システムは `fetchAllBuyers()` で取得した買主データに `pinrich_500man_registration` カラムが
含まれていないため、フィルタ条件 `(!buyer.pinrich_500man_registration || buyer.pinrich_500man_registration === '未')` が
全買主に対して `true` と評価されるが、`inquiry_property_price` が `null` のため
`Number(null) <= 5000000` が `false` となり、結果として0件が返る

1.3 WHEN `fetchAllBuyers()` がDBから買主データを取得する THEN
システムは `BUYER_COLUMNS` に `pinrich_500man_registration` を含めずにクエリを実行するため、
取得した買主オブジェクトに `pinrich_500man_registration` フィールドが存在しない

1.4 WHEN `fetchAllBuyers()` が `property_listings` テーブルから物件情報を取得する THEN
システムは `price` カラムを取得しないため、`inquiry_property_price` が常に `null` になる

### 期待される動作（正しい動作）

2.1 WHEN ユーザーがサイドバーの「Pinrich500万以上登録未」カテゴリをクリックする THEN
システムは以下の4条件を全て満たす買主の一覧を表示する SHALL：
- `email` が空でない
- `inquiry_property_price`（物件価格）が500万円以下
- `pinrich_500man_registration` が `null`、空文字、または `'未'`
- `reception_date` が `'2026-01-01'` 以降

2.2 WHEN バックエンドの `fetchAllBuyers()` がDBから買主データを取得する THEN
システムは `BUYER_COLUMNS` に `pinrich_500man_registration` を含めてクエリを実行する SHALL

2.3 WHEN バックエンドの `fetchAllBuyers()` が `property_listings` テーブルから物件情報を取得する THEN
システムは `price` カラムを取得し、`inquiry_property_price` として各買主オブジェクトに付与する SHALL

2.4 WHEN `getBuyersByStatus('pinrich500manUnregistered')` が呼び出される THEN
システムは正しく取得された `pinrich_500man_registration` と `inquiry_property_price` を使って
フィルタリングを実行し、条件を満たす買主を返す SHALL

### 変更されない動作（リグレッション防止）

3.1 WHEN ユーザーが「Pinrich500万以上登録未」以外のサイドバーカテゴリをクリックする THEN
システムは従来通りの正しいフィルタリング結果を表示し続ける SHALL CONTINUE TO

3.2 WHEN `fetchAllBuyers()` が呼び出される THEN
システムは既存の全カラム（`buyer_number`、`name`、`email` 等）を引き続き取得する SHALL CONTINUE TO

3.3 WHEN `pinrich_500man_registration` が `'済'` の買主が存在する THEN
システムはその買主を「Pinrich500万以上登録未」カテゴリに含めない SHALL CONTINUE TO

3.4 WHEN `inquiry_property_price` が500万円を超える買主が存在する THEN
システムはその買主を「Pinrich500万以上登録未」カテゴリに含めない SHALL CONTINUE TO

3.5 WHEN `email` が空の買主が存在する THEN
システムはその買主を「Pinrich500万以上登録未」カテゴリに含めない SHALL CONTINUE TO

3.6 WHEN `reception_date` が `'2026-01-01'` より前の買主が存在する THEN
システムはその買主を「Pinrich500万以上登録未」カテゴリに含めない SHALL CONTINUE TO

3.7 WHEN サイドバーのカウント（`buyer_sidebar_counts` テーブル）が表示される THEN
システムは `pinrich500manUnregistered` のカウントを引き続き正しく表示する SHALL CONTINUE TO
（`getSidebarCountsFallback` は `fetchBuyersForSidebarCounts` を使用しており、
こちらには既に `pinrich_500man_registration` と `price` が含まれているため影響なし）
