# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - カレンダーイベントの重複送信・誤送信バグ
  - **CRITICAL**: このテストは修正前のコードで FAIL することが期待される — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **GOAL**: バグが存在することを示す反例（counterexample）を見つける
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `handleCalendarButtonClick` 関数が生成する Google カレンダー URL
  - バグ条件1（重複送信）: 後続担当が有効な従業員の場合、URL に `add=` と `src=` が両方含まれることを確認（修正前は FAIL するはず）
  - バグ条件2（誤送信）: 後続担当が「業者」の場合、URL に `tenant%40ifoo-oita.com` が含まれることを確認（修正前は FAIL するはず）
  - 期待される反例: `add=tanaka%40example.com&src=tanaka%40example.com` が URL に含まれる
  - 期待される反例: 後続担当「業者」の場合、`tenant%40ifoo-oita.com` が URL に含まれる
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録して根本原因を理解する
  - テストを書き、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 既存の正常動作の保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで、バグ条件が成立しない入力（後続担当が「業者」以外の有効な従業員イニシャル、または後続担当が未設定・不正な場合）の動作を観察する
  - 観察1: 有効なイニシャルで従業員が1件見つかる場合、`src=` パラメータにそのメールアドレスが使用される
  - 観察2: 同じイニシャルを持つ従業員が複数いる場合、エラーメッセージが表示されてカレンダーが開かれない
  - 観察3: 後続担当が従業員マスタに存在しない場合、エラーメッセージが表示されてカレンダーが開かれない
  - 観察4: 正常にカレンダーが開かれた場合、`calendarOpened` が `true` になる
  - 観察5: カレンダーボタンクリック時に `/api/buyer-appointments` へのメール通知送信が試みられる
  - 観察した動作パターンをキャプチャするプロパティベーステストを作成する
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが保持すべきベースライン動作を確認する）
  - テストを書き、実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for カレンダーイベントの重複送信・誤送信バグ

  - [x] 3.1 Implement the fix
    - `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` の `handleCalendarButtonClick` 関数を修正する
    - 変更1: `add` パラメータを削除する（`params.append('add', assignedEmail)` の行を削除）
    - 変更2: `src` パラメータのみ維持する（`&src=${encodeURIComponent(assignedEmail)}` はそのまま）
    - 変更3: `followUpAssignee === '業者'` の場合に `assignedEmail = 'tenant@ifoo-oita.com'` をセットしている箇所を削除し、代わりに warning スナックバーを表示して `return` する
    - 修正後のコード例:
      ```typescript
      if (followUpAssignee === '業者') {
        setSnackbar({
          open: true,
          message: '後続担当が「業者」のため、カレンダー送信をスキップしました',
          severity: 'warning',
        });
        return;
      }
      ```
    - _Bug_Condition: isBugCondition(input) where (input.assignedEmail != '' AND urlContains('add=') AND urlContains('src=')) OR (input.followUpAssignee == '業者' AND input.assignedEmail == 'tenant@ifoo-oita.com')_
    - _Expected_Behavior: URL に `add=` パラメータが含まれず `src=` のみ使用される。後続担当が「業者」の場合はカレンダーを開かず warning スナックバーを表示する_
    - _Preservation: 後続担当が有効な従業員イニシャルの場合の従業員マスタ検索、エラーハンドリング、calendarOpened フラグ設定、メール通知送信の動作は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - カレンダーイベントの重複送信・誤送信バグ
    - **IMPORTANT**: タスク1で作成した SAME テストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることが確認される
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 既存の正常動作の保持
    - **IMPORTANT**: タスク2で作成した SAME テストを再実行する — 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストが PASS することを確認する。疑問が生じた場合はユーザーに確認する。
