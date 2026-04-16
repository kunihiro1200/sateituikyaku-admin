# 要件定義書

## はじめに

買主リストにおいて、内覧日を入力してカレンダー送信した際に、物件担当者へメール通知を送信する機能の要件定義書です。

通知は2種類あります：
1. **内覧確定メール**：内覧日を入力してカレンダー送信したとき
2. **内覧キャンセルメール**：保存済みの内覧日（最新）が空欄になったとき

本機能は `backend/src/routes/buyer-appointments.ts`（社内管理システム用バックエンド、ポート3000）に実装します。

---

## 用語集

- **System**：社内管理システムのバックエンドサーバー（`backend/src/`、ポート3000）
- **EmailNotifier**：メール通知を送信するシステムコンポーネント
- **物件担当（sales_assignee）**：`property_listings` テーブルの `sales_assignee` カラムに格納されたイニシャル。従業員マスタからメールアドレスを引く対象
- **後続担当（follow_up_assignee）**：買主の `follow_up_assignee` カラムに格納されたイニシャル
- **住居表示（display_address）**：`property_listings` テーブルの `display_address` カラムの値
- **物件住所（address）**：`property_listings` テーブルの `address` カラムの値
- **内覧日（最新）（viewing_date）**：`buyers` テーブルの `viewing_date` カラムの値
- **時間（viewing_time）**：`buyers` テーブルの `viewing_time` カラムの値
- **内覧形態（viewing_mobile / viewing_type_general）**：`buyers` テーブルの `viewing_mobile` または `viewing_type_general` カラムの値
- **後続担当（follow_up_assignee）**：`buyers` テーブルの `follow_up_assignee` カラムの値
- **ヒアリング項目（inquiry_hearing）**：`buyers` テーブルの `inquiry_hearing` カラムの値
- **売主氏名（name）**：`sellers` テーブルの `name` カラム（暗号化済み）を復号した値
- **電話番号（phone_number）**：`sellers` テーブルの `phone_number` カラム（暗号化済み）を復号した値
- **買主番号（buyer_number）**：`buyers` テーブルの `buyer_number` カラムの値
- **物件番号（property_number）**：`property_listings` テーブルの `property_number` カラムの値

---

## 要件

### 要件1：内覧確定メール送信

**ユーザーストーリー：** 担当者として、内覧日を入力してカレンダー送信したとき、物件担当者に内覧確定の通知メールが届くようにしたい。そうすることで、物件担当者が内覧の予定を把握できる。

#### 受け入れ基準

1. WHEN カレンダー送信が実行された場合、THE EmailNotifier SHALL 物件担当（`property_listings.sales_assignee`）のメールアドレスを宛先として内覧確定メールを送信する

2. IF 物件担当（`property_listings.sales_assignee`）が存在しない、またはメールアドレスが取得できない場合、THEN THE EmailNotifier SHALL 内覧確定メールを送信しない（送信不要）

3. THE EmailNotifier SHALL 件名を以下のルールで生成する：
   - `property_listings.display_address` が存在する場合：`<<display_address>>の内覧入りました！`
   - `property_listings.display_address` が空または存在しない場合：`<<address>>の内覧入りました！`

4. THE EmailNotifier SHALL 本文を以下の形式で生成する：
   ```
   内覧担当は<<follow_up_assignee>>です。
   <<viewing_mobile または viewing_type_general>>
   物件所在地<<display_address（なければaddress）>>
   内覧日<<viewing_date>><<viewing_time>>
   問合時コメント：<<inquiry_hearing>>
   売主様：<<sellers.name（復号済み）>>様
   所有者連絡先<<sellers.phone_number（復号済み）>>
   買主番号：<<buyer_number>>
   物件番号：<<property_number>>
   ```

5. WHEN `sellers` テーブルから売主情報を取得する場合、THE System SHALL `seller_number = property_number` の条件で検索する

6. WHEN `sellers.name` または `sellers.phone_number` が暗号化されている場合、THE System SHALL `decrypt()` 関数を使用して復号してから本文に埋め込む

7. IF 売主情報が取得できない場合、THEN THE EmailNotifier SHALL 売主氏名を「なし」、所有者連絡先を「なし」として本文を生成する

8. WHEN 内覧確定メール送信が失敗した場合、THE System SHALL カレンダー登録の成功レスポンスに影響を与えず、エラーをログに記録する

---

### 要件2：内覧キャンセルメール送信

**ユーザーストーリー：** 担当者として、保存済みの内覧日が空欄になったとき、物件担当者に内覧キャンセルの通知メールが届くようにしたい。そうすることで、物件担当者が内覧キャンセルを把握し、報告書記入時に注意できる。

