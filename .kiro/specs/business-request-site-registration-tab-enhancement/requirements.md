# 要件定義書

## はじめに

本機能は、社内管理システム（sateituikyaku-admin）の業務依頼リスト「サイト登録」タブに対して以下の変更を加えるものです。

1. 「サイト登録納期予定日」および「間取図完了予定*」フィールドの表示形式を日付のみから日時（datetime）表示に変更する
2. 「メール配信v」フィールドの下に「サイト登録確認OKコメント」と「サイト登録確認OK送信」の2つのフィールドを追加する

対象ファイルは主に以下の通りです：
- フロントエンド: `frontend/frontend/src/components/WorkTaskDetailModal.tsx`
- バックエンド設定: `backend/src/config/work-task-column-mapping.json`
- フロントエンド設定: `frontend/frontend/src/backend/config/work-task-column-mapping.json`
- DBマイグレーション: `backend/migrations/`

## 用語集

- **WorkTaskDetailModal**: 業務依頼リストの詳細モーダルコンポーネント（`WorkTaskDetailModal.tsx`）
- **SiteRegistrationSection**: WorkTaskDetailModal内のサイト登録タブを描画するコンポーネント
- **EditableField**: WorkTaskDetailModal内で使用される汎用編集フィールドコンポーネント
- **site_registration_due_date**: 「サイト登録納期予定日」に対応するDBカラム（現在 `DATE` 型）
- **floor_plan_due_date**: 「間取図完了予定」に対応するDBカラム（既に `TIMESTAMPTZ` 型に変更済み）
- **site_registration_ok_comment**: 「サイト登録確認OKコメント」に対応するDBカラム（既存）
- **site_registration_ok_sent**: 「サイト登録確認OK送信」に対応するDBカラム（既存）
- **work-task-column-mapping.json**: スプレッドシートのカラム名とDBカラム名のマッピング定義ファイル
- **typeConversions**: work-task-column-mapping.json内でDBカラムの型変換を定義するセクション
- **GAS（GyomuWorkTaskSync.gs）**: スプレッドシートとDBを同期するGoogle Apps Scriptファイル

---

## 要件

### 要件1: サイト登録納期予定日の日時表示対応

**ユーザーストーリー:** 担当者として、「サイト登録納期予定日」に日時（例: 2026/4/8 12:00）が入力されている場合、日付だけでなく時刻も含めて確認・編集したい。そうすることで、スプレッドシートの実際の値と画面表示が一致し、入力ミスを防ぐことができる。

#### 受け入れ基準

1. WHEN 「サイト登録納期予定日」フィールドを表示する時、THE SiteRegistrationSection SHALL 日時（datetime-local）形式の入力フィールドとして描画する
2. WHEN ユーザーが「サイト登録納期予定日」に日時値（例: `2026-04-08T12:00`）を入力する時、THE WorkTaskDetailModal SHALL その値を `site_registration_due_date` フィールドとして保存する
3. THE WorkTaskDetailModal SHALL `site_registration_due_date` の既存の日付のみの値（`DATE` 型）を datetime-local 入力フィールドで正しく表示できるよう変換する
4. WHEN `site_registration_due_date` の値が null または空の場合、THE SiteRegistrationSection SHALL デフォルト日時値（現在の日付 + 2〜3日、時刻は 12:00）を初期値として表示する
5. THE Backend SHALL `work_tasks` テーブルの `site_registration_due_date` カラムを `DATE` 型から `TIMESTAMPTZ` 型に変更するマイグレーションを提供する
6. THE work-task-column-mapping.json SHALL `site_registration_due_date` の `typeConversions` エントリを `"date"` から `"datetime"` に変更する（バックエンド・フロントエンド両方）

---

### 要件2: 間取図完了予定の日時表示対応

**ユーザーストーリー:** 担当者として、「間取図完了予定*」に日時（例: 2026/4/7 12:00）が入力されている場合、時刻も含めて確認・編集したい。そうすることで、スプレッドシートの実際の値と画面表示が一致する。

#### 受け入れ基準

1. WHEN 「間取図完了予定*」フィールドを表示する時、THE SiteRegistrationSection SHALL 日時（datetime-local）形式の入力フィールドとして描画する
2. WHEN ユーザーが「間取図完了予定*」に日時値を入力する時、THE WorkTaskDetailModal SHALL その値を `floor_plan_due_date` フィールドとして保存する
3. THE WorkTaskDetailModal SHALL `floor_plan_due_date` の既存値を datetime-local 入力フィールドで正しく表示できるよう変換する
4. IF `floor_plan_due_date` の値が null または空の場合、THEN THE SiteRegistrationSection SHALL 空の状態で表示する（デフォルト値なし）
5. THE work-task-column-mapping.json SHALL `floor_plan_due_date` の `typeConversions` エントリが `"datetime"` であることを確認する（バックエンド・フロントエンド両方）
   - 注: DBカラムは migration 100 で既に `TIMESTAMPTZ` 型に変更済みのため、追加マイグレーションは不要
   - 注: GAS（GyomuWorkTaskSync.gs）では既に `'floor_plan_due_date': 'datetime'` と定義済みのため変更不要

