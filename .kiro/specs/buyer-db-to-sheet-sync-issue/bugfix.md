# Bugfix Requirements Document

## Introduction

買主リストの詳細画面において、データベースの`inquiry_hearing`フィールド（スプレッドシート列名：「●問合時ヒアリング」）を更新しても、スプレッドシートへ即時同期されない不具合を修正します。

この不具合により、買主詳細画面で「●問合時ヒアリング」を入力・更新しても、スプレッドシートに反映されない状態が発生しています（買主番号7294で確認）。他のフィールドは正常に同期されており、この列のみが同期されない状況です。

過去に同様の即時同期機能が実装されており（コミット`49672ef7`、`0d9f517a`）、`BuyerWriteService.updateRowPartial`を使用して数式を上書きしないように実装されています。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 買主詳細画面で「●問合時ヒアリング」フィールドを入力・更新した場合 THEN システムはスプレッドシートの「●問合時ヒアリング」列を即時更新しない

1.2 WHEN 買主番号7294の「●問合時ヒアリング」をデータベースで更新した場合 THEN システムはスプレッドシートの対応する行のM列（「●問合時ヒアリング」）を更新しない

1.3 WHEN `BuyerService.updateWithSync`が`inquiry_hearing`フィールドを含む更新を実行した場合 THEN システムは`BuyerWriteService.updateFields`を呼び出すが、スプレッドシートに反映されない

### Expected Behavior (Correct)

2.1 WHEN 買主詳細画面で「●問合時ヒアリング」フィールドを入力・更新した場合 THEN システムSHALL即座にスプレッドシートの「●問合時ヒアリング」列を更新する

2.2 WHEN 買主番号7294の「●問合時ヒアリング」をデータベースで更新した場合 THEN システムSHALLスプレッドシートの対応する行のM列（「●問合時ヒアリング」）を即座に更新する

2.3 WHEN `BuyerService.updateWithSync`が`inquiry_hearing`フィールドを含む更新を実行した場合 THEN システムSHALL`BuyerWriteService.updateFields`を呼び出し、`updateRowPartial`を使用してスプレッドシートに正しく反映する

2.4 WHEN `inquiry_hearing`フィールドにHTMLタグが含まれる場合 THEN システムSHALLプレーンテキストに変換してからスプレッドシートに書き込む

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主詳細画面で「●問合時ヒアリング」以外のフィールド（「●氏名・会社名」「●内覧日(最新）」「●希望時期」など）を更新した場合 THEN システムSHALL CONTINUE TOこれらのフィールドをスプレッドシートに即時同期する

3.2 WHEN `BuyerWriteService.updateRowPartial`が呼び出された場合 THEN システムSHALL CONTINUE TOスプレッドシートの数式を上書きしない

3.3 WHEN 他のHTMLフィールド（`viewing_result_follow_up`、`message_to_assignee`）を更新した場合 THEN システムSHALL CONTINUE TOHTMLタグをプレーンテキストに変換してスプレッドシートに書き込む

3.4 WHEN スプレッドシートからデータベースへの同期（逆方向）が実行された場合 THEN システムSHALL CONTINUE TO「●問合時ヒアリング」を含む全フィールドを正常にデータベースに反映する
