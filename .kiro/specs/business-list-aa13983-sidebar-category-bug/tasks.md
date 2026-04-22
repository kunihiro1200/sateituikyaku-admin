# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - cw_request_email_siteに値がある場合に条件3が誤って適用されるバグ
  - **CRITICAL**: このテストは未修正コードで必ずFAILすること — FAILがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターエグザンプルを表面化する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `calculateTaskStatus` 関数（`frontend/frontend/src/utils/workTaskStatusUtils.ts`）
  - バグ条件（isBugCondition）: `cw_request_email_site` が 'N' または 'Y'（空でない）、かつ `site_registration_requestor` が空、かつ `on_hold` が空、かつ `distribution_date` が空、かつ `publish_scheduled_date` が空、かつ `site_registration_deadline` が設定済み、かつ `sales_contract_deadline` が空
  - AA13983再現テスト: `cw_request_email_site = 'N'`、`site_registration_requestor = null`、`site_registration_deadline = '2026-04-22'`、`sales_contract_deadline = null` → 未修正コードで「サイト登録依頼してください 4/22」が返ることを確認（バグ再現）
  - `cw_request_email_site = 'Y'` テスト: 同条件で「サイト登録依頼してください」が返ることを確認（バグ再現）
  - 期待動作（expectedBehavior）: `cw_request_email_site` に値がある場合、「サイト登録依頼してください」で始まる文字列を返さない
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストFAIL（これが正しい — バグの存在を証明する）
  - 発見したカウンターエグザンプルを記録して根本原因を理解する
  - テストを作成し、実行し、FAILを記録したらタスク完了とする
  - _Requirements: 1.1_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - cw_request_email_siteが空の場合の既存動作の保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ入力（`cw_request_email_site` が空）の動作を観察する
  - 観察1: `cw_request_email_site = null`、`site_registration_requestor = null`、`site_registration_deadline = '2026-04-22'` → 「サイト登録依頼してください 4/22」が返る
  - 観察2: `site_registration_confirm_request_date` が設定済み、`site_registration_confirmed` が空 → 「サイト登録要確認」が返る
  - 観察3: `sales_contract_confirmed = '確認中'` → 「売買契約　営業確認中」が返る
  - 観察4: `on_hold` が設定済み → 「保留」が返る
  - 観察5: `sales_contract_deadline` が設定済みで依頼未の場合 → 「売買契約 依頼未」が返る
  - 観察した動作パターンをキャプチャするプロパティベーステストを作成する（Preservation Requirementsより）
  - 非バグ入力全体で強い保証を得るためプロパティベーステストを推奨
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストPASS（保持すべきベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. cw_request_email_siteバグの修正

  - [x] 3.1 修正を実装する
    - `WorkTask` インターフェースに `cw_request_email_site: string` を追加（`site_registration_requestor` の直後）
    - 条件3の `if` 文に `isBlank(task.cw_request_email_site) &&` を追加（`isBlank(task.site_registration_requestor) &&` の直後）
    - 対象ファイル: `frontend/frontend/src/utils/workTaskStatusUtils.ts`
    - _Bug_Condition: isBugCondition(task) — isNotBlank(task.cw_request_email_site) AND isBlank(task.site_registration_requestor) AND isBlank(task.on_hold) AND isBlank(task.distribution_date) AND isBlank(task.publish_scheduled_date) AND isNotBlank(task.site_registration_deadline) AND isBlank(task.sales_contract_deadline)_
    - _Expected_Behavior: cw_request_email_siteに値がある場合、「サイト登録依頼してください」を返さず、条件9（「サイト依頼済み納品待ち」）に進む_
    - _Preservation: cw_request_email_siteが空の全タスクは修正前後で同じ結果を返す_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストがPASSすることを確認する
    - **Property 1: Expected Behavior** - cw_request_email_siteに値がある場合は条件3をスキップ
    - **IMPORTANT**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストがPASSすれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストPASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保持テストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - cw_request_email_siteが空の場合の既存動作の保持
    - **IMPORTANT**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストPASS（リグレッションがないことを確認する）
    - 修正後も全テストがPASSすることを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストがPASSすることを確認する
  - 全テストがPASSすることを確認する。疑問が生じた場合はユーザーに確認する。
