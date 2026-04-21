# 実装計画: 売主リスト近隣買主候補メール Reply-To 機能

## 概要

`EmailService.supabase.ts` の MIME メッセージ生成ロジックに Reply-To ヘッダーを追加し、
バックエンド API のバリデーション拡張、フロントエンドの `EmailConfirmationModal` への
スタッフ選択ドロップダウン追加、`NearbyBuyersList` の API リクエスト拡張を順に実装する。

## タスク

- [x] 1. バックエンド: EmailService に Reply-To ヘッダーを追加する
  - [x] 1.1 `sendDistributionEmail` のパラメータ型に `replyTo?: string` を追加する
    - `backend/src/services/EmailService.supabase.ts` の `sendDistributionEmail` メソッドのパラメータ型を拡張する
    - `replyTo` が未指定・空文字の場合は `tenant@ifoo-oita.com` をデフォルト値として使用する
    - _Requirements: 2.4, 2.5_
  - [x] 1.2 添付なし MIME メッセージに `Reply-To` ヘッダーを追加する
    - `messageParts` 配列の `To:` ヘッダーの直後に `Reply-To: ${effectiveReplyTo}` を追加する
    - _Requirements: 2.5_
  - [x] 1.3 添付あり MIME メッセージに `Reply-To` ヘッダーを追加する

    - multipart/mixed の `messageParts` 配列にも同様に `Reply-To: ${effectiveReplyTo}` を追加する
    - _Requirements: 2.5_
  - [ ]* 1.4 Property 1 のプロパティテストを書く（Reply-To ヘッダーの設定）
    - **Property 1: Reply-To ヘッダーの設定**
    - 任意の有効なメールアドレス文字列 `replyTo` に対して、生成される MIME メッセージに `Reply-To: {replyTo}` ヘッダーが含まれることを検証する
    - `fast-check` の `fc.emailAddress()` を使用し、numRuns: 100
    - **Validates: Requirements 2.3, 2.5**
  - [ ]* 1.5 Property 2 のプロパティテストを書く（replyTo 未指定時のデフォルト値適用）
    - **Property 2: replyTo 未指定時のデフォルト値適用**
    - `replyTo` が null・undefined・空文字列の場合、MIME メッセージに `Reply-To: tenant@ifoo-oita.com` が含まれることを検証する
    - `fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(''))` を使用し、numRuns: 100
    - **Validates: Requirements 2.4**

- [x] 2. バックエンド: `POST /api/emails/send-distribution` に `replyTo` バリデーションを追加する
  - [x] 2.1 `replyTo` フィールドのバリデーションルールを追加する
    - `backend/src/routes/emails.ts` の `send-distribution` エンドポイントに `body('replyTo').optional().isEmail()` バリデーションを追加する
    - _Requirements: 3.1, 3.2, 3.3_
  - [x] 2.2 `replyTo` を `req.body` から取り出して `sendDistributionEmail` に渡す
    - デストラクチャリングに `replyTo` を追加し、`sendDistributionEmail` 呼び出し時に `replyTo: replyTo || 'tenant@ifoo-oita.com'` を渡す
    - _Requirements: 2.3, 2.4_
  - [ ]* 2.3 Property 4 のプロパティテストを書く（無効なメールアドレスのバリデーション拒否）
    - **Property 4: 無効なメールアドレスのバリデーション拒否**
    - 無効なメールアドレス形式の文字列を `replyTo` として送信したとき、HTTP 400 が返されることを検証する
    - `fc.string().filter(s => s.length > 0 && !isValidEmail(s))` を使用し、numRuns: 100
    - **Validates: Requirements 3.1, 3.2**

- [x] 3. チェックポイント - バックエンドのテストがすべて通ることを確認する
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

- [x] 4. フロントエンド: `EmailConfirmationModal` に Reply-To ドロップダウンを追加する
  - [x] 4.1 `onConfirm` コールバックのシグネチャに `replyTo: string` を追加する
    - `frontend/frontend/src/components/EmailConfirmationModal.tsx` の `EmailConfirmationModalProps` インターフェースを拡張する
    - `onConfirm: (subject: string, body: string, attachments: ImageFile[], replyTo: string) => Promise<void>` に変更する
    - _Requirements: 4.1_
  - [x] 4.2 スタッフ一覧の状態と `replyTo` 状態を追加する
    - `employees`, `employeesLoading`, `replyTo` の state を追加する
    - `DEFAULT_REPLY_TO = 'tenant@ifoo-oita.com'` 定数を定義する
    - _Requirements: 1.2, 1.3_
  - [x] 4.3 モーダルが開かれたときにスタッフ一覧を取得する `useEffect` を実装する
    - `open === true` のとき `GET /api/employees/active` を呼び出してスタッフ一覧を取得する
    - 取得失敗時は `employees` を空配列にし、`replyTo` を `DEFAULT_REPLY_TO` にリセットする
    - _Requirements: 1.1, 1.5, 1.6_
  - [x] 4.4 Reply-To 選択ドロップダウン UI を追加する
    - MUI の `Select` コンポーネントを使用し、「デフォルト（tenant@ifoo-oita.com）」＋スタッフ全員の選択肢を表示する
    - `sending || employeesLoading` 中はドロップダウンを `disabled` にする
    - _Requirements: 1.1, 1.2_
  - [x] 4.5 `handleConfirm` で `replyTo` を `onConfirm` の第4引数として渡す
    - `replyTo.trim() || DEFAULT_REPLY_TO` を `effectiveReplyTo` として `onConfirm` に渡す
    - _Requirements: 1.4, 4.2_
  - [ ]* 4.6 Property 3 のプロパティテストを書く（onConfirm への replyTo 引数の受け渡し）
    - **Property 3: onConfirm への replyTo 引数の受け渡し**
    - 任意の有効なメールアドレスをドロップダウンで選択して `onConfirm` を呼び出したとき、第4引数にその選択値が渡されることを検証する
    - `fc.emailAddress()` を使用し、numRuns: 100
    - **Validates: Requirements 4.2**

- [x] 5. フロントエンド: `NearbyBuyersList` の `handleConfirmSendEmail` を拡張する
  - [x] 5.1 `handleConfirmSendEmail` のシグネチャに `replyTo: string` を追加する
    - `frontend/frontend/src/components/NearbyBuyersList.tsx` の `handleConfirmSendEmail` 関数のパラメータに `replyTo: string` を追加する
    - _Requirements: 4.3_
  - [x] 5.2 API リクエストボディに `replyTo` を追加する
    - `POST /api/emails/send-distribution` のリクエストボディに `replyTo` フィールドを追加する
    - _Requirements: 2.1, 2.2_

- [x] 6. 最終チェックポイント - すべてのテストが通ることを確認する
  - すべてのテストが通ることを確認し、疑問点があればユーザーに確認する。

## 備考

- `*` が付いたサブタスクはオプションであり、MVP では省略可能
- 各タスクは対応する要件番号を参照している
- プロパティテストは `fast-check` ライブラリを使用（既存プロジェクトで使用済み）
- バックエンドの変更（タスク1〜2）を先に実装し、フロントエンドの変更（タスク4〜5）を後に実装することで、API インターフェースを確定してから UI を実装できる
