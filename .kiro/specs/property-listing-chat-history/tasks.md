# 実装計画：物件リスト詳細画面CHAT送信履歴表示機能

## 概要

物件リスト詳細画面に「事務へCHAT」と「担当へCHAT」ボタンの送信履歴を表示する機能を実装します。既存のCHAT送信機能（`/api/property-listings/:propertyNumber/send-chat-to-assignee`、`/api/property-listings/:propertyNumber/send-chat-to-office`）に履歴保存ロジックを追加し、新規APIエンドポイントで履歴を取得できるようにします。

## タスク

- [x] 1. データベーススキーマの作成
  - `property_chat_history`テーブルを作成するマイグレーションファイルを作成
  - カラム: id (UUID), property_number, chat_type, message, sender_name, sent_at, created_at
  - インデックス: property_number, sent_at DESC
  - 外部キー制約: property_number → property_listings(property_number) ON DELETE CASCADE
  - _要件: 5.1, 5.2, 5.3, 5.4_

- [ ] 2. バックエンドAPI実装
  - [x] 2.1 CHAT送信履歴取得APIエンドポイントを実装
    - `GET /api/property-listings/:propertyNumber/chat-history`を`backend/src/routes/propertyListings.ts`に追加
    - 物件番号で履歴を取得（最大50件、sent_at降順）
    - 物件が存在しない場合は404エラーを返す
    - _要件: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 2.2 「担当へCHAT」送信APIに履歴保存ロジックを追加
    - `POST /api/property-listings/:propertyNumber/send-chat-to-assignee`に履歴保存処理を追加
    - CHAT送信成功後、property_chat_historyテーブルに履歴を保存（chat_type='assignee'）
    - 履歴保存失敗時はエラーログを記録するが、送信処理は成功とする
    - _要件: 1.2, 6.2, 6.3, 6.4_
  
  - [x] 2.3 「事務へCHAT」送信APIに履歴保存ロジックを追加
    - `POST /api/property-listings/:propertyNumber/send-chat-to-office`に履歴保存処理を追加
    - CHAT送信成功後、property_chat_historyテーブルに履歴を保存（chat_type='office'）
    - 履歴保存失敗時はエラーログを記録するが、送信処理は成功とする
    - _要件: 1.1, 6.1, 6.3, 6.4_

- [ ] 3. フロントエンドUI実装
  - [x] 3.1 CHAT送信履歴の型定義とAPI関数を作成
    - `ChatHistoryItem`インターフェースを定義
    - `fetchChatHistory(propertyNumber: string)`関数を実装
    - _要件: 2.1, 4.1_
  
  - [x] 3.2 CHAT送信履歴セクションコンポーネントを実装
    - PropertyListingDetailPage.tsxにCHAT送信履歴セクションを追加
    - カテゴリー欄の下に配置、折りたたみ可能（デフォルト展開）
    - 送信日時（YYYY/MM/DD HH:mm）、送信先バッジ（事務/担当）、送信内容、送信者名を表示
    - 長い送信内容は最初の3行まで表示し、「続きを読む」ボタンで全文表示
    - スクロール可能（最大高さ400px）
    - 履歴がない場合は「送信履歴はありません」と表示
    - _要件: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 3.3 CHAT送信後の履歴自動更新を実装
    - 「事務へCHAT」送信成功後、fetchChatHistory()を呼び出して履歴を再取得
    - 「担当へCHAT」送信成功後、fetchChatHistory()を呼び出して履歴を再取得
    - ページリロードなしで履歴を更新
    - _要件: 8.1, 8.2, 8.3, 8.4_

- [ ] 4. チェックポイント - 動作確認
  - 全てのテストが通ることを確認し、質問があればユーザーに確認してください。

## 注意事項

- 既存のCHAT送信機能（`send-chat-to-assignee`、`send-chat-to-office`）を変更する際は、既存の動作を壊さないように注意
- 履歴保存失敗時もCHAT送信は成功として扱う（要件6.4）
- 送信者名は`req.employee?.name`または`req.employee?.initials`から取得
- TypeScriptの型定義を適切に行い、型安全性を確保
