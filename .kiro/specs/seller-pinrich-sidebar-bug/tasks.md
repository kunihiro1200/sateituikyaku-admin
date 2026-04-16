# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - Pinrich要変更カテゴリ未実装バグ
  - **重要**: このテストは未修正コードで必ず**失敗**する — 失敗がバグの存在を証明する
  - **修正前にテストを書くこと。テストや実装コードを修正しようとしないこと**
  - **目的**: バグが存在することを示すカウンターサンプルを表面化する
  - **スコープ**: 条件Aを満たす売主（`visit_assignee="外す"`, `pinrich_status="クローズ"`, `status="追客中"`）を使って具体的なケースに絞る
  - テスト内容:
    - 条件Aを満たす売主データをモックして `SellerStatusSidebar` をレンダリングし、「Pinrich要変更」ボタンが存在しないことを確認（未修正コードでは `getByText('Pinrich要変更')` が失敗する）
    - `sellerStatusFilters.ts` の `StatusCategory` 型に `pinrichChangeRequired` が含まれていないことを確認
    - `filterSellersByCategory(sellers, 'pinrichChangeRequired')` が存在しないことを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**失敗**する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録する（例: 「`SellerStatusSidebar` に『Pinrich要変更』ボタンが存在しない」）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保持プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 既存カテゴリの動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで既存カテゴリの動作を観察する:
    - `pinrichEmpty` カテゴリ: `pinrich_status` が空欄の売主が正しくカウントされることを確認
    - `todayCall` カテゴリ: 当日TEL対象の売主が正しくカウントされることを確認
    - `exclusive`, `general` カテゴリ: 専任・一般媒介の売主が正しくカウントされることを確認
  - 観察した動作をキャプチャするプロパティベーステストを書く:
    - `pinrichChangeRequired` 条件に関係しない全ての売主に対して、既存カテゴリのカウントが変わらないことを検証
    - `filterSellersByCategory(sellers, 'pinrichEmpty')` が `pinrichChangeRequired` 条件の有無に関わらず同じ結果を返すことを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**成功**する（保持すべきベースライン動作を確認）
  - テストを書き、実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Pinrich要変更カテゴリの実装

  - [x] 3.1 `sellerStatusFilters.ts` に `pinrichChangeRequired` を追加
    - `StatusCategory` 型に `'pinrichChangeRequired'` を追加
    - `isPinrichChangeRequired(seller)` 判定関数を追加（条件A〜Dを評価）:
      - 条件A: `visit_assignee = "外す"` AND `pinrich_status = "クローズ"` AND `status = "追客中"`
      - 条件B: `confidence_level = "D"` AND `pinrich_status` が除外リスト外（`クローズ`, `登録不要`, `アドレスエラー`, `配信不要（他決後、訪問後、担当付）`, `△配信停止`）
      - 条件C: `visit_date` が空欄でない AND `pinrich_status = "配信中"` AND `visit_assignee` が空欄でない AND `status` が `{"専任媒介", "追客中", "除外後追客中"}` のいずれか
      - 条件D: `status` が `{"他決→追客", "他決→追客不要", "一般媒介"}` のいずれか AND `pinrich_status = "クローズ"` AND `contract_year_month >= "2025-05-01"`
    - `calculateCategoryCounts()` に `pinrichChangeRequired` を追加
    - `filterSellersByCategory()` の switch文に `pinrichChangeRequired` ケースを追加
    - _Bug_Condition: isBugCondition(seller) — 条件A〜Dのいずれかを満たす売主_
    - _Expected_Behavior: isPinrichChangeRequired(seller) が true を返し、フィルタリングが正しく動作する_
    - _Preservation: 既存の `isPinrichEmpty` 等の判定関数は変更しない_
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 3.2 `SellerStatusSidebar.tsx` に「Pinrich要変更」ボタンを追加
    - `isPinrichChangeRequired` をインポートに追加
    - `renderAllCategories()` に「Pinrich要変更」ボタンを追加（`pinrichEmpty` ボタンの直前に配置）:
      - `renderCategoryButton('pinrichChangeRequired', 'Pinrich要変更', '#e91e63')` を呼び出す
    - `getCategoryLabel()` に `pinrichChangeRequired` ケースを追加（`'Pinrich要変更'` を返す）
    - `getCategoryColor()` に `pinrichChangeRequired` ケースを追加（`'#e91e63'` を返す）
    - _Bug_Condition: フロントエンドに「Pinrich要変更」ボタンが存在しない_
    - _Expected_Behavior: ボタンが表示され、クリックすると対象売主の一覧が表示される_
    - _Preservation: 既存ボタン・レイアウトは変更しない_
    - _Requirements: 2.4_

  - [x] 3.3 `SellerSidebarCountsUpdateService.ts` に `pinrichChangeRequired` カウント計算を追加
    - `Promise.all` に `pinrichChangeRequired` 用のクエリを追加（既存の `pinrichEmpty` 用クエリのパターンを参考にする）
    - 取得データから条件A〜Dを評価してカウントを算出
    - `rows` 配列に `{ category: 'pinrichChangeRequired', count: pinrichChangeRequiredCount, label: null, assignee: null }` を追加
    - _Bug_Condition: `seller_sidebar_counts` テーブルに `pinrichChangeRequired` レコードが保存されない_
    - _Expected_Behavior: `pinrichChangeRequired` カウントが正しく計算され保存される_
    - _Preservation: 既存カテゴリ（`todayCall`, `pinrichEmpty` 等）のカウント計算ロジックは変更しない_
    - _Requirements: 2.3_

  - [x] 3.4 `SellerService.supabase.ts` の `statusCategory` switch文に `pinrichChangeRequired` ケースを追加
    - 既存の `pinrichEmpty` ケース（約1452行目）の直後に `pinrichChangeRequired` ケースを追加
    - 条件A〜Dを満たす売主を取得するロジックを実装（全件取得後にJS側でフィルタリング）
    - _Bug_Condition: `statusCategory=pinrichChangeRequired` でAPIを呼び出しても対象売主が返されない_
    - _Expected_Behavior: 条件A〜Dを満たす売主のみが返される_
    - _Preservation: 既存の `statusCategory` ケースは変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 バグ条件の探索テストが成功することを確認
    - **Property 1: Expected Behavior** - Pinrich要変更カテゴリの正常表示
    - **重要**: タスク1で書いた**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク1のテストが期待される動作をエンコードしている
    - このテストが成功すれば、期待される動作が満たされたことを確認できる
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 保持テストが引き続き成功することを確認
    - **Property 2: Preservation** - 既存カテゴリの動作保持
    - **重要**: タスク2で書いた**同じテスト**を再実行する — 新しいテストを書かないこと
    - 保持プロパティテスト（タスク2）を実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認）
    - 修正後も全ての既存カテゴリが正しく動作することを確認する

- [x] 4. チェックポイント — 全テストの成功確認
  - 全テストが成功していることを確認する
  - 疑問点があればユーザーに確認する
  - 確認事項:
    - 「Pinrich要変更」ボタンがサイドバーに表示される
    - 条件A〜Dを満たす売主（AA13712を含む）がカテゴリに表示される
    - `seller_sidebar_counts` テーブルに `pinrichChangeRequired` レコードが保存される
    - 既存カテゴリ（`pinrichEmpty` 等）の動作が変わっていない
