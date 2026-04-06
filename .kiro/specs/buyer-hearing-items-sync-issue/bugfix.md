# Bugfix Requirements Document

## Introduction

買主リストの詳細画面において、スプレッドシートの「●問合時ヒアリング」列（データベースカラム名：`inquiry_hearing`）がスプレッドシートからデータベースへ同期されない不具合を修正します。

この不具合により、スプレッドシートで「●問合時ヒアリング」列を更新しても、買主詳細画面に反映されない状態が発生しています。他のフィールドは正常に同期されており、この列のみが同期されない状況です。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN スプレッドシートの「●問合時ヒアリング」列を更新した場合 THEN システムはデータベースの`inquiry_hearing`カラムを更新しない

1.2 WHEN 買主詳細画面を表示した場合 THEN システムはスプレッドシートで更新された「●問合時ヒアリング」の内容を表示しない

1.3 WHEN EnhancedAutoSyncServiceの買主同期処理（`syncUpdatedBuyers`）が実行された場合 THEN システムは「●問合時ヒアリング」フィールドの変更を検出しない

### Expected Behavior (Correct)

2.1 WHEN スプレッドシートの「●問合時ヒアリング」列を更新した場合 THEN システムSHALLデータベースの`inquiry_hearing`カラムを正しく更新する

2.2 WHEN 買主詳細画面を表示した場合 THEN システムSHALLスプレッドシートで更新された「●問合時ヒアリング」の内容を正しく表示する

2.3 WHEN EnhancedAutoSyncServiceの買主同期処理（`syncUpdatedBuyers`）が実行された場合 THEN システムSHALL「●問合時ヒアリング」フィールドの変更を正しく検出し、データベースに反映する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN スプレッドシートの他のフィールド（「●氏名・会社名」「●内覧日(最新）」「●希望時期」など）を更新した場合 THEN システムSHALL CONTINUE TOこれらのフィールドを正常に同期する

3.2 WHEN 買主詳細画面で「●問合時ヒアリング」以外のフィールドを表示した場合 THEN システムSHALL CONTINUE TOこれらのフィールドを正常に表示する

3.3 WHEN EnhancedAutoSyncServiceの買主同期処理が実行された場合 THEN システムSHALL CONTINUE TO「●問合時ヒアリング」以外のフィールドの変更を正常に検出し、データベースに反映する

3.4 WHEN 新規買主がスプレッドシートに追加された場合 THEN システムSHALL CONTINUE TO「●問合時ヒアリング」を含む全フィールドを正常にデータベースに挿入する
