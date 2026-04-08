# 実装計画：物件リスト詳細画面「事務へCHAT」送信履歴表示機能

## 概要

物件リスト詳細画面の左サイドバーに「事務へCHAT」送信履歴を表示する機能を実装します。既存のAPIエンドポイントを活用し、新しいReactコンポーネント`PropertyChatHistory.tsx`を作成して、リアルタイムで履歴を更新します。

## タスク

- [x] 1. バックエンドAPI修正
  - [x] 1.1 GET /api/property-listings/:propertyNumber/chat-history にクエリパラメータを追加
    - `chat_type`パラメータでフィルタリング機能を追加
    - `limit`パラメータで件数制限機能を追加
    - 新しい順（`sent_at DESC`）にソート
    - `backend/src/routes/propertyListings.ts`を修正
    - _要件: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.2 POST /api/property-listings/:propertyNumber/send-chat-to-office に履歴保存処理を追加
    - Google Chat送信成功後に`property_chat_history`テーブルに履歴を保存
    - `chat_type='office'`で保存
    - `sender_name`に送信者名を保存
    - `sent_at`に送信日時を保存
    - `backend/src/routes/propertyListings.ts`を修正
    - _要件: 8.1, 8.2, 8.3, 8.4_

- [x] 2. フロントエンドコンポーネント作成
  - [x] 2.1 PropertyChatHistory.tsx コンポーネントを作成
    - `frontend/frontend/src/components/PropertyChatHistory.tsx`を新規作成
    - Props: `propertyNumber`, `refreshTrigger`
    - State: `history`, `loading`, `error`
    - `fetchChatHistory()`メソッドを実装（API呼び出し）
    - `formatDateTime()`メソッドを実装（YYYY/MM/DD HH:MM形式）
    - `truncateMessage()`メソッドを実装（100文字で切り捨て）
    - _要件: 6.1, 2.1, 2.2, 2.3_

  - [x] 2.2 PropertyChatHistory.tsx のUI実装
    - タイトル「事務へCHAT送信履歴」を表示
    - ローディング状態を表示（CircularProgress）
    - エラー状態を表示（Alert）
    - 履歴が0件の場合「送信履歴はありません」と表示
    - 履歴リストを表示（最大高さ300px、スクロール可能）
    - 各履歴に送信日時、送信者名、メッセージを表示
    - _要件: 1.1, 1.2, 1.4, 2.4, 3.2, 3.3_

- [x] 3. PropertyListingDetailPage.tsx に統合
  - [x] 3.1 PropertyChatHistory コンポーネントを配置
    - `PropertySidebarStatus`の下に`PropertyChatHistory`を配置
    - `chatHistoryRefreshTrigger` stateを追加
    - `PropertyChatHistory`に`propertyNumber`と`refreshTrigger`を渡す
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`を修正
    - _要件: 1.1, 6.2, 6.3_

  - [x] 3.2 handleSendChatToOffice 関数を修正
    - CHAT送信成功後に`setChatHistoryRefreshTrigger(prev => prev + 1)`を追加
    - 履歴を自動的に再取得
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`を修正
    - _要件: 7.1, 7.2, 7.3_

- [x] 4. Checkpoint - 基本機能の動作確認
  - すべてのテストが通ることを確認
  - ユーザーに質問があれば確認

- [x] 5. 統合テストと最終確認
  - [x] 5.1 E2Eテストを実行
    - 物件リスト詳細画面を開く
    - 左サイドバーに履歴が表示されることを確認
    - 「事務へCHAT」を送信
    - 履歴が自動的に更新されることを確認
    - 新しい履歴が一覧の最上部に表示されることを確認
    - _要件: 1.3, 7.1, 7.2, 7.3_

  - [x] 5.2 エラーハンドリングの確認
    - API呼び出し失敗時にエラーメッセージが表示されることを確認
    - ネットワークエラー時に適切なメッセージが表示されることを確認
    - 履歴が0件の場合に「送信履歴はありません」と表示されることを確認
    - _要件: 1.4_

- [x] 6. Final Checkpoint - すべてのテストが通ることを確認
  - すべてのテストが通ることを確認
  - ユーザーに質問があれば確認

## 注意事項

- 既存の「事務へCHAT」機能との互換性を保つ
- 既存のAPIエンドポイントを変更しない（クエリパラメータの追加のみ）
- 最新5件の履歴のみを表示する
- 「担当へCHAT」の履歴は表示しない（「事務へCHAT」のみ）
- 履歴の削除・編集機能は提供しない
