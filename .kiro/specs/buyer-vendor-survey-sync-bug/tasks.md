# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 業者向けアンケートのDB同期スキップ
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: バグ条件は決定論的（`BUYER_COLUMN_MAPPING` に `'業者向けアンケート'` キーが存在しない）なので、具体的な失敗ケースにスコープする
  - Bug Condition: `isBugCondition(input)` = `input['業者向けアンケート'] IS NOT NULL AND input['業者向けアンケート'] != '' AND '業者向けアンケート' NOT IN BUYER_COLUMN_MAPPING`
  - GASの `buyerMapRowToRecord` 関数に「業者向けアンケート」= "確認済み" の行を渡す
  - 返却レコードに `vendor_survey` フィールドが含まれないことを確認（未修正コードで失敗）
  - 買主番号7260の行データを使用して同期をシミュレートし、`vendor_survey` が更新されないことを確認
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found: `buyerMapRowToRecord({'業者向けアンケート': '確認済み', ...})` の返却オブジェクトに `vendor_survey` キーが存在しない
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他フィールドの同期動作維持
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs（「業者向けアンケート」以外のフィールド）
  - Observe: `buyerMapRowToRecord({'★次電日': '2026/04/01', ...})` が `next_call_date` を正しくマッピングする
  - Observe: `buyerMapRowToRecord({'業者向けアンケート': '', ...})` が他フィールドを正常に処理する
  - Write property-based test: `BUYER_COLUMN_MAPPING` に定義された全カラム（`next_call_date`、`latest_status`、`broker_survey` 等）が修正前後で同一の結果を返すことを確認
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. Fix for 業者向けアンケートのDB同期スキップバグ

  - [x] 3.1 GASの `BUYER_COLUMN_MAPPING` に `'業者向けアンケート': 'vendor_survey'` を追加
    - `gas_complete_code.js` の `BUYER_COLUMN_MAPPING` 定数を確認する
    - 既存の `'業者向けアンケート': 'broker_survey'` エントリとの重複に注意（スプレッドシートの実際のヘッダー名を確認）
    - `'業者向けアンケート': 'vendor_survey'` を追加する
    - 修正後のGASコードをGASプロジェクトに手動でコピーする（Vercelデプロイ対象外）
    - _Bug_Condition: `'業者向けアンケート' NOT IN BUYER_COLUMN_MAPPING` from design_
    - _Expected_Behavior: `buyerMapRowToRecord(input)['vendor_survey'] == input['業者向けアンケート']` from design_
    - _Preservation: `BUYER_COLUMN_MAPPING` の既存マッピングは変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 `backend/src/config/buyer-column-mapping.json` の `spreadsheetToDatabaseExtended` を確認・更新
    - `spreadsheetToDatabaseExtended` に `"業者向けアンケート": "vendor_survey"` が存在するか確認する
    - 存在しない場合は追加する（現在は `"業者向けアンケート": "broker_survey"` のみ存在）
    - `vendor_survey` と `broker_survey` は別カラムであることを確認する
    - _Requirements: 3.3_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 業者向けアンケートのDB同期
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - 他フィールドの同期動作維持
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Deploy
  - `git push origin main` でバックエンド（`buyer-column-mapping.json`）を自動デプロイ
  - GASコードは手動でGASプロジェクトにコピーする（Vercelデプロイ対象外）
  - デプロイ後、買主番号7260のスプレッドシート行を確認し、次回GAS定期同期（10分トリガー）後にDBの `vendor_survey` が更新されることを確認する

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.
