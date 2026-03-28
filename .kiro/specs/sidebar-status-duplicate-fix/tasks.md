# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 未着手案件が未査定にも重複表示されるバグ
  - **CRITICAL**: このテストは未修正コードで**FAIL**することが期待される — FAILがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることでバグ解消を確認できる
  - **GOAL**: バグが存在することを示す反例（counterexample）を表面化する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `isUnvaluated()` と `isTodayCallNotStarted()` の両方が `true` になる売主データを作成
  - バグ条件（design.mdのBug Conditionより）: `isTodayCallNotStarted(seller) === true` かつ `isUnvaluated(seller) === true` となる売主が存在する
  - 具体的なテストケース:
    - `status = '追客中'`、`inquiry_date = '2026-02-01'`（2026/1/1以降）、`unreachable_status = ''`、査定額全て空、`next_call_date` が今日以前 → 未修正コードで `isUnvaluated()` が `true` を返すことを確認（バグ）
    - `status = '除外後追客中'`、同じ条件 → インライン展開の不整合により `isUnvaluated()` が `true` を返すことを確認（バグ）
  - テストファイル: `frontend/frontend/src/tests/sidebar-status-bug.test.ts`
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストがFAIL（バグの存在を証明）
  - 発見した反例を記録して根本原因を理解する
  - テストを書き、実行し、FAILを記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正実装の前に）
  - **Property 2: Preservation** - 未着手条件を満たさない未査定案件は引き続き表示される
  - **IMPORTANT**: 観察優先（observation-first）メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isTodayCallNotStarted(seller) === false`）の動作を観察する
  - 観察すべき動作:
    - `inquiry_date = '2025-12-10'`（2026/1/1より前）の売主 → `isUnvaluated()` が `true` を返す（正常）
    - `inquiry_date = '2025-12-08'`（基準日ちょうど）の売主 → `isUnvaluated()` が `true` を返す（正常）
    - `visit_assignee = 'Y'` の売主 → `isUnvaluated()` が `false` を返す（正常）
    - `mailing_status = '未'` の売主 → `isMailingPending()` が `true` を返す（正常）
    - `status = '追客中'`、`next_call_date` が今日以前、コミュニケーション情報なし、営担なし → `isTodayCall()` が `true` を返す（正常）
  - プロパティベーステスト: `isTodayCallNotStarted(seller) === false` の全ての入力で、修正前後の `isUnvaluated()` の結果が一致することを検証
  - テストファイル: `frontend/frontend/src/tests/sidebar-status-preservation.test.ts`
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストがPASS（保全すべきベースライン動作を確認）
  - テストを書き、実行し、PASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. サイドバーステータス重複バグの修正

  - [x] 3.1 `isUnvaluated()` のインライン展開を `isTodayCallNotStarted()` の直接呼び出しに置き換える
    - ファイル: `frontend/frontend/src/utils/sellerStatusFilters.ts`
    - `isUnvaluated()` 内の「未着手除外ロジック」のインライン展開（約15行）を削除する
    - `isTodayCallNotStarted(seller)` を直接呼び出して除外判定する
    - 注意: `isTodayCallNotStarted` は `isUnvaluated` より後に定義されているため、関数の順序を入れ替えるか、`isTodayCallNotStarted` の定義を `isUnvaluated` より前に移動する
    - 修正後のコード:
      ```typescript
      // 当日TEL_未着手の条件を満たす場合は未査定から除外（未着手が優先）
      if (isTodayCallNotStarted(seller)) {
        return false;
      }
      ```
    - _Bug_Condition: `isTodayCallNotStarted(seller) === true` かつ `isUnvaluated(seller) === true` となる売主が存在する（design.mdのBug Conditionより）_
    - _Expected_Behavior: `isTodayCallNotStarted(seller) === true` の場合、`isUnvaluated(seller)` は `false` を返す（design.mdのExpected Behaviorより）_
    - _Preservation: `isTodayCallNotStarted(seller) === false` の場合、修正前後の `isUnvaluated()` の結果が一致する（design.mdのPreservation Requirementsより）_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 バグ条件の探索テストが今度はPASSすることを確認する
    - **Property 1: Expected Behavior** - 未着手案件は未査定から除外される
    - **IMPORTANT**: タスク1で書いた**同じテスト**を再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすれば、期待される動作が満たされていることを確認できる
    - `frontend/frontend/src/tests/sidebar-status-bug.test.ts` を実行する
    - **EXPECTED OUTCOME**: テストがPASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - 未着手条件を満たさない未査定案件は引き続き表示される
    - **IMPORTANT**: タスク2で書いた**同じテスト**を再実行する — 新しいテストを書かない
    - `frontend/frontend/src/tests/sidebar-status-preservation.test.ts` を実行する
    - **EXPECTED OUTCOME**: テストがPASS（リグレッションなしを確認）
    - 修正後も全テストがPASSすることを確認する

- [x] 4. チェックポイント — 全テストがPASSすることを確認する
  - 全テストがPASSすることを確認する。疑問が生じた場合はユーザーに確認する。
