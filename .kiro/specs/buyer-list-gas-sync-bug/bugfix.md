# Bugfix Requirements Document

## Introduction

買主リストのスプレッドシートに入力した「業者向けアンケート」フィールドがデータベースに同期されない問題。

買主番号7260を含む全買主に影響する可能性がある。GASの買主リスト同期スクリプト（10分トリガー）がスプレッドシートからデータベースへの同期を実行しているが、「業者向けアンケート」フィールドが同期されていない。

**調査結果**:
- ✅ GASの`BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が既に存在
- ✅ バックエンドの`buyer-column-mapping.json`にも定義済み
- ✅ DBの買主番号7260には`vendor_survey: '確認済み'`が既に同期されている

**推測される原因**:
- 今日一度修正した後、GASの10分トリガーで**古いバージョンのコード**が実行された可能性
- GASプロジェクトに最新コードがデプロイされていない可能性

過去に類似の問題（`buyer-vendor-survey-sync-bug`）があり、GASの`BUYER_COLUMN_MAPPING`の更新漏れが原因だった。今回は既にマッピングが存在するため、**GASのデプロイ状態**を確認する必要がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートの買主リストの「業者向けアンケート」フィールドに「確認済み」が入力されている THEN GASの定期同期（10分トリガー）は古いバージョンのコードを実行し、DBの`buyers`テーブルの`vendor_survey`カラムに反映されない

1.2 WHEN 買主番号7260のスプレッドシート行の「業者向けアンケート」フィールドの値が更新される THEN GASの10分トリガーが古いコードを実行するため、DBの`vendor_survey`カラムは更新されず、古い値または`NULL`のまま残る

1.3 WHEN GASの10分トリガーが実行される THEN GASプロジェクトに最新コードがデプロイされていないため、`BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在しない古いバージョンが実行され、同期がスキップされる

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートの買主リストの「業者向けアンケート」フィールドに「確認済み」が入力されている THEN GASの定期同期は最新バージョンのコードを実行し、DBの`buyers`テーブルの`vendor_survey`カラムに正しく反映する

2.2 WHEN 買主番号7260のスプレッドシート行の「業者向けアンケート」フィールドの値が更新される THEN GASの10分トリガーが最新コードを実行し、DBの`vendor_survey`カラムが即座に（次回の10分トリガー実行時に）更新される

2.3 WHEN GASの10分トリガーが実行される THEN GASプロジェクトに最新コードがデプロイされており、`BUYER_COLUMN_MAPPING`に`'業者向けアンケート': 'vendor_survey'`が存在するバージョンが実行され、全買主の「業者向けアンケート」データが正常に同期される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主番号7260以外の買主のスプレッドシート行が更新される THEN システムは CONTINUE TO それらの買主データを従来通りDBに同期する

3.2 WHEN 売主リストのスプレッドシート同期が実行される THEN システムは CONTINUE TO 売主データを従来通り正常に同期する（買主リスト同期の修正が売主リスト同期に影響しない）

3.3 WHEN GASの定期同期が実行される THEN システムは CONTINUE TO `buyer-column-mapping.json`の`spreadsheetToDatabaseExtended`に定義された全カラムを従来通り同期する
