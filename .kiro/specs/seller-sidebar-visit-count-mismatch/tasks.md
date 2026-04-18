# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 訪問日前日カウントと一覧件数の不一致
  - **重要**: このテストは修正前のコードで **FAIL** することが期待される — 失敗がバグの存在を証明する
  - **修正やコードを変更しないこと（テストが失敗しても）**
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ**: `new Date(year, month, day)` を使用している `getSidebarCountsFallback()` と `listSellers('visitDayBefore')` の結果を比較する
  - テスト対象: `backend/src/services/SellerService.supabase.ts`（`backend/api/` は対象外）
  - テスト内容:
    - 訪問日が木曜日の売主データを用意し、`getSidebarCountsFallback().visitDayBefore` と `listSellers({ statusCategory: 'visitDayBefore' }).total` が一致するか確認
    - `SellerSidebarCountsUpdateService` が計算するカウントとも比較する
    - タイムスタンプ型（`YYYY-MM-DDTHH:MM:SS+09:00`）の `visit_date` を持つ売主でも確認する
  - 修正前のコードで実行し、カウント不一致のカウンターエグザンプルを記録する
  - **期待される結果**: テスト FAIL（バグが存在することを確認）
  - カウンターエグザンプルの例: `getSidebarCountsFallback()` が 2 を返すが `SellerSidebarCountsUpdateService` は 3 を返す
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 訪問日前日以外のカテゴリへの影響なし
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで訪問日前日以外のカテゴリの動作を観察・記録する:
    - `todayCall`（当日TEL）カウントを観察
    - `unvaluated`（未査定）カウントを観察
    - `visitCompleted`（訪問済み）カウントを観察
  - 観察した動作をプロパティベーステストとして記述する:
    - 訪問日前日以外の全カテゴリで、修正前後のカウントが一致することを検証
    - `visit_reminder_assignee` がある売主が訪問日前日カテゴリから除外されることを確認
    - `visit_assignee` が空または「外す」の売主が除外されることを確認
    - 訪問日が空欄の売主が除外されることを確認
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト PASS（保全すべきベースライン動作を確認）
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 訪問日前日タイムゾーン不一致バグの修正

  - [x] 3.1 `getSidebarCountsFallback()` の `visitDayBeforeCount` 計算を修正する
    - `backend/src/services/SellerService.supabase.ts` の `getSidebarCountsFallback()` メソッド（Line ~2551）を修正
    - `new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))` を `new Date(Date.UTC(year, month, day))` に変更
    - `.getDay()` を `.getUTCDay()` に変更
    - `.getDate()` を `.getUTCDate()` に変更
    - `.getFullYear()` を `.getUTCFullYear()` に変更
    - `.getMonth()` を `.getUTCMonth()` に変更
    - `SellerSidebarCountsUpdateService` と同一のロジックに統一する
    - `backend/api/` 配下のファイルは触らない
    - _Bug_Condition: `getSidebarCountsFallback()` が `new Date(year, month, day)` を使用してローカルタイムゾーン依存の曜日計算を行っている_
    - _Expected_Behavior: `Date.UTC(year, month, day)` を使用してタイムゾーン非依存の曜日計算を行い、`SellerSidebarCountsUpdateService` と同じカウントを返す_
    - _Preservation: 訪問日前日以外のカテゴリのカウントは変更しない_
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 3.2 `listSellers()` の `case 'visitDayBefore'` フィルタを修正する
    - `backend/src/services/SellerService.supabase.ts` の `listSellers()` メソッド（Line ~1169）を修正
    - `new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))` を `new Date(Date.UTC(year, month, day))` に変更
    - `.getDay()` を `.getUTCDay()` に変更
    - `.getDate()` を `.getUTCDate()` に変更
    - `.getFullYear()` を `.getUTCFullYear()` に変更
    - `.getMonth()` を `.getUTCMonth()` に変更
    - `SellerSidebarCountsUpdateService` と同一のロジックに統一する
    - `backend/api/` 配下のファイルは触らない
    - _Bug_Condition: `listSellers()` の `visitDayBefore` フィルタが `new Date(year, month, day)` を使用してローカルタイムゾーン依存の曜日計算を行っている_
    - _Expected_Behavior: `Date.UTC(year, month, day)` を使用してタイムゾーン非依存の曜日計算を行い、サイドバーカウントと一致する件数を返す_
    - _Preservation: `visit_reminder_assignee`、`visit_assignee`、`visit_date` の存在確認ロジックは変更しない_
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 訪問日前日カウントと一覧件数の一致
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストが修正後のコードで PASS することを確認する
    - `getSidebarCountsFallback().visitDayBefore` と `listSellers({ statusCategory: 'visitDayBefore' }).total` が一致することを確認
    - `SellerSidebarCountsUpdateService` が計算するカウントとも一致することを確認
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 訪問日前日以外のカテゴリへの影響なし
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - 訪問日前日以外の全カテゴリのカウントが修正前後で変わらないことを確認
    - **期待される結果**: テスト PASS（リグレッションなしを確認）

- [x] 4. チェックポイント — 全テストの通過確認
  - タスク1のバグ条件テストが PASS していることを確認
  - タスク2の保全テストが PASS していることを確認
  - 3箇所すべて（`getSidebarCountsFallback()`、`listSellers()`、`SellerSidebarCountsUpdateService`）が同一の `Date.UTC()` ロジックを使用していることをコードレビューで確認
  - 疑問点があればユーザーに確認する
