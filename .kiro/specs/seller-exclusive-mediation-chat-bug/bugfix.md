# Bugfix Requirements Document

## Introduction

売主リストの通話モードページ（`/sellers/:id/call`）にある「専任媒介通知」ボタンを押してもGoogle Chatへの通知が送信されないバグ。

ボタンは `isRequiredFieldsComplete()` が `true` の場合のみ表示される。この関数は `editedExclusiveDecisionDate !== ''`（空文字との比較）で決定日の入力有無を判定しているが、初期値が `null` の場合 `null !== ''` は `true` となるため、決定日が未入力でもボタンが表示されてしまう。

その後 `handleSendChatNotification` 内のバリデーションで `!editedExclusiveDecisionDate`（null は falsy）が `true` となり早期リターンし、チャット送信が実行されない。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `editedExclusiveDecisionDate` が `null`（初期値）の状態で「専任媒介通知」ボタンを押す THEN システムは `isRequiredFieldsComplete()` が `true` を返すためボタンを表示するが、`handleSendChatNotification` 内のバリデーション `!editedExclusiveDecisionDate` が `true` となり早期リターンしてチャット送信が実行されない

1.2 WHEN `editedExclusiveDecisionDate` が `null` の状態で `isRequiredFieldsComplete()` が呼ばれる THEN システムは `null !== ''` が `true` であるため必須項目が入力済みと誤判定し `true` を返す

1.3 WHEN ステータスが「専任媒介」（`exclusive_contract`）で必須フィールドが未入力の状態でボタンを押す THEN システムはエラーメッセージを表示するが、ボタンが表示されていること自体が誤り（必須項目未入力なのにボタンが表示される）

### Expected Behavior (Correct)

2.1 WHEN `editedExclusiveDecisionDate` が `null` または空文字の状態で `isRequiredFieldsComplete()` が呼ばれる THEN システムは `false` を返し、「専任媒介通知」ボタンを表示しない

2.2 WHEN 専任（他決）決定日・競合・専任他決要因がすべて入力済みの状態で「専任媒介通知」ボタンを押す THEN システムは SHALL バリデーションを通過してGoogle Chat通知を送信する

2.3 WHEN `isRequiredFieldsComplete()` が呼ばれる THEN システムは SHALL `editedExclusiveDecisionDate` が `null` でも空文字でもない場合のみ `true` を返す（`!!editedExclusiveDecisionDate` または `editedExclusiveDecisionDate !== null && editedExclusiveDecisionDate !== ''` で判定する）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 専任（他決）決定日・競合・専任他決要因がすべて正しく入力されている状態でボタンを押す THEN システムは SHALL CONTINUE TO Google Chat通知を送信し成功メッセージを表示する

3.2 WHEN ステータスが「専任媒介」以外（例：「追客中」）の場合 THEN システムは SHALL CONTINUE TO 「専任媒介通知」ボタンを表示しない

3.3 WHEN ステータスが「他決→専任」「他決→追客不要」など「他決」を含む場合 THEN システムは SHALL CONTINUE TO 必須フィールドの入力チェックを行い、全入力済みの場合のみボタンを表示する

3.4 WHEN チャット送信前のDB保存（`api.put('/api/sellers/:id', ...)`）が実行される THEN システムは SHALL CONTINUE TO 4つのフィールド（専任決定日・競合・専任他決要因・競合名理由）をデータベースに保存する

3.5 WHEN ステータスラベルに「専任」が含まれる場合 THEN システムは SHALL CONTINUE TO `/chat-notifications/exclusive-contract/:sellerId` エンドポイントを呼び出す
