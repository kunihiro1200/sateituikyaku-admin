# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Fault Condition** - 担当者別カテゴリー未表示バグ
  - **CRITICAL**: このテストは修正前のコードで FAIL することが期待される（バグの存在を確認）
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: `visit_assignee="Y"` の売主が1件以上存在する具体的なケースにスコープを絞る
  - テスト内容（design.md の Fault Condition より）:
    - `visit_assignee="Y"` の売主が存在する状態で `SellerStatusSidebar` をレンダリングする
    - サイドバーに「担当（Y）」カテゴリーが表示されないことを確認（修正前は FAIL）
    - `visit_assignee="Y"` かつ `next_call_date` が今日以前の売主が存在する状態で「当日TEL(Y)」が表示されないことを確認
    - `visit_assignee="Y"` と `visit_assignee="I"` の両方が存在する場合に個別エントリーが表示されないことを確認
  - テストは修正前のコードで実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（バグの存在を証明）
  - 反例を記録して根本原因を理解する（例: `renderAllCategories()` が担当者別カテゴリーを生成しない）
  - タスク完了条件: テストを作成し、実行し、FAIL を記録した時点
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存カテゴリーの動作維持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで `visit_assignee` が空欄の売主に対して各カテゴリーの件数を観察・記録する
  - 観察内容（design.md の Preservation Requirements より）:
    - `visit_assignee` が空欄の売主が「③当日TEL分」に正しく分類されることを確認
    - `visit_assignee` が空欄でコミュニケーション情報がある売主が「④当日TEL（内容）」に正しく分類されることを確認
    - 未査定・査定（郵送）・当日TEL_未着手・Pinrich空欄の各カテゴリーが正しく動作することを確認
  - プロパティベーステスト: ランダムな売主データで `isTodayCall`、`isTodayCallWithInfo` の結果が修正前後で変わらないことを検証
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作を確認）
  - タスク完了条件: テストを作成し、修正前のコードで PASS を確認した時点
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 担当者別カテゴリー表示バグの修正

  - [x] 3.1 `sellerStatusFilters.ts` に担当者別フィルター関数を追加する
    - 実装前にファイルパスを確認する（`frontend/src/` または `frontend/frontend/src/`）
    - `StatusCategory` 型を拡張して動的カテゴリーIDをサポートする:
      ```typescript
      | `visitAssigned:${string}`
      | `todayCallAssigned:${string}`
      ```
    - `getUniqueAssignees(sellers)` 関数を追加する（「外す」と空文字を除外）
    - `isVisitAssignedTo(seller, assignee)` 関数を追加する
    - `isTodayCallAssignedTo(seller, assignee)` 関数を追加する
    - `filterSellersByCategory` 関数に動的カテゴリーのパターンマッチングを追加する:
      - `visitAssigned:` プレフィックスの処理
      - `todayCallAssigned:` プレフィックスの処理
    - 既存の `isTodayCall`、`isTodayCallWithInfo` などのフィルター関数は変更しない
    - _Bug_Condition: `visit_assignee` に有効な値（「外す」以外）を持つ売主が存在するにもかかわらず担当者別カテゴリーが表示されない_
    - _Expected_Behavior: `getUniqueAssignees` が重複なくイニシャルを返し、`filterSellersByCategory('visitAssigned:Y')` が `visit_assignee="Y"` の売主のみを返す_
    - _Preservation: `isTodayCall`、`isTodayCallWithInfo` などの既存関数は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_

  - [x] 3.2 `SellerStatusSidebar.tsx` に担当者別カテゴリーのレンダリングを追加する
    - 実装前にファイルパスを確認する（`frontend/src/` または `frontend/frontend/src/`）
    - `getUniqueAssignees`、`isVisitAssignedTo`、`isTodayCallAssignedTo` を import する
    - `renderAssigneeCategories()` 関数を追加する:
      - `getUniqueAssignees(validSellers)` でユニークな担当者リストを取得
      - 担当者ごとに「担当（{イニシャル}）」メインカテゴリーボタンを生成（色: `#ff5722`）
      - 当日TEL対象の売主が存在する場合、インデント付きで「当日TEL({イニシャル})」サブカテゴリーを生成
    - `renderAllCategories()` 関数を更新して担当者別カテゴリーを既存カテゴリーの前に追加する
    - 表示イメージ:
      ```
      担当（Y）
        └ 当日TEL(Y)
      担当（I）
        └ 当日TEL(I)
      ```
    - _Bug_Condition: `SellerStatusSidebar.tsx` に動的カテゴリー生成ロジックが存在しない_
    - _Expected_Behavior: 担当者ごとのメインカテゴリーとサブカテゴリーが動的に生成・表示される_
    - _Preservation: 既存の固定カテゴリー（当日TEL分、当日TEL（内容）等）の表示は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3, 3.4_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 担当者別カテゴリー表示
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしており、修正後に PASS するはず
    - 修正後のコードでテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3 の Expected Behavior Properties_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存カテゴリーの動作維持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する（新しいテストを書かない）
    - 修正後のコードでタスク2の保全テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションなし）
    - 全ての既存カテゴリーが引き続き正しく動作することを確認する

- [x] 4. チェックポイント - 全テストの通過確認
  - 全テストが PASS することを確認する
  - 疑問点があればユーザーに確認する
