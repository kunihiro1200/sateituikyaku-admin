# Bugfix Requirements Document

## Introduction

買主リストサイドバーに「①内覧日前日」と「すべて」しか表示されない問題を修正します。以前は他のカテゴリ（内覧済み、当日TEL、未査定など）も表示されていましたが、現在はGASコード（`gas_buyer_complete_code.js`）の`updateBuyerSidebarCounts_()`関数が一部のカテゴリしか計算・挿入していないため、サイドバーに表示されません。

売主GASコード（`gas_complete_code.js`）には全カテゴリの完全な実装があるため、それを参考に買主用のカテゴリ計算ロジックを実装します。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主リストページを開く THEN サイドバーに「①内覧日前日」と「すべて」しか表示されない

1.2 WHEN GASの`updateBuyerSidebarCounts_()`関数が実行される THEN 以下の4種類のカテゴリしか計算されない：
- `viewingDayBefore`（内覧日前日）
- `todayCall`（当日TEL分）
- `inquiryEmailNotResponded`（問合せメール未対応）
- `assigned`（担当別）

1.3 WHEN フロントエンドが`buyer_sidebar_counts`テーブルを読み取る THEN 欠落しているカテゴリのデータが存在しないため、サイドバーに表示されない

### Expected Behavior (Correct)

2.1 WHEN 買主リストページを開く THEN サイドバーに以下の全カテゴリが表示される（カウントが0より大きい場合）：
- ①内覧日前日（`viewingDayBefore`）
- ②内覧済み（`visitCompleted`）
- ③当日TEL分（`todayCall`）
- ④当日TEL（内容）（`todayCallWithInfo`）
- ⑤未査定（`unvaluated`）
- ⑥査定（郵送）（`mailingPending`）
- ⑦当日TEL_未着手（`todayCallNotStarted`）
- ⑧Pinrich空欄（`pinrichEmpty`）
- 専任（`exclusive`）
- 一般（`general`）
- 内覧後他決（`visitOtherDecision`）
- 未内覧他決（`unvisitedOtherDecision`）
- 担当(イニシャル)（`assigned`）
- 当日TEL(イニシャル)（`todayCallAssigned`）

2.2 WHEN GASの`updateBuyerSidebarCounts_()`関数が実行される THEN 上記の全カテゴリを計算して`buyer_sidebar_counts`テーブルに挿入する

2.3 WHEN フロントエンドが`buyer_sidebar_counts`テーブルを読み取る THEN 全カテゴリのデータが存在するため、サイドバーに正しく表示される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 既存の「①内覧日前日」カテゴリが表示されている THEN 修正後も同じ条件で正しく表示され続ける

3.2 WHEN 買主データがスプレッドシートからデータベースに同期される THEN 修正後も同じロジックで正しく同期され続ける

3.3 WHEN GASの10分トリガーが実行される THEN 修正後も同じ間隔で正しく実行され続ける

3.4 WHEN バックエンドの`BuyerService.getSidebarCounts()`が呼び出される THEN 修正後も同じマッピングで正しくカテゴリを返す