---

### 要件3: サイト登録確認OKコメントフィールドの追加

**ユーザーストーリー:** 担当者として、「メール配信v」フィールドの下に「サイト登録確認OKコメント」フィールドを表示したい。そうすることで、サイト登録確認OKに関するコメントを画面上で確認・編集できる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「メール配信v」フィールドの直下に「サイト登録確認OKコメント」フィールドを表示する
2. WHEN ユーザーが「サイト登録確認OKコメント」フィールドを編集する時、THE WorkTaskDetailModal SHALL その値を `site_registration_ok_comment` カラムとして保存する
3. THE SiteRegistrationSection SHALL 「サイト登録確認OKコメント」フィールドをテキスト入力（EditableField、type="text"）として描画する
4. THE WorkTaskData interface SHALL `site_registration_ok_comment` フィールドを含む（既存の定義を確認・維持する）

---

### 要件4: サイト登録確認OK送信フィールドの追加

**ユーザーストーリー:** 担当者として、「サイト登録確認OKコメント」フィールドの下に「サイト登録確認OK送信」フィールドを表示したい。そうすることで、サイト登録確認OKの送信状況を画面上で確認・編集できる。

#### 受け入れ基準

1. THE SiteRegistrationSection SHALL 「サイト登録確認OKコメント」フィールドの直下に「サイト登録確認OK送信」フィールドを表示する
2. WHEN ユーザーが「サイト登録確認OK送信」フィールドを編集する時、THE WorkTaskDetailModal SHALL その値を `site_registration_ok_sent` カラムとして保存する
3. THE SiteRegistrationSection SHALL 「サイト登録確認OK送信」フィールドを Yes/No 選択（EditableYesNo）として描画する
   - 注: `floor_plan_ok_sent`（間取図確認OK送信）が EditableYesNo で実装されているため、同様の実装とする
4. THE WorkTaskData interface SHALL `site_registration_ok_sent` フィールドを含む（既存の定義を確認・維持する）

---

### 要件5: スプレッドシートカラムマッピングの整合性確認

**ユーザーストーリー:** 開発者として、スプレッドシートのカラム名とDBカラム名のマッピングが正しく定義されていることを確認したい。そうすることで、GASによる同期が正しく動作する。

#### 受け入れ基準

1. THE work-task-column-mapping.json SHALL 「サイト登録確認OKコメント」が `site_registration_ok_comment` にマッピングされていることを確認する（既存定義の確認）
2. THE work-task-column-mapping.json SHALL 「サイト登録確認OK送信」が `site_registration_ok_sent` にマッピングされていることを確認する（既存定義の確認）
3. THE GAS GyomuWorkTaskSync.gs SHALL 「サイト登録確認OKコメント」と「サイト登録確認OK送信」のマッピングが既存定義と一致していることを確認する（変更不要）
   - 注: GASファイルでは既に `'サイト登録確認OKコメント': 'site_registration_ok_comment'` および `'サイト登録確認OK送信': 'site_registration_ok_sent'` が定義済み

---

## 実装上の注意事項

### DBカラムの型変更について

- `site_registration_due_date`: 現在 `DATE` 型 → `TIMESTAMPTZ` 型への変更マイグレーションが必要
- `floor_plan_due_date`: migration 100 で既に `TIMESTAMPTZ` 型に変更済み → 追加マイグレーション不要
- `site_registration_ok_comment` / `site_registration_ok_sent`: migration 040 で既に `TEXT` 型として定義済み → 追加マイグレーション不要

### スプレッドシートのCM列について

ユーザーの記載では「サイト登録確認OKコメント」と「サイト登録確認OK送信」の両方がCM列に対応するとされているが、実際のGASコードおよびwork-task-column-mapping.jsonでは別々のカラム（`site_registration_ok_comment` と `site_registration_ok_sent`）にマッピングされている。実装時はGASコードおよびマッピングファイルの定義を正とする。

### フロントエンドの日時フォーマット

- `type="date"` → `type="datetime-local"` に変更
- 既存の `formatDateForInput` ユーティリティ関数が datetime-local 形式（`YYYY-MM-DDTHH:mm`）に対応しているか確認が必要
- 対応していない場合は、datetime-local 用のフォーマット関数を追加する
