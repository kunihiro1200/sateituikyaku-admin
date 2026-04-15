# 要件ドキュメント

## はじめに

売主管理システム（sateituikyaku-admin）において、売主の「当社（状況）」フィールド（DBカラム: `situation_company`）に「一般媒介」が設定された場合に、以下の2つの機能を追加する：

1. 売主詳細ページのステータスセクションに「専任（他決）決定日」フィールドを表示する
2. 「Google Chat通知」セクション内の既存「一般媒介通知」ボタンを、`situation_company` が「一般媒介」の場合にオレンジ系の強調スタイルで表示する

本機能は、一般媒介になった売主を営業チームがリアルタイムで把握し、迅速に対応できるようにすることを目的とする。

---

## 用語集

- **Seller_Detail_Page**: 売主詳細ページ（`/sellers/:id`）。売主管理システムのフロントエンドで動作する。
- **Google_Chat_Notification_Section**: 売主詳細ページ内の「Google Chat通知」CollapsibleSection。既存ボタン群（一般媒介通知・専任取得通知・訪問後他決共有・未訪問他決共有・物件紹介）を含む。
- **General_Mediation_Button**: Google_Chat_Notification_Section内の「一般媒介通知」ボタン。`handleSendChatNotification('general_contract')` を呼び出す既存ボタン。
- **ChatNotificationService**: バックエンド（`backend/src/services/ChatNotificationService.ts`）のサービスクラス。Google Chat Webhookへの送信を担当する。
- **situation_company**: 売主テーブル（`sellers`）のDBカラム。「当社（状況）」フィールドに対応する。フロントエンドでは `seller.situation_company` として参照する。
- **contract_year_month**: 売主テーブル（`sellers`）のDBカラム。「専任（他決）決定日」フィールドに対応する。フロントエンドでは `seller.contractYearMonth` として参照する。
- **General_Mediation_Value**: `situation_company` カラムに格納される「一般媒介」という文字列値。
- **Google_Chat_Webhook**: 指定のGoogle Chat スペースへメッセージを送信するためのWebhook URL。

---

## 要件

### 要件1：一般媒介時の「専任（他決）決定日」フィールド表示

**ユーザーストーリー：** 営業担当者として、売主が一般媒介になった場合に「専任（他決）決定日」を確認できるようにしたい。そうすることで、専任契約の取得期限を把握して追客活動を計画できる。

#### 受け入れ基準

1. WHEN 売主の `situation_company` フィールドの値が「一般媒介」である場合、THE Seller_Detail_Page SHALL ステータスセクションに「専任（他決）決定日」フィールドを表示する
2. WHEN 売主の `situation_company` フィールドの値が「一般媒介」以外である場合、THE Seller_Detail_Page SHALL 「専任（他決）決定日」フィールドを非表示にする
3. THE Seller_Detail_Page SHALL 「専任（他決）決定日」フィールドに `contract_year_month` カラムの値を表示する
4. IF `contract_year_month` の値が null または空文字列である場合、THEN THE Seller_Detail_Page SHALL 「専任（他決）決定日」フィールドに「未設定」と表示する

---

### 要件2：一般媒介時の「一般媒介通知」ボタン強調表示

**ユーザーストーリー：** 営業担当者として、売主が一般媒介になった際に「Google Chat通知」セクション内の「一般媒介通知」ボタンが目立つスタイルで表示されるようにしたい。そうすることで、一般媒介になったことを見落とさずに通知を送れる。

#### 受け入れ基準

1. WHEN 売主の `situation_company` フィールドの値が「一般媒介」である場合、THE Seller_Detail_Page SHALL Google_Chat_Notification_Section内の General_Mediation_Button をオレンジ系の背景色（例：`#FF6D00` 系）で強調表示する
2. WHEN 売主の `situation_company` フィールドの値が「一般媒介」以外である場合、THE Seller_Detail_Page SHALL General_Mediation_Button を通常の `variant="outlined"` スタイルで表示する
3. WHILE General_Mediation_Button が強調表示されている場合、THE Seller_Detail_Page SHALL ボタンのラベルを「一般媒介通知」のまま維持する
4. THE General_Mediation_Button SHALL 強調表示の有無にかかわらず、押下時に `handleSendChatNotification('general_contract')` を呼び出す動作を維持する

---

### 要件3：一般媒介Google Chat通知の送信

