# Bugfix Requirements Document

## Introduction

CallModePage（通話モードページ）の「専任媒介通知」ボタンを押すと、「専任媒介の通知を送信しました（4つのフィールドも保存しました）」というサクセスメッセージが表示されるが、実際にはGoogle Chatに通知が届いていない。

調査の結果、以下の2つの問題が確認された：

1. **APIエンドポイントのパス不一致**: フロントエンドは `/api/chat-notifications/exclusive-contract/:sellerId` を呼び出しているが、バックエンドは `/chat-notifications`（`/api/` プレフィックスなし）でルートを登録している。そのため、リクエストが正しいルートに到達していない可能性がある。
2. **環境変数の未設定**: `backend/.env` に `GOOGLE_CHAT_WEBHOOK_URL` が設定されていない。`ChatNotificationService` はこの環境変数が空の場合、`console.warn` を出力して `false` を返すだけで、エラーをスローしない。そのため、フロントエンドは成功レスポンスを受け取り、サクセスメッセージを表示してしまう。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN ユーザーが「専任媒介通知」ボタンを押し、必須フィールドが入力済みの場合 THEN システムはサクセスメッセージ「専任媒介の通知を送信しました（4つのフィールドも保存しました）」を表示する

1.2 WHEN `GOOGLE_CHAT_WEBHOOK_URL` 環境変数が未設定の場合 THEN `ChatNotificationService.sendToGoogleChat()` はエラーをスローせず `false` を返し、呼び出し元の `sendExclusiveContractNotification()` もエラーをスローしない

1.3 WHEN バックエンドのルートが `/chat-notifications` で登録されているが、フロントエンドが `/api/chat-notifications/exclusive-contract/:sellerId` を呼び出す場合 THEN リクエストが正しいルートハンドラに到達しない可能性がある

1.4 WHEN Google Chat Webhook URLが未設定または無効な場合 THEN Google Chatには何も通知が届かない

### Expected Behavior (Correct)

2.1 WHEN ユーザーが「専任媒介通知」ボタンを押した場合 THEN システムは指定されたGoogle Chat Webhook URL（`https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=...`）に通知を送信し、Google Chatに実際にメッセージが届く

2.2 WHEN `GOOGLE_CHAT_WEBHOOK_URL` 環境変数が設定されていない場合 THEN システムはエラーをスローし、フロントエンドにエラーメッセージを返す（サクセスメッセージを表示しない）

2.3 WHEN フロントエンドが `/api/chat-notifications/exclusive-contract/:sellerId` を呼び出す場合 THEN バックエンドのルートが正しく `/api/chat-notifications` で登録されており、リクエストが正しいルートハンドラに到達する

2.4 WHEN Google Chat通知の送信に失敗した場合 THEN システムはエラーレスポンスを返し、フロントエンドはエラーメッセージを表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN ユーザーが「専任媒介通知」ボタンを押し、必須フィールド（専任（他決）決定日、競合、専任・他決要因）が未入力の場合 THEN システムは引き続きバリデーションエラーを表示し、通知を送信しない

3.2 WHEN ユーザーが「専任媒介通知」ボタンを押した場合 THEN システムは引き続き4つのフィールド（status、exclusiveDecisionDate、competitors、exclusiveOtherDecisionFactors）をDBに保存する

3.3 WHEN Google Chat通知が正常に送信された場合 THEN システムは引き続きサクセスメッセージを表示する

3.4 WHEN 一般媒介、訪問後他決、未訪問他決の通知ボタンを押した場合 THEN それぞれのエンドポイント（`/api/chat-notifications/general-contract`、`/api/chat-notifications/post-visit-other-decision`、`/api/chat-notifications/pre-visit-other-decision`）も同様に正しく動作する
