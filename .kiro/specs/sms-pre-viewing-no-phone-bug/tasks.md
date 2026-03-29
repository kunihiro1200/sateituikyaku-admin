# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 電話番号があるのにSMSボタンが表示されないバグ
  - **重要**: このテストは未修正コードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正を試みないこと** — テストまたはコードが失敗しても修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 実装後に PASS することで修正を検証する
  - **目標**: バグが存在することを示す反例を発見する
  - **スコープ付き PBT アプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テストファイル: `frontend/frontend/src/__tests__/SmsPreViewingNoPhoneBug.property.test.ts`
  - 探索テスト1: `buyer.phone_number = '090-1234-5678'`、`buyer.email = 'test@example.com'` → SMSボタン表示条件 `!buyer.email && buyer.phone_number` が false になりSMSボタンが表示されないことを確認（design.md の Bug Condition より）
  - 探索テスト2: `buyer.phone_number = '090-1234-5678'`、`buyer.email = null` → 現在の条件では表示されるが、修正後の条件 `buyer.phone_number` でも表示されることを確認
  - 未修正コードでテストを実行する（表示条件ロジックを抽出した純粋関数でテスト）
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見された反例を記録して根本原因を理解する（例: `phone_number='090-1234-5678', email='test@example.com'` でSMSボタンが非表示）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 電話番号がない場合・内覧前日でない場合の既存動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ入力の動作を観察する
  - 観察1: `buyer.phone_number = null`、`buyer.email = null` → SMSボタンが表示されないことを確認（送信手段なし）
  - 観察2: `buyer.phone_number = null`、`buyer.email = 'test@example.com'` → SMSボタンが表示されず、Eメールボタンのみ表示されることを確認
  - 観察3: `buyer.email = 'test@example.com'` → Eメールボタンが表示されることを確認（email条件は変更しない）
  - 観察4: `broker_inquiry = '業者問合せ'` → ボタン群が表示されないことを確認
  - 観察5: `notification_sender` が入力済み → ボタン群が表示されないことを確認
  - 観察されたパターンを捉えるプロパティベーステストを作成する（design.md の Preservation Requirements より）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これが保持すべきベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードで PASS したらタスク完了とする
  - _Requirements: 2.1, 2.4, 3.1, 3.2, 3.3, 3.4_

- [x] 3. SMSボタン表示条件のバグを修正する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` のSMSボタン表示条件を変更する
    - 変更前: `{!buyer.email && buyer.phone_number && (() => {`
    - 変更後: `{buyer.phone_number && (() => {`
    - コメントも合わせて修正する（変更前: `{/* メアドがない場合（または電話番号がある場合）はSMSボタン */}`、変更後: `{/* 電話番号がある場合はSMSボタン */}`）
    - 変更箇所は1行のみ — Eメールボタンの表示条件（`buyer.email`）は変更しない
    - _Bug_Condition: isBugCondition(buyer) where buyer.phone_number IS NOT NULL AND smsButtonIsNotDisplayed(buyer)_
    - _Expected_Behavior: buyer.phone_number が存在する場合、buyer.email の有無に関わらずSMSボタンを表示する_
    - _Preservation: Eメールボタンの表示条件（buyer.email）、内覧前日判定ロジック（isViewingPreDay）、broker_inquiry・notification_sender の除外条件、SMS履歴記録APIコールは変更しない_
    - _Requirements: 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 電話番号があればSMSボタンが表示される
    - **重要**: タスク1と同じテストを再実行する — 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 保持テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 電話番号がない場合・その他の除外条件の既存動作保持
    - **重要**: タスク2と同じテストを再実行する — 新しいテストを作成しない
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テスト（バグ条件テスト・保持テスト）が PASS することを確認する
  - 疑問が生じた場合はユーザーに確認する
