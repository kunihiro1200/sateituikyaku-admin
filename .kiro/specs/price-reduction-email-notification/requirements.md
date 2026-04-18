# 要件定義書

## はじめに

物件リスト（`property_listings` テーブル）において、`price_reduction_scheduled_date`（値下げ予約日）が当日（today）になった物件を検出し、担当者へメール通知を送信する機能。

通知メールを受け取った担当者は、実際に値下げ作業を行い、完了後に `price_reduction_scheduled_date` フィールドを削除（null に更新）して保存する。その後、物件担当へのCHATにスクリーンショットを添付して値下げ完了を報告する。

本機能は Vercel Cron Job として毎日定時に実行される。

---

## 用語集

- **PriceReductionNotificationJob**: 値下げ予約日メール配信を担当するCronジョブ
- **PropertyListingService**: 物件リストのデータ取得・更新を担当するサービス
- **EmailService**: Gmail API を使用してメールを送信するサービス
- **price_reduction_scheduled_date**: `property_listings` テーブルの値下げ予約日カラム（DATE型）
- **property_number**: `property_listings` テーブルの物件番号カラム
- **address**: `property_listings` テーブルの物件住所カラム
- **CRON_SECRET**: Vercel Cron Job の認証に使用する環境変数

---

## 要件

### 要件1：値下げ予約日当日の物件検出

**ユーザーストーリー：** 担当者として、値下げ予約日が当日になった物件を自動的に検出してほしい。そうすることで、値下げ作業の見落としを防ぐことができる。

#### 受け入れ基準

1. WHEN Cron Job が実行される、THE PriceReductionNotificationJob SHALL `property_listings` テーブルから `price_reduction_scheduled_date` が当日（日本時間 JST）と一致する物件を全件取得する
2. WHEN 対象物件が0件である、THE PriceReductionNotificationJob SHALL メール送信をスキップしてジョブを正常終了する
3. THE PriceReductionNotificationJob SHALL 日付比較に日本時間（Asia/Tokyo、UTC+9）を使用する
4. WHEN `price_reduction_scheduled_date` が null の物件がある、THE PriceReductionNotificationJob SHALL その物件を対象外として除外する

---

### 要件2：値下げ予約日メールの送信

**ユーザーストーリー：** 担当者として、値下げ予約日当日に通知メールを受け取りたい。そうすることで、当日中に値下げ作業を実施できる。

#### 受け入れ基準

1. WHEN 値下げ予約日当日の物件が1件以上存在する、THE PriceReductionNotificationJob SHALL 対象物件ごとに個別のメールを `tenant@ifoo-oita.com` へ送信する
2. THE PriceReductionNotificationJob SHALL 件名を「本日すぐに値下げお願い致します！！」として送信する
3. THE PriceReductionNotificationJob SHALL 本文を以下の形式で送信する：
   ```
   物件番号：{property_number}
   物件住所：{address}
   値下げ予約日：{price_reduction_scheduled_date}
   ```
4. WHEN メール送信が失敗する、THE PriceReductionNotificationJob SHALL エラーをログに記録し、残りの物件のメール送信を継続する
5. THE EmailService SHALL Gmail API を使用してメールを送信する

---

### 要件3：Cron Job の認証と実行スケジュール

**ユーザーストーリー：** システム管理者として、Cron Job が安全に認証され、毎日定時に実行されてほしい。そうすることで、不正アクセスを防ぎつつ確実に通知が届く。

#### 受け入れ基準

1. THE PriceReductionNotificationJob SHALL Vercel Cron Job として `/api/cron/price-reduction-notification` エンドポイントで公開される
2. WHEN リクエストの `Authorization` ヘッダーが `Bearer {CRON_SECRET}` と一致しない、THEN THE PriceReductionNotificationJob SHALL HTTP 401 を返してジョブを中断する
3. THE PriceReductionNotificationJob SHALL 毎日午前9時（JST）に実行されるよう `vercel.json` の `crons` に設定される（UTC: `0 0 * * *`）
4. WHEN ジョブが正常完了する、THE PriceReductionNotificationJob SHALL 送信件数を含む成功レスポンスを HTTP 200 で返す
5. WHEN ジョブ実行中に予期しないエラーが発生する、THE PriceReductionNotificationJob SHALL エラー内容をログに記録し HTTP 500 を返す

---

### 要件4：実行ログの記録

**ユーザーストーリー：** 開発者として、Cron Job の実行結果をログで確認したい。そうすることで、通知が正常に送信されたかどうかをトラブルシューティングできる。

#### 受け入れ基準

1. WHEN Cron Job が開始される、THE PriceReductionNotificationJob SHALL 実行開始をログに記録する
2. WHEN 対象物件が検出される、THE PriceReductionNotificationJob SHALL 検出件数をログに記録する
3. WHEN 各物件へのメール送信が完了する、THE PriceReductionNotificationJob SHALL 物件番号と送信結果（成功/失敗）をログに記録する
4. WHEN Cron Job が完了する、THE PriceReductionNotificationJob SHALL 送信成功件数・失敗件数をログに記録する
