# 実装計画

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - showChatButton 誤表示バグ
  - **重要**: このテストは修正前のコードで必ず FAIL する — FAIL することでバグの存在が確認される
  - **修正やコードを直そうとしてはいけない（テストが失敗しても）**
  - **注意**: このテストは期待される動作をエンコードしている — 実装後に PASS することで修正を検証する
  - **目的**: バグの存在を示す反例を見つける
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - バグ条件（design.md の Bug Condition より）:
    - `showChatButton = !isEditMode && !displayScheduledDate` という条件は `isPriceChanged` チェックが欠落している
    - 結果として `isPriceChanged === false` でも `displayScheduledDate` が空なら常にバーが表示される
  - テストケース（修正前コードで実行）:
    - `isPriceChanged = false`, `displayScheduledDate = null`, `isEditMode = false` → バーが表示される（バグ）
    - `isPriceChanged = false`, `displayScheduledDate = null`, `isEditMode = false` → 期待値: どちらのバーも非表示
  - 修正前コードで実行する
  - **期待される結果**: テスト FAIL（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録してバグの根本原因を理解する
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正実装前に）
  - **Property 2: Preservation** - 非バグ条件での既存動作の保全
  - **重要**: 観察優先メソドロジーに従う
  - 修正前コードで非バグ条件の入力を使って動作を観察する:
    - 観察: `displayScheduledDate` に値がある場合 → どちらのバーも非表示
    - 観察: `isEditMode = true` の場合 → どちらのバーも非表示
    - 観察: 青いバーから送信した場合 → `handlePriceChatSendSuccess` が呼ばれ「確認」フィールドが「未」になる
  - プロパティベーステストを書く（Preservation Requirements より）:
    - `displayScheduledDate` に値がある全ての入力で、どちらのバーも非表示であること
    - `isEditMode = true` の全ての入力で、どちらのバーも非表示であること
    - 青いバーの送信処理が `handlePriceChatSendSuccess` を呼び出すこと
  - 修正前コードでテストを実行する
  - **期待される結果**: テスト PASS（これが保全すべきベースライン動作を確認する）
  - テストを書き、実行し、修正前コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [-] 3. showChatButton 誤表示バグの修正

  - [x] 3.1 ローカル状態変数を追加する
    - `chatSent` と `scheduledDateWasCleared` の `useState` を追加
    - `const [chatSent, setChatSent] = useState(false);`
    - `const [scheduledDateWasCleared, setScheduledDateWasCleared] = useState(false);`
    - _Bug_Condition: `showChatButton = !isEditMode && !displayScheduledDate`（`isPriceChanged` チェックが欠落）_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 displayScheduledDate の変化を監視する useEffect と useRef を追加する
    - `prevScheduledDateRef` を `useRef` で追加
    - `displayScheduledDate` の変化を監視する `useEffect` を追加
    - 値あり → 空欄になった場合: `setScheduledDateWasCleared(true)`, `setChatSent(false)`
    - 空欄 → 値が設定された場合: `setScheduledDateWasCleared(false)`, `setChatSent(false)`
    - _Bug_Condition: `scheduledDateWasCleared` 状態が存在しないため、値下げ予約日クリア時の追跡ができない_
    - _Expected_Behavior: `displayScheduledDate` の変化を追跡し `scheduledDateWasCleared` を正しく更新する_
    - _Requirements: 2.3_

  - [x] 3.3 showOrangeChatButton と showBlueChatButton の表示条件を分離する
    - `showOrangeChatButton = !isEditMode && !displayScheduledDate && scheduledDateWasCleared && !chatSent`
    - `showBlueChatButton = !isEditMode && !displayScheduledDate && isPriceChanged && !showOrangeChatButton`
    - 既存の `showChatButton` 変数を削除または置き換える
    - _Bug_Condition: isBugCondition(input) where `isPriceChanged === false` AND `displayScheduledDate === null` AND `isEditMode === false`_
    - _Expected_Behavior: `showOrangeChatButton` と `showBlueChatButton` がそれぞれ独立した条件で制御される_
    - _Preservation: `displayScheduledDate` に値がある場合・`isEditMode === true` の場合は両方非表示_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.2, 3.3_

  - [x] 3.4 オレンジのバー送信成功後に setChatSent(true) を呼び出す
    - `handleSendPriceReductionChat` の送信成功後に `setChatSent(true)` を追加
    - _Expected_Behavior: 送信完了後にオレンジのバーが非表示になり、条件を満たす場合は青いバーが表示される_
    - _Preservation: 送信処理自体は変更しない（`onChatSendSuccess` の呼び出しは維持）_
    - _Requirements: 2.4, 3.4_

  - [x] 3.5 JSX を2つのバーブロックに分離する
    - 既存の `{showChatButton && (...)}` を `{showOrangeChatButton && (...)}` と `{showBlueChatButton && (...)}` に分ける
    - オレンジのバー: `backgroundColor: '#f57c00'`（`isPriceChanged` 時は `'#e65100'`）
    - 青いバー: `backgroundColor: '#1976d2'`
    - 青いバーの `onClick` は既存の `handlePriceChatSendSuccess` を呼ぶ処理を維持する
    - _Preservation: 青いバーの送信は引き続き `handlePriceChatSendSuccess` を呼び出し「確認」フィールドを「未」にリセットする_
    - _Requirements: 2.2, 2.3, 3.1_

  - [x] 3.6 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - showChatButton 誤表示バグ
    - **重要**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで期待される動作が満たされたことを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.7 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非バグ条件での既存動作の保全
    - **重要**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
