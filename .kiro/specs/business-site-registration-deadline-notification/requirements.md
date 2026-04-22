# 要件定義ドキュメント

## はじめに

業務詳細の「サイト登録」タブにおいて、サイト登録納期および間取図完了予定の約1時間前に自動メール通知を送信する機能を実装する。

既存の `WorkTaskDeadlineNotificationService`（毎日JST 09:00に締切日当日通知）および `WorkTaskEmailNotificationService`（フィールド変更トリガー通知）とは独立した、**時刻ベースの通知**として実装する。

Vercel Cron Job（毎時0分実行）から呼び出されるバックエンドAPIエンドポイントとして実装し、対象レコードを `work_tasks` テーブルから取得してメールを送信する。メールの件名・本文には、Cron Job実行時点から納期までの**実際の残り時間を動的に計算**して表示する。

## 用語集

- **System**: 本通知システム全体
- **Notification_Service**: 1時間前メール通知を処理するバックエンドサービス（`BusinessSiteDeadlineHourlyNotificationService`）
- **Cron_Job**: Vercel Cron Jobによる定期実行エンドポイント
- **work_tasks**: 業務詳細データを格納するSupabaseテーブル
- **site_registration_due_date**: サイト登録納期予定日（`work_tasks`テーブルのカラム）
- **site_registration_ok_sent**: サイト登録確認OK送信（`work_tasks`テーブルのカラム）
- **floor_plan_due_date**: 間取図完了予定日（`work_tasks`テーブルのカラム）
- **floor_plan_confirmer**: 間取図確認者（`work_tasks`テーブルのカラム）
- **property_number**: 物件番号（`work_tasks`テーブルのカラム）
- **property_address**: 物件所在（`work_tasks`テーブルのカラム）
- **Notification_Window**: 通知対象とみなす時間範囲（現在時刻の30分後〜90分後）
- **Remaining_Time**: Cron Job実行時点から納期予定日時までの残り時間（分単位で計算し、件名・本文に動的表示）
- **JST**: 日本標準時（UTC+9）

## 要件

### 要件1: サイト登録納期通知（約1時間前）

**ユーザーストーリー:** 業務担当者として、サイト登録の納期が約1時間後に迫っているにもかかわらず確認OK送信が未完了の場合に自動メール通知を受け取りたい。そうすることで、納期超過を防ぐために迅速に対応できる。

#### 受け入れ基準

1. WHEN `Cron_Job` が実行される、THE `Notification_Service` SHALL `work_tasks` テーブルから全レコードを取得する
2. WHEN `site_registration_due_date` が現在時刻（JST）の30分後から90分後の範囲内である、THE `Notification_Service` SHALL そのレコードをサイト登録通知候補として選択する
3. WHILE `site_registration_ok_sent` が空欄である、THE `Notification_Service` SHALL 通知候補レコードに対してメールを送信する
4. THE `Notification_Service` SHALL 宛先 `tenant@ifoo-oita.com` にメールを送信する
5. THE `Notification_Service` SHALL Cron Job実行時点から `site_registration_due_date` までの残り時間を分単位で計算し、`Remaining_Time` として件名・本文に使用する（例：30分の場合「あと約30分」、60分の場合「あと約1時間」、90分の場合「あと約1時間30分」）
6. THE `Notification_Service` SHALL 件名を `{物件番号}/{物件所在}のサイト登録の納期が{Remaining_Time}です！！` の形式で生成する
7. THE `Notification_Service` SHALL 本文を以下の形式で生成する：
   ```
   サイト登録者へ、至急メール送信してください！！
   {物件番号}/{物件所在}のサイト登録の納期が{Remaining_Time}ですが大丈夫でしょうか？
   ご確認の程よろしくお願い致します。
   ```
8. IF `site_registration_ok_sent` が空欄でない、THEN THE `Notification_Service` SHALL そのレコードへの通知をスキップする
9. IF `site_registration_due_date` が空欄または無効な日付形式である、THEN THE `Notification_Service` SHALL そのレコードへの通知をスキップする
10. IF メール送信が失敗する、THEN THE `Notification_Service` SHALL エラーをログに記録し、他のレコードの処理を継続する

### 要件2: 間取図完了予定通知（約1時間前）

**ユーザーストーリー:** 業務担当者として、間取図の完了予定が約1時間後に迫っているにもかかわらず確認者が未設定の場合に自動メール通知を受け取りたい。そうすることで、間取図作成の遅延を防ぐために迅速に対応できる。

#### 受け入れ基準

