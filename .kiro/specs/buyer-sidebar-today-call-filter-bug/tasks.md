# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 当日TEL完全一致フィルタバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを表面化する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `selectedCalculatedStatus = '当日TEL'` のとき、`calculated_status = '当日TEL(Y)'` の買主が混入しないことを期待
    - `selectedCalculatedStatus = '当日TEL'` のとき、フィルタ結果の全要素が `calculated_status === '当日TEL'` であることを期待
  - テストは `BuyersPage.tsx` のフィルタリングロジックを直接テストする（isBugCondition の形式仕様に基づく）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `'当日TEL'` フィルタ時に `'当日TEL(Y)'` が含まれる）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. Preservation プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 非バグ条件の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（isBugCondition が false を返すケース）の動作を観察する
    - `selectedCalculatedStatus = null` のとき、全買主が返ることを観察
    - `selectedCalculatedStatus = '担当(Y)'` のとき、`'担当(Y)'` のみが返ることを観察
    - `selectedCalculatedStatus = '当日TEL(Y)'` のとき、`'当日TEL(Y)'` のみが返ることを観察（修正前後で同一）
  - 観察した動作パターンをキャプチャするプロパティベーステストを書く（Preservation Requirements に基づく）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが保持すべきベースライン動作を確認する）
  - テストを書き、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 当日TELフィルタの startsWith バグを修正する

  - [x] 3.1 フィルタリングロジックを修正する
    - `frontend/frontend/src/pages/BuyersPage.tsx` の `fetchBuyers` 内フィルタリングロジックを修正する
    - `||` 以降の `startsWith(selectedCalculatedStatus + '(')` 条件を完全に削除する
    - 変更箇所は1行のみ（`startsWith` 条件の削除）
    - 修正前: `b.calculated_status === selectedCalculatedStatus || (b.calculated_status || '').startsWith(selectedCalculatedStatus + '(')`
    - 修正後: `b.calculated_status === selectedCalculatedStatus`
    - _Bug_Condition: isBugCondition(selectedStatus, buyer) — selectedStatus が非 null かつ buyer.calculated_status !== selectedStatus かつ startsWith(selectedStatus + '(') が true_
    - _Expected_Behavior: selectedCalculatedStatus が非 null のとき、calculated_status === selectedCalculatedStatus に完全一致する買主のみを返す_
    - _Preservation: selectedCalculatedStatus = null（全件表示）、他カテゴリ選択時の完全一致動作、検索フィルタ、buildCategoriesFromBuyers、calculateBuyerStatus は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 当日TEL完全一致フィルタバグ
    - **IMPORTANT**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Preservation テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非バグ条件の動作保持
    - **IMPORTANT**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - タスク2の Preservation プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS することを確認する。疑問が生じた場合はユーザーに確認する。
