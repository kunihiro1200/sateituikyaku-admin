# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 除外日にすること フィールドの双方向同期欠落
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — FAIL することがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を表面化させる
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.md の Bug Condition より）:
    - `column-mapping.json` の `databaseToSpreadsheet` に `exclusion_action` キーが存在しないことを確認
    - `column-mapping.json` の `spreadsheetToDatabase` に `除外日にすること` キーが存在しないことを確認
    - `ColumnMapper.mapToSheet()` に `exclusion_action = '次電日になにもせずに除外'` を渡したとき、結果に `除外日にすること` キーが含まれないことを確認（未修正コードで失敗）
    - GAS の `syncSellerList` に `row['除外日にすること']` を処理するブロックが存在しないことを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト FAIL（バグの存在を証明）
  - 反例を記録して根本原因を理解する
  - テストを書き、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正実装の前に）
  - **Property 2: Preservation** - 他フィールドの同期動作維持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`exclusion_action` 以外のフィールド）の動作を観察する
  - 観察内容（design.md の Preservation Requirements より）:
    - `ColumnMapper.mapToSheet()` に `first_call_person`、`status`、`next_call_date`、`comments` 等を渡したとき、正しくスプシカラム名にマッピングされることを確認
    - `column-mapping.json` の既存マッピング（`spreadsheetToDatabase`・`databaseToSpreadsheet` 両セクション）が変更されていないことを確認
    - `exclusion_action` 以外のフィールドに対して `ColumnMapper.mapToSheet()` の結果が修正前後で同一であることをプロパティベーステストで検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テスト PASS（保全すべきベースライン動作を確認）
  - テストを書き、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 除外日にすること 双方向同期バグの修正

  - [x] 3.1 `column-mapping.json` にマッピングを追加する
    - `backend/src/config/column-mapping.json` の `spreadsheetToDatabase` セクションに `"除外日にすること": "exclusion_action"` を追加する
    - `backend/src/config/column-mapping.json` の `databaseToSpreadsheet` セクションに `"exclusion_action": "除外日にすること"` を追加する
    - **重要**: 日本語を含むファイルの編集は Python スクリプトを使用して UTF-8 で書き込む（`file-encoding-protection.md` ルール準拠）
    - 既存のマッピングエントリは一切変更・削除しない（追加のみ）
    - _Bug_Condition: isBugCondition(op) where op.fieldName = '除外日にすること' AND NOT 'exclusion_action' IN databaseToSpreadsheet.keys_
    - _Expected_Behavior: SpreadsheetSyncService が exclusion_action を スプシの「除外日にすること」列に正しく書き込む_
    - _Preservation: spreadsheetToDatabase・databaseToSpreadsheet の既存エントリは変更しない_
    - _Requirements: 2.1, 3.1, 3.2, 3.3_

  - [x] 3.2 `gas_complete_code.js` の `syncSellerList` に同期処理を追加する
    - `first_call_person` の同期処理ブロックの直後に以下を追加する:
      ```javascript
      var sheetExclusionAction = row['除外日にすること'] ? String(row['除外日にすること']) : null;
      var dbExclusionAction = dbSeller.exclusion_action || null;
      if (sheetExclusionAction !== dbExclusionAction) {
        updateData.exclusion_action = sheetExclusionAction;
        needsUpdate = true;
      }
      ```
    - **重要**: 日本語を含むファイルの編集は Python スクリプトを使用して UTF-8 で書き込む（`file-encoding-protection.md` ルール準拠）
    - 他フィールドの同期処理ブロックは一切変更しない
    - _Bug_Condition: isBugCondition(op) where NOT '除外日にすること' IN syncSellerList.processedFields_
    - _Expected_Behavior: syncSellerList が row['除外日にすること'] を exclusion_action として DB に保存する_
    - _Preservation: first_call_person・status・next_call_date・comments 等の既存同期処理は変更しない_
    - _Requirements: 2.2, 3.2, 3.3_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 除外日にすること フィールドの双方向同期
    - **IMPORTANT**: タスク 1 と同じテストを再実行する — 新しいテストを書かない
    - タスク 1 のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされたことを確認できる
    - タスク 1 のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 他フィールドの同期動作維持
    - **IMPORTANT**: タスク 2 と同じテストを再実行する — 新しいテストを書かない
    - タスク 2 の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テスト PASS（リグレッションなしを確認）
    - 修正後も全テストが PASS することを確認する

- [-] 4. チェックポイント — 全テストの PASS を確認する
  - 全テスト（タスク 1・タスク 2）が PASS していることを確認する
  - 疑問点があればユーザーに確認する
