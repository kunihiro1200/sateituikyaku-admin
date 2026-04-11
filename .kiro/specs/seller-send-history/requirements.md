# 要件ドキュメント

## はじめに

物件リスト詳細画面（`PropertyListingDetailPage`）において、売主への各種送信操作（EMAIL送信・SMS・GMAIL送信）の履歴を記録し、詳細画面のサイドバーに「売主への送信履歴」セクションとして表示する機能を追加する。

既存の「事務へCHAT送信履歴」（`PropertyChatHistory` コンポーネント）と同様のアーキテクチャを採用し、`property_chat_history` テーブルに `chat_type` を拡張する形で履歴を保存・表示する。

## 用語集

- **System**: 売主管理システム（`sateituikyaku-admin`）のバックエンド（ポート3000）およびフロントエンド
- **PropertyListingDetailPage**: 物件リスト詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **SellerSendHistory**: 売主への送信履歴を表示するコンポーネント（新規作成）
- **EMAIL送信ボタン**: 詳細画面ヘッダーの「Email送信」ドロップダウンボタン（テンプレート選択後にメール送信）
- **SMSボタン**: 詳細画面ヘッダーの「SMS」ボタン（`sms:` リンクで端末のSMSアプリを起動）
- **GMAIL送信ボタン**: レインズ登録・サイト入力画面（`ReinsRegistrationPage`）の「Gmail送信」ボタン
- **property_chat_history**: 送信履歴を保存する既存のデータベーステーブル
- **seller_number**: 物件番号（`property_listings.property_number` と同一の値）
- **chat_type**: 送信種別を識別するカラム（既存: `office`, `assignee`。新規追加: `seller_email`, `seller_sms`, `seller_gmail`）
- **subject**: 送信履歴の件名フィールド（EMAIL/GMAIL送信時はメール件名、SMS送信時は空文字）
- **message**: 送信履歴の本文フィールド（EMAIL/GMAIL送信時はメール本文全文、SMS送信時は固定テキスト「SMS送信」）

## 要件

### 要件1: EMAIL送信履歴の記録

**ユーザーストーリー**: 担当者として、売主へのメール送信履歴を確認したいので、EMAIL送信ボタンからメールを送信した際に履歴が記録されてほしい。

#### 受け入れ基準

1. WHEN 「Email送信」ボタンからメール送信が成功する、THE System SHALL `property_chat_history` テーブルに `chat_type='seller_email'` で履歴を保存する
2. THE System SHALL 履歴レコードに `property_number`（物件番号）、`subject`（件名）、`message`（本文全文）、`sender_name`（送信者名）、`sent_at`（送信日時）を保存する
3. IF メール送信が失敗する、THEN THE System SHALL 履歴を保存せず、既存のエラー処理を継続する
4. IF 履歴の保存が失敗する、THEN THE System SHALL エラーログを記録するが、メール送信の成功レスポンスには影響を与えない

---

### 要件2: SMS送信履歴の記録

**ユーザーストーリー**: 担当者として、売主へのSMS送信履歴を確認したいので、SMSボタンを押した際に履歴が記録されてほしい。

#### 受け入れ基準

1. WHEN 「SMS」ボタンが押される、THE System SHALL `property_chat_history` テーブルに `chat_type='seller_sms'` で履歴を保存する
2. THE System SHALL 履歴レコードに `property_number`、`subject`（件名なし・空文字）、`message`（固定テキスト「SMS送信」）、`sender_name`（ログイン中の従業員名）、`sent_at`（送信日時）を保存する
3. IF 履歴の保存が失敗する、THEN THE System SHALL エラーログを記録するが、SMSリンクの起動には影響を与えない

---

### 要件3: GMAIL送信履歴の記録

**ユーザーストーリー**: 担当者として、レインズ登録・サイト入力画面からのGmail送信履歴を確認したいので、GMAIL送信ボタンからメールを送信した際に履歴が記録されてほしい。

#### 受け入れ基準

1. WHEN `ReinsRegistrationPage` の「Gmail送信」ボタンからメール送信が成功する、THE System SHALL `property_chat_history` テーブルに `chat_type='seller_gmail'` で履歴を保存する
2. THE System SHALL 履歴レコードに `property_number`（URLパラメータから取得した物件番号）、`subject`（件名）、`message`（本文全文）、`sender_name`（送信者名）、`sent_at`（送信日時）を保存する
3. IF メール送信が失敗する、THEN THE System SHALL 履歴を保存せず、既存のエラー処理を継続する
4. IF 履歴の保存が失敗する、THEN THE System SHALL エラーログを記録するが、Gmail送信の成功レスポンスには影響を与えない

---

### 要件4: 売主への送信履歴セクションの表示

