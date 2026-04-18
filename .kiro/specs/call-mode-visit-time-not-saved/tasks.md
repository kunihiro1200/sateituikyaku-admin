# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 訪問時間が visit_date に反映されないバグ
  - **重要**: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
  - **修正やコードを直そうとしないこと（テストが失敗しても）**
  - **注意**: このテストは期待動作をエンコードしている。修正後にパスすることでバグ修正を検証する
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `EnhancedAutoSyncService` の `updateSingleSeller` に「訪問日あり・訪問時間あり」のスプレッドシート行を渡す
  - テストケース1: `visitDate = "2026/05/10"`, `visitTime = "14:00"` → `visit_date` が `2026-05-10 14:00:00` になることを期待（バグ条件: `formatVisitDate` のみで上書きされ `2026-05-10 00:00:00` になる）
  - テストケース2: `visitDate = 46151`（Excelシリアル値）, `visitTime = 0.583333`（14:00のシリアル値）→ `visit_date` が `2026-05-10 14:00:00` になることを期待
  - テストケース3: `detectUpdatedSellers` で DB の `visit_date = "2026-05-10 14:00:00"`、スプレッドシートの `訪問日 Y/M/D = "2026/05/10"` → 「変更あり」と検出されることを期待（バグ条件: 日付部分のみ比較で「変更なし」と誤判定）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい。バグの存在を証明する）
  - 見つかった反例を記録して根本原因を理解する（例: `updateSingleSeller` が `visit_date` を `YYYY-MM-DD` のみで保存し時間が `00:00:00` になる）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 訪問時間なし・その他フィールドの動作が変わらない
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードでバグ条件に該当しない入力の動作を観察する
  - 観察1: `visitDate = "2026/05/10"`, `visitTime = ""` → `visit_date = "2026-05-10"` のまま（`00:00:00`）
  - 観察2: `visitDate = ""`, `visitTime = "14:00"` → `visit_date` は更新されない
  - 観察3: `visitDate = ""`, `visitTime = ""` → `visit_date` は更新されない
  - 観察4: `visitAssignee = "田中"` → `visit_assignee` が正しく更新され、`visit_date` は変わらない
  - 観察した動作パターンを捉えるプロパティベーステストを作成する（Preservation Requirements より）
  - 訪問時間が空欄のランダム入力で、修正前後の `visit_date` が同じになることを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これが正しい。保全すべきベースライン動作を確認する）
  - テストを作成・実行し、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [-] 3. visit_date 時間情報消失バグの修正

  - [x] 3.1 `combineVisitDateAndTime` ヘルパーメソッドを追加する
    - `backend/src/services/EnhancedAutoSyncService.ts` に `private combineVisitDateAndTime(visitDate: any, visitTime: any): string | null` を追加
    - `formatVisitDate(visitDate)` で日付部分を取得する
    - `formatVisitTime(visitTime)` で時間部分を取得する
    - 時間が存在する場合: `${formattedDate} ${formattedTime}:00` 形式（`YYYY-MM-DD HH:MM:00`）を返す
    - 時間が存在しない場合: `formattedDate` のみを返す（`00:00:00` として保存される）
    - 日付が null の場合: `null` を返す
    - _Bug_Condition: `isBugCondition(X)` where `X.visitDate` が非null かつ `X.visitTime` が存在する_
    - _Expected_Behavior: `visit_date` が `YYYY-MM-DD HH:mm:ss` 形式で保存される_
    - _Preservation: 訪問時間が空欄の場合は `YYYY-MM-DD` のみ返す（`00:00:00` として保存）_
    - _Requirements: 2.2, 2.3, 3.1, 3.2_

  - [x] 3.2 `updateSingleSeller` の visit_date 更新ロジックを修正する
    - `backend/src/services/EnhancedAutoSyncService.ts` の `updateSingleSeller` メソッド（1384行目付近）を修正
    - `updateData.visit_date = this.formatVisitDate(visitDate)` を `updateData.visit_date = this.combineVisitDateAndTime(visitDate, visitTime)` に変更
    - `visit_time` カラムの更新ロジック（`formatVisitTime`）はそのまま維持する
    - _Bug_Condition: `formatVisitDate` のみで `visit_date` を上書きし時間が消える_
    - _Expected_Behavior: `combineVisitDateAndTime` で日付と時間を結合して保存_
    - _Requirements: 2.2, 2.3_

  - [x] 3.3 `syncSingleSeller` の visit_date 更新ロジックを修正する
    - `backend/src/services/EnhancedAutoSyncService.ts` の `syncSingleSeller` メソッド（1692行目付近）を修正
    - `encryptedData.visit_date = this.formatVisitDate(visitDate)` を `encryptedData.visit_date = this.combineVisitDateAndTime(visitDate, visitTime)` に変更
    - _Bug_Condition: `formatVisitDate` のみで `visit_date` を上書きし時間が消える_
    - _Expected_Behavior: `combineVisitDateAndTime` で日付と時間を結合して保存_
    - _Requirements: 2.2, 2.3_

  - [x] 3.4 `detectUpdatedSellers` の visit_date 比較ロジックを修正する
    - `backend/src/services/EnhancedAutoSyncService.ts` の `detectUpdatedSellers` メソッド（856行目付近）を修正
    - スプレッドシートの `訪問時間` 列も取得: `const sheetVisitTime = sheetRow['訪問時間']`
    - `combineVisitDateAndTime(sheetVisitDate, sheetVisitTime)` で日時文字列を生成する
    - DB の `visit_date` を `YYYY-MM-DD HH:mm` 形式（先頭16文字、`T` を空白に置換）で比較する
    - スプレッドシート側も先頭16文字で比較する（秒は無視）
    - _Bug_Condition: 日付部分のみ比較するため時間の差異を検出できない_
    - _Expected_Behavior: 日時（分まで）を含めて比較し、時間の差異も検出する_
    - _Requirements: 2.2_

  - [x] 3.5 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 訪問時間が visit_date に反映される
    - **重要**: タスク1で作成した同じテストを再実行する。新しいテストを書かないこと
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.2, 2.3_

  - [x] 3.6 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 訪問時間なし・その他フィールドの動作が変わらない
    - **重要**: タスク2で作成した同じテストを再実行する。新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. チェックポイント - 全テストのパスを確認する
  - 全テストがパスしていることを確認する。疑問点があればユーザーに確認する
