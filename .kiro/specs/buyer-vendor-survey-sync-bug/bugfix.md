# Bugfix Requirements Document

## Introduction

買主リストにおいて、「業者向けアンケート」フィールド（DBカラム: `vendor_survey`）がスプレッドシートからデータベースへ同期されないバグ。

買主番号7260を含む全買主に影響する。GASの買主リスト同期スクリプト内の `BUYER_COLUMN_MAPPING` に `'業者向けアンケート': 'vendor_survey'` のマッピングが追加されていないため、GASの `buyerMapRowToRecord` 関数がこのカラムをスキップしている。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートの買主行に「業者向けアンケート」列の値が入力されている THEN GASの定期同期（10分トリガー）はそのフィールドをスキップし、DBの `vendor_survey` カラムに反映されない

1.2 WHEN 買主番号7260のスプレッドシート行に「業者向けアンケート」の値が存在する THEN DBの `buyers.vendor_survey` は `NULL` または古い値のまま更新されない

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートの買主行に「業者向けアンケート」列の値が入力されている THEN GASの定期同期はその値をDBの `vendor_survey` カラムに反映する

2.2 WHEN 買主番号7260のスプレッドシート行に「業者向けアンケート」の値が存在する THEN DBの `buyers.vendor_survey` がその値に更新される

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「業者向けアンケート」以外の買主フィールド（例: `next_call_date`、`latest_status`、`broker_survey` 等）がスプレッドシートで更新される THEN システムは CONTINUE TO それらのフィールドを従来通りDBに同期する

3.2 WHEN 「業者向けアンケート」列が空欄の買主行が同期される THEN システムは CONTINUE TO その行の他のフィールドを正常に同期し、`vendor_survey` には `NULL` または空値を設定する

3.3 WHEN GASの定期同期が実行される THEN システムは CONTINUE TO `buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` に定義された全カラムを従来通り同期する
