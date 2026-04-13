# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 内覧前日メール送信後に「業者」が保存されるバグ
  - **重要**: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
  - **修正を試みないこと**: テストが失敗しても、コードやテストを修正しない
  - **注意**: このテストは期待される動作をエンコードしており、修正後に PASS することで修正を検証する
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `getInitialsByEmail(tomokoのメールアドレス)` が「業者」を返すことを確認
    - スプシに「業者」行が存在し、そのE列にtomokoのメールが入っているケースをモックで再現
  - テストは `StaffManagementService.getInitialsByEmail` をモックしてスプシデータを制御する
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（バグが存在することを証明）
  - 見つかった反例を記録する（例: `getInitialsByEmail('tomoko@example.com')` が「業者」を返す）
  - タスク完了条件: テストを書き、実行し、失敗を記録したとき
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 手動操作・他フィールド更新の動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`isBugCondition` が false のケース）の動作を観察する
    - 手動で通知送信者ボタンをクリックした場合の動作を観察
    - 内覧日・内覧結果・フォローアップ担当の更新が `notification_sender` に影響しないことを観察
    - `/api/employees/normal-initials` エンドポイントの動作を観察
    - `notification_sender` 入力済み買主の「内覧日前日」除外判定を観察
  - 観察した動作パターンをキャプチャするプロパティベーステストを書く
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（保全すべきベースライン動作を確認）
  - タスク完了条件: テストを書き、実行し、未修正コードで PASS を確認したとき
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 内覧前日メール送信後の通知送信者バグを修正する

  - [x] 3.1 修正を実装する
    - `backend/src/services/StaffManagementService.ts` の `getInitialsByEmail` を修正する
    - `matched['スタッフID'] || matched['イニシャル']` を `fetchStaffData` と同じロジックに統一する
    - 推奨: `fetchStaffData` のキャッシュを活用してメールで検索する方式に変更し、`GoogleSheetsClient` の直接使用をやめる
    - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` の `onEmailSent` コールバックを修正する
    - `(employee as any)?.initial` を `employee?.initials` に修正する（`Employee` 型の正しいフィールド名は `initials`）
    - `initials-by-email` が `null` を返した場合でも `employee?.initials` をフォールバックとして使用できるようにする
    - `backend/src/routes/employees.ts` の `GET /initials-by-email` にエラーハンドリングのログを追加する
    - _Bug_Condition: isBugCondition(input) where input.action === 'sendPreDayEmail' AND initialsFromEndpoint(input.userEmail) === '業者'_
    - _Expected_Behavior: notification_sender(result) !== '業者' AND notification_sender(result) === correctInitials(input.userEmail)_
    - _Preservation: 手動ボタンクリック・他フィールド更新・他エンドポイントの動作が変わらないこと_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 内覧前日メール送信後に正しいイニシャルが保存される
    - **重要**: タスク1で書いた同じテストを再実行すること（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 手動操作・他フィールド更新の動作保持
    - **重要**: タスク2で書いた同じテストを再実行すること（新しいテストを書かない）
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント - 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
