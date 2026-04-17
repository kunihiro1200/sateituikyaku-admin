# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - メールアドレスあり・selectedPropertyIds空の場合にボタンがグレーアウトされるバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを表面化する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `selectedPropertyIds` が空の `Set`（`status === 'current'` の物件が0件）
    - `buyerEmail` が有効なメールアドレス（例: `test@example.com`）
    - `loading = false`
  - テスト対象: `BuyerGmailSendButton` コンポーネントをレンダリングし、ボタンが `disabled` でないことをアサート
  - 未修正コードで実行 → **EXPECTED OUTCOME**: テスト FAILS（`isDisabled = selectedCount === 0 || loading` が `true` になるため）
  - カウンターサンプルを記録: 「`selectedPropertyIds` が空の場合、ボタンが `disabled` になる（期待: `disabled={false}`）」
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 2.1_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バグ条件が成立しない入力での既存動作の保全
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで以下の動作を観察・記録する:
    - `selectedPropertyIds` に物件IDが1件以上ある場合 → ボタンが有効化される
    - `loading = true` の場合 → ボタンが無効化される
    - `selectedPropertyIds` が空の状態でボタンをクリック → 「物件を選択してください」が表示される
    - `inquiryHistory` が空配列の場合 → コンポーネントが `null` を返す
  - 観察した動作をプロパティベーステストとして記述:
    - `selectedPropertyIds` に1件以上の物件IDがある場合（`isBugCondition` が `false`）、修正前後でボタンの状態が一致する
    - `loading = true` の場合、修正前後でボタンが無効化される
  - 未修正コードでテストを実行
  - **EXPECTED OUTCOME**: テスト PASSES（ベースライン動作を確認）
  - テストを作成・実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. `isDisabled` 条件の修正

  - [x] 3.1 `BuyerGmailSendButton.tsx` の `isDisabled` を修正する
    - `frontend/frontend/src/components/BuyerGmailSendButton.tsx` を編集
    - 約65行目付近の `isDisabled` 定義を以下のように変更（1行のみ変更）:
      ```typescript
      // 修正前
      const isDisabled = selectedCount === 0 || loading;

      // 修正後
      const isDisabled = loading;
      ```
    - `handleClick` 内の物件未選択チェックロジックは変更しない（既存動作を維持）
    - _Bug_Condition: `isBugCondition(buyer, inquiryHistory)` — `hasEmail AND hasHistory AND NOT hasCurrentItems`_
    - _Expected_Behavior: `loading = false` の場合、`selectedPropertyIds` の状態に関わらず `isDisabled = false`_
    - _Preservation: `loading = true` の場合は引き続き `isDisabled = true`。`handleClick` 内の「物件を選択してください」エラーは変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - メールアドレスあり・selectedPropertyIds空でもボタンが有効化される
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、バグが修正されたことを確認する
    - **EXPECTED OUTCOME**: テスト PASSES（バグ修正を確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存動作が維持されている
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションなしを確認）
    - 全テストが PASS することを確認する

- [x] 4. フロントエンドをデプロイする
  - `frontend/frontend` ディレクトリでVercelフロントエンドをデプロイする
  - デプロイコマンド（`frontend/frontend` ディレクトリで実行）:
    ```bash
    vercel --prod
    ```
  - または `.vercel-frontend` の設定を使用してデプロイ
  - デプロイ完了後、本番環境（`https://sateituikyaku-admin-frontend.vercel.app`）で動作確認する
  - 買主7359相当のデータ（メールアドレスあり、`status === 'current'` の物件0件）でGmail送信ボタンがクリック可能であることを確認する

- [x] 5. チェックポイント — 全テストが PASS していることを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
  - 本番環境での動作確認が完了していることを確認する。
