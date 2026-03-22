# Bugfix Requirements Document

## Introduction

通話モードページ（CallModePage）のサイドバーにある「過去の追客ログ」セクション（`FollowUpLogHistoryTable`）に、通話履歴（phone_call タイプのアクティビティ）が表示されている。通話履歴は「売主追客ログ」セクション（`CallLogDisplay`）に既に表示されているため、「過去の追客ログ」には不要であり、EmailとSMS送信履歴のみを表示すべきである。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 通話モードページのサイドバーを表示する THEN システムは「過去の追客ログ」セクション（`FollowUpLogHistoryTable`）に通話履歴（phone_call タイプ）を含む全アクティビティを表示する

1.2 WHEN 「過去の追客ログ」セクションに通話履歴が表示される THEN システムは「売主追客ログ」セクション（`CallLogDisplay`）と重複した通話履歴をユーザーに見せる

### Expected Behavior (Correct)

2.1 WHEN 通話モードページのサイドバーを表示する THEN システムは「過去の追客ログ」セクションにEmailおよびSMS送信履歴のみを表示する（通話履歴は除外する）

2.2 WHEN 「過去の追客ログ」セクションにEmailまたはSMS送信履歴が存在しない THEN システムは「この売主の履歴データはありません」と表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 「売主追客ログ」セクション（`CallLogDisplay`）を表示する THEN システムは引き続き通話履歴（phone_call タイプ）を正しく表示する

3.2 WHEN 「過去の追客ログ」セクションにEmailまたはSMS送信履歴が存在する THEN システムは引き続きそれらの履歴を正しく表示する

3.3 WHEN 「過去の追客ログ」セクションのデータを取得する THEN システムは引き続きキャッシュ機能・手動更新機能を正常に動作させる
