# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - ボタンラベルと404エラーの確認
  - **CRITICAL**: このテストは未修正コードで実行し、失敗することを確認する（バグの存在を証明）
  - **DO NOT attempt to fix the test or the code when it fails**
  - **GOAL**: バグが実際に存在することを確認し、根本原因を理解する
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - テスト1: `GmailDistributionButton` をレンダリングし、ボタンテキストが「公開前、値下げメール」であることを確認（`isBugCondition` の `component = 'GmailDistributionButton'` ケース）
  - テスト2: `PriceSection` を `propertyNumber="P001"` でレンダリングし、`/api/property-listings/P001/scheduled-notifications` への API 呼び出しが発生しないことを確認
  - テスト3: `PriceSection` マウント後に `console.error` が呼ばれないことを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが失敗する（バグの存在を証明）
  - 反例を記録する（例: ボタンテキストが「公開前、値下げメール配信」、`api.get` が呼ばれる）
  - テストを作成・実行・失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - メール配信フローと Chat 送信ボタンの動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（ボタンクリック、Chat 送信ボタン操作）の動作を観察する
  - 観察1: `isPriceChanged=true` かつ `scheduledNotifications=[]` のとき、Chat 送信ボタンにアニメーションスタイルが適用される
  - 観察2: ボタンクリック時にテンプレート選択モーダルが開く
  - 観察3: `distribution-buyers-enhanced` API が正常に呼び出される
  - プロパティベーステスト: `isPriceChanged`（true/false）と `scheduledNotifications`（空配列/非空配列）のランダムな組み合わせで、Chat 送信ボタンのスタイル制御ロジックが正しく動作することを確認
  - プロパティベーステスト: 様々な `propertyNumber` 値（空文字、通常値）で `PriceSection` をレンダリングし、メール配信フローが正常に動作することを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが通過する（保全すべきベースライン動作を確認）
  - テストを作成・実行・通過を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [-] 3. ボタンラベルと404エラーの修正

  - [x] 3.1 `GmailDistributionButton.tsx` のボタンラベルを修正する
    - `frontend/frontend/src/components/GmailDistributionButton.tsx` を開く
    - ボタンテキスト「公開前、値下げメール配信」を「公開前、値下げメール」に変更する（「配信」を削除）
    - _Bug_Condition: isBugCondition(input) where input.component = 'GmailDistributionButton' AND buttonLabel = '公開前、値下げメール配信'_
    - _Expected_Behavior: ボタンラベルが「公開前、値下げメール」と表示される_
    - _Preservation: ボタンクリック時のテンプレート選択モーダル表示、メール配信フロー全体は変更しない_
    - _Requirements: 2.3_

  - [ ] 3.2 `PriceSection.tsx` の存在しないエンドポイントへの API 呼び出しを削除する
    - `frontend/frontend/src/components/PriceSection.tsx` を開く
    - `useEffect` 内の `fetchScheduledNotifications` 関数と呼び出しを削除する
    - `loadingNotifications` 状態変数を削除する（`scheduledNotifications` の初期値 `[]` は保持する）
    - `useEffect` が他の用途で使われていない場合は `useEffect` の import も削除する
    - **注意**: `scheduledNotifications` 変数は Chat 送信ボタンのスタイル制御に使用されているため削除しない
    - _Bug_Condition: isBugCondition(input) where input.component = 'PriceSection' AND input.propertyNumber IS NOT EMPTY AND apiEndpointExists('/api/property-listings/' + propertyNumber + '/scheduled-notifications') = false_
    - _Expected_Behavior: API 呼び出しが発生せず、console.error が出力されない。scheduledNotifications は空配列のまま_
    - _Preservation: scheduledNotifications.length === 0 の条件は変わらないため、Chat 送信ボタンのスタイル制御ロジックは影響を受けない_
    - _Requirements: 2.1, 2.2, 3.4_

  - [ ] 3.3 バグ条件の探索テストが通過することを確認する
    - **Property 1: Expected Behavior** - ボタンラベルと404エラーの修正確認
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する（新しいテストを書かない）
    - タスク1のテストを実行する
    - **EXPECTED OUTCOME**: テストが通過する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ] 3.4 保全プロパティテストが引き続き通過することを確認する
    - **Property 2: Preservation** - メール配信フローと Chat 送信ボタンの動作保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する（新しいテストを書かない）
    - タスク2のテストを実行する
    - **EXPECTED OUTCOME**: テストが通過する（リグレッションなしを確認）
    - 修正後も全ての保全テストが通過することを確認する

- [~] 4. チェックポイント - 全テストの通過確認
  - 全テストが通過していることを確認する
  - 疑問点があればユーザーに確認する
