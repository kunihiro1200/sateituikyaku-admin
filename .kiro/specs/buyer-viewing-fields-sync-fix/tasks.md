# Implementation Plan

- [x] 1. バグ条件の探索テストを書く（修正前）
  - **Property 1: Bug Condition** - 型変換不備による内覧フィールドの空欄化
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターエグザンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `BuyerColumnMapper.formatValueForSpreadsheet`
  - バグ条件A: `formatValueForSpreadsheet('viewing_time', '10:00')` が `time` 型として処理されない（型処理なしでパスする）
  - バグ条件B: `formatValueForSpreadsheet('latest_viewing_date', '2026-03-29')` がUTC環境で `'2026/03/28'` を返す（1日ずれ）
  - テストアサーション: `formatValueForSpreadsheet('latest_viewing_date', '2026-03-29')` === `'2026/03/29'`（タイムゾーンずれなし）
  - 未修正コードで実行 → **EXPECTED OUTCOME**: テスト FAILS（バグの存在を証明）
  - カウンターエグザンプルを記録（例: UTC環境で `new Date("2026-03-29").getDate()` が `28` を返す）
  - テストを書き、実行し、失敗を記録したらタスク完了
  - _Requirements: 1.1, 1.2_

- [x] 2. 保持プロパティテストを書く（修正前）
  - **Property 2: Preservation** - 非内覧フィールドの変換動作の保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`viewing_time`・`latest_viewing_date` 以外のフィールド）の動作を観察する
  - 観察: `formatValueForSpreadsheet('reception_date', '2026-01-15')` → `'2026/01/15'`（既存date型）
  - 観察: `formatValueForSpreadsheet('inquiry_hearing', '<p>テスト</p>')` → `'テスト'`（HTML変換）
  - 観察: `formatValueForSpreadsheet('follow_up_assignee', '担当者名')` → `'担当者名'`（text型パススルー）
  - プロパティベーステスト: 任意の `reception_date`/`next_call_date`/`campaign_date` に対して `"YYYY/MM/DD"` 形式が返る
  - プロパティベーステスト: HTMLフィールド（`inquiry_hearing`等）に対してHTML変換が正しく行われる
  - プロパティベーステスト: text型フィールドに対して値がそのまま返る
  - 未修正コードで実行 → **EXPECTED OUTCOME**: テスト PASSES（ベースライン動作を確認）
  - テストを書き、実行し、未修正コードでPASSを確認したらタスク完了
  - _Requirements: 3.3, 3.4_

- [x] 3. 内覧フィールド同期バグの修正

  - [x] 3.1 Fix 1: BuyerColumnMapper.formatValueForSpreadsheet の修正
    - ファイル: `backend/src/services/BuyerColumnMapper.ts`
    - `time` 型変換を追加: `type === 'time'` の場合 `String(value)` を返す
    - `date` 型変換をタイムゾーン安全な文字列パースに変更: `new Date()` の代わりに正規表現で `YYYY-MM-DD` を直接パース
    - フォールバックとして `new Date()` を残す
    - _Bug_Condition: isBugCondition(input) where input.field = 'viewing_time' OR (input.field = 'latest_viewing_date' AND input.syncType = 'db_to_sheet')_
    - _Expected_Behavior: formatValueForSpreadsheet('viewing_time', 'HH:mm') returns 'HH:mm'; formatValueForSpreadsheet('latest_viewing_date', 'YYYY-MM-DD') returns 'YYYY/MM/DD' without timezone shift_
    - _Preservation: reception_date/next_call_date/campaign_date の変換、HTMLフィールドのストリップ処理、text型フィールドのパススルーが変わらない_
    - _Requirements: 2.1, 2.2, 3.3, 3.4_

  - [x] 3.2 Fix 2: GASの db_updated_at 除外
    - ファイル: `gas/buyer-sync/BuyerSync.gs`（または対応するGASファイル）
    - `syncBuyers()` 内のレコード生成後に `delete record.db_updated_at` を追加
    - `record.last_synced_at = new Date().toISOString()` は維持する
    - _Bug_Condition: isBugCondition(input) where input.syncType = 'gas_sync' AND input.field IN VIEWING_FIELDS AND db_updated_at IS INCLUDED IN upsert_payload_
    - _Expected_Behavior: GASのupsertペイロードに db_updated_at が含まれず、バックエンドの db_updated_at > last_synced_at 保護ロジックが機能する_
    - _Preservation: 内覧フィールド以外のフィールドのGAS定期同期が継続する; db_updated_at <= last_synced_at の場合はスプシの値をDBに同期し続ける_
    - _Requirements: 2.3, 2.4, 3.1, 3.2, 3.5_

  - [x] 3.3 バグ条件探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - 型変換不備による内覧フィールドの空欄化
    - **IMPORTANT**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされたことを確認できる
    - 修正後のコードでタスク1のテストを実行
    - **EXPECTED OUTCOME**: テスト PASSES（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保持プロパティテストが引き続き PASS することを確認
    - **Property 2: Preservation** - 非内覧フィールドの変換動作の保持
    - **IMPORTANT**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - 修正後のコードでタスク2のテストを実行
    - **EXPECTED OUTCOME**: テスト PASSES（リグレッションなしを確認）
    - 修正後も全ての保持プロパティが満たされていることを確認

- [x] 4. チェックポイント — 全テストが PASS することを確認
  - タスク1のバグ条件テストが PASS することを確認
  - タスク2の保持プロパティテストが PASS することを確認
  - 疑問点があればユーザーに確認する
