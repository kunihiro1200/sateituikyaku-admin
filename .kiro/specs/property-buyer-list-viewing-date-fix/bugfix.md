# Bugfix Requirements Document

## Introduction

物件リストの詳細ページ（物件詳細画面）に表示される買主リストにおいて、内覧日が正しく表示されないバグを修正する。

- 物件番号: AA278
- チケット番号: 7344

バックエンドAPI（`GET /api/property-listings/:propertyNumber/buyers`）は `latest_viewing_date` フィールドとして内覧日を返しているが、フロントエンドの `PropertyListingDetailPage.tsx` の `Buyer` インターフェースは `viewing_date` フィールドを期待しているため、フィールド名の不一致により内覧日が常に未定義（`-`）として表示される。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件詳細ページ（`/property-listings/:propertyNumber`）を開き、買主リストが表示される THEN バックエンドが返す `latest_viewing_date` フィールドがフロントエンドの `Buyer` インターフェースの `viewing_date` にマッピングされず、内覧日が `-` として表示される

1.2 WHEN 買主に内覧日（`latest_viewing_date`）が登録されている THEN `CompactBuyerListForProperty` コンポーネントに渡される `viewing_date` プロパティが `undefined` となり、内覧日列に `-` が表示される

### Expected Behavior (Correct)

2.1 WHEN 物件詳細ページを開き、買主リストが表示される THEN バックエンドが返す `latest_viewing_date` フィールドが正しくフロントエンドにマッピングされ、内覧日が `YYYY/MM/DD` 形式で表示される

2.2 WHEN 買主に内覧日（`latest_viewing_date`）が登録されている THEN `CompactBuyerListForProperty` コンポーネントの内覧日列に正しい日付が表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主に内覧日が登録されていない THEN 内覧日列は引き続き `-` として表示される

3.2 WHEN 物件詳細ページの買主リストを表示する THEN 氏名・受付日・時間・最新状況の各列は引き続き正しく表示される

3.3 WHEN 買主リストの行をクリックする THEN 引き続き買主詳細ページが新しいタブで開く

3.4 WHEN `CompactBuyerListForProperty` コンポーネントが他の画面で使用される THEN 引き続き正常に動作する
