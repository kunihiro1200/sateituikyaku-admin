# Bugfix Requirements Document

## Introduction

買主リストの「通知送信者」フィールドをブラウザUIで更新すると、データベースには正しく保存されるが、スプレッドシート（BS列）には反映されない問題を修正する。

この問題は、買主リスト用GAS（`gas_buyer_complete_code.js`）にDB→スプレッドシートの同期処理（`syncFromSupabaseToSpreadsheet_`関数）が実装されていないことが原因である。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーがブラウザUIで買主の「通知送信者」フィールドを更新する THEN データベースには正しく保存されるが、スプレッドシート（BS列）には反映されない

1.2 WHEN データベースの`notification_sender`カラムが更新される THEN 買主リスト用GASにDB→スプレッドシートの同期処理が実装されていないため、スプレッドシートに反映されない（GASの定期同期はスプレッドシート→DBの同期のみ）

1.3 WHEN 売主リストで同様の操作を行う THEN データベースとスプレッドシートの両方に正しく反映される（売主リスト用GASには`syncFromSupabaseToSpreadsheet_`関数が実装されているため）

### Expected Behavior (Correct)

2.1 WHEN ユーザーがブラウザUIで買主の「通知送信者」フィールドを更新する THEN データベースに保存され、数秒以内にスプレッドシート（BS列）に反映される SHALL

2.2 WHEN データベースの`notification_sender`カラムが更新される THEN バックエンドの即時同期処理（BuyerWriteService）によってスプレッドシートに反映される SHALL

2.3 WHEN バックエンドの`BuyerWriteService.updateFields()`が呼び出される THEN データベースの全フィールド（`notification_sender`を含む）がスプレッドシートに同期される SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 買主リスト用GASの`syncUpdatesToSupabase_`関数が実行される THEN スプレッドシート→データベースの同期が正常に動作し続ける SHALL CONTINUE TO

3.2 WHEN 買主リスト用GASの`updateBuyerSidebarCounts_`関数が実行される THEN サイドバーカウントの更新が正常に動作し続ける SHALL CONTINUE TO

3.3 WHEN 売主リストで同様の操作を行う THEN データベースとスプレッドシートの両方に正しく反映され続ける SHALL CONTINUE TO

3.4 WHEN 買主の他のフィールド（最新状況、次電日、内覧日等）を更新する THEN スプレッドシート→データベースの同期が正常に動作し続ける SHALL CONTINUE TO
