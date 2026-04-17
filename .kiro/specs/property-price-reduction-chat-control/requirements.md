# 要件ドキュメント

## はじめに

本機能は、社内管理システム（sateituikyaku-admin）の物件リスト詳細画面において、価格情報セクションの「値下げ予約日」フィールドの入力状態に応じて「CHAT送信」ボタンの表示/非表示を制御する機能です。

また、CHAT送信機能を拡張し、画像添付機能を追加するとともに、CHAT送信先をスタッフ管理スプレッドシートの「CHAT送信アドレス」（物件担当者のWebhook URL）から動的に取得するよう改善します。

現在の実装では、`PriceSection` コンポーネント内に「Chat送信」ボタンが常時表示されており、送信先のWebhook URLがフロントエンドにハードコードされています。本機能ではこれらの問題を解消します。

## 用語集

- **PriceSection**: 物件リスト詳細画面の価格情報セクションを表示するReactコンポーネント（`frontend/frontend/src/components/PriceSection.tsx`）
- **PropertyListingDetailPage**: 物件リスト詳細画面のページコンポーネント（`frontend/frontend/src/pages/PropertyListingDetailPage.tsx`）
- **値下げ予約日フィールド**: `property_listings` テーブルの `price_reduction_scheduled_date` カラムに対応するUIフィールド
- **CHAT送信ボタン**: 物件担当者へGoogle Chat通知を送信するボタン（現在のラベル: 「Chat送信」）
- **物件担当者**: `property_listings.sales_assignee` カラムに格納された担当者のイニシャル
- **CHAT送信アドレス**: スタッフ管理スプレッドシート（スタッフシート）のF列「Chat webhook」に格納されたGoogle Chat Webhook URL
- **StaffManagementService**: スタッフ管理スプレッドシートからスタッフ情報を取得するバックエンドサービス（`backend/src/services/StaffManagementService.ts`）
- **chatNotificationsルート**: CHAT通知送信を担当するバックエンドAPIルート（`backend/src/routes/chatNotifications.ts`）
- **ChatNotificationService**: Google Chat通知送信を担当するバックエンドサービス（`backend/src/services/ChatNotificationService.ts`）
- **事務フォールバック**: 物件担当者（`sales_assignee`）が未設定の場合に使用するフォールバック送信先。スタッフ管理スプレッドシートのイニシャル「事務」に対応するWebhook URL。

---

## 要件

### 要件1: 値下げ予約日に基づくCHAT送信ボタンの表示制御

**ユーザーストーリー:** 社内スタッフとして、値下げ予約日が設定されている物件では誤ってCHAT送信しないよう、ボタンを非表示にしたい。値下げ予約日が空の場合のみ送信可能にすることで、適切なタイミングでのみ通知を送れるようにしたい。

#### 受け入れ基準

1. WHEN `price_reduction_scheduled_date` フィールドに値が入力されている場合、THE PriceSection SHALL 「CHAT送信」ボタンを非表示にする
2. WHEN `price_reduction_scheduled_date` フィールドが空（null または空文字列）の場合、THE PriceSection SHALL 「物件担当へCHAT送信」ボタンを表示する
3. WHEN ユーザーが `price_reduction_scheduled_date` フィールドの値を削除した場合、THE PriceSection SHALL 「物件担当へCHAT送信」ボタンをリアルタイムで表示する
4. WHEN ユーザーが `price_reduction_scheduled_date` フィールドに値を入力した場合、THE PriceSection SHALL 「物件担当へCHAT送信」ボタンをリアルタイムで非表示にする
5. THE PriceSection SHALL 表示モード（非編集モード）においてのみ「物件担当へCHAT送信」ボタンの表示/非表示制御を適用する

---

### 要件2: CHAT送信先の動的取得（スタッフ管理スプレッドシート参照）

**ユーザーストーリー:** 社内スタッフとして、CHAT送信ボタンを押した際に、物件担当者のCHAT送信アドレスへ自動的に通知が届くようにしたい。担当者が変わっても、スプレッドシートを更新するだけで送信先が自動的に変わるようにしたい。

#### 受け入れ基準

