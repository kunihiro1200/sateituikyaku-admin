# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 当日TEL_未着手該当者が当日TEL分に含まれるバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `filterSellersByCategory(sellers, 'todayCall')` の結果に `isTodayCallNotStarted` 該当者が含まれることを確認
  - バグ条件（design.md の isBugCondition より）: `isTodayCallNotStarted(seller) === true` かつ `filterSellersByCategory([seller], 'todayCall')` の結果にその売主が含まれている
  - テストケース1（基本ケース）: 状況=「追客中」、次電日=今日以前、コミュニケーション情報=全て空、営担=空、不通=空、反響日付=2026/2/1 の売主が `todayCall` に含まれることを確認
  - テストケース2（境界値）: 反響日付=2026/1/1（カットオフ日当日）の売主が `todayCall` に含まれることを確認
  - テストケース3（複数売主）: `isTodayCallNotStarted` 該当者と非該当者が混在するリストで、該当者が `todayCall` に含まれることを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト FAILS（これが正しい — バグの存在を証明する）
  - 反例を記録して根本原因を理解する（例: `filterSellersByCategory([seller], 'todayCall')` が `isTodayCallNotStarted` 該当者を返してしまう）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正実装の前に）
  - **Property 2: Preservation** - 当日TEL_未着手非該当者の当日TEL分表示は変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`isTodayCallNotStarted` が false の売主）の動作を観察する
  - 観察1: `isTodayCall` が true かつ `isTodayCallNotStarted` が false の売主（例: 不通あり、または反響日付が2025/12/31以前）は `todayCall` に含まれる
  - 観察2: `isTodayCallNotStarted` 該当者は `todayCallNotStarted` カテゴリーに引き続き含まれる
  - 観察3: `todayCallWithInfo`、`visitDayBefore` など他カテゴリーの結果は変わらない
  - プロパティベーステストを書く: `isTodayCallNotStarted` が false かつ `isTodayCall` が true の全売主に対して、`filterSellersByCategory(sellers, 'todayCall')` がその売主を含むことを検証（design.md の Preservation Requirements より）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト PASSES（これが保全すべきベースライン動作を確認する）
  - テストを書き、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 3. 当日TEL分カテゴリーの重複表示バグを修正する

  - [x] 3.1 修正を実装する
    - ファイル: `frontend/frontend/src/utils/sellerStatusFilters.ts`
    - 関数: `filterSellersByCategory`
    - `todayCall` ケースに `isTodayCallNotStarted` の除外ロジックを追加する
    - 修正前: `return sellers.filter(isTodayCall);`
    - 修正後: `return sellers.filter(s => isTodayCall(s) && !isTodayCallNotStarted(s));`
    - 変更箇所はこの1行のみ。他のケースは一切変更しない
    - _Bug_Condition: isTodayCallNotStarted(seller) === true かつ filterSellersByCategory([seller], 'todayCall') にその売主が含まれている状態_
    - _Expected_Behavior: filterSellersByCategory(sellers, 'todayCall') の結果に isTodayCallNotStarted 該当者が含まれないこと_
    - _Preservation: todayCallNotStarted カテゴリーの結果、および todayCall 以外の全カテゴリーの結果は変わらない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 当日TEL_未着手該当者は当日TEL分に含まれない
    - **IMPORTANT**: タスク1で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 当日TEL_未着手非該当者の当日TEL分表示は変わらない
    - **IMPORTANT**: タスク2で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - タスク1のバグ条件探索テストが PASS することを確認する
  - タスク2の保全プロパティテストが PASS することを確認する
  - 疑問点があればユーザーに確認する
