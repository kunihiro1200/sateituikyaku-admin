# 要件定義書

## はじめに

本機能は、業務詳細画面（`WorkTaskDetailModal`）において、既存の「司法書士、相手側不動産情報」タブを「売主、買主詳細」タブに改名し、売主・買主の連絡先情報および取引関連フィールドを追加するものです。

現在のタブには司法書士・仲介業者情報のみが表示されていますが、売買取引に関わる売主・買主の直接連絡先情報（名前・メールアドレス・電話番号）、ローン情報、金融機関名、引き渡し予定日、融資承認予定日を同一タブ内で管理できるようにします。

なお、`loan_approval_scheduled_date`（融資承認予定日）は既に `work_tasks` テーブルに存在するため、フロントエンドへの表示追加のみが必要です。その他の新規フィールドはDBマイグレーションとバックエンドAPIの対応も必要です。

## 用語集

- **WorkTaskDetailModal**: 業務詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **work_tasks**: 業務依頼データを格納するSupabaseテーブル
- **WorkTaskService**: `backend/src/services/WorkTaskService.ts` - 業務依頼データのCRUD操作を担うサービス
- **WorkTaskData**: `backend/src/services/WorkTaskColumnMapper.ts` で定義されるデータインターフェース
- **JudicialScrivenerSection**: 現在の「司法書士、相手側不動産情報」タブのコンテンツコンポーネント
- **SellerBuyerDetailSection**: 新しい「売主、買主詳細」タブのコンテンツコンポーネント（新規作成）
- **EditableField**: テキスト入力フィールドコンポーネント（既存）
- **EditableButtonSelect**: ボタン選択フィールドコンポーネント（既存）
- **EditableDateField**: 日付入力フィールドコンポーネント（既存）

---

## 要件

### 要件1: タブ名の変更

**ユーザーストーリー:** 業務担当者として、タブ名が「売主、買主詳細」と表示されることで、そのタブに売主・買主の詳細情報が含まれていることを直感的に理解したい。

#### 受け入れ基準

1. THE WorkTaskDetailModal SHALL タブラベル配列の4番目の要素を「司法書士、相手側不動産情報」から「売主、買主詳細」に変更して表示する
2. WHEN ユーザーが「売主、買主詳細」タブをクリックしたとき、THE WorkTaskDetailModal SHALL 対応するタブコンテンツを表示する
3. THE WorkTaskDetailModal SHALL 既存の他のタブ（「媒介契約」「サイト登録」「契約決済」）の名称・順序・動作を変更しない

---

### 要件2: 売主情報フィールドの追加

**ユーザーストーリー:** 業務担当者として、売主の名前・メールアドレス・電話番号を業務詳細画面から直接確認・編集したい。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「売主名前」フィールドをテキスト入力として表示する
2. THE SellerBuyerDetailSection SHALL 「売主メアド」フィールドをテキスト入力として表示する
3. THE SellerBuyerDetailSection SHALL 「売主TEL」フィールドをテキスト入力として表示する
4. WHEN ユーザーが売主情報フィールドを編集して保存したとき、THE WorkTaskDetailModal SHALL `work_tasks` テーブルの対応するカラムに値を保存する
5. IF `work_tasks` テーブルに売主情報フィールドのカラムが存在しないとき、THEN THE System SHALL DBマイグレーションによりカラムを追加する

---

### 要件3: 買主情報フィールドの追加

**ユーザーストーリー:** 業務担当者として、買主の名前・メールアドレス・電話番号を業務詳細画面から直接確認・編集したい。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「買主名前」フィールドをテキスト入力として表示する
2. THE SellerBuyerDetailSection SHALL 「買主メアド」フィールドをテキスト入力として表示する
3. THE SellerBuyerDetailSection SHALL 「買主TEL」フィールドをテキスト入力として表示する
4. WHEN ユーザーが買主情報フィールドを編集して保存したとき、THE WorkTaskDetailModal SHALL `work_tasks` テーブルの対応するカラムに値を保存する
5. IF `work_tasks` テーブルに買主情報フィールドのカラムが存在しないとき、THEN THE System SHALL DBマイグレーションによりカラムを追加する

---

### 要件4: ローン・金融機関フィールドの追加

**ユーザーストーリー:** 業務担当者として、取引のローン有無と金融機関名を業務詳細画面で管理したい。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「ローン」フィールドをボタン選択（「あり」「なし」）として表示する
2. THE SellerBuyerDetailSection SHALL 「金融機関名」フィールドをテキスト入力として表示する
3. WHEN ユーザーがローン・金融機関フィールドを編集して保存したとき、THE WorkTaskDetailModal SHALL `work_tasks` テーブルの対応するカラムに値を保存する
4. IF `work_tasks` テーブルにローン・金融機関フィールドのカラムが存在しないとき、THEN THE System SHALL DBマイグレーションによりカラムを追加する

---

### 要件5: 引き渡し予定日フィールドの追加

