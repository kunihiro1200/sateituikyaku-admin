# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - SMS送信者名の代わりに電話番号が表示されるバグ
  - **CRITICAL**: このテストは修正前のコードで必ず FAIL する - 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている - 修正後にパスすることで修正を検証する
  - **GOAL**: バグの存在を示すカウンターサンプルを表面化する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `activity.employee = { id: 'uuid-string', name: '国広智子', initials: 'K' }` の場合の `displayName` 計算ロジック
  - Bug Condition: `activity.action === 'sms'` かつ `activity.employee` が存在するにもかかわらず `displayName` が `'不明'` になる
  - テストアサーション: `displayName` が `'国広'`（名字）であること、かつ電話番号形式でないこと
  - 修正前のコードで実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（バグの存在を証明）
  - カウンターサンプルを記録して根本原因を理解する（例: `employee.id` が `number` 型で定義されているため UUID が正しく扱われない）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非SMS履歴の表示が変わらないこと
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（`action !== 'sms'`）の動作を観察する
  - 観察: `action === 'email'` の場合、送信者欄は `送信者: 国広 (sender@example.com)` 形式で表示される
  - 観察: `action === 'call'` の場合、担当者名は `emp.name.split(/[\s　]/)[0]` で表示される
  - 観察: `activity.employee === undefined` の場合、`'担当者'` が表示される
  - プロパティベーステスト: `action !== 'sms'` の全ての入力に対して、表示結果が修正前後で同一であること
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（保全すべきベースライン動作を確認）
  - 修正前のコードでテストが通過したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. SMS送信者名表示バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/BuyerDetailPage.tsx` を編集する
    - 修正1: `Activity` インターフェースの `employee.id` 型を `number` から `string` に変更する（UUIDはstring型）
    - 修正2: SMS送信者の `displayName` 計算ロジックを変更する
      - 変更前: `const displayName = activity.employee ? getDisplayName(activity.employee) : '不明';`
      - 変更後: `const displayName = activity.employee ? (activity.employee.name ? activity.employee.name.split(/[\s　]/)[0] : (activity.employee.initials || '担当者')) : '担当者';`
    - 変更スコープ: `activity.action === 'sms'` の場合の送信者表示ロジックのみ
    - メール送信履歴・通話履歴の表示ロジックは変更しない
    - `getDisplayName` 関数自体は変更しない
    - _Bug_Condition: `activity.action === 'sms'` かつ `activity.employee` が存在するが `displayName` が `'不明'` になる_
    - _Expected_Behavior: `activity.employee.name.split(/[\s　]/)[0]` で名字（例: `'国広'`）を返す_
    - _Preservation: メール送信履歴・通話履歴・employee未定義時の表示は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件の探索テストが通過することを確認する
    - **Property 1: Expected Behavior** - SMS送信者名の正しい表示
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き通過することを確認する
    - **Property 2: Preservation** - 非SMS履歴の表示の保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - メール送信履歴・通話履歴・employee未定義時の表示が変わっていないことを確認する

- [x] 4. チェックポイント - 全テストの通過を確認する
  - タスク1のバグ条件探索テスト（Property 1）が PASS することを確認する
  - タスク2の保全プロパティテスト（Property 2）が PASS することを確認する
  - `getDiagnostics` で `BuyerDetailPage.tsx` に型エラーがないことを確認する
  - 疑問点があればユーザーに確認する
