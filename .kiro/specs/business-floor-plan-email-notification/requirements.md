# 要件定義ドキュメント

## はじめに

業務リスト（WorkTasksPage / WorkTaskDetailModal）において、特定フィールドの変更を検知して自動メールを送信する機能を実装する。

現在、業務リストは社内管理システム（React/TypeScript フロントエンド + Node.js バックエンド）で実装されており、レコードの保存は `PUT /api/work-tasks/:propertyNumber` エンドポイントを通じて行われる。

本機能では、保存時に以下のトリガーフィールドの値が変更された場合に、指定の宛先へ自動メールを送信する：

- 「CWの方へ依頼メール（間取り、区画図）」（`cw_request_email_floor_plan`）
- 「CWの方へ依頼メール（2階以上）」（`cw_request_email_2f_above`）
- 「間取図確認OK送信」（`floor_plan_ok_send`）
- 「CWの方へ依頼メール（サイト登録）」（`cw_request_email_site_registration`）
- 「サイト登録確認OK送信」（`site_registration_ok_send`）
- 「間取図格納済み連絡メール」（`floor_plan_stored_notification`）

また、将来的に同様のパターンで複数のメール送信ルールを追加できるよう、拡張性を考慮した設計とする。

---

## 用語集

- **Email_Notification_Service**: メール自動送信を担うバックエンドサービス（`backend/src/services/`）
- **Work_Task_Route**: 業務依頼APIルート（`backend/src/routes/workTasks.ts`）
- **WorkTaskDetailModal**: 業務詳細モーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **cw_request_email_floor_plan**: 「CWの方へ依頼メール（間取り、区画図）」フィールド（`Y` / `N` / null）
- **cw_request_email_2f_above**: 「CWの方へ依頼メール（2階以上）」フィールド（`Y` / `N` / null）
- **floor_plan_ok_send**: 「間取図確認OK送信」フィールド（`Y` / `N` / null）
- **cw_request_email_site_registration**: 「CWの方へ依頼メール（サイト登録）」フィールド（`Y` / `N` / null）
- **site_registration_ok_send**: 「サイト登録確認OK送信」フィールド（`Y` / `N` / null）
- **floor_plan_stored_notification**: 「間取図格納済み連絡メール」フィールド（`Y` / `N` / null）
- **トリガーフィールド**: メール送信を引き起こすフィールド（上記6フィールドのいずれか）
- **Email_Rule**: メール送信ルールの設定（宛先・CC・件名テンプレート・本文テンプレートのセット）
- **テンプレート変数**: メール件名・本文中の `<<[カラム名]>>` 形式のプレースホルダー

---

## 要件

### 要件1：保存時のフィールド変更検知

**ユーザーストーリー：** 担当者として、業務詳細モーダルで「CWの方へ依頼メール」フィールドを変更して保存したとき、自動的にメールが送信されることを期待する。

#### 受け入れ基準

1. WHEN `PUT /api/work-tasks/:propertyNumber` が呼び出され、リクエストボディに `cw_request_email_floor_plan`、`cw_request_email_2f_above`、`floor_plan_ok_send`、`cw_request_email_site_registration`、`site_registration_ok_send`、または `floor_plan_stored_notification` が含まれる場合、THE Work_Task_Route SHALL 保存前の値と保存後の値を比較する。

2. WHEN `cw_request_email_floor_plan` の値が保存前後で異なる場合、THE Work_Task_Route SHALL Email_Notification_Service のメール送信処理を呼び出す。

3. WHEN `cw_request_email_2f_above` の値が保存前後で異なる場合、THE Work_Task_Route SHALL Email_Notification_Service のメール送信処理を呼び出す。

4. WHEN `floor_plan_ok_send` の値が保存前後で異なる場合、THE Work_Task_Route SHALL Email_Notification_Service のメール送信処理を呼び出す。

5. WHEN `cw_request_email_site_registration` の値が保存前後で異なる場合、THE Work_Task_Route SHALL Email_Notification_Service のメール送信処理を呼び出す。

6. WHEN `site_registration_ok_send` の値が保存前後で異なる場合、THE Work_Task_Route SHALL Email_Notification_Service のメール送信処理を呼び出す。

7. WHEN `floor_plan_stored_notification` の値が保存前後で異なる場合、THE Work_Task_Route SHALL Email_Notification_Service のメール送信処理を呼び出す。

8. WHEN トリガーフィールドの値が変更されていない場合、THE Work_Task_Route SHALL メール送信処理を呼び出さない。

9. WHEN メール送信処理が失敗した場合、THE Work_Task_Route SHALL 保存レスポンスをエラーにせず、エラーログを記録した上で正常レスポンスを返す（メール送信失敗は保存処理をブロックしない）。

---

### 要件2：間取り・区画図依頼メールの送信

