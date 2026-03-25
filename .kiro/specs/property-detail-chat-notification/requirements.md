# 要件ドキュメント

## はじめに

物件詳細画面（PropertyListingDetailPage.tsx）のヘッダーにある「SMS」ボタンの隣に「担当へCHAT」ボタンを追加します。このボタンをクリックすると「担当へ質問_伝言」フィールドと「送信」ボタンが表示され、送信するとスタッフ管理スプレッドシートの担当者のChat webhookにメッセージが送信されます。

## 用語集

- **PropertyListingDetailPage**: 物件詳細画面（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **sales_assignee**: 物件の担当者フィールド（`property_listings`テーブルの`sales_assignee`カラム）
- **StaffManagementService**: スタッフ管理スプレッドシートからスタッフ情報（チャットWebhook URL等）を取得するバックエンドサービス（`backend/src/services/StaffManagementService.ts`）
- **ChatWebhook**: スタッフ管理スプレッドシートのF列「Chat webhook」に格納されているGoogle Chat送信先URL
- **スタッフ管理スプレッドシート**: スプレッドシートID `19yAuVYQRm-_zhjYX7M7zjiGbnBibkG77Mpz93sN1xxs`、シート名「スタッフ」
- **担当マッチング**: 物件の`sales_assignee`値がスタッフスプレッドシートのC列（名字）またはB列（イニシャル）と一致する行を検索する処理

## 要件

### 要件1: 「担当へCHAT」ボタンの表示制御

**ユーザーストーリー:** 担当者として、物件詳細画面のヘッダーから物件担当者にチャットメッセージを送りたい。なぜなら、物件に関する質問や伝言を素早く担当者に通知したいからです。

#### 受け入れ基準

1. WHEN 物件の`sales_assignee`フィールドに値が入力されている場合、THE PropertyListingDetailPage SHALL 「SMS」ボタンの隣に「担当へCHAT」ボタンを表示する
2. WHEN 物件の`sales_assignee`フィールドが空または未入力の場合、THE PropertyListingDetailPage SHALL 「担当へCHAT」ボタンを表示しない
3. THE PropertyListingDetailPage SHALL 「担当へCHAT」ボタンを売主連絡先ボタン群（SMS、Email、売主TEL）と同じ行に配置する

---

### 要件2: チャット入力フォームの表示

**ユーザーストーリー:** 担当者として、「担当へCHAT」ボタンをクリックしてメッセージを入力・送信したい。なぜなら、物件に関する質問や伝言を担当者に伝えたいからです。

#### 受け入れ基準

1. WHEN 「担当へCHAT」ボタンがクリックされた場合、THE PropertyListingDetailPage SHALL 「担当へ質問_伝言」テキストフィールドと「送信」ボタンを表示する
2. WHEN 「担当へCHAT」ボタンが再度クリックされた場合（トグル動作）、THE PropertyListingDetailPage SHALL 入力フォームを非表示にする
3. THE PropertyListingDetailPage SHALL 入力フォームを「担当へCHAT」ボタンの下に表示する
4. THE PropertyListingDetailPage SHALL 「担当へ質問_伝言」フィールドのプレースホルダーとして「担当へ質問_伝言」を表示する

---

### 要件3: チャットメッセージの送信

**ユーザーストーリー:** 担当者として、入力したメッセージを物件担当者のGoogle Chatに送信したい。なぜなら、担当者に即座に通知を届けたいからです。

#### 受け入れ基準

1. WHEN 「送信」ボタンがクリックされた場合、THE PropertyListingDetailPage SHALL `/api/property-listings/:propertyNumber/send-chat-to-assignee` エンドポイントを呼び出す
2. WHEN チャット送信が成功した場合、THE PropertyListingDetailPage SHALL 成功メッセージ（「担当へチャットを送信しました」）をスナックバーで表示する
3. WHEN チャット送信が成功した場合、THE PropertyListingDetailPage SHALL 入力フォームを閉じてテキストフィールドをクリアする
4. IF チャット送信が失敗した場合、THEN THE PropertyListingDetailPage SHALL エラーメッセージをスナックバーで表示する
5. WHILE チャット送信中の場合、THE PropertyListingDetailPage SHALL 「送信」ボタンをローディング状態（無効化）にする

---

### 要件4: バックエンドAPIエンドポイント

**ユーザーストーリー:** システムとして、物件担当者のChat webhookにメッセージを送信するAPIを提供したい。なぜなら、フロントエンドからのチャット送信リクエストを処理する必要があるからです。

#### 受け入れ基準

1. THE Backend SHALL `POST /api/property-listings/:propertyNumber/send-chat-to-assignee` エンドポイントを提供する
2. WHEN エンドポイントが呼び出された場合、THE Backend SHALL `StaffManagementService.getWebhookUrl()` を使用して物件の`sales_assignee`に対応するChat webhook URLを取得する
3. WHEN Chat webhook URLが取得できた場合、THE Backend SHALL 物件番号・担当者名・メッセージ内容を含むメッセージをGoogle Chat webhookに送信する
4. IF 物件が見つからない場合、THEN THE Backend SHALL 404エラーを返す
5. IF `sales_assignee`が空の場合、THEN THE Backend SHALL 400エラーを返す
6. IF Chat webhook URLが見つからない場合、THEN THE Backend SHALL 404エラーを返す
7. IF Google Chat webhookへの送信が失敗した場合、THEN THE Backend SHALL 500エラーを返す

---

### 要件5: スタッフマッチングロジック

**ユーザーストーリー:** システムとして、物件担当者名からスタッフのChat webhook URLを正確に取得したい。なぜなら、正しい担当者にメッセージを届ける必要があるからです。

#### 受け入れ基準

1. THE StaffManagementService SHALL 物件の`sales_assignee`値をスタッフスプレッドシートのC列（名字）と照合する
2. THE StaffManagementService SHALL 物件の`sales_assignee`値をスタッフスプレッドシートのB列（イニシャル）と照合する
3. WHEN C列またはB列と一致するスタッフが見つかった場合、THE StaffManagementService SHALL そのスタッフのF列（Chat webhook）のURLを返す
4. IF 一致するスタッフが見つからない場合、THEN THE StaffManagementService SHALL エラーを返す
5. IF 一致するスタッフのF列（Chat webhook）が空の場合、THEN THE StaffManagementService SHALL エラーを返す
