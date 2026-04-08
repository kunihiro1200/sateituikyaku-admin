# 要件定義書：物件リスト詳細画面「事務へCHAT」送信履歴表示機能

## はじめに

物件リスト詳細画面の左サイドバー（カテゴリーの下）に「事務へCHAT」送信履歴を表示する機能を追加します。現在、「事務へCHAT」ボタンでメッセージを送信できますが、送信した内容の履歴がサイドバーに表示されないため、過去のやり取りを素早く確認できません。

## 用語集

- **物件リスト詳細画面**: 物件の詳細情報を表示する画面（`PropertyListingDetailPage.tsx`）
- **左サイドバー**: 物件詳細画面の左側に表示されるサイドバー領域（`PropertySidebarStatus`コンポーネントを含む）
- **事務へCHAT**: 事務担当者にGoogle Chatメッセージを送信する機能
- **CHAT送信履歴**: 過去に送信したCHATメッセージの記録（送信日時、送信内容、送信者名を含む）
- **property_chat_history**: CHAT送信履歴を保存するデータベーステーブル

## 要件

### 要件1: CHAT送信履歴の表示場所

**ユーザーストーリー**: 営業担当者として、過去に送信したCHATメッセージを素早く確認したいので、左サイドバーのカテゴリーの下に履歴を表示してほしい

#### 受け入れ基準

1. THE System SHALL CHAT送信履歴を左サイドバーのカテゴリー（`PropertySidebarStatus`）の下に表示する
2. THE System SHALL 送信履歴セクションのタイトルを「事務へCHAT送信履歴」と表示する
3. THE System SHALL 送信履歴を新しい順（降順）に表示する
4. WHEN 送信履歴が存在しない、THE System SHALL 「送信履歴はありません」と表示する

### 要件2: CHAT送信履歴の表示内容

**ユーザーストーリー**: ユーザーとして、送信履歴を読みやすい形式で確認したいので、適切なフォーマットで表示してほしい

#### 受け入れ基準

1. THE System SHALL 送信日時を「YYYY/MM/DD HH:MM」形式で表示する
2. THE System SHALL メッセージ内容を最大100文字まで表示する
3. WHEN メッセージ内容が100文字を超える、THE System SHALL 100文字で切り捨てて「...」を末尾に追加する
4. THE System SHALL 送信者名を各履歴に表示する

### 要件3: CHAT送信履歴の表示件数

**ユーザーストーリー**: ユーザーとして、最新の送信履歴のみを確認したいので、最新5件まで表示してほしい

#### 受け入れ基準

1. THE System SHALL 最新5件の送信履歴のみを表示する
2. WHEN 送信履歴が5件を超える、THE System SHALL スクロール表示する
3. THE System SHALL スクロール領域の最大高さを300pxに設定する

### 要件4: CHAT送信履歴の取得

**ユーザーストーリー**: システム管理者として、CHAT送信履歴を効率的に取得したいので、既存のAPIエンドポイントを使用してほしい

#### 受け入れ基準

1. THE System SHALL 既存の`GET /api/property-listings/:propertyNumber/chat-history` APIエンドポイントを使用する
2. THE System SHALL `chat_type='office'`の履歴のみを取得する
3. THE System SHALL 送信履歴を新しい順（降順）に取得する
4. THE System SHALL 最大5件の履歴を取得する

### 要件5: データソース

**ユーザーストーリー**: 開発者として、既存のデータベーステーブルを使用したいので、`property_chat_history`テーブルから履歴を取得してほしい

#### 受け入れ基準

1. THE System SHALL `property_chat_history`テーブルから履歴を取得する
2. THE System SHALL `property_number`で履歴を絞り込む
3. THE System SHALL `chat_type='office'`で履歴を絞り込む
4. THE System SHALL `sent_at`で降順ソートする

### 要件6: フロントエンドコンポーネント

**ユーザーストーリー**: 開発者として、再利用可能なコンポーネントを作成したいので、新しいコンポーネント`PropertyChatHistory.tsx`を作成してほしい

#### 受け入れ基準

1. THE System SHALL 新しいコンポーネント`PropertyChatHistory.tsx`を作成する
2. THE System SHALL コンポーネントを`PropertyListingDetailPage.tsx`の左サイドバーに配置する
3. THE System SHALL コンポーネントを`PropertySidebarStatus`の下に配置する
4. THE System SHALL コンポーネントをスクロール可能にする

### 要件7: リアルタイム更新

**ユーザーストーリー**: ユーザーとして、CHAT送信後すぐに履歴を確認したいので、送信後に自動的に履歴を更新してほしい

#### 受け入れ基準

1. WHEN 「事務へCHAT」送信が成功する、THE System SHALL 送信履歴を自動的に再取得する
2. THE System SHALL ページリロードなしで履歴を更新する
3. THE System SHALL 新しい履歴を一覧の最上部に表示する

### 要件8: 既存機能との連携

**ユーザーストーリー**: 開発者として、既存の「事務へCHAT」送信機能と連携したいので、送信時に`property_chat_history`テーブルに履歴を保存してほしい

#### 受け入れ基準

1. THE System SHALL 既存の`POST /api/property-listings/:propertyNumber/send-chat-to-office` APIエンドポイントを使用する
2. WHEN 「事務へCHAT」送信が成功する、THE System SHALL `property_chat_history`テーブルに履歴を保存する
3. THE System SHALL `chat_type='office'`で履歴を保存する
4. THE System SHALL 送信者名（`employee.name`または`employee.initials`）を保存する

## 非機能要件

### パフォーマンス

1. THE System SHALL CHAT送信履歴を1秒以内に取得する
2. THE System SHALL 履歴表示を500ms以内に完了する

### セキュリティ

1. THE System SHALL 認証されたユーザーのみがCHAT送信履歴を閲覧できるようにする

### 互換性

1. THE System SHALL 既存の「事務へCHAT」機能と互換性を保つ
2. THE System SHALL 既存のAPIエンドポイントを変更しない

## 制約事項

1. CHAT送信履歴は削除機能を提供しない
2. CHAT送信履歴の編集機能を提供しない
3. 最新5件の履歴のみを表示する（それ以上は表示しない）
4. 「担当へCHAT」の履歴は表示しない（「事務へCHAT」のみ）
