# 要件ドキュメント

## はじめに

物件リスト詳細画面（`PropertyListingDetailPage`）の「Email送信」ボタンをクリックした際に表示されるメール送信ダイアログに、送信元（Reply-To）アドレスを選択できる機能を追加する。

現在の実装では、送信元は `SenderAddressSelector` コンポーネントで `tenant@ifoo-oita.com`（テナント共有）のみが選択肢として表示されており、Reply-To ヘッダーは設定されていない。本機能により、物件担当者のアドレスをデフォルトの返信先として設定し、売主からの返信が適切な担当者に届くようになる。

### 調査結果サマリー

- **フロントエンド**: `frontend/frontend/src/pages/PropertyListingDetailPage.tsx`
  - `emailDialog` 状態でメール送信ダイアログを管理
  - `senderAddress` 状態で送信元アドレスを管理（`SenderAddressSelector` コンポーネントを使用）
  - `POST /api/emails/by-seller-number/:sellerNumber/send-template-email` でメール送信
  - `data.sales_assignee`（イニシャル形式）で物件担当を管理
- **バックエンド**: `backend/src/routes/emails.ts`
  - `by-seller-number/:sellerNumber/send-template-email` エンドポイントは現在 `replyTo` パラメータを受け取っていない
  - 添付ファイルあり時は `sendEmailWithCcAndAttachments`、なし時は `sendTemplateEmail` を呼び出す
- **参考実装**: `PropertyReportPage` の GMAIL 送信ボタンが同様の返信先選択 UI を実装済み
  - `GET /api/employees/jimu-staff` でスタッフ一覧（イニシャル・氏名・メールアドレス）を取得
  - `report_assignee` イニシャルに対応するスタッフをデフォルト選択
  - `replyTo` パラメータをバックエンドに送信
- **`EmailService`**: `sendEmailWithCcAndAttachments` は `replyTo` パラメータをサポート済み（`PropertyReportPage` で使用中）

---

## 用語集

- **Reply-To（返信先）**: メール受信者が「返信」ボタンを押したときに送信先となるメールアドレス。送信元（From）とは異なる場合がある。
- **物件担当（sales_assignee）**: 物件リストの担当者イニシャル。`property_listings.sales_assignee` カラムに格納される。
- **事務ありスタッフ（jimu-staff）**: スタッフ管理スプレッドシートの「事務あり」列が TRUE のスタッフ。返信先の選択肢として使用される。
- **PropertyListingDetailPage**: 物件リスト詳細画面（`/property-listings/:propertyNumber`）。
- **EmailService**: Gmail API を使用してメールを送信するバックエンドサービス（`backend/src/services/EmailService.supabase.ts`）。
- **sendEmailWithCcAndAttachments**: CC・添付ファイル・Reply-To ヘッダー付きメール送信メソッド。
- **SenderAddressSelector**: 送信元アドレスを選択するフロントエンドコンポーネント（`frontend/frontend/src/components/SenderAddressSelector.tsx`）。

---

## 要件

### 要件1: 返信先選択UIの追加

**ユーザーストーリー:** 担当者として、物件リスト詳細画面のメール送信ダイアログで返信先（Reply-To）メールアドレスを選択したい。そうすることで、売主からの返信が指定した担当者に届くようになる。

#### 受け入れ基準

1. WHEN メール送信ダイアログが開かれたとき、THE `PropertyListingDetailPage` SHALL 返信先（Reply-To）選択フィールドを表示する
2. THE `PropertyListingDetailPage` SHALL 事務ありスタッフの全メールアドレスを返信先の選択肢として表示する
3. WHEN `data.sales_assignee`（物件担当）が設定されている場合、THE `PropertyListingDetailPage` SHALL 対応するスタッフのメールアドレスをデフォルトの返信先として選択した状態でダイアログを開く
4. IF `data.sales_assignee` に対応するメールアドレスが存在しない場合、THEN THE `PropertyListingDetailPage` SHALL 返信先を未選択状態でダイアログを開く
5. THE `PropertyListingDetailPage` SHALL ユーザーがドロップダウンから返信先メールアドレスを変更できるようにする
6. WHERE 返信先が選択されていない場合、THE `PropertyListingDetailPage` SHALL Reply-To ヘッダーを設定せずにメールを送信する
7. WHEN メール送信ダイアログが閉じられたとき、THE `PropertyListingDetailPage` SHALL 返信先選択状態をリセットする

---

### 要件2: 返信先選択状態の表示

**ユーザーストーリー:** 担当者として、現在選択されている返信先が分かりやすく表示されてほしい。そうすることで、誤った返信先でメールを送信するミスを防げる。

#### 受け入れ基準

1. THE `PropertyListingDetailPage` SHALL 返信先選択フィールドのラベルを「返信先（Reply-To）」と表示する
2. WHEN 返信先が選択されている場合、THE `PropertyListingDetailPage` SHALL 選択されたスタッフの氏名とメールアドレスを選択肢として表示する
3. WHERE 返信先が未選択の場合、THE `PropertyListingDetailPage` SHALL 「選択なし（送信元と同じ）」というプレースホルダーを表示する

---

### 要件3: Reply-To ヘッダーのメール送信への反映

**ユーザーストーリー:** 担当者として、選択した返信先がメールの Reply-To ヘッダーに設定されてほしい。そうすることで、売主が返信ボタンを押したときに指定した担当者にメールが届く。

#### 受け入れ基準

1. WHEN メール送信が実行されたとき、THE `PropertyListingDetailPage` SHALL 選択された返信先メールアドレスをリクエストボディの `replyTo` フィールドとして送信する
2. WHEN `POST /api/emails/by-seller-number/:sellerNumber/send-template-email` が `replyTo` パラメータを受け取ったとき、THE `EmailsRoute` SHALL そのアドレスを `sendEmailWithCcAndAttachments` に渡す
3. WHEN `sendEmailWithCcAndAttachments` が `replyTo` パラメータを受け取ったとき、THE `EmailService` SHALL MIMEメッセージに `Reply-To: {replyTo}` ヘッダーを追加する
4. IF `replyTo` パラメータが空または未指定の場合、THEN THE `EmailsRoute` SHALL Reply-To ヘッダーを設定しない（既存の動作を維持する）
5. WHEN 添付ファイルなしでメールを送信する場合、THE `EmailsRoute` SHALL `replyTo` が指定されていれば `sendEmailWithCcAndAttachments` を使用して Reply-To ヘッダーを設定する

---

### 要件4: スタッフメールアドレス一覧の取得

**ユーザーストーリー:** 担当者として、返信先を選択するために当社スタッフのメールアドレス一覧を取得したい。そうすることで、売主からの返信が適切な担当者に届くようにできる。

#### 受け入れ基準

1. WHEN `PropertyListingDetailPage` が初期化されたとき、THE `PropertyListingDetailPage` SHALL `GET /api/employees/jimu-staff` を呼び出して事務ありスタッフの一覧を取得する
2. THE `EmployeesRoute` SHALL `jimu-staff` エンドポイントのレスポンスにイニシャル・氏名・メールアドレスを含める（既存実装済み）
3. IF スタッフのメールアドレスが空欄の場合、THEN THE `PropertyListingDetailPage` SHALL そのスタッフを返信先の選択肢から除外する