**ユーザーストーリー：** 営業担当者として、一般媒介通知ボタンを押したときにGoogle Chatへ通知を送りたい。そうすることで、チーム全員がリアルタイムで一般媒介になった売主を把握できる。

#### 受け入れ基準

1. WHEN ユーザーが General_Mediation_Button を押下した場合、THE Seller_Detail_Page SHALL バックエンドの `/api/chat-notifications/general-contract/:sellerId` エンドポイントへPOSTリクエストを送信する
2. WHEN バックエンドが通知リクエストを受信した場合、THE ChatNotificationService SHALL 以下のWebhook URLへPOSTする：
   `https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=kJGiIgrKmgd1vJCwr805DdVX_1l0IUcGx4JnJPHIK-8`
3. THE ChatNotificationService SHALL 以下のテンプレートに基づいてメッセージを生成し、動的フィールドを実際の売主データで埋め込む：
   ```
   一般媒介になりました！{日付}:売主番号：{seller_number} 物件所在地：{property_address} 種別：{property_type}訪問査定取得者：{visit_valuation_acquirer} 営業担当：{visit_assignee} サイト：{inquiry_site}机上査定：{valuation_text}<<{売主詳細ページURL}>>
   ```
4. THE ChatNotificationService SHALL `{日付}` を通知送信時の日付（YYYY/MM/DD形式）で埋め込む
5. THE ChatNotificationService SHALL `{seller_number}` を売主番号で埋め込む
6. THE ChatNotificationService SHALL `{property_address}` を物件所在地（`property_address`カラム）で埋め込む
7. THE ChatNotificationService SHALL `{property_type}` を種別（`property_type`カラム）で埋め込む
8. THE ChatNotificationService SHALL `{visit_valuation_acquirer}` を訪問査定取得者（`visit_valuation_acquirer`カラム）で埋め込む
9. THE ChatNotificationService SHALL `{visit_assignee}` を営業担当（`visit_assignee`カラム）で埋め込む
10. THE ChatNotificationService SHALL `{inquiry_site}` をサイト（`inquiry_site`カラム）で埋め込む
11. THE ChatNotificationService SHALL `{valuation_text}` を机上査定（`valuation_text`カラム）で埋め込む
12. THE ChatNotificationService SHALL `{売主詳細ページURL}` を売主詳細ページのURL（`https://sateituikyaku-admin-frontend.vercel.app/sellers/{seller_number}/call`）で埋め込む
13. IF 動的フィールドの値が null または空文字列である場合、THEN THE ChatNotificationService SHALL そのフィールドを空文字列として埋め込む

---

### 要件4：通知送信時のUI状態管理

**ユーザーストーリー：** 営業担当者として、通知送信中と送信完了の状態を視覚的に確認したい。そうすることで、通知が正常に送信されたかどうかを把握できる。

#### 受け入れ基準

1. WHEN ユーザーが General_Mediation_Button を押下した場合、THE Seller_Detail_Page SHALL 送信中状態（ローディング表示）に切り替わり、重複送信を防ぐためにボタンを無効化する
2. WHEN 通知の送信が成功した場合、THE Seller_Detail_Page SHALL 成功メッセージ（例：「Google Chatに通知を送信しました」）を表示する
3. IF 通知の送信が失敗した場合、THEN THE Seller_Detail_Page SHALL エラーメッセージ（例：「通知の送信に失敗しました」）を表示する

---

### 要件5：バックエンドAPIエンドポイントの確認

**ユーザーストーリー：** システムとして、一般媒介通知を送信するためのAPIエンドポイントが必要である。そうすることで、フロントエンドからの通知リクエストを処理できる。

#### 受け入れ基準

1. THE ChatNotificationService SHALL 一般媒介通知を送信するための `sendGeneralContractNotification(sellerId: string, data: ChatNotificationData)` メソッドを提供する
2. THE Backend SHALL `/api/chat-notifications/general-contract/:sellerId` エンドポイントをPOSTメソッドで提供する
3. WHEN エンドポイントが有効な `sellerId` を受信した場合、THE Backend SHALL `ChatNotificationService.sendGeneralContractNotification` を呼び出す
4. IF `sellerId` が無効なUUID形式である場合、THEN THE Backend SHALL HTTPステータス400とバリデーションエラーを返す
5. IF 通知送信中にエラーが発生した場合、THEN THE Backend SHALL HTTPステータス500とエラー詳細を返す