#### 受け入れ基準

1. WHEN `buyers.viewing_date`（内覧日最新）が保存済みの値から空欄に変更されて保存された場合、THE EmailNotifier SHALL 物件担当（`property_listings.sales_assignee`）のメールアドレスを宛先として内覧キャンセルメールを送信する

2. IF 物件担当（`property_listings.sales_assignee`）が存在しない、またはメールアドレスが取得できない場合、THEN THE EmailNotifier SHALL 内覧キャンセルメールを送信しない（送信不要）

3. THE EmailNotifier SHALL 件名を以下のルールで生成する：
   - `property_listings.display_address` が存在する場合：`<<display_address>>の内覧キャンセルです`
   - `property_listings.display_address` が空または存在しない場合：`<<address>>の内覧キャンセルです`

4. THE EmailNotifier SHALL 本文を以下の形式で生成する：
   ```
   内覧担当は<<follow_up_assignee>>でした。
   <<viewing_mobile または viewing_type_general>>
   物件所在地<<display_address（なければaddress）>>
   内覧日<<viewing_date（キャンセル前の値）>>の予定でしたがキャンセルとなりました。報告書記入の際はお気をつけください。
   問合時コメント：<<inquiry_hearing>>
   売主様：<<sellers.name（復号済み）>>様
   所有者連絡先<<sellers.phone_number（復号済み）>>
   買主番号：<<buyer_number>>
   物件番号：<<property_number>>
   ```

5. WHEN キャンセルメール本文に内覧日を埋め込む場合、THE EmailNotifier SHALL キャンセル前（空欄になる前）の `viewing_date` の値を使用する

6. WHEN `sellers` テーブルから売主情報を取得する場合、THE System SHALL `seller_number = property_number` の条件で検索する

7. WHEN `sellers.name` または `sellers.phone_number` が暗号化されている場合、THE System SHALL `decrypt()` 関数を使用して復号してから本文に埋め込む

8. IF 売主情報が取得できない場合、THEN THE EmailNotifier SHALL 売主氏名を「なし」、所有者連絡先を「なし」として本文を生成する

9. WHEN 内覧キャンセルメール送信が失敗した場合、THE System SHALL エラーをログに記録し、エラーレスポンスを返す

---

### 要件3：物件担当メールアドレスの解決

**ユーザーストーリー：** システムとして、物件担当のイニシャルから正しいメールアドレスを取得したい。そうすることで、正しい宛先にメールを送信できる。

#### 受け入れ基準

1. WHEN 物件担当のメールアドレスを解決する場合、THE System SHALL `property_listings.sales_assignee`（イニシャル）を使用して従業員マスタからメールアドレスを取得する

2. IF `property_listings.sales_assignee` が空または存在しない場合、THEN THE System SHALL メール送信をスキップする

3. IF 従業員マスタに該当するイニシャルが存在しない場合、THEN THE System SHALL メール送信をスキップしてログに記録する

4. IF 従業員マスタに該当するイニシャルが存在するがメールアドレスが未設定の場合、THEN THE System SHALL メール送信をスキップしてログに記録する

---

### 要件4：住居表示フォールバック

**ユーザーストーリー：** システムとして、住居表示が存在しない場合に物件住所を代替として使用したい。そうすることで、件名・本文に常に物件の場所が表示される。

#### 受け入れ基準

1. WHEN 件名または本文に物件の場所を埋め込む場合、THE EmailNotifier SHALL `property_listings.display_address` が存在する場合はその値を使用する

2. WHEN `property_listings.display_address` が空または NULL の場合、THE EmailNotifier SHALL `property_listings.address` の値を代替として使用する

3. IF `property_listings.display_address` も `property_listings.address` も存在しない場合、THEN THE EmailNotifier SHALL 物件の場所を「（住所未設定）」として扱う

---

### 要件5：既存実装との整合性

**ユーザーストーリー：** 開発者として、既存のカレンダー送信・キャンセル通知の実装を本要件に合わせて修正したい。そうすることで、仕様通りのメール通知が送信される。

#### 受け入れ基準

1. THE System SHALL `backend/src/routes/buyer-appointments.ts` の `POST /` エンドポイント（カレンダー送信）において、宛先を物件担当のみとする（後続担当への送信は行わない）

2. THE System SHALL `backend/src/routes/buyer-appointments.ts` の `POST /cancel-notification` エンドポイント（キャンセル通知）において、宛先を物件担当のみとする（固定メールアドレスへの送信は行わない）

3. THE System SHALL 件名・本文を本要件定義書に記載の形式に修正する

4. WHEN `display_address` を取得する場合、THE System SHALL `property_listings` テーブルから `display_address` カラムを SELECT に含める
