# 実装計画: seller-send-history（売主への送信履歴）

## 概要

`property_chat_history` テーブルを拡張し、売主への送信履歴（EMAIL・SMS・GMAIL）を記録・表示する機能を実装する。バックエンドAPIの追加、フロントエンドコンポーネントの新規作成、既存ページへの組み込みを順に行う。

## タスク

- [ ] 1. DBマイグレーション
  - [ ] 1.1 `subject` カラムの追加と `chat_type` CHECK制約の拡張
    - `property_chat_history` テーブルに `subject TEXT DEFAULT ''` カラムを追加する
    - `chat_type` の CHECK制約を `('office', 'assignee', 'seller_email', 'seller_sms', 'seller_gmail')` に拡張する
    - `chat_type` カラムへのインデックスを追加する
    - マイグレーションSQLファイルを `backend/add-seller-send-history.sql` として作成する
    - _Requirements: 8.1, 8.2_

- [ ] 2. バックエンドAPI実装
  - [x] 2.1 `POST /api/property-listings/:propertyNumber/seller-send-history` エンドポイントを追加する
    - `backend/src/index.ts` または既存のルーティングファイルに新規エンドポイントを追加する
    - リクエストボディの `chat_type` バリデーション（`seller_email` | `seller_sms` | `seller_gmail` 以外は400エラー）を実装する
    - `property_chat_history` テーブルへのINSERT処理を実装する
    - 成功時は `{ success: true }` を返す
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [ ]* 2.2 `POST` エンドポイントのプロパティテストを書く
    - **Property 1: 履歴レコードの必須フィールド保存**
    - **Validates: Requirements 1.2, 2.2, 3.2, 8.2**
    - **Property 2: 無効な chat_type のバリデーション**
    - **Validates: Requirements 8.3**

  - [x] 2.3 `GET /api/property-listings/:propertyNumber/chat-history` エンドポイントを拡張する
    - `chat_type` パラメータに `seller_email`・`seller_sms`・`seller_gmail` を指定できるようにする
    - `sent_at` 降順・最大50件のクエリを実装する（既存動作を維持しつつ拡張）
    - レスポンスに `subject` フィールドを含める
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [ ]* 2.4 `GET` エンドポイントのプロパティテストを書く
    - **Property 3: 履歴の降順ソート**
    - **Validates: Requirements 4.3, 7.3**
    - **Property 4: 最大件数制限**
    - **Validates: Requirements 7.4**

- [ ] 3. チェックポイント - バックエンドAPIの動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 4. フロントエンドコンポーネント実装
  - [x] 4.1 `SellerSendHistoryDetailModal` コンポーネントを作成する
    - `frontend/frontend/src/components/SellerSendHistoryDetailModal.tsx` を新規作成する
    - Props: `open`, `item`, `onClose`
    - 件名・送信者名・送信日時・本文全文を表示する
    - 閉じるボタンでモーダルを閉じる
    - _Requirements: 4b.1, 4b.2, 4b.3, 4b.4_

  - [ ]* 4.2 `SellerSendHistoryDetailModal` のユニットテストを書く
    - モーダルの開閉動作をテストする
    - SMS送信履歴（件名なし・本文「SMS送信」）の表示をテストする
    - _Requirements: 4b.2, 4b.3_

  - [x] 4.3 `SellerSendHistory` コンポーネントを作成する
    - `frontend/frontend/src/components/SellerSendHistory.tsx` を新規作成する
    - Props: `propertyNumber`, `refreshTrigger`
    - `GET /api/property-listings/:propertyNumber/chat-history` を呼び出し、`seller_email`・`seller_sms`・`seller_gmail` の履歴をフィルタリングして表示する
    - 各アイテムに件名・送信者名・送信日時（`YYYY/MM/DD HH:mm`）・送信種別ラベルを表示する（本文は非表示）
    - 空状態は「送信履歴はありません」を表示する
    - アイテムクリック時に `SellerSendHistoryDetailModal` を開く
    - `CHAT_TYPE_LABELS` で送信種別ラベルと色を定義する（EMAIL: 青系、SMS: 緑系、GMAIL: 赤系）
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 4.4 `SellerSendHistory` のプロパティテストを書く
    - **Property 5: 送信種別ラベルの対応**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
    - **Property 6: 一覧表示の必須フィールド（本文非表示）**
    - **Validates: Requirements 4.4**
    - **Property 7: 詳細モーダルの必須フィールド**
    - **Validates: Requirements 4b.2**

- [ ] 5. 既存ページへの組み込み
  - [x] 5.1 `PropertyListingDetailPage` に `SellerSendHistory` を追加する
    - `SellerSendHistory` コンポーネントをインポートし、サイドバーの `PropertyChatHistory` の下に配置する
    - `sellerSendHistoryRefreshTrigger` state を追加する
    - _Requirements: 4.1, 4.2_

  - [x] 5.2 `PropertyListingDetailPage` のEMAIL送信後に履歴保存処理を追加する
    - `handleSendEmail` 成功後に `POST /api/property-listings/:propertyNumber/seller-send-history` を呼び出す（`chat_type: 'seller_email'`）
    - 成功後に `sellerSendHistoryRefreshTrigger` をインクリメントする
    - 履歴保存失敗時は `console.error` でログ記録のみ（送信成功のスナックバーには影響しない）
    - _Requirements: 1.1, 1.2, 1.4, 6.1_

  - [x] 5.3 `PropertyListingDetailPage` のSMSボタン押下後に履歴保存処理を追加する
    - SMSボタンの `onClick` で `POST /api/property-listings/:propertyNumber/seller-send-history` を呼び出す（`chat_type: 'seller_sms'`、`subject: ''`、`message: 'SMS送信'`）
    - 成功後に `sellerSendHistoryRefreshTrigger` をインクリメントする
    - 履歴保存失敗時は `console.error` でログ記録のみ
    - _Requirements: 2.1, 2.2, 2.3, 6.3_

  - [x] 5.4 `ReinsRegistrationPage` のGmail送信後に履歴保存処理を追加する
    - `handleSendEmail` 成功後に `POST /api/property-listings/:propertyNumber/seller-send-history` を呼び出す（`chat_type: 'seller_gmail'`）
    - 送信者名は `useAuthStore` から `employee.name || employee.initials || '不明'` を使用する
    - 履歴保存失敗時は `console.error` でログ記録のみ
    - _Requirements: 3.1, 3.2, 3.4, 6.2_

- [ ] 6. チェックポイント - フロントエンドの動作確認
  - 全テストが通ることを確認し、疑問点があればユーザーに確認する。

- [ ] 7. デプロイ
  - [x] 7.1 DBマイグレーションを本番環境に適用する
    - `backend/add-seller-send-history.sql` を本番DBに実行する
    - _Requirements: 8.1_

  - [x] 7.2 バックエンドをデプロイする
    - `sateituikyaku-admin-backend` Vercelプロジェクトにデプロイする

  - [x] 7.3 フロントエンドをデプロイする
    - `sateituikyaku-admin-frontend` Vercelプロジェクトにデプロイする

## 備考

- `*` が付いたタスクはオプションであり、MVPとして省略可能
- 各タスクは対応する要件番号を参照しているため、トレーサビリティを確保している
- プロパティテストには **fast-check** ライブラリを使用する（`frontend/frontend/src/__tests__/seller-send-history.property.test.ts`）
- 履歴保存の失敗は送信操作の成功に影響を与えない（非ブロッキング設計）
