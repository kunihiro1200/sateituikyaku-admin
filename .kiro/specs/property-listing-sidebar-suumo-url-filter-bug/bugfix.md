# バグ修正要件ドキュメント

## Introduction

物件番号AA12497が、Suumo URLが正しく入力されているにもかかわらず、物件リストページのサイドバーで「レインズ登録＋SUUMO登録」カテゴリーに誤って表示されるバグを修正します。

**影響範囲**: 物件リストページのサイドバーステータス表示

**関連ファイル**:
- `frontend/frontend/src/utils/propertyListingStatusUtils.ts` - ステータス計算ロジック
- `frontend/frontend/src/components/PropertySidebarStatus.tsx` - サイドバーコンポーネント
- `frontend/frontend/src/pages/PropertyListingsPage.tsx` - 物件リストページ

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 物件のSuumo URLが入力されている（例: `https://suumo.jp/chukoikkodate/oita/sc_oita/nc_20541403/`）AND ATBB状況が「専任・公開中」AND 公開予定日が昨日以前 THEN システムは物件を「レインズ登録＋SUUMO登録」カテゴリーに表示する

1.2 WHEN `listing.suumo_url`がデータベースに正しく保存されている THEN システムは条件6の`!listing.suumo_url`チェックで`false`を返すべきだが、実際には`true`を返している可能性がある

1.3 WHEN `workTaskMap`が正しく渡されていない OR `workTaskMap.get(listing.property_number)`が`undefined`を返す THEN システムは条件6を誤って評価する可能性がある

### Expected Behavior (Correct)

2.1 WHEN 物件のSuumo URLが入力されている（空文字列でない）AND ATBB状況が「専任・公開中」AND 公開予定日が昨日以前 THEN システムは物件を「レインズ登録＋SUUMO登録」カテゴリーに表示しない

2.2 WHEN `listing.suumo_url`が空文字列または`null`または`undefined`である AND ATBB状況が「専任・公開中」AND 公開予定日が昨日以前 AND Suumo登録が「S不要」でない THEN システムは物件を「レインズ登録＋SUUMO登録」カテゴリーに表示する

2.3 WHEN `workTaskMap`が正しく渡されている AND `workTaskMap.get(listing.property_number)`が有効な日付を返す THEN システムは条件6を正しく評価する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 物件のSuumo URLが空で AND ATBB状況が「専任・公開中」AND 公開予定日が昨日以前 AND Suumo登録が「S不要」でない THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」カテゴリーに表示する

3.2 WHEN 物件のSuumo URLが空で AND ATBB状況が「一般・公開中」AND 公開予定日が昨日以前 AND Suumo登録が「S不要」でない THEN システムは引き続き物件を「SUUMO URL　要登録」カテゴリーに表示する

3.3 WHEN 物件のSuumo登録が「S不要」である THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに表示しない

3.4 WHEN 物件の公開予定日が今日以降である THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに表示しない

3.5 WHEN 物件のATBB状況が「公開中」でない THEN システムは引き続き物件を「レインズ登録＋SUUMO登録」または「SUUMO URL　要登録」カテゴリーに表示しない
