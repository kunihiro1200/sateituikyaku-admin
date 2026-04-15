# Bugfix Requirements Document

## Introduction

物件リストの報告ページ（`PropertyReportPage`）に表示される買主リストの右上に「新規作成」ボタンが表示されている。
報告ページは閲覧・報告用途のページであり、買主の新規作成操作は不要なため、このボタンを非表示にする。

なお、物件詳細モーダル（`PropertyListingDetailModal`）の買主タブにある「新規作成」ボタンは引き続き表示する。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが報告ページ（`/properties/:propertyNumber/report` 相当）を開いたとき THEN 買主リスト右上に「新規作成」ボタンが表示される
1.2 WHEN 報告ページの買主リストが表示されているとき THEN `CompactBuyerListForProperty` コンポーネントが「新規作成」ボタンを常にレンダリングする

### Expected Behavior (Correct)

2.1 WHEN ユーザーが報告ページを開いたとき THEN 買主リスト右上に「新規作成」ボタンが表示されない
2.2 WHEN 報告ページの買主リストが表示されているとき THEN `CompactBuyerListForProperty` コンポーネントが「新規作成」ボタンをレンダリングしない

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが物件詳細モーダル（`PropertyListingDetailModal`）の買主タブを開いたとき THEN 買主リスト右上に「新規作成」ボタンが引き続き表示される
3.2 WHEN ユーザーが「新規作成」ボタン（物件詳細モーダル内）をクリックしたとき THEN 買主新規作成ページへ遷移する動作が引き続き機能する
3.3 WHEN 報告ページで買主リストが表示されているとき THEN 買主一覧の表示・クリックによる買主詳細ページへの遷移は引き続き機能する
