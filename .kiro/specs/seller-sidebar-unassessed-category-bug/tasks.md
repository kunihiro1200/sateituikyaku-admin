# Implementation Plan

- [ ] 1. バグ条件の探索的テストを作成する
  - **Property 1: Bug Condition** - 当日TEL_未着手の売主が未査定に誤って表示されるバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する - 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている - 修正後に PASS することで修正を検証する
  - **GOAL**: バグの存在を示す反例を発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケース（AA13953相当）にスコープを絞る
  - テスト対象: `isTodayCallNotStarted(seller) = true` の場合に `isUnvaluated(seller)` が `false` を返すべき（design.md の Bug Condition より）
  - テストデータ: 反響日付=2026-01-15、状況=追客中、営担なし、不通=空欄、次電日=今日以前、コミュニケーション情報なし、査定額なし
  - 境界値テスト: 反響日付=2026-01-01（カットオフ日ちょうど）でも同様に確認
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい - バグの存在を証明する）
  - 発見した反例を記録して根本原因を理解する（仮説1〜3のどれか特定）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [ ] 2. 保存性プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 当日TEL_未着手でない売主の未査定判定は変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 観察: 反響日付=2025-12-10（2026/1/1未満）の売主で `isTodayCallNotStarted()=false` → `isUnvaluated()` の結果を記録
  - 観察: 反響日付=2025-12-08（基準日ちょうど）の売主で同様に記録
  - 観察: 営担ありの売主で `isUnvaluated()=false` を確認
  - 観察: 査定額ありの売主で `isUnvaluated()=false` を確認
  - プロパティベーステスト: `isTodayCallNotStarted(seller) = false` の全ての売主に対して、修正前後で `isUnvaluated()` の結果が一致することを検証（design.md の Preservation Requirements より）
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが正しい - 保存すべきベースライン動作を確認する）
  - テストを作成・実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. `isUnvaluated()` のバグ修正

  - [x] 3.1 修正を実装する
    - ファイル: `frontend/frontend/src/utils/sellerStatusFilters.ts`
    - 関数: `isUnvaluated`
    - `isTodayCallNotStarted(seller)` の除外チェックを `normalizedInquiryDate` の取得前（できるだけ早い段階）に移動する
    - 修正後の順序: 各種チェック → `isTodayCallNotStarted()` チェック → `normalizedInquiryDate` 取得 → 日付比較
    - 探索的テスト（タスク1）で特定した根本原因に基づいて実装を確定する
    - _Bug_Condition: `isTodayCallNotStarted(seller) = true` かつ `isUnvaluated(seller) = true` となる状態（design.md Bug Condition より）_
    - _Expected_Behavior: `isTodayCallNotStarted(seller) = true` の場合、`isUnvaluated(seller)` は必ず `false` を返す（design.md Expected Behavior より）_
    - _Preservation: `isTodayCallNotStarted(seller) = false` の全売主に対して `isUnvaluated()` の動作は変更しない（design.md Preservation Requirements より）_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索的テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 当日TEL_未着手の売主は未査定から除外される
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索的テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保存性テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 当日TEL_未着手でない売主の未査定判定は変わらない
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク2の保存性プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント - 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
