# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - visitDate フォールバック欠如バグ
  - **CRITICAL**: このテストは未修正コードで FAIL することが期待される — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `replaceEmailPlaceholders` 関数（`frontend/frontend/src/pages/CallModePage.tsx` 2829行付近）
  - バグ条件（isBugCondition）: `seller.appointmentDate` が null/undefined かつ `seller.visitDate` が有効な値を持つ
  - テストケース1: `appointmentDate = null`, `visitDate = "2025-07-15T10:00:00"` → `<<訪問日>>` が `"7月15日"` になることをアサート（未修正コードでは `""` になるため FAIL）
  - テストケース2: `appointmentDate = null`, `visitDate = "2025-07-15T00:00:00"`, `visitTime = "10:30:00"` → `<<時間>>` が `"10:30"` になることをアサート（未修正コードでは `""` になるため FAIL）
  - テストケース3: `appointmentDate = null`, `visitDate = null` → `<<訪問日>>` が `""` になることをアサート（正常動作、PASS）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストケース1・2が FAIL（バグの存在を証明）、テストケース3が PASS
  - 発見した反例を記録して根本原因を理解する（例: `else` ブランチが `visitDate` を参照せずに空文字を返している）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - appointmentDate 優先ロジックの維持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（`appointmentDate` が有効な場合）の動作を観察する
  - 観察: `appointmentDate = "2025-07-20T14:00:00"` の場合、`<<訪問日>>` が `"7月20日"` になる
  - 観察: `appointmentDate = "2025-07-20T14:00:00"` の場合、`<<時間>>` が `"14:00"` になる
  - 観察: `appointmentDate` が有効な場合、`visitDate` の値に関わらず `appointmentDate` が優先される
  - プロパティベーステスト: 有効な `appointmentDate` を持つ任意の seller に対して、`<<訪問日>>` と `<<時間>>` が `appointmentDate` から生成された文字列になることを検証
  - プロパティベーステスト: `<<名前（漢字のみ）>>`、`<<物件所在地>>` 等その他プレースホルダーが修正前後で同一であることを検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS（保全すべきベースライン動作を確認）
  - テストを作成し、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [-] 3. visitDate フォールバックロジックの修正

  - [x] 3.1 修正を実装する
    - **注意**: 日本語を含むファイルのため、Pythonスクリプトを使用してUTF-8で編集すること（file-encoding-protection.md ルール）
    - 対象ファイル: `frontend/frontend/src/pages/CallModePage.tsx`（2829行付近の `replaceEmailPlaceholders` 関数）
    - `seller.appointmentDate` が null/undefined の場合に `seller.visitDate` を参照するフォールバックブランチを追加する
    - `seller.visitDate` は `Date | string | undefined` 型のため `new Date(seller.visitDate)` でパースする
    - `visitDate` の時刻部分（`getHours()` と `getMinutes()`）が両方 0 かつ `seller.visitTime` が存在する場合、`visitTime`（`HH:mm:ss` 形式）から `HH:mm` を抽出して時刻文字列を生成する
    - `seller.appointmentDate` が有効な場合の既存ロジックは一切変更しない
    - Pythonスクリプト（`fix_visit_date_fallback.py`）を作成して変更を適用する
    - _Bug_Condition: isBugCondition(seller) = seller.appointmentDate IS NULL AND seller.visitDate IS NOT NULL_
    - _Expected_Behavior: visitDate から dateStr（M月D日形式）と timeStr（H:mm形式）を生成し、visitDate の時刻が 00:00 かつ visitTime が存在する場合は visitTime の HH:mm 部分を使用する_
    - _Preservation: appointmentDate が有効な場合は既存ロジックを維持し、visitDate を参照しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - visitDate フォールバックによる訪問日時置換
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - appointmentDate 優先ロジックの維持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS（リグレッションがないことを確認）
    - 修正後もすべてのテストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — すべてのテストが PASS することを確認する
  - すべてのテストが PASS することを確認する。疑問が生じた場合はユーザーに確認する。
