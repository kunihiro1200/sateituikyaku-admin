# 要件ドキュメント

## はじめに

物件リストの報告ページ（`PropertyReportPage`）にあるGmail送信機能に、「返信先（Reply-To）」メールアドレスを選択できる機能を追加する。

現在の実装では、送信されるメールの返信先は送信元アドレス（`tenant@ifoo-oita.com` 等）に固定されている。本機能により、ユーザーは当社スタッフのメールアドレスを返信先として指定できるようになり、売主からの返信が適切な担当者に届くようになる。

### 調査結果サマリー

- **フロントエンド**: `frontend/frontend/src/pages/PropertyReportPage.tsx`
  - メール送信確認ダイアログ（`sendConfirmDialogOpen`）内でメール内容を編集
  - `editTo`（宛先）、`editSubject`（件名）、`editBody`（本文）の状態を管理
  - `POST /api/property-listings/:propertyNumber/send-report-email` でメール送信
- **バックエンド**: `backend/src/routes/propertyListings.ts`
  - `send-report-email` エンドポイントが `from` パラメータを受け取り `sendEmailWithCcAndAttachments` を呼び出す
  - `EmailService.sendEmailWithCcAndAttachments` は現在 Reply-To ヘッダーを設定していない
- **スタッフ情報**: `StaffManagementService.fetchStaffData()` がスプレッドシートから全スタッフのイニシャル・氏名・メールアドレスを取得可能
- **従業員API**: `GET /api/employees/jimu-staff` が事務ありスタッフの一覧（イニシャル + 氏名）を返す
- **デフォルト値**: `reportData.report_assignee`（報告担当のイニシャル）が既に管理されており、これに対応するメールアドレスをデフォルト選択に使用できる

---

## 用語集

- **Reply-To（返信先）**: メール受信者が「返信」ボタンを押したときに送信先となるメールアドレス。送信元（From）とは異なる場合がある。
- **報告担当**: 物件報告を担当するスタッフのイニシャル（`report_assignee`）。報告ページで選択される。
- **事務ありスタッフ**: スタッフ管理スプレッドシートの「事務あり」列が TRUE のスタッフ。報告担当の選択肢として使用される。
- **PropertyReportPage**: 物件リストの報告ページ（`/property-listings/:propertyNumber/report`）。
- **EmailService**: Gmail API を使用してメールを送信するバックエンドサービス（`backend/src/services/EmailService.supabase.ts`）。
- **StaffManagementService**: スタッフ管理スプレッドシートからスタッフ情報を取得するサービス（`backend/src/services/StaffManagementService.ts`）。
- **sendEmailWithCcAndAttachments**: CC・添付ファイル付きメール送信メソッド。報告メール送信に使用される。

---

## 要件

### 要件1: スタッフメールアドレス一覧の取得API

**ユーザーストーリー:** 担当者として、返信先を選択するために当社スタッフのメールアドレス一覧を取得したい。そうすることで、売主からの返信が適切な担当者に届くようにできる。

#### 受け入れ基準

1. THE `StaffManagementService` SHALL スタッフ管理スプレッドシートから全スタッフのイニシャル・氏名・メールアドレスを取得する機能を提供する
2. WHEN `GET /api/employees/jimu-staff` が呼び出されたとき、THE `EmployeesRoute` SHALL 事務ありスタッフのイニシャル・氏名・メールアドレスを含むレスポンスを返す
3. IF スタッフのメールアドレスが空欄の場合、THEN THE `EmployeesRoute` SHALL そのスタッフをレスポンスから除外する
4. THE `EmployeesRoute` SHALL メールアドレスを含む `jimu-staff` エンドポイントのレスポンスを返す（現在はイニシャルと氏名のみ）

---

### 要件2: 返信先選択UIの追加

**ユーザーストーリー:** 担当者として、メール送信確認ダイアログで返信先メールアドレスを選択したい。そうすることで、売主からの返信が指定した担当者に届くようになる。

#### 受け入れ基準

1. WHEN メール送信確認ダイアログが開かれたとき、THE `PropertyReportPage` SHALL 返信先（Reply-To）選択フィールドを表示する
2. THE `PropertyReportPage` SHALL 当社スタッフの全メールアドレスを返信先の選択肢として表示する
3. WHEN `reportData.report_assignee`（報告担当）が設定されている場合、THE `PropertyReportPage` SHALL 対応するスタッフのメールアドレスをデフォルトの返信先として選択した状態で表示する
4. IF `reportData.report_assignee` に対応するメールアドレスが存在しない場合、THEN THE `PropertyReportPage` SHALL 返信先を未選択状態で表示する
5. THE `PropertyReportPage` SHALL ユーザーがドロップダウンから返信先メールアドレスを変更できるようにする
6. WHERE 返信先が選択されていない場合、THE `PropertyReportPage` SHALL Reply-To ヘッダーを設定せずにメールを送信する

---

### 要件3: Reply-To ヘッダーのメール送信への反映

**ユーザーストーリー:** 担当者として、選択した返信先がメールの Reply-To ヘッダーに設定されてほしい。そうすることで、売主が返信ボタンを押したときに指定した担当者にメールが届く。

#### 受け入れ基準

1. WHEN メール送信が実行されたとき、THE `PropertyReportPage` SHALL 選択された返信先メールアドレスをリクエストボディの `replyTo` フィールドとして送信する
2. WHEN `POST /api/property-listings/:propertyNumber/send-report-email` が `replyTo` パラメータを受け取ったとき、THE `PropertyListingsRoute` SHALL そのアドレスを `sendEmailWithCcAndAttachments` に渡す
3. WHEN `sendEmailWithCcAndAttachments` が `replyTo` パラメータを受け取ったとき、THE `EmailService` SHALL MIMEメッセージに `Reply-To: {replyTo}` ヘッダーを追加する
4. IF `replyTo` パラメータが空または未指定の場合、THEN THE `EmailService` SHALL Reply-To ヘッダーを設定しない（既存の動作を維持する）
5. THE `EmailService` SHALL Reply-To ヘッダーを From ヘッダーの直後に配置する

---

### 要件4: 返信先選択状態の表示

**ユーザーストーリー:** 担当者として、現在選択されている返信先が分かりやすく表示されてほしい。そうすることで、誤った返信先でメールを送信するミスを防げる。

#### 受け入れ基準

1. THE `PropertyReportPage` SHALL 返信先選択フィールドに選択中のスタッフ名（氏名またはイニシャル）とメールアドレスを表示する
2. WHEN 返信先が選択されている場合、THE `PropertyReportPage` SHALL 選択されたスタッフの氏名とメールアドレスを選択肢として表示する
3. THE `PropertyReportPage` SHALL 返信先選択フィールドのラベルを「返信先（Reply-To）」と表示する
4. WHERE 返信先が未選択の場合、THE `PropertyReportPage` SHALL 「選択なし（送信元と同じ）」というプレースホルダーを表示する

