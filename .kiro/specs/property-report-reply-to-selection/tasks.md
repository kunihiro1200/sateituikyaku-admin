# 実装計画：物件リスト報告ページ Email 返信先選択機能

## 概要

バックエンド（`backend/src/`）とフロントエンド（`frontend/frontend/src/`）に対して、返信先（Reply-To）選択機能を段階的に実装する。

## タスク

- [x] 1. `jimu-staff` エンドポイントにメールアドレスを追加
  - `backend/src/routes/employees.ts` の `jimu-staff` エンドポイントのマッピングに `email: s.email || undefined` を追加する
  - メールアドレスが空欄（null / undefined / 空文字）のスタッフをレスポンスから除外する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ]* 1.1 プロパティテスト：jimu-staff レスポンスにメールアドレスが含まれる
    - **Property 1: jimu-staff レスポンスにメールアドレスが含まれる**
    - **Validates: Requirements 1.2, 1.4**
    - `fast-check` を使用し、任意のスタッフリストに対してメールアドレスが空でないスタッフには `email` フィールドが存在することを検証する

  - [ ]* 1.2 プロパティテスト：メールアドレスが空のスタッフは除外される
    - **Property 2: メールアドレスが空のスタッフは除外される**
    - **Validates: Requirements 1.3**
    - `fast-check` を使用し、任意のスタッフリストに対してメールアドレスが空欄のスタッフがレスポンスに含まれないことを検証する

- [x] 2. `EmailService.sendEmailWithCcAndAttachments` に `replyTo` パラメータを追加
  - `backend/src/services/EmailService.supabase.ts` のメソッドシグネチャに `replyTo?: string` を追加する
  - `replyTo` が指定された場合、MIMEメッセージの `From` ヘッダーの直後に `Reply-To: {replyTo}` ヘッダーを追加する
  - `replyTo` が空文字列または undefined の場合は Reply-To ヘッダーを追加しない
  - _Requirements: 3.3, 3.4, 3.5_

  - [ ]* 2.1 プロパティテスト：replyTo が指定された場合 Reply-To ヘッダーが設定される
    - **Property 3: replyTo が指定された場合 Reply-To ヘッダーが設定される**
    - **Validates: Requirements 3.3**
    - `fast-check` の `fc.emailAddress()` を使用し、任意の有効なメールアドレスを渡した場合に MIME メッセージに `Reply-To: {replyTo}` が含まれることを検証する

  - [ ]* 2.2 プロパティテスト：replyTo が未指定の場合 Reply-To ヘッダーが設定されない
    - **Property 4: replyTo が未指定の場合 Reply-To ヘッダーが設定されない**
    - **Validates: Requirements 3.4**
    - `fast-check` の `fc.constantFrom('', undefined, null)` を使用し、Reply-To ヘッダーが含まれないことを検証する

- [x] 3. `send-report-email` エンドポイントに `replyTo` パラメータを追加
  - `backend/src/routes/propertyListings.ts` の `send-report-email` エンドポイントで `req.body` から `replyTo` を取り出す
  - `sendEmailWithCcAndAttachments` および `sendTemplateEmail` を使用するパスの両方に `replyTo` を渡す
  - _Requirements: 3.1, 3.2_

  - [ ]* 3.1 プロパティテスト：replyTo パラメータがエンドポイントからサービスに伝達される
    - **Property 5: replyTo パラメータがエンドポイントからサービスに伝達される**
    - **Validates: Requirements 3.1, 3.2**
    - `fast-check` の `fc.emailAddress()` を使用し、任意の `replyTo` を含むリクエストに対して `sendEmailWithCcAndAttachments` が同じ `replyTo` 値で呼ばれることを検証する

- [x] 4. チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 5. フロントエンド：返信先選択 UI の追加
  - [x] 5.1 `GET /api/employees/jimu-staff` のレスポンス型に `email?: string` を追加する
    - `frontend/frontend/src/` 内の型定義（または API クライアント）を更新する
    - _Requirements: 2.1, 2.2_

  - [x] 5.2 メール送信確認ダイアログに返信先選択フィールドを追加する
    - `frontend/frontend/src/pages/PropertyReportPage.tsx` に `editReplyTo` 状態を追加する
    - ダイアログが開いたとき、`reportData.report_assignee` に対応するスタッフのメールアドレスをデフォルト値として設定する（対応するスタッフが存在しない場合は空文字列）
    - スタッフ一覧をドロップダウンで表示し、ラベルを「返信先（Reply-To）」とする
    - 未選択状態のプレースホルダーを「選択なし（送信元と同じ）」とする
    - 選択肢にはスタッフの氏名とメールアドレスを表示する
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 4.1, 4.2, 4.3, 4.4_

  - [x] 5.3 メール送信リクエストに `replyTo` フィールドを追加する
    - `POST /api/property-listings/:propertyNumber/send-report-email` のリクエストボディに `replyTo: editReplyTo` を含める
    - 返信先が未選択の場合は `replyTo` を送信しない（または空文字列を送信する）
    - _Requirements: 2.6, 3.1_

- [x] 6. 最終チェックポイント - 全テストが通ることを確認
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP では省略可能
- 各タスクは要件との対応が明記されている
- バックエンドの変更対象は `backend/src/` のみ（`backend/api/` は変更しない）
- プロパティテストには `fast-check` を使用する（既存プロジェクトで使用中）
