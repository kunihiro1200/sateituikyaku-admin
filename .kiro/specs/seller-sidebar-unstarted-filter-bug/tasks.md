# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 当日TEL_未着手カウントとリスト件数の不一致
  - **重要**: このテストは未修正コードで必ず FAIL する — 失敗がバグの存在を証明する
  - **修正しないこと**: テストが失敗しても、テストやコードを修正しようとしないこと
  - **注意**: このテストは期待動作をエンコードしている — 修正後にパスすることで修正を検証する
  - **目標**: バグが存在することを示す反例を発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `getSidebarCountsFallback()` と `listSellers({ statusCategory: 'todayCallNotStarted' })` を同一データセットで実行し結果を比較
  - バグ条件（design.mdより）: `seller.status MATCHES ilike('%追客中%') AND seller.status !== '追客中' AND seller.next_call_date <= todayJST`
  - テストケース1: ステータス「除外後追客中」、次電日が今日以前の売主を含むデータセットでカウントとリスト件数が一致しないことを確認
  - テストケース2: 「追客中」と「除外後追客中」が混在するデータセットで不一致を確認
  - 未修正コードでテストを実行する
  - **期待結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見した反例を記録する（例: 「除外後追客中」の売主が `filteredTodayCallSellers` に含まれ、`todayCallNotStartedCount` が `listSellers()` の結果より多くなる）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 他カテゴリへの非影響
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`status === '追客中'` のみのデータセット）の動作を観察する
  - 観察: `todayCall` カウントが「追客中」「他決→追客」の売主を正しく集計することを確認
  - 観察: `pinrichEmpty` カウントが修正前後で変わらないことを確認
  - 観察: `unvaluated` カウントが修正前後で変わらないことを確認
  - プロパティベーステスト: 様々なステータスの組み合わせを生成し、`todayCall`・`todayCallWithInfo`・`pinrichEmpty`・`unvaluated` カウントが修正前後で同一であることを検証
  - `filteredTodayCallSellers` を使用する他のカウント（`todayCallNoInfoCount`、`todayCallWithInfoCount`、`pinrichEmptyCount`）が影響を受けないことを確認
  - 未修正コードでテストを実行する
  - **期待結果**: テストが PASS する（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 当日TEL_未着手カウント・フィルタ不一致バグの修正

  - [x] 3.1 修正を実装する
    - ファイル: `backend/src/services/SellerService.supabase.ts`
    - 関数: `getSidebarCountsFallback()`
    - `filteredTodayCallSellers` から `status === '追客中'`（完全一致）のみを抽出した `notStartedBaseSellers` を作成する
    - `todayCallNotStartedCount` の計算を `filteredTodayCallSellers` から `notStartedBaseSellers` に切り替える
    - `filteredTodayCallSellers` 自体は変更しない（`todayCall`、`todayCallWithInfo`、`pinrichEmpty` の計算に引き続き使用）
    - 修正例:
      ```typescript
      // filteredTodayCallSellers から status === '追客中' のみを抽出
      const notStartedBaseSellers = filteredTodayCallSellers.filter(s => s.status === '追客中');
      const todayCallNotStartedCount = notStartedBaseSellers.filter(s => {
        // 既存の条件（hasInfo, unreachable, confidence, exclusionDate, inquiryDate）
        ...
      }).length;
      ```
    - `listSellers()` の `todayCallNotStarted` との条件一致を確認（`exclusion_date`、`confidence_level`、`unreachable_status`、`inquiry_date >= '2026-01-01'` チェック）
    - _Bug_Condition: `seller.status MATCHES ilike('%追客中%') AND seller.status !== '追客中' AND seller.next_call_date <= todayJST`_
    - _Expected_Behavior: `getSidebarCountsFallback().todayCallNotStarted === listSellers({ statusCategory: 'todayCallNotStarted' }).total`_
    - _Preservation: `filteredTodayCallSellers` を使用する他のカウント（`todayCall`、`todayCallWithInfo`、`pinrichEmpty`）は変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 バグ条件の探索テストが今度はパスすることを確認する
    - **Property 1: Expected Behavior** - 当日TEL_未着手カウントとリスト件数の一致
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストがパスすれば、期待動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 他カテゴリへの非影響
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストのパスを確認する
  - 全テストがパスすることを確認する。疑問が生じた場合はユーザーに確認すること。