**ユーザーストーリー**: 担当者として、売主への送信履歴を一覧で確認したいので、詳細画面のサイドバーに「売主への送信履歴」セクションが表示されてほしい。

#### 受け入れ基準

1. THE System SHALL 詳細画面のサイドバーに「売主への送信履歴」セクションを表示する
2. THE System SHALL 「事務へCHAT送信履歴」セクションの下に「売主への送信履歴」セクションを配置する
3. THE System SHALL 送信履歴を新しい順（降順）に表示する
4. THE System SHALL 各履歴アイテムに件名（`subject`）、送信者名、送信日時（`YYYY/MM/DD HH:mm` 形式）、送信種別ラベルを表示する（本文は一覧には表示しない）
5. WHEN 送信履歴が存在しない、THE System SHALL 「送信履歴はありません」と表示する
6. THE System SHALL 送信種別（`seller_email`, `seller_sms`, `seller_gmail`）の全てを対象として履歴を取得する

---

### 要件4b: 履歴詳細表示

**ユーザーストーリー**: 担当者として、送信した本文の全文を確認したいので、履歴アイテムをクリックすると詳細が表示されてほしい。

#### 受け入れ基準

1. WHEN 履歴アイテムがクリックされる、THE System SHALL 本文全文をモーダルまたは展開表示で表示する
2. THE System SHALL 詳細表示に件名（`subject`）、送信者名、送信日時（`YYYY/MM/DD HH:mm` 形式）、本文全文（`message`）を表示する
3. WHEN SMS送信の履歴アイテムがクリックされる、THE System SHALL 件名なし・本文「SMS送信」として詳細を表示する
4. WHEN 詳細表示が開いている状態で閉じる操作が行われる、THE System SHALL 詳細表示を閉じる

---

### 要件5: 送信種別の視覚的区別

**ユーザーストーリー**: 担当者として、どの方法で送信したかを一目で確認したいので、送信種別がラベルで区別されて表示されてほしい。

#### 受け入れ基準

1. THE System SHALL `chat_type='seller_email'` の履歴に「EMAIL」ラベルを表示する
2. THE System SHALL `chat_type='seller_sms'` の履歴に「SMS」ラベルを表示する
3. THE System SHALL `chat_type='seller_gmail'` の履歴に「GMAIL」ラベルを表示する
4. THE System SHALL 各送信種別ラベルを異なる色で表示する（EMAIL: 青系、SMS: 緑系、GMAIL: 赤系）

---

### 要件6: 履歴の自動更新

**ユーザーストーリー**: 担当者として、送信直後に履歴が反映されてほしいので、送信成功後に履歴セクションが自動更新されてほしい。

#### 受け入れ基準

1. WHEN EMAIL送信が成功する、THE System SHALL 「売主への送信履歴」セクションを自動的に再取得して表示を更新する
2. WHEN GMAIL送信が成功する、THE System SHALL 「売主への送信履歴」セクションを自動的に再取得して表示を更新する
3. WHEN SMSボタンが押される、THE System SHALL 「売主への送信履歴」セクションを自動的に再取得して表示を更新する

---

### 要件7: APIエンドポイントの拡張

**ユーザーストーリー**: 開発者として、既存のAPIを活用したいので、既存の `GET /api/property-listings/:propertyNumber/chat-history` エンドポイントが売主送信履歴も返せるようにしてほしい。

#### 受け入れ基準

1. THE System SHALL 既存の `GET /api/property-listings/:propertyNumber/chat-history` エンドポイントで `chat_type` パラメータに `seller_email`, `seller_sms`, `seller_gmail` を指定できるようにする
2. WHERE `chat_type` パラメータが指定されない場合、THE System SHALL 全ての `chat_type` の履歴を返す
3. THE System SHALL 履歴を `sent_at` 降順で返す
4. THE System SHALL 最大50件の履歴を返す

---

### 要件8: 履歴保存APIエンドポイントの追加

**ユーザーストーリー**: 開発者として、フロントエンドから履歴を保存できるようにしたいので、売主送信履歴を保存するAPIエンドポイントが必要である。

#### 受け入れ基準

1. THE System SHALL `POST /api/property-listings/:propertyNumber/seller-send-history` エンドポイントを追加する
2. THE System SHALL リクエストボディに `chat_type`（`seller_email` | `seller_sms` | `seller_gmail`）、`subject`（件名。SMS送信時は空文字）、`message`（本文）、`sender_name` を受け付ける
3. IF `chat_type` が `seller_email`, `seller_sms`, `seller_gmail` 以外の値の場合、THEN THE System SHALL 400エラーを返す
4. THE System SHALL 保存成功時に `{ success: true }` を返す
