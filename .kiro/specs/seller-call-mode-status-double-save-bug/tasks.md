# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - ステータス保存後のstatusChangedフラグ再設定バグ
  - **重要**: このテストは修正前のコードで実行し、**失敗することを確認する**（失敗 = バグの存在を証明）
  - **修正を試みないこと** - テストが失敗しても、コードを修正しない
  - **目的**: バグが存在することを示す反例（counterexample）を発見する
  - **スコープ**: キャッシュヒット状態（`pageDataCache` に売主データが存在する状態）でページをロードし、ステータスフィールドを変更して「ステータスを更新」ボタンを1回押した後、`statusChanged` が `false` のまま維持されることを検証する
  - テスト対象ファイル: `frontend/frontend/src/pages/CallModePage.tsx`
  - バグ条件（isBugCondition）: `pageDataCache` にデータが存在する状態で `handleUpdateStatus` を呼び出し、APIが成功した後に `statusChanged` が再び `true` になる
  - 期待される動作（expectedBehavior）: `handleUpdateStatus` 成功後、`statusChanged` が `false` のまま維持される
  - 未修正コードで実行 → **失敗が期待される結果**（バグの存在を確認）
  - 反例を記録する（例: 「`handleUpdateStatus` 後に `statusChanged` が `true` に戻った」）
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バックグラウンド更新によるstatusChangedへの非干渉
  - **重要**: 観察優先メソドロジーに従うこと
  - 観察: 未修正コードで非バグ条件（キャッシュなし・直接URLアクセス）の動作を確認する
  - 観察1: ユーザーがフィールドを変更すると `statusChanged` が `true` になる
  - 観察2: ページ初回ロード時（キャッシュなし）に `statusChanged` が `false` に初期化される
  - 観察3: `setSeller(freshData)` が呼ばれても `statusChanged` は変化しない（修正後の期待動作）
  - プロパティベーステスト: キャッシュなし状態での全ステータス値（追客中、訪問済み、専任、他決等）で `handleUpdateStatus` を呼び出し、常に `statusChanged=false` になることを検証
  - 未修正コードで実行 → **成功が期待される結果**（ベースライン動作の確認）
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. ステータス2回保存バグの修正

  - [x] 3.1 `handleSaveCallMemo` 内の `await loadAllData()` を削除する
    - `frontend/frontend/src/pages/CallModePage.tsx` の `handleSaveCallMemo` 関数を修正
    - `await loadAllData()` の呼び出しを削除する
    - コメント保存後に必要な状態（`editableComments`、`savedComments`）は既に更新済みのため、`loadAllData()` は不要
    - これにより、コメント保存後にキャッシュヒットが発生してバックグラウンド更新が走ることを防ぐ
    - _Bug_Condition: `handleSaveCallMemo` 内の `await loadAllData()` がキャッシュヒットし、バックグラウンド更新で `setSeller(freshData)` が呼ばれる_
    - _Expected_Behavior: `handleUpdateStatus` 成功後、`statusChanged` が `false` のまま維持される_
    - _Preservation: ステータスセクション以外の操作（コメント保存等）は影響を受けない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 キャッシュヒット時のバックグラウンド更新で `statusChanged` を保護する
    - `frontend/frontend/src/pages/CallModePage.tsx` のキャッシュヒット時バックグラウンド更新処理（`setSeller(freshData)` を呼ぶ箇所）を修正
    - `statusChanged` が `true` の場合（ユーザーが編集中）は `setEditedStatus`、`setEditedConfidence`、`setEditedNextCallDate`、`setEditedPinrichStatus` を呼ばない
    - `statusChanged` が `false` の場合のみ、ステータスフィールドを最新データで上書きする
    - `useRef` を使って `statusChanged` の最新値をバックグラウンド更新のクロージャ内から参照できるようにする
    - _Bug_Condition: キャッシュヒット時のバックグラウンド更新で `setSeller(freshData)` のみが呼ばれ、`setEditedStatus` 等が呼ばれないため `seller.status` と `editedStatus` が乖離する_
    - _Expected_Behavior: バックグラウンド更新後も `statusChanged` フラグが変化しない_
    - _Preservation: `setSeller(freshData)` は引き続き呼ばれ、売主データは更新される_
    - _Requirements: 2.1, 2.2, 3.6_

  - [x] 3.3 バグ条件の探索テスト（タスク1）が修正後に成功することを確認する
    - **Property 1: Expected Behavior** - ステータス保存後のstatusChangedフラグ維持
    - **重要**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すれば、バグが修正されたことを確認できる
    - 修正後のコードで実行 → **成功が期待される結果**（バグ修正の確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全プロパティテスト（タスク2）が修正後も成功することを確認する
    - **Property 2: Preservation** - バックグラウンド更新によるstatusChangedへの非干渉
    - **重要**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - 修正後のコードで実行 → **成功が期待される結果**（リグレッションなしの確認）
    - 全ての保全テストが成功することを確認する

- [x] 4. フロントエンドのデプロイ
  - フロントエンドのみデプロイする（バックエンド変更なし）
  - デプロイ対象: `frontend/frontend/` （Vercelプロジェクト: `sateituikyaku-admin-frontend`）
  - デプロイコマンド: `frontend/frontend/` ディレクトリで `vercel --prod` を実行
  - または `.vercel-frontend/` の設定を使用してデプロイ
  - デプロイ後、本番環境で以下を確認する:
    - 一覧ページから通話モードページに遷移（キャッシュヒット）し、ステータスを変更して1回保存するフローが正常に動作すること
    - 直接URLアクセス（キャッシュなし）でステータスを変更して1回保存するフローが正常に動作すること
    - コメント保存後にステータスを変更して1回保存するフローが正常に動作すること

- [x] 5. チェックポイント - 全テストの成功確認
  - タスク1のバグ条件テストが成功していることを確認する
  - タスク2の保全プロパティテストが成功していることを確認する
  - 本番環境での動作確認が完了していることを確認する
  - 不明点があればユーザーに確認する
