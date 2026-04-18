# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - バックグラウンド更新後の `editedExclusiveDecisionDate` 未初期化バグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正を試みないこと**: テストが FAIL しても、テストもコードも修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ限定 PBT アプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `loadAllData` 内のバックグラウンド更新処理をシミュレートするテストを作成する
  - バグ条件（`isBugCondition`）: `pageLoadType === 'cache_hit'` かつ `statusChangedRef.current === false` かつ `freshData.status === '一般媒介'` かつ `setEditedExclusiveDecisionDate` が呼ばれていない
  - テストケース1: `statusChangedRef.current === false` かつ `freshData.status === '一般媒介'` かつ `freshData.contractYearMonth = '2025-03'` の場合、`editedExclusiveDecisionDate` が `'2025-03-01'` に設定されることを確認（修正前は FAIL）
  - テストケース2: `freshData.contractYearMonth = null` の場合、`editedExclusiveDecisionDate` が `''` に設定されることを確認（修正前は FAIL）
  - テストケース3: `freshData.contractYearMonth = '2025-03-15'` の場合、`editedExclusiveDecisionDate` が `'2025-03-15'` に設定されることを確認（修正前は FAIL）
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターエグザンプルを記録して根本原因を理解する（例: 「バックグラウンド更新後に `editedExclusiveDecisionDate` が空文字列のまま」）
  - テストを作成し、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 専任・他決系ステータスおよびその他ステータスでの動作維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（`isBugCondition` が false を返すケース）の動作を観察する
  - 観察1: `freshData.status === '専任媒介'` の場合、`requiresDecisionDate` が `true` を返す
  - 観察2: `freshData.status === '他決→追客'` の場合、`requiresDecisionDate` が `true` を返す
  - 観察3: `freshData.status === '追客中'` の場合、`requiresDecisionDate` が `false` を返す
  - 観察4: `statusChangedRef.current === true` の場合、`editedExclusiveDecisionDate` が上書きされない
  - 観察5: キャッシュなし通常パスでは `setEditedExclusiveDecisionDate` が正しく初期化される
  - 観察された動作パターンをキャプチャするプロパティベーステストを作成する
  - プロパティベーステスト: 専任・他決系ステータスの全パターン（`requiresDecisionDate` が `true` を返すステータス）に対して、`requiresDecisionDate` が `true` を返し続けることを検証
  - プロパティベーステスト: 非対象ステータス（追客中、追客不要、除外済追客不要など）に対して、`requiresDecisionDate` が `false` を返し続けることを検証
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが PASS する（ベースライン動作を確認する）
  - テストを作成し、実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 「状況（当社）」フィールド表示遅延バグの修正

  - [x] 3.1 バックグラウンド更新処理に `setEditedExclusiveDecisionDate` の初期化を追加する
    - `frontend/frontend/src/pages/CallModePage.tsx` の `loadAllData` 関数内を修正する
    - バックグラウンド更新処理（約1585〜1601行目）の `if (!statusChangedRef.current)` ブロックに追加する
    - `contractYearMonth` の変換ロジック（通常パスと同じ）を追加する:
      - `freshData.contractYearMonth` が存在する場合: `YYYY-MM` 形式（7文字）なら `-01` を付加して `YYYY-MM-DD` に変換、それ以外は `split('T')[0]` で日付部分を取得
      - `freshData.contractYearMonth` が `null` の場合: `''` を設定
    - `setEditedExclusiveDecisionDate(formattedDecisionDate)` を呼び出す
    - 変更は `loadAllData` 内のバックグラウンド更新パスのみ。通常パス（キャッシュなし）は変更不要
    - _Bug_Condition: `pageLoadType === 'cache_hit'` かつ `statusChangedRef.current === false` かつ `freshData.status === '一般媒介'` かつ `setEditedExclusiveDecisionDate` が呼ばれていない_
    - _Expected_Behavior: `editedStatus === '一般媒介'` になった瞬間に「専任（他決）決定日」フィールドが即座に表示される_
    - _Preservation: 専任・他決系ステータスでの「専任（他決）決定日」フィールドの表示、マウスクリックによる操作、ページ初期表示時の正しい表示制御は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - バックグラウンド更新後の `editedExclusiveDecisionDate` 正常初期化
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 専任・他決系ステータスおよびその他ステータスでの動作維持
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを作成しない
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - タスク1のバグ条件探索テスト（Property 1）が PASS することを確認する
  - タスク2の保全プロパティテスト（Property 2）が PASS することを確認する
  - 疑問点があればユーザーに確認する
