# タスクリスト: property-detail-chat-notification

## Tasks

- [x] 1. バックエンドAPIエンドポイントを追加する
  - [x] 1.1 `backend/src/routes/propertyListings.ts` に `POST /:propertyNumber/send-chat-to-assignee` エンドポイントを追加する
  - [x] 1.2 `StaffManagementService` をインポートして `getWebhookUrl()` を呼び出す処理を実装する
  - [x] 1.3 Google Chat webhookへのメッセージ送信処理を実装する（axiosを使用）

- [x] 2. フロントエンドに「担当へCHAT」ボタンと入力フォームを追加する
  - [x] 2.1 `PropertyListingDetailPage.tsx` に `chatPanelOpen`・`chatMessage`・`chatSending` の状態変数を追加する
  - [x] 2.2 `handleSendChatToAssignee` 関数を実装する
  - [x] 2.3 SMSボタンの隣に「担当へCHAT」ボタンを追加する（`sales_assignee`が空の場合は非表示）
  - [x] 2.4 「担当へCHAT」ボタンの下にトグル表示する入力フォームを追加する