**ユーザーストーリー:** 業務担当者として、物件の引き渡し予定日を業務詳細画面で管理したい。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「引き渡し予定」フィールドを日付入力として表示する
2. WHEN ユーザーが引き渡し予定日を入力して保存したとき、THE WorkTaskDetailModal SHALL `work_tasks` テーブルの対応するカラムに日付値を保存する
3. IF `work_tasks` テーブルに引き渡し予定日のカラムが存在しないとき、THEN THE System SHALL DBマイグレーションによりカラムを追加する

---

### 要件6: 融資承認予定日フィールドの表示

**ユーザーストーリー:** 業務担当者として、融資承認予定日を「売主、買主詳細」タブで確認・編集したい。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「融資承認予定日」フィールドを日付入力として表示する
2. WHEN ユーザーが融資承認予定日を入力して保存したとき、THE WorkTaskDetailModal SHALL `work_tasks` テーブルの `loan_approval_scheduled_date` カラムに日付値を保存する
3. THE SellerBuyerDetailSection SHALL 既存の `loan_approval_scheduled_date` カラムを使用する（新規カラム追加不要）

---

### 要件7: 既存フィールドの継続表示

**ユーザーストーリー:** 業務担当者として、タブ名変更後も司法書士・仲介業者情報を同じタブで引き続き確認・編集できるようにしたい。

#### 受け入れ基準

1. THE SellerBuyerDetailSection SHALL 「司法書士」フィールドを引き続き表示する
2. THE SellerBuyerDetailSection SHALL 「司法書士連絡先」フィールドを引き続き表示する
3. THE SellerBuyerDetailSection SHALL 「仲介業者」フィールドを引き続き表示する
4. THE SellerBuyerDetailSection SHALL 「仲介業者担当連絡先」フィールドを引き続き表示する
5. WHEN ユーザーが既存フィールドを編集して保存したとき、THE WorkTaskDetailModal SHALL 従来と同様に `work_tasks` テーブルに値を保存する

---

### 要件8: データ保存・API対応

**ユーザーストーリー:** 業務担当者として、新規追加フィールドの値が正しくDBに保存・取得されることを期待する。

#### 受け入れ基準

1. THE WorkTaskService SHALL 新規追加カラムを含む `work_tasks` テーブルのデータを取得できる
2. THE WorkTaskService SHALL 新規追加カラムを含む更新データを `work_tasks` テーブルに保存できる
3. WHEN バックエンドAPIが `PUT /api/work-tasks/:propertyNumber` を受け取ったとき、THE WorkTaskService SHALL 新規フィールドを含む更新を処理する
4. THE WorkTaskData SHALL 新規追加カラムのフィールドを型定義に含む（`[key: string]: any` により既存の型定義で対応可能）

---

### 要件9: スプレッドシートとの相互同期

**ユーザーストーリー:** 業務担当者として、新規追加フィールド（売主名前・売主メアド・売主TEL・買主名前・買主メアド・買主TEL・ローン・金融機関名・引き渡し予定・融資承認予定日）の値がスプレッドシートと双方向に同期されることで、スプレッドシートと業務詳細画面のどちらから更新しても常に最新の情報を参照できるようにしたい。

#### 受け入れ基準

1. THE WorkTaskColumnMapper SHALL 新規追加フィールドのスプレッドシートカラム名とDBカラム名のマッピングを `work-task-column-mapping.json` に含む

2. WHEN `WorkTaskSyncService.syncByPropertyNumber` が実行されたとき、THE WorkTaskSyncService SHALL スプレッドシートの新規追加フィールドの値を `work_tasks` テーブルに反映する

3. WHEN ユーザーが業務詳細画面で新規追加フィールドを編集して保存したとき、THE WorkTaskSyncService SHALL `writeBackToSpreadsheet` を通じてスプレッドシートの対応するセルに値を書き戻す

4. THE WorkTaskColumnMapper SHALL 以下のスプレッドシートカラム名とDBカラム名のマッピングを定義する
   - 「売主名前」→ `seller_contact_name`
   - 「売主メアド」→ `seller_contact_email`
   - 「売主TEL」→ `seller_contact_tel`
   - 「買主名前」→ `buyer_contact_name`
   - 「買主メアド」→ `buyer_contact_email`
   - 「買主TEL」→ `buyer_contact_tel`
   - 「ローン」→ `loan`
   - 「金融機関名」→ `financial_institution`
   - 「引き渡し予定」→ `delivery_scheduled_date`
   - 「融資承認予定日」→ `loan_approval_scheduled_date`（既存マッピング、変更不要）

5. THE WorkTaskColumnMapper SHALL `delivery_scheduled_date` を日付型（`date`）として型変換設定に含む

6. IF スプレッドシートに新規追加フィールドのカラムが存在しないとき、THEN THE WorkTaskSyncService SHALL 該当フィールドのスプシ書き戻しをスキップし、DBへの保存には影響させない

7. WHEN `WorkTaskSyncService.syncAll` が実行されたとき、THE WorkTaskSyncService SHALL 新規追加フィールドを含む全フィールドをスプレッドシートから `work_tasks` テーブルに一括同期する
