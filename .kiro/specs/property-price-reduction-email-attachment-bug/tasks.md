# 実装計画

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 画像添付メール送信バグ
  - **重要**: このプロパティベーステストは修正前のコードで実行すること
  - **目標**: バグが存在することを示す反例を発見する
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT**: テストが失敗しても、テストやコードを修正しようとしないこと
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **スコープ**: `selectedImages.length > 0` かつ `sendAction = 'confirm'` の具体的なケースにスコープを絞る
  - テスト内容（design.md の Bug Condition より）:
    - `GmailDistributionButton` の `handleConfirmationConfirm` を `selectedImages` に1枚以上の画像を設定して実行
    - `gmailDistributionService.sendEmailsDirectly` の呼び出し引数に `attachments` が含まれていないことを確認（未修正コードで FAIL）
    - `sendEmailsDirectly` が `attachments` パラメータを受け取らないことを確認（未修正コードで FAIL）
    - バックエンドの `send-distribution-emails` エンドポイントが `req.body.attachments` を無視することを確認（未修正コードで FAIL）
  - **期待される反例**: `sendEmailsDirectly` の呼び出し引数に `attachments` が含まれない
  - **期待される結果**: テスト FAIL（これが正しい — バグの存在を証明する）
  - テストが書かれ、実行され、失敗が記録されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 画像なし送信の既存動作保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ入力（`selectedImages.length = 0`）の動作を観察する:
    - `selectedImages` が空配列の場合、`sendEmailsDirectly` が `attachments` なしで呼び出されることを観察
    - 複数受信者への個別送信が正常に動作することを観察
    - `activity_logs` への記録が行われることを観察
    - API 失敗時の Gmail Web UI フォールバックが動作することを観察
  - 観察した動作をプロパティベーステストとして記述（design.md の Preservation Requirements より）:
    - 任意の非バグ入力（`selectedImages.length = 0`）に対して、修正前後で同じ動作をすること
    - 複数受信者（1〜10人）に対して、各受信者に個別にメールが送信されること
    - `{buyerName}` プレースホルダーが正しく置換されること
  - 未修正コードでテストを実行して PASS することを確認する
  - **期待される結果**: テスト PASS（これが正しい — 保全すべきベースライン動作を確認する）
  - テストが書かれ、実行され、未修正コードで PASS することが確認されたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 画像添付メール送信バグの修正

  - [x] 3.1 フロントエンド（コンポーネント層）の修正: `GmailDistributionButton.tsx`
    - `handleConfirmationConfirm` 内で `selectedImages` を `attachments` 形式に変換する
    - `gmailDistributionService.sendEmailsDirectly(...)` の呼び出しに `attachments` を追加する
    - 変換形式: `{ id, name, mimeType, base64Data?, driveFileId?, url? }`
    - _Bug_Condition: `input.selectedImages.length > 0 AND input.sendAction = 'confirm'` (design.md Bug Condition より)_
    - _Expected_Behavior: 選択された全ての画像が `sendEmailsDirectly` に渡され、メールに添付されること (design.md Expected Behavior より)_
    - _Preservation: `selectedImages.length = 0` の場合は従来通り `attachments` なしで送信されること (design.md Preservation Requirements より)_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 フロントエンド（サービス層）の修正: `gmailDistributionService.ts`
    - `sendEmailsDirectly` メソッドシグネチャに `attachments?: Array<{...}>` パラメータを追加する
    - `api.post(...)` の JSON ボディに `attachments` を追加する（`multipart/form-data` への変更は不要）
    - `attachments` が空または未指定の場合は `undefined` を送信する
    - _Bug_Condition: `sendEmailsDirectly` が `attachments` パラメータを受け取らない (design.md Bug Condition より)_
    - _Expected_Behavior: `attachments` が JSON ボディに含まれてバックエンドに送信されること (design.md Expected Behavior より)_
    - _Preservation: `attachments` が未指定の場合は既存の JSON ボディのみで送信されること (design.md Preservation Requirements より)_
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 バックエンド（エンドポイント層）の修正: `backend/src/routes/propertyListings.ts`
    - `const { ..., attachments } = req.body;` に `attachments` を追加する
    - `attachments` がある場合は `sendEmailWithCcAndAttachments` を使用する処理を追加する
    - `attachments` がない場合は既存の `sendTemplateEmail` フローを維持する
    - `driveFileId` がある場合は `GoogleDriveService.getFile()` でデータを取得する
    - `base64Data` がある場合は `Buffer.from(img.base64Data, 'base64')` で変換する
    - `send-template-email` エンドポイント（`emails.ts`）の添付ファイル処理パターンを参考にする
    - _Bug_Condition: `req.body.attachments` が無視されて `sendTemplateEmail` のみが呼び出される (design.md Bug Condition より)_
    - _Expected_Behavior: `attachments` がある場合は `sendEmailWithCcAndAttachments` が呼び出され、画像が添付されること (design.md Expected Behavior より)_
    - _Preservation: `attachments` がない場合は既存の `sendTemplateEmail` フローが変わらず動作すること (design.md Preservation Requirements より)_
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.4 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 画像添付メール送信バグ
    - **重要**: タスク1で書いた同じテストを再実行すること — 新しいテストを書かないこと
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 画像なし送信の既存動作保全
    - **重要**: タスク2で書いた同じテストを再実行すること — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認する）
    - 全ての保全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストの PASS を確認する
  - 全てのテストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