**ユーザーストーリー：** 担当者として、「CWの方へ依頼メール（間取り、区画図）」フィールドを変更したとき、指定の宛先に間取図作成依頼メールが自動送信されることを期待する。

#### 受け入れ基準

1. WHEN `cw_request_email_floor_plan` の値が変更された場合、THE Email_Notification_Service SHALL 以下の宛先・CCにメールを送信する：
   - 宛先：`freetask.e72@gmail.com`
   - CC：`tenant@ifoo-oita.com`

2. WHEN `cw_request_email_floor_plan` の値が変更された場合、THE Email_Notification_Service SHALL 以下の件名でメールを送信する：
   - `間取図作成関係お願いいたします！{物件番号}{物件所在}（㈱いふう）`
   - `{物件番号}` および `{物件所在}` は対象レコードの実際の値に置換する。

3. WHEN `cw_request_email_floor_plan` の値が変更された場合、THE Email_Notification_Service SHALL 以下の本文でメールを送信する（各変数は対象レコードの実際の値に置換する）：

   ```
   阿曽様
   お世話になっております。
   間取図OR区画図作成お願いします。
   物件番号：{物件番号}
   物件所在地：{物件所在}

   コメント：{コメント（間取図関係）}
   {道路寸法}
   当社の希望納期：{間取図完了予定}格納先：{格納先URL}
   納期が難しかったり、ご不明点等がございましたら、こちらに返信していただければと思います。
   ㈱いふうTEL:097-533-2022MAIL:tenant@ifoo-oita.com以上です
   ```

4. WHEN 本文テンプレート変数に対応するフィールドの値が null または空文字の場合、THE Email_Notification_Service SHALL 該当変数を空文字に置換してメールを送信する（エラーにしない）。

---

### 要件3：2階以上依頼メールの送信

**ユーザーストーリー：** 担当者として、「CWの方へ依頼メール（2階以上）」フィールドを変更したとき、同様の宛先に2階以上対応の依頼メールが自動送信されることを期待する。

#### 受け入れ基準

1. WHEN `cw_request_email_2f_above` の値が変更された場合、THE Email_Notification_Service SHALL 要件2と同一の宛先・CC・件名・本文テンプレートでメールを送信する。

   > 注記：現時点では `cw_request_email_floor_plan` と `cw_request_email_2f_above` は同一のメールテンプレートを使用する。将来的に異なるテンプレートが必要になった場合は Email_Rule を追加することで対応する。

---

### 要件4：テンプレート変数の解決

**ユーザーストーリー：** 担当者として、メール本文に物件の実際の情報が正しく埋め込まれることを期待する。

#### 受け入れ基準

1. THE Email_Notification_Service SHALL 件名・本文テンプレート内の `{カラム名}` 形式の変数を、対象レコードの対応するDBカラム値に置換する。

2. THE Email_Notification_Service SHALL 以下のカラムマッピングでテンプレート変数を解決する：

   | テンプレート変数 | DBカラム名 |
   |---|---|
   | `{物件番号}` | `property_number` |
   | `{物件所在}` | `property_address` |
   | `{コメント（間取図関係）}` | `floor_plan_comment` |
   | `{道路寸法}` | `road_dimensions` |
   | `{間取図完了予定}` | `floor_plan_due_date` |
   | `{格納先URL}` | `storage_url` |
   | `{間取図確認OK/修正コメント}` | `floor_plan_ok_comment` |
   | `{コメント（サイト登録）}` | `site_registration_comment` |
   | `{サイト登録依頼日}` | `site_registration_request_date` |
   | `{サイト登録依頼者}` | `site_registration_requester` |
   | `{サイト登録納期予定日}` | `site_registration_due_date` |
   | `{パノラマ}` | `panorama` |
   | `{スプシURL}` | `spreadsheet_url` |
   | `{サイト登録確認OKコメント}` | `site_registration_ok_comment` |

3. WHEN `floor_plan_due_date` の値が ISO 8601 形式の日時文字列の場合、THE Email_Notification_Service SHALL `YYYY-MM-DD HH:mm` 形式（日本時間）に変換してメールに埋め込む。

4. FOR ALL テンプレート変数において、対応するフィールドの値が null または空文字の場合、THE Email_Notification_Service SHALL 変数を空文字に置換する（エラーにしない）。

---

### 要件5：メール送信設定の拡張性

**ユーザーストーリー：** 開発者として、将来的に同様のパターンで新しいメール送信ルールを追加できるよう、設定ベースの構造にしてほしい。

#### 受け入れ基準

1. THE Email_Notification_Service SHALL メール送信ルールを設定オブジェクト（Email_Rule）として定義し、トリガーフィールド・宛先・CC・件名テンプレート・本文テンプレートを一箇所で管理できる構造にする。

