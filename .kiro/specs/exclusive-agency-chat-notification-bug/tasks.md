# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 専任媒介通知がGoogle Chatに届かないバグ
  - **重要**: このテストは修正前のコードで必ず**失敗**すること（失敗がバグの存在を証明する）
  - **修正前にテストが失敗しても、コードを修正しないこと**
  - **目的**: バグが存在することを示すカウンターサンプルを発見する
  - **スコープ限定PBTアプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.mdのBug Conditionより）:
    - 条件1: バックエンドのルートが `/chat-notifications` で登録されているとき、`POST /api/chat-notifications/exclusive-contract/:sellerId` へのリクエストが正しいルートハンドラに到達しないことを確認
    - 条件2: `GOOGLE_CHAT_WEBHOOK_URL` が空の状態で `sendToGoogleChat()` を呼び出したとき、エラーをスローせず `false` を返すことを確認
  - テストアサーション（design.mdのExpected Behaviorより）:
    - 修正後は `/api/chat-notifications/exclusive-contract/:sellerId` が正しく200を返すこと
    - 修正後は `GOOGLE_CHAT_WEBHOOK_URL` 未設定時にエラーがスローされること
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**失敗**する（バグの存在を確認）
  - 発見したカウンターサンプルを記録して根本原因を理解する
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バグ条件に該当しない既存動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ入力（`isBugCondition` が false を返すケース）の動作を観察する
  - 観察内容（design.mdのPreservation Requirementsより）:
    - 必須フィールド未入力時のバリデーションエラーが正しく返されることを確認
    - 4つのフィールド（status、exclusiveDecisionDate、competitors、exclusiveOtherDecisionFactors）のDB保存処理が正しく動作することを確認
    - 一般媒介・訪問後他決・未訪問他決の各エンドポイントが正しく動作することを確認
  - 観察した動作パターンをキャプチャするプロパティベーステストを作成する
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**成功**する（保全すべきベースライン動作を確認）
  - テストを作成・実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 専任媒介チャット通知バグの修正

  - [x] 3.1 ルート登録パスを修正する
    - `backend/src/index.ts` の `/chat-notifications` を `/api/chat-notifications` に変更する
    - 変更前: `app.use('/chat-notifications', chatNotificationRoutes);`
    - 変更後: `app.use('/api/chat-notifications', chatNotificationRoutes);`
    - _Bug_Condition: isBugCondition(request) where backendRoute REGISTERED_AS '/chat-notifications' AND request.path STARTS_WITH '/api/chat-notifications'_
    - _Expected_Behavior: POST /api/chat-notifications/exclusive-contract/:sellerId が正しいルートハンドラに到達し、200を返す_
    - _Preservation: バリデーションエラー表示・DB保存処理・他エンドポイントは変更しない_
    - _Requirements: 2.3, 3.4_

  - [x] 3.2 環境変数未設定時のエラースローを実装する
    - `backend/src/services/ChatNotificationService.ts` の `sendToGoogleChat()` を修正する
    - 変更前: `console.warn('Google Chat webhook URL not configured'); return false;`
    - 変更後: `throw new Error('Google Chat webhook URL is not configured (GOOGLE_CHAT_WEBHOOK_URL)');`
    - _Bug_Condition: isBugCondition(request) where process.env.GOOGLE_CHAT_WEBHOOK_URL IS EMPTY AND sendToGoogleChat RETURNS false WITHOUT THROWING_
    - _Expected_Behavior: GOOGLE_CHAT_WEBHOOK_URL 未設定時にエラーをスローし、フロントエンドにエラーレスポンスが返される_
    - _Preservation: GOOGLE_CHAT_WEBHOOK_URL 設定済みの場合の動作は変更しない_
    - _Requirements: 2.2, 2.4_

  - [x] 3.3 ローカル環境変数を設定する
    - `backend/.env` に `GOOGLE_CHAT_WEBHOOK_URL` を追加する
    - 値: `https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=kJGiIgrKmgd1vJCwr805DdVX_1l0IUcGx4JnJPHIK-8`
    - _Requirements: 2.1_

  - [x] 3.4 Vercel環境変数を設定する
    - Vercelの `sateituikyaku-admin-backend` プロジェクトに `GOOGLE_CHAT_WEBHOOK_URL` を追加する
    - 値: `https://chat.googleapis.com/v1/spaces/AAAAEz1pOnw/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=kJGiIgrKmgd1vJCwr805DdVX_1l0IUcGx4JnJPHIK-8`
    - Vercelダッシュボードから手動で設定し、再デプロイする
    - _Requirements: 2.1_

  - [x] 3.5 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - 専任媒介通知がGoogle Chatに届く
    - **重要**: タスク1で作成した**同じテスト**を再実行すること（新しいテストを書かない）
    - タスク1のテストはExpected Behaviorをエンコードしている
    - このテストが成功すれば、期待される動作が満たされたことを確認できる
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - 既存動作が変更されていない
    - **重要**: タスク2で作成した**同じテスト**を再実行すること（新しいテストを書かない）
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認）
    - バリデーションエラー・DB保存・他エンドポイントが引き続き正しく動作することを確認する

- [x] 4. チェックポイント - 全テストの成功を確認する
  - 全テストが成功していることを確認する。疑問点があればユーザーに確認すること。
