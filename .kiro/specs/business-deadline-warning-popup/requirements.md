# 要件ドキュメント

## はじめに

業務リスト詳細画面（`WorkTaskDetailModal`）において、以下の2つの日付フィールドが「サイト登録締日」（`site_registration_deadline`）を過ぎている場合に、警告ポップアップを表示する機能を追加する。

**対象フィールド**:
- `サイト登録納期予定日*`（`site_registration_due_date`）
- `間取図完了予定*`（`floor_plan_due_date`）

**警告条件**: 上記フィールドの日付が `site_registration_deadline` の日付を過ぎている場合

**警告メッセージ**: 「サイト登録締日を過ぎています　担当に確認しましたか？」

対象ファイル:
- `frontend/frontend/src/components/WorkTaskDetailModal.tsx`（詳細モーダル）

## 用語集

- **WorkTaskDetailModal**: 業務リスト詳細画面のモーダルコンポーネント（`frontend/frontend/src/components/WorkTaskDetailModal.tsx`）
- **サイト登録締日**: 物件のサイト登録期限日（`site_registration_deadline` フィールド）
- **サイト登録納期予定日**: CWへのサイト登録依頼の納期予定日時（`site_registration_due_date` フィールド、datetime-local型）
- **間取図完了予定**: 間取図作成の完了予定日時（`floor_plan_due_date` フィールド、datetime-local型）
- **警告ポップアップ**: 締日超過を通知するダイアログ（MUI `Dialog` または `Alert` コンポーネント）
- **WarningChecker**: 締日超過チェックを行うロジック（本機能で追加するロジック）

---

## 要件

### 要件1: サイト登録納期予定日の締日超過警告

**ユーザーストーリー:** 業務担当者として、サイト登録納期予定日がサイト登録締日を過ぎている場合に警告を受け取りたい。そうすることで、締日超過に気づかずに登録作業を進めてしまうリスクを防げる。

#### 受け入れ基準

1. WHEN `site_registration_due_date` の日付が `site_registration_deadline` の日付より後である場合、THE WarningChecker SHALL 警告ポップアップを表示する
2. WHEN `site_registration_due_date` の日付が `site_registration_deadline` の日付と同日または以前である場合、THE WarningChecker SHALL 警告ポップアップを表示しない
3. WHEN `site_registration_deadline` が空または無効な日付である場合、THE WarningChecker SHALL 警告ポップアップを表示しない
4. WHEN `site_registration_due_date` が空または無効な日付である場合、THE WarningChecker SHALL 警告ポップアップを表示しない
5. THE WarningChecker SHALL 警告ポップアップに「サイト登録締日を過ぎています　担当に確認しましたか？」というメッセージを表示する

### 要件2: 間取図完了予定の締日超過警告

**ユーザーストーリー:** 業務担当者として、間取図完了予定日がサイト登録締日を過ぎている場合に警告を受け取りたい。そうすることで、間取図の完成が締日に間に合わないリスクを事前に把握できる。

#### 受け入れ基準

1. WHEN `floor_plan_due_date` の日付が `site_registration_deadline` の日付より後である場合、THE WarningChecker SHALL 警告ポップアップを表示する
2. WHEN `floor_plan_due_date` の日付が `site_registration_deadline` の日付と同日または以前である場合、THE WarningChecker SHALL 警告ポップアップを表示しない
3. WHEN `site_registration_deadline` が空または無効な日付である場合、THE WarningChecker SHALL 警告ポップアップを表示しない
4. WHEN `floor_plan_due_date` が空または無効な日付である場合、THE WarningChecker SHALL 警告ポップアップを表示しない
5. THE WarningChecker SHALL 警告ポップアップに「サイト登録締日を過ぎています　担当に確認しましたか？」というメッセージを表示する

### 要件3: 警告ポップアップの表示タイミング

**ユーザーストーリー:** 業務担当者として、フィールドを入力・変更した直後に警告を確認したい。そうすることで、入力ミスをその場で認識して対処できる。

#### 受け入れ基準

1. WHEN `site_registration_due_date` フィールドの値が変更された場合、THE WarningChecker SHALL 変更後の値と `site_registration_deadline` を比較して締日超過チェックを実行する
2. WHEN `floor_plan_due_date` フィールドの値が変更された場合、THE WarningChecker SHALL 変更後の値と `site_registration_deadline` を比較して締日超過チェックを実行する
3. THE WarningChecker SHALL 締日超過が検出された場合に即座に警告ポップアップを表示する
4. WHEN 警告ポップアップが表示されている場合、THE WarningChecker SHALL ユーザーが確認ボタンを押すことでポップアップを閉じられるようにする
5. THE WarningChecker SHALL 警告ポップアップを閉じた後も、フィールドの値はそのまま保持する（入力値を取り消さない）

### 要件4: 複数フィールドの同時超過

**ユーザーストーリー:** 業務担当者として、複数のフィールドが同時に締日を超過している場合でも、適切に警告を受け取りたい。

#### 受け入れ基準

1. WHEN `site_registration_due_date` と `floor_plan_due_date` の両方が `site_registration_deadline` を超過している場合、THE WarningChecker SHALL 各フィールドの変更時にそれぞれ警告ポップアップを表示する
2. THE WarningChecker SHALL 警告ポップアップにどのフィールドが締日を超過しているかを示すメッセージを含める