2. WHEN 新しいトリガーフィールドとメールテンプレートのセットを追加する場合、THE Email_Notification_Service SHALL Email_Rule の配列に新しいエントリを追加するだけで対応できる構造にする。

3. THE Email_Notification_Service SHALL 1つのトリガーフィールドに対して1つの Email_Rule を対応付ける。

---

### 要件6：メール送信の実装方式

**ユーザーストーリー：** 開発者として、既存のバックエンドインフラを活用してメール送信を実装してほしい。

#### 受け入れ基準

1. THE Email_Notification_Service SHALL Node.js の `nodemailer` ライブラリ（または既存のメール送信ライブラリ）を使用してメールを送信する。

2. THE Email_Notification_Service SHALL SMTP 接続情報を環境変数（`SMTP_HOST`、`SMTP_PORT`、`SMTP_USER`、`SMTP_PASS` 等）から取得する。

3. IF SMTP 接続に失敗した場合、THEN THE Email_Notification_Service SHALL エラーをログに記録し、呼び出し元に例外をスローする。

4. THE Email_Notification_Service SHALL メール本文を HTML 形式で送信する（改行を `<br>` タグに変換する）。

---

### 要件7：エラーハンドリングとログ

**ユーザーストーリー：** 運用担当者として、メール送信の成否をログで確認できることを期待する。

#### 受け入れ基準

1. WHEN メール送信が成功した場合、THE Email_Notification_Service SHALL 送信成功ログ（物件番号・宛先・トリガーフィールド名）を記録する。

2. WHEN メール送信が失敗した場合、THE Email_Notification_Service SHALL エラーログ（物件番号・宛先・エラーメッセージ）を記録する。

3. WHEN メール送信が失敗した場合、THE Work_Task_Route SHALL 保存処理の結果（成功/失敗）に影響を与えない（メール送信は非同期・ベストエフォート）。

---

### 要件8：間取図確認OK送信メールの送信

**ユーザーストーリー：** 担当者として、「間取図確認OK送信」フィールドを変更したとき、指定の宛先に間取図確認完了メールが自動送信されることを期待する。

#### 受け入れ基準

1. WHEN `floor_plan_ok_send` の値が変更された場合、THE Email_Notification_Service SHALL 以下の宛先・CCにメールを送信する：
   - 宛先：`freetask.e72@gmail.com`
   - CC：`tenant@ifoo-oita.com`

2. WHEN `floor_plan_ok_send` の値が変更された場合、THE Email_Notification_Service SHALL 以下の件名でメールを送信する：
   - `図面ありがとうございます！{物件番号}{物件所在}（㈱いふう）`
   - `{物件番号}` および `{物件所在}` は対象レコードの実際の値に置換する。

3. WHEN `floor_plan_ok_send` の値が変更された場合、THE Email_Notification_Service SHALL 以下の本文でメールを送信する（各変数は対象レコードの実際の値に置換する）：

   ```
   阿曽様
   お世話になっております。
   間取図OR区画図作成ありがとうございます。{間取図確認OK/修正コメント}
   物件番号：{物件番号}
   物件所在地：{物件所在}
   ご不明点等がございましたら、こちらに返信していただければと思います。
   ㈱いふうTEL:097-533-2022MAIL:tenant@ifoo-oita.com
   ```

4. WHEN 本文テンプレート変数に対応するフィールドの値が null または空文字の場合、THE Email_Notification_Service SHALL 該当変数を空文字に置換してメールを送信する（エラーにしない）。

---

### 要件9：CWの方へ依頼メール（サイト登録）の送信

**ユーザーストーリー：** 担当者として、「CWの方へ依頼メール（サイト登録）」フィールドを変更したとき、指定の宛先にサイト登録依頼メールが自動送信されることを期待する。

#### 受け入れ基準

1. WHEN `cw_request_email_site_registration` の値が変更された場合、THE Email_Notification_Service SHALL 以下の宛先・CCにメールを送信する：
   - 宛先：`shiraishi8biz@gmail.com`
   - CC：`tenant@ifoo-oita.com`

2. WHEN `cw_request_email_site_registration` の値が変更された場合、THE Email_Notification_Service SHALL 以下の件名でメールを送信する：
   - `サイト登録関係お願いいたします！{物件番号}{物件所在}（㈱いふう）`
   - `{物件番号}` および `{物件所在}` は対象レコードの実際の値に置換する。

