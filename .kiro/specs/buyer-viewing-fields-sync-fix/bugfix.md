# Bugfix Requirements Document

## Introduction

買主詳細画面の内覧ページでフィールドを入力・保存すると「保存しました」と表示されるが、約10分後に他のページに移動して戻ると値が空欄に戻るバグ。根本原因は複数あり、DB→スプシ同期での型変換不備と、GASの定期同期がDBの手動更新を上書きしてしまう保護ロジックの欠如が組み合わさって発生している。

影響を受けるフィールドは内覧ページの全フィールド（`latest_viewing_date`、`viewing_time`、`follow_up_assignee`、`inquiry_hearing`、`viewing_result_follow_up`、`pre_viewing_notes`、`viewing_notes`、`pre_viewing_hearing`、`seller_viewing_contact`、`buyer_viewing_contact`、`notification_sender`）。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが内覧ページで `viewing_time`（内覧時間）を入力してDBに保存し、DB→スプシ同期が実行される THEN システムは `viewing_time` の値をスプレッドシートに書き戻さない（`time`型の変換処理が未実装のため空欄になる）

1.2 WHEN ユーザーが内覧ページで `latest_viewing_date`（内覧日）を入力してDBに保存し、DB→スプシ同期が実行される THEN システムは日付をタイムゾーンのずれにより1日前の日付でスプレッドシートに書き込む可能性がある（`new Date("2026-03-29")` がUTC 00:00として解釈され、JST変換で前日になる）

1.3 WHEN DB→スプシ同期が失敗または遅延し、その後GASの10分定期同期（`syncBuyers()`）が実行される THEN システムはスプレッドシートの空欄値でDBの内覧フィールドを無条件に上書きし、ユーザーが保存した値が消える

1.4 WHEN GASの `syncBuyers()` が `last_synced_at` を設定してupsertを実行する THEN システムは `db_updated_at` フィールドをnullで上書きする可能性があり、バックエンドの `db_updated_at > last_synced_at` 保護ロジックが次回以降機能しなくなる

### Expected Behavior (Correct)

2.1 WHEN ユーザーが内覧ページで `viewing_time` を入力してDBに保存し、DB→スプシ同期が実行される THEN システムは `time`型の値（例: `"10:00"`）をスプレッドシートの時刻形式に正しく変換してスプレッドシートに書き込む SHALL

2.2 WHEN ユーザーが内覧ページで `latest_viewing_date` を入力してDBに保存し、DB→スプシ同期が実行される THEN システムは `date`型の文字列（例: `"2026-03-29"`）をタイムゾーンのずれなく `2026/03/29` としてスプレッドシートに書き込む SHALL

2.3 WHEN GASの `syncBuyers()` が実行され、対象レコードの `db_updated_at` が `last_synced_at` より新しい場合 THEN システムは内覧関連フィールド（`latest_viewing_date`、`viewing_time`、`follow_up_assignee`、`inquiry_hearing`、`viewing_result_follow_up`、`pre_viewing_notes`、`viewing_notes`、`pre_viewing_hearing`、`seller_viewing_contact`、`buyer_viewing_contact`、`notification_sender`）をスプレッドシートの値で上書きしない SHALL

2.4 WHEN GASの `syncBuyers()` がupsertを実行する THEN システムは既存の `db_updated_at` 値を保持し、nullで上書きしない SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが内覧ページ以外のフィールド（例: `name`、`phone_number`、`inquiry_confidence`）を更新する THEN システムは引き続きGASの定期同期でスプレッドシートの値をDBに反映する SHALL CONTINUE TO

3.2 WHEN `latest_viewing_date` や `viewing_time` がスプレッドシートで直接編集され、`db_updated_at` が `last_synced_at` 以前の場合 THEN システムは引き続きスプレッドシートの値をDBに同期する SHALL CONTINUE TO

3.3 WHEN `date`型フィールド（`reception_date`、`next_call_date`、`campaign_date`）のDB→スプシ同期が実行される THEN システムは引き続き正しい日付形式でスプレッドシートに書き込む SHALL CONTINUE TO

3.4 WHEN `text`型の内覧フィールド（`follow_up_assignee`、`pre_viewing_notes` 等）のDB→スプシ同期が実行される THEN システムは引き続き値をそのままスプレッドシートに書き込む SHALL CONTINUE TO

3.5 WHEN GASの `syncBuyers()` が新規買主レコードを処理する THEN システムは引き続き全フィールドをDBにupsertする SHALL CONTINUE TO