1. WHEN `Cron_Job` が実行される、THE `Notification_Service` SHALL `work_tasks` テーブルから全レコードを取得する
2. WHEN `floor_plan_due_date` が現在時刻（JST）の30分後から90分後の範囲内である、THE `Notification_Service` SHALL そのレコードを間取図通知候補として選択する
3. WHILE `floor_plan_confirmer` が空欄である、THE `Notification_Service` SHALL 通知候補レコードに対してメールを送信する
4. THE `Notification_Service` SHALL 宛先 `tenant@ifoo-oita.com` にメールを送信する
5. THE `Notification_Service` SHALL Cron Job実行時点から `floor_plan_due_date` までの残り時間を分単位で計算し、`Remaining_Time` として件名・本文に使用する
6. THE `Notification_Service` SHALL 件名を `{物件番号}/{物件所在}の間取図作成の納期が{Remaining_Time}です！！` の形式で生成する
7. THE `Notification_Service` SHALL 本文を以下の形式で生成する：
   ```
   間取図作成者へ、至急メール送信してください！！
   {物件番号}/{物件所在}の間取図作成の納期が{Remaining_Time}ですが大丈夫でしょうか？
   ご確認の程よろしくお願い致します。
   ```
8. IF `floor_plan_confirmer` が空欄でない、THEN THE `Notification_Service` SHALL そのレコードへの通知をスキップする
9. IF `floor_plan_due_date` が空欄または無効な日付形式である、THEN THE `Notification_Service` SHALL そのレコードへの通知をスキップする
10. IF メール送信が失敗する、THEN THE `Notification_Service` SHALL エラーをログに記録し、他のレコードの処理を継続する

### 要件3: Cron Job定期実行

**ユーザーストーリー:** システム管理者として、通知処理が毎時自動実行されることを保証したい。そうすることで、手動操作なしに1時間前通知が確実に届く。

#### 受け入れ基準

1. THE `Cron_Job` SHALL Vercel Cron Jobとして毎時0分（`0 * * * *`）に実行される
2. THE `Cron_Job` SHALL バックエンドAPIエンドポイント `/api/cron/business-site-deadline-hourly-notification` を呼び出す
3. THE `Notification_Service` SHALL サイト登録通知と間取図通知を同一の実行サイクルで処理する
4. THE `Notification_Service` SHALL 送信件数・スキップ件数・失敗件数をレスポンスとして返す
5. IF `Cron_Job` の実行中にシステムエラーが発生する、THEN THE `Notification_Service` SHALL HTTP 500 ステータスとエラー詳細を返す

### 要件4: 通知対象時間範囲の判定と残り時間の計算

**ユーザーストーリー:** システムとして、毎時実行のCron Jobで通知対象を正確に判定し、実際の残り時間をメールに表示したい。そうすることで、受信者が正確な緊急度を把握できる。

#### 受け入れ基準

1. THE `Notification_Service` SHALL 現在時刻（JST）の30分後から90分後の範囲内に納期予定日時が含まれるレコードを通知対象とする
2. THE `Notification_Service` SHALL `site_registration_due_date` および `floor_plan_due_date` をJST基準で解釈する
3. IF 納期予定日時が日付のみ（時刻なし）の形式である、THEN THE `Notification_Service` SHALL その日付のJST 00:00:00 として解釈する
4. THE `Notification_Service` SHALL 同一レコードに対して同一Cron実行サイクル内で重複送信しない
5. THE `Notification_Service` SHALL 残り時間を以下のルールでフォーマットする：
   - 60分未満の場合：「あと約XX分」（例：「あと約30分」）
   - 60分以上かつ60分の倍数の場合：「あと約XX時間」（例：「あと約1時間」）
   - 60分以上かつ端数がある場合：「あと約XX時間XX分」（例：「あと約1時間30分」）

### 要件5: 既存通知との独立性

**ユーザーストーリー:** システム管理者として、新しい1時間前通知が既存の締切日当日通知（`WorkTaskDeadlineNotificationService`）やフィールド変更通知（`WorkTaskEmailNotificationService`）に影響しないことを保証したい。

#### 受け入れ基準

1. THE `Notification_Service` SHALL 既存の `WorkTaskDeadlineNotificationService` とは独立したサービスクラスとして実装される
2. THE `Notification_Service` SHALL 既存の `WorkTaskEmailNotificationService` とは独立したサービスクラスとして実装される
3. THE `Cron_Job` SHALL 既存のCron Job（`/api/cron/work-task-deadline-notification`）とは別のエンドポイントとして実装される
