# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 専任媒介通知が誤って他決Chat URLに送信される
  - **重要**: このテストは未修正コードで**必ず失敗する** — 失敗がバグの存在を証明する
  - **修正前にテストを実行してもコードを修正しないこと**
  - **目的**: バグが存在することを示す反例（counterexample）を発見する
  - **スコープ**: `sendExclusiveContractNotification()` を呼び出したとき `axios.post` が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` ではなく `GOOGLE_CHAT_WEBHOOK_URL` で呼ばれる具体的なケースに絞る
  - テスト内容（design.md の Bug Condition より）:
    - `ChatNotificationService` をインスタンス化し、`GOOGLE_CHAT_WEBHOOK_URL` と `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` を別々の値でモック環境変数に設定する
    - `sendExclusiveContractNotification()` を呼び出す
    - `axios.post` が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` で呼ばれたことを検証する（未修正コードではこの検証が失敗する）
  - プロパティベーステスト: 任意の売主IDとデータで `sendExclusiveContractNotification()` を呼び出したとき、常に `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` が使われることを検証
  - テストを未修正コードで実行する
  - **期待される結果**: テストが**失敗**する（バグの存在を確認）
  - 発見した反例を記録する（例: 「`axios.post` の呼び出しURLが `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` ではなく `GOOGLE_CHAT_WEBHOOK_URL` になっている」）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 他決・一般媒介通知が引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用する
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`sendExclusiveContractNotification` 以外のメソッド呼び出し）の動作を観察する:
    - 観察1: `sendGeneralContractNotification()` を呼び出す → `axios.post` が `GOOGLE_CHAT_WEBHOOK_URL` で呼ばれる
    - 観察2: `sendPostVisitOtherDecisionNotification()` を呼び出す → `axios.post` が `GOOGLE_CHAT_WEBHOOK_URL` で呼ばれる
    - 観察3: `sendPreVisitOtherDecisionNotification()` を呼び出す → `axios.post` が `GOOGLE_CHAT_WEBHOOK_URL` で呼ばれる
    - 観察4: `sendPropertyIntroductionNotification()` を呼び出す → `axios.post` が `GOOGLE_CHAT_WEBHOOK_URL` で呼ばれる
  - プロパティベーステスト: 上記4メソッドそれぞれについて、任意の入力で呼び出したとき常に `GOOGLE_CHAT_WEBHOOK_URL` が使われることを検証
  - 保全要件（design.md の Preservation Requirements より）:
    - `sendGeneralContractNotification()` は `GOOGLE_CHAT_WEBHOOK_URL` を使用する（要件 3.1）
    - `sendPostVisitOtherDecisionNotification()` は `GOOGLE_CHAT_WEBHOOK_URL` を使用する（要件 3.2）
    - `sendPreVisitOtherDecisionNotification()` は `GOOGLE_CHAT_WEBHOOK_URL` を使用する（要件 3.2）
    - `sendPropertyIntroductionNotification()` は `GOOGLE_CHAT_WEBHOOK_URL` を使用する（要件 3.1）
    - 専任媒介通知の送信成功・失敗時のメッセージ表示は変わらない（要件 3.3, 3.4）
    - バリデーションエラーの動作は変わらない（要件 3.5）
  - テストを未修正コードで実行する
  - **期待される結果**: テストが**成功**する（保全すべきベースライン動作を確認）
  - テストを作成・実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 専任媒介通知Chat URL バグを修正する

  - [x] 3.1 修正を実装する
    - `backend/src/services/ChatNotificationService.ts` を修正する
    - `private exclusiveWebhookUrl: string` フィールドを追加する
    - コンストラクタで `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` 環境変数から読み込む
    - `sendToGoogleChat(message: string, webhookUrl?: string)` にオプション引数を追加する
    - 引数が渡された場合はそのURLを、渡されない場合は `this.webhookUrl` を使用するよう変更する
    - `sendExclusiveContractNotification()` の `sendToGoogleChat(message)` 呼び出しを `sendToGoogleChat(message, this.exclusiveWebhookUrl)` に変更する
    - 変更前:
      ```typescript
      constructor() {
        this.webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL || '';
      }

      private async sendToGoogleChat(message: string): Promise<boolean> {
        // this.webhookUrl を使用
      }

      async sendExclusiveContractNotification(...) {
        return await this.sendToGoogleChat(message);
      }
      ```
    - 変更後:
      ```typescript
      constructor() {
        this.webhookUrl = process.env.GOOGLE_CHAT_WEBHOOK_URL || '';
        this.exclusiveWebhookUrl = process.env.GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL || '';
      }

      private async sendToGoogleChat(message: string, webhookUrl?: string): Promise<boolean> {
        const url = webhookUrl || this.webhookUrl;
        // url を使用
      }

      async sendExclusiveContractNotification(...) {
        return await this.sendToGoogleChat(message, this.exclusiveWebhookUrl);
      }
      ```
    - Vercel の `sateituikyaku-admin-backend` プロジェクトに環境変数 `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` を追加し、専任媒介Chat Space（`AAAAEz1pOnw`）のURLを設定する
    - _Bug_Condition: `sendExclusiveContractNotification()` が呼び出されたとき、`GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` ではなく `GOOGLE_CHAT_WEBHOOK_URL` を使用している状態（design.md の isBugCondition より）_
    - _Expected_Behavior: 修正後は `sendExclusiveContractNotification()` が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` のエンドポイントにHTTP POSTを送信し、選任媒介Chat Space（`AAAAEz1pOnw`）にメッセージが届く（design.md の Property 1 より）_
    - _Preservation: `sendExclusiveContractNotification()` 以外の全メソッドは引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用し、同じChat Spaceに同じメッセージを送信する（design.md の Preservation Requirements より）_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - 専任媒介通知が `GOOGLE_CHAT_EXCLUSIVE_WEBHOOK_URL` に送信される
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストが成功すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - 他決・一般媒介通知が引き続き `GOOGLE_CHAT_WEBHOOK_URL` を使用する
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認）
    - 修正後も全ての保全要件が満たされていることを確認する

- [x] 4. チェックポイント — 全テストが成功することを確認する
  - タスク1のバグ条件探索テスト（修正後は成功するはず）を実行する
  - タスク2の保全プロパティテストを実行する
  - 全テストが成功することを確認する
  - 疑問点があればユーザーに確認する
