# 要件定義書：物件リスト詳細画面CHAT送信履歴表示機能

## はじめに

物件リスト詳細画面に「事務へCHAT」と「担当へCHAT」ボタンの送信履歴を表示する機能を追加します。現在、これらのボタンでメッセージを送信できますが、送信した内容の履歴が残らないため、過去のやり取りを確認できません。

## 用語集

- **物件リスト詳細画面**: 物件の詳細情報を表示する画面（`/property-listings/:propertyNumber`）
- **事務へCHAT**: 事務担当者にChatworkメッセージを送信する機能
- **担当へCHAT**: 営業担当者にChatworkメッセージを送信する機能
- **CHAT送信履歴**: 過去に送信したCHATメッセージの記録（送信日時、送信先、送信内容を含む）
- **カテゴリー欄**: 物件詳細画面の左側に表示されるサイドバー領域

## 要件

### 要件1: CHAT送信履歴の保存

**ユーザーストーリー**: 事務担当者として、物件に関するCHAT送信履歴を確認したいので、送信したメッセージを自動的に保存してほしい

#### 受け入れ基準

1. WHEN 「事務へCHAT」ボタンでメッセージを送信する、THE System SHALL 送信日時、送信先（事務）、送信内容、送信者名をデータベースに保存する
2. WHEN 「担当へCHAT」ボタンでメッセージを送信する、THE System SHALL 送信日時、送信先（担当）、送信内容、送信者名をデータベースに保存する
3. THE System SHALL 送信履歴を物件番号と紐付けて保存する
4. THE System SHALL 送信失敗時は履歴を保存しない

### 要件2: CHAT送信履歴の表示

**ユーザーストーリー**: 営業担当者として、過去に送信したCHATメッセージを確認したいので、カテゴリー欄の下に履歴を表示してほしい

#### 受け入れ基準

1. THE System SHALL CHAT送信履歴をカテゴリー欄の左の欄の下に表示する
2. THE System SHALL 送信履歴を新しい順（降順）に表示する
3. THE System SHALL 各履歴に送信日時、送信先（事務/担当）、送信内容を表示する
4. THE System SHALL 送信者名を各履歴に表示する
5. WHEN 送信履歴が存在しない、THE System SHALL 「送信履歴はありません」と表示する

### 要件3: CHAT送信履歴の表示形式

**ユーザーストーリー**: ユーザーとして、送信履歴を読みやすい形式で確認したいので、適切なフォーマットで表示してほしい

#### 受け入れ基準

1. THE System SHALL 送信日時を「YYYY/MM/DD HH:mm」形式で表示する
2. THE System SHALL 送信先を「事務」または「担当」のバッジで表示する
3. THE System SHALL 送信内容を改行を保持して表示する
4. THE System SHALL 長い送信内容は最初の3行まで表示し、「続きを読む」ボタンで全文を表示する
5. THE System SHALL 送信者名を各履歴の右上に表示する

### 要件4: CHAT送信履歴の取得

**ユーザーストーリー**: システム管理者として、CHAT送信履歴を効率的に取得したいので、適切なAPIエンドポイントを提供してほしい

#### 受け入れ基準

1. THE System SHALL 物件番号を指定してCHAT送信履歴を取得するAPIエンドポイントを提供する
2. THE System SHALL 送信履歴を新しい順（降順）に返す
3. THE System SHALL 最大50件の履歴を返す
4. WHEN 物件番号が存在しない、THE System SHALL 404エラーを返す

### 要件5: データベーススキーマ

**ユーザーストーリー**: システム管理者として、CHAT送信履歴を永続化したいので、適切なデータベーステーブルを作成してほしい

#### 受け入れ基準

1. THE System SHALL `property_chat_history`テーブルを作成する
2. THE System SHALL 以下のカラムを含める：
   - `id`（UUID、主キー）
   - `property_number`（物件番号、外部キー）
   - `chat_type`（送信先：'office'または'assignee'）
   - `message`（送信内容、TEXT型）
   - `sender_name`（送信者名、VARCHAR型）
   - `sent_at`（送信日時、TIMESTAMP型）
   - `created_at`（作成日時、TIMESTAMP型）
3. THE System SHALL `property_number`にインデックスを作成する
4. THE System SHALL `sent_at`にインデックスを作成する

### 要件6: CHAT送信時の履歴保存

**ユーザーストーリー**: 開発者として、CHAT送信時に自動的に履歴を保存したいので、既存のCHAT送信処理に履歴保存ロジックを追加してほしい

#### 受け入れ基準

1. WHEN 「事務へCHAT」送信APIが成功する、THE System SHALL 履歴をデータベースに保存する
2. WHEN 「担当へCHAT」送信APIが成功する、THE System SHALL 履歴をデータベースに保存する
3. THE System SHALL トランザクション内で履歴を保存する
4. WHEN 履歴保存に失敗する、THE System SHALL エラーログを記録するが送信処理は成功とする

### 要件7: フロントエンドUI配置

**ユーザーストーリー**: ユーザーとして、CHAT送信履歴を見つけやすい場所に表示してほしいので、カテゴリー欄の下に配置してほしい

#### 受け入れ基準

1. THE System SHALL CHAT送信履歴セクションをカテゴリー欄の左の欄の下に配置する
2. THE System SHALL セクションタイトルを「CHAT送信履歴」と表示する
3. THE System SHALL セクションを折りたたみ可能にする
4. THE System SHALL デフォルトで展開状態にする
5. THE System SHALL スクロール可能な領域にする（最大高さ400px）

### 要件8: リアルタイム更新

**ユーザーストーリー**: ユーザーとして、CHAT送信後すぐに履歴を確認したいので、送信後に自動的に履歴を更新してほしい

#### 受け入れ基準

1. WHEN 「事務へCHAT」送信が成功する、THE System SHALL 送信履歴を自動的に再取得する
2. WHEN 「担当へCHAT」送信が成功する、THE System SHALL 送信履歴を自動的に再取得する
3. THE System SHALL ページリロードなしで履歴を更新する
4. THE System SHALL 新しい履歴を一覧の最上部に表示する

## 非機能要件

### パフォーマンス

1. THE System SHALL CHAT送信履歴を1秒以内に取得する
2. THE System SHALL 履歴保存を500ms以内に完了する

### セキュリティ

1. THE System SHALL 認証されたユーザーのみがCHAT送信履歴を閲覧できるようにする
2. THE System SHALL 送信内容を平文でデータベースに保存する（暗号化不要）

### 互換性

1. THE System SHALL 既存の「事務へCHAT」「担当へCHAT」機能と互換性を保つ
2. THE System SHALL 既存のAPIエンドポイントを変更しない

## 制約事項

1. CHAT送信履歴は削除機能を提供しない
2. CHAT送信履歴の編集機能を提供しない
3. 最大50件の履歴のみを表示する（それ以上は表示しない）
