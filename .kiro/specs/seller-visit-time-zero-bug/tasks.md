# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 訪問日時のラウンドトリップ不一致バグ
  - **重要**: このプロパティベーステストは修正を実装する**前**に作成すること
  - **目標**: バグが存在することを示すカウンターサンプルを発見する
  - **CRITICAL**: このテストは未修正コードで**FAIL**することが期待される — 失敗がバグの存在を証明する
  - **修正を試みないこと**: テストが失敗しても、コードを修正しようとしないこと
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `appointmentDate: "2026-05-10 10:00:00"` のみ送信（`visitDate` なし）
    - バックエンドの `new Date(data.appointmentDate)` がUTC解釈でズレを発生させることを確認
  - テスト内容（デザインの Bug Condition より）:
    - `updateSeller` に `appointmentDate: "2026-05-10 10:00:00"` のみ渡す
    - `visit_date` が `"2026-05-10 01:00:00"` になること（9時間のズレ）を確認
    - `new Date("2026-05-10 10:00:00")` がUTCとして解釈されることを確認
  - テストアサーション（デザインの Expected Behavior より）:
    - `visit_date` が入力した `"2026-05-10 10:00:00"` と一致すること（タイムゾーン変換なし）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**FAIL**する（これが正しい — バグの存在を証明する）
  - 発見したカウンターサンプルを記録して根本原因を理解する
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正実装前）
  - **Property 2: Preservation** - 訪問日時以外の既存動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - **観察**: 未修正コードでバグ条件に該当しない入力の動作を観察・記録する
    - `visitDate: null` を送信 → `visit_date` が `null` になることを確認
    - `visitDate: "2026-05-10 10:00:00"` を送信（`visitDate` あり）→ `visit_date` が正しく保存されることを確認
    - 訪問日を新規設定 → `visit_acquisition_date` が今日の日付に自動設定されることを確認
    - 訪問日を削除（空欄）して保存 → `visit_acquisition_date` もクリアされることを確認
  - プロパティベーステストを作成（デザインの Preservation Requirements より）:
    - バグ条件に該当しない入力（`visitDate` が指定されている場合）では、修正前後で `visit_date` の保存結果が変わらないこと
    - 訪問日が未設定の場合、フィールドが空欄のまま表示されること
    - 訪問取得日の自動設定ロジックが正しく動作すること
    - カレンダーイベントの作成・更新が正しく行われること
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**PASS**する（ベースライン動作を確認）
  - テストを作成し、実行し、PASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. 訪問日時タイムゾーンバグの修正

  - [x] 3.1 バックエンドの `appointmentDate` 変換処理を削除する
    - `backend/src/services/SellerService.supabase.ts` の `updateSeller` メソッドを修正
    - 行537-551の `appointmentDate` → `visit_date` 変換ブロックを削除
    - `appointment_date` カラムへの保存（行538）は残す（カレンダーイベント作成に使用）
    - `visitDate` が直接指定された場合のみ `visit_date` を更新する処理（行527-529）は維持
    - 修正前: `if (data.appointmentDate && (data as any).visitDate === undefined) { const appointmentDateObj = new Date(data.appointmentDate); ... updates.visit_date = ...; }`
    - 修正後: `if (data.appointmentDate !== undefined) { updates.appointment_date = data.appointmentDate; // appointmentDate経由のvisit_date変換は削除 }`
    - _Bug_Condition: isBugCondition(input) where input.appointmentDate is set AND input.visitDate is undefined AND backend converts via new Date() causing UTC shift_
    - _Expected_Behavior: visit_date は visitDate の値をタイムゾーン変換なしでそのまま保存する_
    - _Preservation: visitDate が指定されている場合の保存処理、appointment_date の保存、visitAcquisitionDate の自動設定ロジックは変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.2 フロントエンドの保存処理を確認・維持する
    - `frontend/frontend/src/pages/CallModePage.tsx` の保存処理を確認
    - `visitDateTimeStr` 生成処理（`YYYY-MM-DD HH:mm:ss` 形式）が維持されていることを確認
    - `visitDate` として送信する処理が維持されていることを確認
    - `appointmentDate` も同じ値で送信する処理が維持されていることを確認（カレンダーイベント作成用）
    - _Requirements: 2.3_

  - [x] 3.3 バックエンドの `visitDate` 返却形式を確認する
    - `backend/src/services/SellerService.supabase.ts` の `decryptSeller` メソッドを確認
    - `visitDate: seller.visit_date || undefined` の返却形式を確認
    - Supabase から返される `visit_date` が UTC ISO 8601 形式（`2026-05-10T01:00:00.000Z`）であることを確認
    - フロントエンドで `new Date()` を使って正しくJST変換されることを確認
    - _Requirements: 2.2_

  - [x] 3.4 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 訪問日時のラウンドトリップ一貫性
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを作成しないこと
    - タスク1のテストはExpected Behaviorをエンコードしている
    - このテストがPASSすることで、期待される動作が満たされていることを確認する
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テストが**PASS**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.5 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存動作の保全
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを作成しないこと
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テストが**PASS**する（リグレッションがないことを確認）
    - 修正後も全テストがPASSすることを確認する

- [x] 4. チェックポイント — 全テストのPASSを確認する
  - 全テスト（バグ条件テスト・保全テスト）がPASSすることを確認する
  - 疑問点があればユーザーに確認する
