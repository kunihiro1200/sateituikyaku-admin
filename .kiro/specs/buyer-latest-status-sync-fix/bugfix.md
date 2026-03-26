# Bugfix Requirements Document

## Introduction

`BuyerViewingResultPage`（内覧ページ）の★最新状況フィールドで値を変更しても、DBに保存されずページを離れると元の値に戻るバグ。`BuyerDetailPage`では同じフィールドが正常に保存されるため、内覧ページ固有の問題。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `BuyerViewingResultPage`で★最新状況をドロップダウンで変更する THEN the system DBへの保存をスキップし、ページを離れて戻ると元の値（例：C）に戻っている

1.2 WHEN `buyerApi.update`が`sync=true`で呼ばれ、バックエンドの`updateWithSync`が競合を検出する THEN the system DBを更新せずに古い`buyer`データを409レスポンスで返し、フロントエンドのstateが古い値に上書きされる

### Expected Behavior (Correct)

2.1 WHEN `BuyerViewingResultPage`で★最新状況をドロップダウンで変更する THEN the system SHALL DBに新しい値を保存し、ページを離れて戻っても変更後の値が表示される

2.2 WHEN `buyerApi.update`が`sync=true`で呼ばれる THEN the system SHALL 競合チェックをスキップ（`force=true`）してDBへの保存を確実に実行する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `BuyerViewingResultPage`で★最新状況以外のフィールド（内覧日、時間、後続担当等）を変更する THEN the system SHALL CONTINUE TO 従来通りDBに保存する

3.2 WHEN `BuyerDetailPage`で★最新状況を変更する THEN the system SHALL CONTINUE TO 従来通りDBに保存する

3.3 WHEN `BuyerViewingResultPage`で内覧結果・後続対応を保存する THEN the system SHALL CONTINUE TO `force=true`でスプレッドシートに同期する
