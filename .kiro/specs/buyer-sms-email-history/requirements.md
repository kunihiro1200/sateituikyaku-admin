# 要件定義書

## はじめに

買主詳細画面（BuyerDetailPage）において、SMS送信ボタン（SmsDropdownButton）からSMSを送信した際に、既存の「メール送信履歴」セクションにSMS送信の記録が残るようにする機能。

現状、メール送信（Gmail）は `activity_logs` テーブルに `action='email'` として記録され、買主詳細画面の「メール送信履歴」セクションに表示されている。SMS送信は端末のSMSアプリを開くだけで履歴が残らない。

本機能では、SMS送信操作時にバックエンドAPIを呼び出して `activity_logs` テーブルに `action='sms'` として記録し、「メール送信履歴」セクションにSMS送信履歴も表示する。

## 用語集

- **SMS_Recorder**: SMS送信履歴をバックエンドに記録する処理（フロントエンド側の呼び出し）
- **ActivityLog_API**: `activity_logs` テーブルへの記録を担うバックエンドAPIエンドポイント（`POST /api/buyers/:buyerNumber/sms-history`）
- **EmailHistory_Section**: 買主詳細画面の「メール送信履歴」表示セクション
- **SmsDropdownButton**: 買主詳細画面のSMS送信ドロップダウンボタンコンポーネント

## 要件

### 要件1: SMS送信時の履歴記録

**ユーザーストーリー:** 担当者として、SMS送信操作を行ったとき、送信履歴が自動的に記録されることで、後から誰がいつどのテンプレートでSMSを送ったか確認したい。

#### 受け入れ基準

1. WHEN SmsDropdownButton でテンプレートを選択してSMS送信操作が実行される、THE SMS_Recorder SHALL バックエンドの ActivityLog_API を呼び出す
2. WHEN ActivityLog_API が呼び出される、THE ActivityLog_API SHALL `activity_logs` テーブルに `action='sms'` のレコードを挿入する
3. THE ActivityLog_API SHALL 記録するメタデータとして、送信先電話番号・テンプレートID・テンプレート名・買主番号を含める
4. IF ActivityLog_API の呼び出しが失敗する、THEN THE SMS_Recorder SHALL SMS送信操作（SMSアプリを開く処理）を中断せずに続行する
5. THE ActivityLog_API SHALL 記録時刻として現在のサーバー時刻（`created_at`）を使用する

### 要件2: メール送信履歴セクションへのSMS履歴表示

**ユーザーストーリー:** 担当者として、買主詳細画面の「メール送信履歴」セクションでSMS送信履歴も確認できることで、メールとSMSを含むすべての送信履歴を一か所で把握したい。

#### 受け入れ基準

1. WHEN 買主詳細画面の「メール送信履歴」セクションが表示される、THE EmailHistory_Section SHALL `action='email'` のレコードに加えて `action='sms'` のレコードも表示する
2. THE EmailHistory_Section SHALL SMS送信履歴の各レコードに対して、送信日時・テンプレート名・送信先電話番号を表示する
3. THE EmailHistory_Section SHALL SMS送信履歴のレコードを視覚的にメール送信履歴と区別できるよう、「SMS」ラベルまたはアイコンを表示する
4. THE EmailHistory_Section SHALL メール送信履歴とSMS送信履歴を送信日時の降順で統合して表示する
5. WHILE SMS送信履歴が1件も存在しない、THE EmailHistory_Section SHALL 既存の「メール送信履歴はありません」メッセージを維持する

### 要件3: SMS送信記録APIエンドポイント

**ユーザーストーリー:** システムとして、SMS送信操作の記録を受け付けるAPIエンドポイントが必要で、フロントエンドから安全に呼び出せることで、履歴データの整合性を保ちたい。

#### 受け入れ基準

1. THE ActivityLog_API SHALL `POST /api/buyers/:buyerNumber/sms-history` エンドポイントとして実装される
2. WHEN リクエストボディに `templateId`・`templateName`・`phoneNumber` が含まれる、THE ActivityLog_API SHALL バリデーションを通過してレコードを挿入する
3. IF `buyerNumber` に対応する買主が存在しない、THEN THE ActivityLog_API SHALL HTTP 404 を返す
4. IF リクエストボディの必須フィールドが欠けている、THEN THE ActivityLog_API SHALL HTTP 400 を返す
5. THE ActivityLog_API SHALL 認証済みユーザーのみアクセスを許可する
