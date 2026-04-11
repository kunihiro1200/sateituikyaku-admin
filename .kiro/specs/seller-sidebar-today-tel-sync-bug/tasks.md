# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 次電日変更がサイドバーに即時反映されないバグ
  - **重要**: このテストは未修正コードで実行し、**失敗することを確認する**（バグの存在を証明）
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ**: 以下の2つの具体的なバグ経路に絞る
    - 経路1: `detectUpdatedSellers()` がスプレッドシートの次電日変更を検出できない
    - 経路2: DBの `next_call_date` を直接変更しても `getSidebarCounts()` に即時反映されない
  - テスト1: `formatVisitDate('2026/7/18')` が `'2026-07-18'` を返すか確認（`EnhancedAutoSyncService.ts`）
  - テスト2: スプレッドシートの次電日が `'2026-07-18'`、DBの `next_call_date` が古い値の場合、`detectUpdatedSellers()` が該当売主を検出するか確認
  - テスト3: DBの `next_call_date` を今日より未来の日付に変更した後、`getSidebarCounts()` が即時に「当日TEL分」から除外するか確認（`seller_sidebar_counts` テーブルに依存している場合は失敗する）
  - 未修正コードで実行 → **失敗が期待される結果**（バグの存在を確認）
  - 反例を記録する（例: `getSidebarCounts()` が `seller_sidebar_counts` の古いデータを返す）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 次電日が今日以前の売主は「当日TEL分」に引き続き含まれる
  - **重要**: 観察優先メソドロジーに従う
  - 観察: 未修正コードで次電日が今日以前の売主（追客中・コミュニケーション情報が全て空・営担なし）が「当日TEL分」に含まれることを確認
  - 観察: 未修正コードで次電日が今日より未来の売主は「当日TEL分」に含まれないことを確認（DBが正しい場合）
  - プロパティベーステスト: ランダムな `next_call_date`（今日以前・今日・今日以降・null）に対して `isTodayCall()` の判定が正しいことを確認
  - プロパティベーステスト: 次電日以外のフィールド（状況、営担など）の同期が正常に動作することを確認
  - 未修正コードで実行 → **成功が期待される結果**（ベースライン動作を確認）
  - テストを書き、実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 「当日TEL分」サイドバー即時反映バグの修正

  - [x] 3.1 `getSidebarCounts()` をDBの現在値から直接計算するように変更
    - `backend/src/services/SellerService.supabase.ts` の `getSidebarCounts()` を修正
    - `seller_sidebar_counts` テーブルへの依存を排除し、常に `getSidebarCountsFallback()` を呼ぶように変更
    - `getSidebarCountsFallback()` の60秒インメモリキャッシュを短縮（30秒）または削除を検討
    - 修正後のコード例:
      ```typescript
      async getSidebarCounts() {
        // seller_sidebar_countsテーブルへの依存を排除
        // 常にDBの現在値から計算する
        return this.getSidebarCountsFallback();
      }
      ```
    - _Bug_Condition: isBugCondition(input) where dbNextCallDate > today AND seller_sidebar_counts.todayCall includes input.sellerNumber_
    - _Expected_Behavior: getSidebarCounts() がDBの現在値に基づいて計算し、next_call_date > today の売主を「当日TEL分」から除外する_
    - _Preservation: getSidebarCountsFallback() の計算ロジック自体は変更しない_
    - _Requirements: 2.3, 3.1_

  - [x] 3.2 `detectUpdatedSellers()` の `next_call_date` 比較ロジックを強化
    - `backend/src/services/EnhancedAutoSyncService.ts` の `detectUpdatedSellers()` を修正
    - `formatVisitDate()` の変換結果を詳細にログ出力してフォーマット不一致を特定
    - スプレッドシートの次電日が空欄になった場合（DBに値がある場合）も差分として検出することを確認
    - 修正後のコード例:
      ```typescript
      const formattedNextCallDate = sheetNextCallDate ? this.formatVisitDate(sheetNextCallDate) : null;
      const dbNextCallDate = dbSeller.next_call_date ? String(dbSeller.next_call_date).substring(0, 10) : null;
      if (formattedNextCallDate !== dbNextCallDate) {
        console.log(`[detectUpdated] ${sellerNumber}: next_call_date changed: sheet="${formattedNextCallDate}" db="${dbNextCallDate}"`);
        needsUpdate = true;
      }
      ```
    - _Bug_Condition: isBugCondition(input) where spreadsheetNextCallDate != dbNextCallDate AND detectUpdatedSellers() does NOT include input.sellerNumber_
    - _Expected_Behavior: detectUpdatedSellers() がスプレッドシートの次電日変更を確実に検出する_
    - _Preservation: 次電日以外のフィールドの差分検出ロジックは変更しない_
    - _Requirements: 2.2, 3.2, 3.3_

  - [x] 3.3 `updateSingleSeller()` での `next_call_date` クリア処理を確認
    - `backend/src/services/EnhancedAutoSyncService.ts` の `updateSingleSeller()` を確認
    - スプレッドシートの次電日が空欄の場合、DBの `next_call_date` を `null` でクリアすることを確認
    - `columnMapper.mapToDatabase()` が空欄を `null` に変換しているか確認
    - 必要に応じて明示的なクリア処理を追加: `next_call_date: mappedData.next_call_date || null`
    - _Requirements: 2.2_

  - [x] 3.4 バグ条件の探索テストが成功することを確認
    - **Property 1: Expected Behavior** - 次電日変更がサイドバーに即時反映される
    - **重要**: タスク1で書いた**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストを修正後のコードで実行
    - **期待される結果**: テストが成功する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.3 の Expected Behavior Properties_

  - [x] 3.5 保全テストが引き続き成功することを確認
    - **Property 2: Preservation** - 次電日が今日以前の売主は「当日TEL分」に引き続き含まれる
    - **重要**: タスク2で書いた**同じテスト**を再実行する（新しいテストを書かない）
    - タスク2の保全プロパティテストを修正後のコードで実行
    - **期待される結果**: テストが成功する（リグレッションなし）
    - 他のサイドバーカテゴリー（訪問済み、未査定など）のカウントも正しいことを確認

- [-] 4. チェックポイント - 全テストの成功を確認
  - 全テストが成功することを確認する
  - 疑問点があればユーザーに確認する
