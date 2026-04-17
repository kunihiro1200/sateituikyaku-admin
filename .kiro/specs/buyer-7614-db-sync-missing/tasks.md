# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 論理削除済み買主の同期バグ
  - **CRITICAL**: このテストは未修正コードで FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - バグ条件: `EXISTS(buyer IN DB WHERE buyer.buyer_number = X.buyer_number AND buyer.deleted_at IS NOT NULL) AND EXISTS(row IN Spreadsheet WHERE row['買主番号'] = X.buyer_number)`
  - テスト内容: `deleted_at` がセットされた買主（例: buyer_number='7614'）に対して `syncSingleBuyer()` を呼び出し、同期後に `getByBuyerNumber('7614')` が非 null を返し、かつ `deleted_at` が `null` であることをアサートする
  - 未修正コードで実行 → **EXPECTED OUTCOME**: テスト FAILS（バグの存在を証明）
  - 反例を記録する（例: 「同期後も deleted_at が null にリセットされない」）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - アクティブな買主・新規買主の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - バグ条件に該当しない入力（`isBugCondition(X) = false`）でのケース:
    - `deleted_at IS NULL` のアクティブな買主（例: buyer_number='5678'）
    - DBに存在しない新規買主（例: buyer_number='9999'）
    - スプレッドシートに存在しない買主番号
  - 未修正コードでアクティブな買主・新規買主の動作を観察・記録する
  - プロパティベーステスト: アクティブな買主に対して同期を実行し、`deleted_at` が変更されないことを確認
  - プロパティベーステスト: 新規買主に対して同期を実行し、新規挿入が正常に行われることを確認
  - 未修正コードでテストを実行 → **EXPECTED OUTCOME**: テスト PASSES（保持すべきベースライン動作を確認）
  - テストを書き、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [-] 3. Fix for 論理削除済み買主の同期時に deleted_at がリセットされないバグ

  - [x] 3.1 Implement the fix
    - `backend/src/services/EnhancedAutoSyncService.ts` の `syncSingleBuyer()` を修正
    - 既存レコード確認クエリを `.select('buyer_id')` から `.select('buyer_id, deleted_at')` に変更
    - `existingBuyer` が存在する場合、`existingBuyer.deleted_at !== null` かどうかを確認する分岐を追加
    - 論理削除済みレコード（`deleted_at !== null`）の場合: 更新データに `deleted_at: null` を明示的に含めて復元
    - アクティブなレコード（`deleted_at === null`）の場合: 従来通り `deleted_at` を変更しない更新処理
    - （オプション）論理削除済みレコードを復元した場合にログを出力
    - _Bug_Condition: isBugCondition(X) where EXISTS(buyer IN DB WHERE buyer.buyer_number = X.buyer_number AND buyer.deleted_at IS NOT NULL) AND EXISTS(row IN Spreadsheet WHERE row['買主番号'] = X.buyer_number)_
    - _Expected_Behavior: syncSingleBuyer'(X) → getByBuyerNumber(X.buyer_number) IS NOT NULL AND result.deleted_at IS NULL_
    - _Preservation: deleted_at IS NULL のアクティブな買主は deleted_at を変更しない; 新規買主は挿入処理; スプシ未存在の買主はスキップ_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 論理削除済み買主の復元
    - **IMPORTANT**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされたことを確認できる
    - バグ条件探索テスト（タスク1）を実行する
    - **EXPECTED OUTCOME**: テスト PASSES（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - アクティブな買主・新規買主の動作保持
    - **IMPORTANT**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - 保持プロパティテスト（タスク2）を実行する
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストが PASS することを確認する
  - 疑問点があればユーザーに確認する
