# 要件ドキュメント

## はじめに

売主リストの近隣買主候補メール送信機能において、Reply-Toヘッダーを追加する。
担当スタッフのメールアドレスを返信先として設定できるようにし、買主からの返信が担当者に直接届くようにする。
未選択の場合はデフォルト値 `tenant@ifoo-oita.com` を返信先として設定する。

## 用語集

- **EmailConfirmationModal**: 近隣買主候補メール送信前の確認モーダルコンポーネント（`frontend/frontend/src/components/EmailConfirmationModal.tsx`）
- **NearbyBuyersList**: 売主リストの近隣買主候補を表示するコンポーネント（`frontend/frontend/src/components/NearbyBuyersList.tsx`）
- **Reply-To**: メールヘッダーの一種。受信者が「返信」ボタンを押した際の宛先を指定する
- **ReplyTo_Address**: Reply-Toヘッダーに設定するメールアドレス
- **Default_ReplyTo**: 未選択時のデフォルト返信先アドレス（`tenant@ifoo-oita.com`）
- **Employee**: 従業員（スタッフ）。`employees` テーブルで管理される
- **send-distribution エンドポイント**: `POST /api/emails/send-distribution`。近隣買主候補へのメール一括送信を行うバックエンドAPI
- **EmailService**: バックエンドのメール送信サービス（`backend/src/services/EmailService.supabase.ts`）

## 要件

### 要件1: メール送信確認モーダルへのReply-To選択UIの追加

**ユーザーストーリー:** 担当者として、近隣買主候補へのメール送信時に返信先（Reply-To）を選択できることを望む。これにより、買主からの返信が担当者のメールアドレスに直接届くようになる。

#### 受け入れ基準

1. WHEN メール送信確認モーダルが開かれる, THE EmailConfirmationModal SHALL スタッフ全員のメールアドレスを選択肢として含むドロップダウンを表示する。

2. WHEN メール送信確認モーダルが開かれる, THE EmailConfirmationModal SHALL ドロップダウンの初期値として `tenant@ifoo-oita.com`（Default_ReplyTo）を設定する。

3. WHEN ドロップダウンで特定のスタッフのメールアドレスが選択される, THE EmailConfirmationModal SHALL 選択されたメールアドレスを ReplyTo_Address として保持する。

4. WHEN ドロップダウンで「未選択」または空欄が選択される, THE EmailConfirmationModal SHALL ReplyTo_Address として Default_ReplyTo（`tenant@ifoo-oita.com`）を使用する。

5. THE EmailConfirmationModal SHALL スタッフ一覧を `GET /api/employees/active` エンドポイントから取得する。

6. IF スタッフ一覧の取得に失敗した場合, THEN THE EmailConfirmationModal SHALL Default_ReplyTo（`tenant@ifoo-oita.com`）のみを選択肢として表示する。

---

### 要件2: メール送信時のReply-Toヘッダー設定

**ユーザーストーリー:** システムとして、近隣買主候補へのメール送信時に選択されたReply-Toアドレスがメールヘッダーに設定されることを望む。これにより、買主が返信した際に正しい担当者へ届く。

#### 受け入れ基準

1. WHEN メール送信が確定される, THE NearbyBuyersList SHALL 選択された ReplyTo_Address を `POST /api/emails/send-distribution` リクエストボディの `replyTo` フィールドに含める。

2. WHEN `replyTo` フィールドが指定されない場合, THE NearbyBuyersList SHALL `replyTo` フィールドに Default_ReplyTo（`tenant@ifoo-oita.com`）を設定して送信する。

3. WHEN `POST /api/emails/send-distribution` が `replyTo` フィールドを受け取る, THE send-distribution エンドポイント SHALL そのアドレスをメール送信時の Reply-To ヘッダーに設定する。

4. WHEN `replyTo` フィールドが空または未指定の場合, THE send-distribution エンドポイント SHALL Default_ReplyTo（`tenant@ifoo-oita.com`）を Reply-To ヘッダーに設定する。

5. WHEN Reply-To ヘッダーが設定される, THE EmailService SHALL 送信されるメールの `Reply-To` ヘッダーに指定されたアドレスを含める。

---

### 要件3: バックエンドAPIのバリデーション拡張

**ユーザーストーリー:** システムとして、`send-distribution` エンドポイントが `replyTo` フィールドを正しく検証することを望む。これにより、不正なメールアドレスがReply-Toに設定されることを防ぐ。

#### 受け入れ基準

1. WHEN `POST /api/emails/send-distribution` が呼び出される, THE send-distribution エンドポイント SHALL `replyTo` フィールドが存在する場合、有効なメールアドレス形式であることを検証する。

2. IF `replyTo` フィールドが無効なメールアドレス形式の場合, THEN THE send-distribution エンドポイント SHALL HTTP 400 ステータスコードとエラーメッセージを返す。

3. WHEN `replyTo` フィールドが省略される, THE send-distribution エンドポイント SHALL バリデーションエラーを発生させずにリクエストを処理する。

---

### 要件4: EmailConfirmationModalのインターフェース拡張

**ユーザーストーリー:** システムとして、`EmailConfirmationModal` が `replyTo` の選択結果を親コンポーネントに渡せることを望む。

#### 受け入れ基準

1. THE EmailConfirmationModal SHALL `onConfirm` コールバックの引数に `replyTo: string` を追加する。

2. WHEN `onConfirm` が呼び出される, THE EmailConfirmationModal SHALL 選択された ReplyTo_Address（未選択時は Default_ReplyTo）を `replyTo` 引数として渡す。

3. THE NearbyBuyersList SHALL `handleConfirmSendEmail` 関数のシグネチャに `replyTo: string` パラメータを追加する。