1. WHEN 「物件担当へCHAT送信」ボタンが押された場合、THE PropertyListingDetailPage SHALL バックエンドAPIを経由してスタッフ管理スプレッドシートから物件担当者（`sales_assignee`）のWebhook URLを取得する
2. WHEN 物件担当者のWebhook URLが取得できた場合、THE ChatNotificationService SHALL 取得したWebhook URLへCHAT通知を送信する
3. IF 物件担当者（`sales_assignee`）が未設定の場合、THEN THE chatNotificationsルート SHALL スタッフ管理スプレッドシートのイニシャル「事務」に対応するWebhook URLをフォールバック送信先として使用する
4. IF スタッフ管理スプレッドシートに物件担当者のWebhook URLが設定されていない場合、THEN THE PropertyListingDetailPage SHALL エラーメッセージ「担当者のCHATアドレスが設定されていません」を表示する
5. THE ChatNotificationService SHALL フロントエンドにWebhook URLを公開せず、バックエンドAPIを経由してのみ送信を行う

---

### 要件3: CHAT送信への画像添付機能

**ユーザーストーリー:** 社内スタッフとして、CHAT送信時に物件の画像を添付して送信できるようにしたい。画像を添付することで、担当者が物件の状況をより直感的に把握できるようにしたい。

#### 受け入れ基準

1. WHEN 「物件担当へCHAT送信」ボタンが押された場合、THE PriceSection SHALL 送信確認ダイアログを表示し、画像添付オプションを提供する
2. WHEN ユーザーが送信確認ダイアログで画像を選択した場合、THE PriceSection SHALL 選択した画像のURLをCHAT通知メッセージに含める
3. THE PriceSection SHALL 画像添付は任意（オプション）とし、画像なしでも送信できるようにする
4. WHEN 画像が添付された場合、THE ChatNotificationService SHALL Google Chat APIのCard形式またはテキスト形式で画像URLを含むメッセージを送信する
5. THE PriceSection SHALL 既存の `ImageSelectorModal` コンポーネントを活用して画像選択UIを提供する

---

### 要件4: CHAT送信メッセージの内容

**ユーザーストーリー:** 社内スタッフとして、CHAT送信時に物件の基本情報が含まれたメッセージが送信されるようにしたい。受信者が物件を特定できる情報が含まれていることで、迅速な対応が可能になる。

#### 受け入れ基準

1. THE ChatNotificationService SHALL CHAT通知メッセージに物件番号（`property_number`）を含める
2. THE ChatNotificationService SHALL CHAT通知メッセージに最新の値下げ履歴（`price_reduction_history` の最初の行）を含める
3. THE ChatNotificationService SHALL CHAT通知メッセージに物件の住所（`address`）を含める
4. THE ChatNotificationService SHALL CHAT通知メッセージに物件詳細画面へのURL（`/property-listings/{property_number}`）を含める
5. WHERE 画像が添付されている場合、THE ChatNotificationService SHALL CHAT通知メッセージに画像URLを含める

---

### 要件5: バックエンドAPIエンドポイントの追加

**ユーザーストーリー:** システム管理者として、物件リスト詳細画面からのCHAT送信をセキュアに処理するバックエンドAPIが必要である。Webhook URLをフロントエンドに公開せず、バックエンドで一元管理することでセキュリティを確保したい。

#### 受け入れ基準

1. THE chatNotificationsルート SHALL 物件担当者へのCHAT通知を送信するエンドポイント `POST /chat-notifications/property-price-reduction` を提供する
2. WHEN `POST /chat-notifications/property-price-reduction` が呼び出された場合、THE chatNotificationsルート SHALL リクエストボディから `salesAssignee`（担当者）、`propertyNumber`（物件番号）、`latestReduction`（最新値下げ履歴）、`address`（住所）、`imageUrl`（画像URL、任意）を受け取る
3. THE chatNotificationsルート SHALL 認証済みユーザーのみがエンドポイントにアクセスできるよう `authenticate` ミドルウェアを適用する
4. IF `salesAssignee` が空の場合、THEN THE chatNotificationsルート SHALL スタッフ管理スプレッドシートのイニシャル「事務」のWebhook URLをフォールバック送信先として使用する
5. IF StaffManagementService がWebhook URLを取得できない場合、THEN THE chatNotificationsルート SHALL HTTPステータス404とエラーコード `WEBHOOK_NOT_FOUND` を返す
6. FOR ALL 送信リクエスト、THE chatNotificationsルート SHALL 送信結果（成功/失敗）をレスポンスとして返す
