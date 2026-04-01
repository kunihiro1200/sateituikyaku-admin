# バグ修正要件定義書：買主リスト同期未実装

## Introduction

買主番号7272がスプレッドシートには存在するが、データベース（buyers テーブル）には存在しない問題を修正します。根本原因は、gas_buyer_complete_code.js の `syncBuyerList()` 関数に買主データの同期処理が未実装（TODOコメントのみ）であることです。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN GASの10分トリガーが実行される THEN システムは買主データをデータベースに同期しない（TODOコメントのみで処理が未実装）

1.2 WHEN スプレッドシートに買主番号7272が存在する THEN データベース（buyers テーブル）には買主番号7272が存在しない

1.3 WHEN 買主データの同期処理が未実装である THEN 全ての買主データがデータベースに同期されない

### Expected Behavior (Correct)

2.1 WHEN GASの10分トリガーが実行される THEN システムはスプレッドシートの買主データをデータベースに同期する

2.2 WHEN スプレッドシートに買主番号7272が存在する THEN データベース（buyers テーブル）にも買主番号7272が存在する

2.3 WHEN 買主データの同期処理が実装される THEN 全ての買主データがデータベースに正しく同期される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主サイドバーカウント更新処理が実行される THEN システムは引き続き buyer_sidebar_counts テーブルを正しく更新する

3.2 WHEN 売主リストの同期処理が実行される THEN システムは引き続き売主データを正しく同期する

3.3 WHEN GASの10分トリガーが設定される THEN システムは引き続き10分ごとに同期処理を実行する