3. WHEN `cw_request_email_site_registration` の値が変更された場合、THE Email_Notification_Service SHALL 以下の HTML 本文でメールを送信する（各変数は対象レコードの実際の値に置換する）：

   ```html
   <!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial, Helvetica, 'Noto Sans JP', sans-serif;font-size:14px;line-height:1.4;">浅沼様<br>お世話になっております。<br>サイト登録関係お願いします。<br>物件番号：{物件番号}<br>コメント：{コメント（サイト登録）}<br>物件所在地：{物件所在}<br>当社依頼日：{サイト登録依頼日} {サイト登録依頼者}<br>当社の希望納期：{サイト登録納期予定日}<br>パノラマ：{パノラマ}<br>間取図格納時期：{間取図完了予定}<br>詳細：<a href="{スプシURL}">スプレッドシート</a><br>格納先：<a href="{格納先URL}">格納先フォルダ</a><br>ご不明点等がございましたら、こちらに返信していただければと思います。<br><br>㈱いふう<br>TEL:097-533-2022<br>MAIL: tenant@ifoo-oita.com</body></html>
   ```

4. WHEN 本文テンプレート変数に対応するフィールドの値が null または空文字の場合、THE Email_Notification_Service SHALL 該当変数を空文字に置換してメールを送信する（エラーにしない）。

---

### 要件10：サイト登録確認OK送信メールの送信

**ユーザーストーリー：** 担当者として、「サイト登録確認OK送信」フィールドを変更したとき、指定の宛先にサイト登録確認完了メールが自動送信されることを期待する。

#### 受け入れ基準

1. WHEN `site_registration_ok_send` の値が変更された場合、THE Email_Notification_Service SHALL 以下の宛先・CCにメールを送信する：
   - 宛先：`shiraishi8biz@gmail.com`
   - CC：`tenant@ifoo-oita.com`

2. WHEN `site_registration_ok_send` の値が変更された場合、THE Email_Notification_Service SHALL 以下の件名でメールを送信する：
   - `サイト登録ありがとうございます！{物件番号}{物件所在}（㈱いふう）`
   - `{物件番号}` および `{物件所在}` は対象レコードの実際の値に置換する。

3. WHEN `site_registration_ok_send` の値が変更された場合、THE Email_Notification_Service SHALL 以下の HTML 本文でメールを送信する（各変数は対象レコードの実際の値に置換する）：

   ```html
   <!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial, Helvetica, 'Noto Sans JP', sans-serif;font-size:14px;line-height:1.4;">浅沼様<br>お世話になっております。<br>サイト登録ありがとうございました。OKでした。<br>{サイト登録確認OKコメント}<br>物件番号：{物件番号}<br>物件所在地：{物件所在}<br>詳細：<a href="{スプシURL}">スプレッドシート</a><br>ご不明点等がございましたら、こちらに返信していただければと思います。<br><br>㈱いふう<br>TEL:097-533-2022<br>MAIL: tenant@ifoo-oita.com</body></html>
   ```

4. WHEN 本文テンプレート変数に対応するフィールドの値が null または空文字の場合、THE Email_Notification_Service SHALL 該当変数を空文字に置換してメールを送信する（エラーにしない）。

---

### 要件11：間取図格納済み連絡メールの送信

**ユーザーストーリー：** 担当者として、「間取図格納済み連絡メール」フィールドを変更したとき、指定の宛先に間取図格納完了の連絡メールが自動送信されることを期待する。

#### 受け入れ基準

1. WHEN `floor_plan_stored_notification` の値が変更された場合、THE Email_Notification_Service SHALL 以下の宛先・CCにメールを送信する：
   - 宛先：`shiraishi8biz@gmail.com`
   - CC：`tenant@ifoo-oita.com`

2. WHEN `floor_plan_stored_notification` の値が変更された場合、THE Email_Notification_Service SHALL 以下の件名でメールを送信する：
   - `間取図格納済みです！{物件番号}{物件所在}（㈱いふう）`
   - `{物件番号}` および `{物件所在}` は対象レコードの実際の値に置換する。

3. WHEN `floor_plan_stored_notification` の値が変更された場合、THE Email_Notification_Service SHALL 以下の HTML 本文でメールを送信する（各変数は対象レコードの実際の値に置換する）：

   ```html
   <!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial, Helvetica, 'Noto Sans JP', sans-serif;font-size:14px;line-height:1.4;">浅沼様<br>お世話になっております。<br>間取図格納済みです。<br>{格納先URL}<br>物件番号：{物件番号}<br>物件所在地：{物件所在}<br>当社依頼日：{サイト登録依頼日} {サイト登録依頼者}<br>当社の希望納期：{サイト登録納期予定日}<br>パノラマ：{パノラマ}<br>詳細：<a href="{スプシURL}">スプレッドシート</a><br>ご不明点等がございましたら、こちらに返信していただければと思います。<br><br>㈱いふう<br>TEL:097-533-2022<br>MAIL: tenant@ifoo-oita.com</body></html>
   ```

4. WHEN 本文テンプレート変数に対応するフィールドの値が null または空文字の場合、THE Email_Notification_Service SHALL 該当変数を空文字に置換してメールを送信する（エラーにしない）。
