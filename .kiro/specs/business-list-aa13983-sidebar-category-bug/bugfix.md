# バグ修正要件ドキュメント

## はじめに

業務リスト（WorkTasksPage）のサイドバーカテゴリー判定ロジックにバグがある。
AA13983はサイト登録依頼済みの状態であるにもかかわらず、「サイト登録依頼してください」カテゴリーに分類されている。
正しくは「サイト依頼済み納品待ち」カテゴリーに分類されるべきである。

対象ファイル: `frontend/frontend/src/utils/workTaskStatusUtils.ts`

### バグの根本原因（確定）

DBデータ確認により根本原因が特定された：

- `cw_request_email_site`（CWの方へ依頼メール（サイト登録）、スプシCGカラム）= **'N'**（値あり＝依頼済み）
- `site_registration_requestor`（サイト登録依頼先）= **None**（空）
- `site_registration_deadline`（サイト登録納期予定日）= **'2026-04-22'**（値あり）

`cw_request_email_site` に Y または N の値が入っていれば「依頼済み」を意味する。
しかし条件3（サイト登録依頼してください）は `cw_request_email_site` を考慮していないため、
`site_registration_requestor` が空の場合に誤って「サイト登録依頼してください」に分類される。

さらに、`WorkTask` インターフェースに `cw_request_email_site` フィールドが定義されていない。

**修正内容：**
1. `WorkTask` インターフェースに `cw_request_email_site: string` を追加
2. 条件3に `isBlank(task.cw_request_email_site)` を追加
   → `cw_request_email_site` に値（Y/N）が入っていれば依頼済みとみなし、条件3をスキップする

---

## バグ分析

### Current Behavior（欠陥）

1.1 WHEN `cw_request_email_site` に値（'Y' または 'N'）が入っており（依頼済み）、`site_registration_requestor` が空で、`site_registration_deadline` が設定されており、`sales_contract_deadline` が空の場合 THEN システムは「サイト登録依頼してください」カテゴリーに分類する

1.2 WHEN `WorkTask` インターフェースに `cw_request_email_site` フィールドが定義されていない場合 THEN 条件3の判定で `cw_request_email_site` を参照できない

### Expected Behavior（正しい動作）

2.1 WHEN `cw_request_email_site` に値（'Y' または 'N'）が入っており（依頼済み）、`site_registration_deadline` が設定されており、`site_registration_confirmed` が「完了」でなく、`site_registration_confirm_request_date` が空の場合 THEN システムは SHALL 「サイト依頼済み納品待ち」カテゴリーに分類する

2.2 WHEN `WorkTask` インターフェースに `cw_request_email_site: string` が追加された場合 THEN 条件3で `isBlank(task.cw_request_email_site)` を評価できる

### Unchanged Behavior（リグレッション防止）

3.1 WHEN `cw_request_email_site` が空で、`site_registration_requestor` も空であり、`site_registration_deadline` が設定されており、`on_hold`・`distribution_date`・`publish_scheduled_date`・`sales_contract_deadline` が全て空の場合 THEN システムは SHALL CONTINUE TO 「サイト登録依頼してください」カテゴリーに分類する

3.2 WHEN `site_registration_confirm_request_date` が設定されており、`site_registration_confirmed` が空の場合 THEN システムは SHALL CONTINUE TO 「サイト登録要確認」カテゴリーに分類する

3.3 WHEN `sales_contract_confirmed` が「確認中」の場合 THEN システムは SHALL CONTINUE TO 「売買契約　営業確認中」カテゴリーに分類する

3.4 WHEN `on_hold` が設定されている場合 THEN システムは SHALL CONTINUE TO 「保留」カテゴリーに分類する

3.5 WHEN `sales_contract_deadline` が設定されており、`binding_scheduled_date` が空で、`binding_completed` が空で、`hirose_request_sales` と `cw_request_sales` と `employee_contract_creation` が全て空の場合 THEN システムは SHALL CONTINUE TO 「売買契約 依頼未」カテゴリーに分類する
