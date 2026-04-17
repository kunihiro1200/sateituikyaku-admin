# 実装計画: property-price-reduction-chat-control

## 概要

物件リスト詳細画面の価格情報セクション（`PriceSection`）において、値下げ予約日の入力状態に応じてCHAT送信ボタンの表示/非表示を制御し、送信先をスタッフ管理スプレッドシートから動的に取得する機能を実装します。また、CHAT送信時の画像添付機能を追加し、Webhook URLをバックエンドで一元管理します。

## タスク

- [x] 1. フロントエンド型定義とPriceSectionボタン表示制御の実装
  - [x] 1.1 `PropertyChatSendData` 型を `frontend/frontend/src/types/chat.ts` に新規作成する
    - `imageUrl?: string` フィールドを持つインターフェースを定義する
    - _Requirements: 3.2, 5.2_

  - [ ]* 1.2 ボタン表示制御ロジックのプロパティテストを書く
    - **Property 1: ボタン表示と値下げ予約日の排他性**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
    - `shouldShowChatButton(scheduledDate)` 関数を対象に fast-check で検証する
    - `fc.oneof(fc.constant(null), fc.constant(''), fc.string({ minLength: 1 }))` を使用する

  - [x] 1.3 `PriceSection.tsx` に `onChatSend` prop と `showChatButton` 制御ロジックを追加する
    - `onChatSend: (data: PropertyChatSendData) => Promise<void>` を props に追加する
    - `const showChatButton = !isEditMode && !displayScheduledDate;` を実装する
    - ボタンを `showChatButton` の条件で表示/非表示に切り替える
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [-] 2. PriceSectionの送信確認ダイアログと画像添付UIの実装
  - [-] 2.1 `PriceSection.tsx` の送信確認ダイアログに `ImageSelectorModal` を組み込む
    - 既存の確認ダイアログに画像添付オプション（任意）を追加する
    - 選択した画像の `previewUrl` または `url` を `imageUrl` として保持する
    - 画像なしでも送信できるようにする
    - _Requirements: 3.1, 3.3, 3.5_

  - [ ] 2.2 ダイアログの「送信する」ボタンで `onChatSend({ imageUrl })` を呼び出す
    - 送信成功時に成功メッセージを表示する
    - 送信失敗時（404: `WEBHOOK_NOT_FOUND`）に「担当者のCHATアドレスが設定されていません」を表示する
    - ネットワークエラー時に「CHAT送信に失敗しました」を表示する
    - _Requirements: 2.4, 3.2, 3.3_

  - [ ]* 2.3 送信確認ダイアログのユニットテストを書く
    - 画像添付オプションが表示されることを確認する
    - 画像なしで送信できることを確認する
    - _Requirements: 3.1, 3.3_

- [ ] 3. PropertyListingDetailPageのハンドラー実装
  - [ ] 3.1 `PropertyListingDetailPage.tsx` に `handlePropertyChatSend` ハンドラーを追加する
    - `POST /api/chat-notifications/property-price-reduction` を呼び出す
    - リクエストボディに `salesAssignee`, `propertyNumber`, `latestReduction`, `address`, `imageUrl` を含める
    - `getLatestPriceReduction(propertyData.price_reduction_history)` で最新値下げ履歴を取得する
    - _Requirements: 2.1, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 3.2 `PriceSection` コンポーネントに `onChatSend={handlePropertyChatSend}` を渡す
    - 既存の `PriceSection` の呼び出し箇所を更新する
    - _Requirements: 2.1_

- [ ] 4. チェックポイント — フロントエンド実装の確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 5. バックエンドエンドポイントの追加
  - [ ] 5.1 `backend/src/routes/chatNotifications.ts` に `POST /property-price-reduction` エンドポイントを追加する
    - `authenticate` ミドルウェアを適用する
    - リクエストボディから `salesAssignee`, `propertyNumber`, `latestReduction`, `address`, `imageUrl?` を受け取る
    - `salesAssignee` が空の場合は `"事務"` をフォールバックとして使用する
    - `StaffManagementService.getWebhookUrl()` でWebhook URLを取得する
    - Webhook URLが取得できない場合は HTTP 404 と `WEBHOOK_NOT_FOUND` を返す
    - `ChatNotificationService.sendPropertyPriceReductionNotification()` を呼び出す
    - 送信結果 `{ success: boolean }` をレスポンスとして返す
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

  - [ ]* 5.2 エンドポイントのユニットテストを書く
    - `salesAssignee` が空のときのフォールバック動作を確認する
    - Webhook URL未設定時の404レスポンスを確認する
    - バリデーションエラー時の400レスポンスを確認する
    - _Requirements: 5.4, 5.5_

  - [ ]* 5.3 エンドポイントのプロパティテストを書く
    - **Property 4: リクエスト処理の完全性**
    - **Validates: Requirements 5.2, 5.6**
    - 有効なリクエストボディに対してレスポンスが必ず `success` フィールドを含むことを検証する

- [ ] 6. ChatNotificationServiceへのメソッド追加
  - [ ] 6.1 `backend/src/services/ChatNotificationService.ts` に `sendPropertyPriceReductionNotification` メソッドを追加する
    - `webhookUrl`, `propertyNumber`, `latestReduction`, `address`, `imageUrl?`, `propertyUrl` を受け取る
    - `formatPropertyPriceReductionMessage()` でメッセージを生成する
    - Google Chat API（Webhook URL）へ POST する
    - 成功時に `true`、失敗時に `false` を返す
    - _Requirements: 2.2, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ] 6.2 `formatPropertyPriceReductionMessage()` 関数を実装する
    - 画像なし: `物件番号：{propertyNumber}\n【値下げ通知】\n{latestReduction}\n{address}\n{propertyUrl}`
    - 画像あり: 上記に `📷 {imageUrl}` を追加する
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 6.3 メッセージフォーマットのプロパティテストを書く
    - **Property 2: メッセージ内容の完全性**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - 任意の `propertyNumber`, `latestReduction`, `address` の組み合わせに対してメッセージが全フィールドを含むことを検証する

  - [ ]* 6.4 画像URLのメッセージ反映プロパティテストを書く
    - **Property 3: 画像URLのメッセージへの反映**
    - **Validates: Requirements 3.2, 3.4, 4.5**
    - 任意の有効な画像URLに対してメッセージにそのURLが含まれることを検証する

  - [ ]* 6.5 `sendPropertyPriceReductionNotification` のユニットテストを書く
    - Google Chat APIへの送信内容を確認する
    - 画像あり/なし両方のケースを確認する
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 7. 最終チェックポイント — 全テストの確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

## 注意事項

- `*` が付いたタスクはオプションであり、MVP実装では省略可能
- 各タスクは対応する要件番号を参照しており、トレーサビリティを確保している
- `StaffManagementService.getWebhookUrl()` は既存メソッドを活用し、変更は最小限にとどめる
- Webhook URLはバックエンドのみで管理し、フロントエンドには公開しない（要件2.5）
