# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - contract_date ソートによる誤表示バグ
  - **CRITICAL**: このテストは未修正コードで FAIL することが期待される（バグの存在を証明）
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後に PASS することでバグ修正を検証する
  - **GOAL**: `orderBy: 'contract_date'` が渡されたとき、`distribution_date` 降順ソートになっていないことを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
    - `distribution_date` が入力されているが `contract_date` が空欄の物件（AA13295相当）が先頭付近に表示されないことを確認
    - `distribution_date` が null の物件が末尾に配置されないことを確認
  - バグ条件: `isBugCondition(request)` = `request.params.orderBy = 'contract_date'`
  - 期待される動作: `distribution_date` の降順でソートされ、null は末尾に配置され `property_number` 降順でフォールバック
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（バグの存在を証明）
  - 反例を記録して根本原因を理解する（例: `contract_date` が null の物件が末尾に表示される）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - フィルター・検索・ページネーションの動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件（ソート以外のパラメータのみ変化）のケースを観察する
    - `salesAssignee` フィルターを適用したとき、返ってくる件数・物件を観察する
    - `search` パラメータを指定したとき、返ってくる件数・物件を観察する
    - `limit`・`offset` を変化させたとき、返ってくる物件を観察する
  - 観察した動作をプロパティベーステストとして記述する
    - フィルターパラメータを変化させても、フィルタリング結果の件数・内容が変わらないこと
    - 検索パラメータを変化させても、検索結果の件数・内容が変わらないこと
    - ページネーションパラメータを変化させても、対応する物件が返ってくること
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（ベースラインの動作を確認）
  - テストを書き、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 物件リストソート順バグの修正

  - [x] 3.1 フロントエンドの orderBy パラメータを修正する
    - `frontend/frontend/src/pages/PropertyListingsPage.tsx` の101行目を修正
    - `orderBy: 'contract_date'` を `orderBy: 'distribution_date'` に変更する
    - _Bug_Condition: `isBugCondition(request)` = `request.params.orderBy = 'contract_date'`_
    - _Expected_Behavior: `distribution_date` の降順でソートされ、null は末尾に配置され `property_number` 降順でフォールバック_
    - _Preservation: フィルター・検索・ページネーション・詳細モーダルのロジックは一切変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 バックエンドの getAll() ソートロジックを修正する
    - `backend/src/services/PropertyListingService.ts` の `getAll()` メソッドを修正
    - SELECT句に `distribution_date`、`contract_date`、`settlement_date` を追加する
    - ソートロジックをハードコードに変更する（フロントエンドの `orderBy` パラメータに依存しない）
    - `query.order(orderBy, ...)` を以下に置き換える:
      ```typescript
      query = query
        .order('distribution_date', { ascending: false, nullsFirst: false })
        .order('property_number', { ascending: false });
      ```
    - `nullsFirst: false` により `distribution_date` が null の物件は末尾に配置される
    - _Bug_Condition: `isBugCondition(request)` = `request.params.orderBy = 'contract_date'`_
    - _Expected_Behavior: `distribution_date` 降順 + `property_number` 降順フォールバック_
    - _Preservation: フィルタリング・検索・ページネーションのロジックは変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 フロントエンドコピーの PropertyListingService も同様に修正する
    - `frontend/frontend/src/backend/services/PropertyListingService.ts` に同じ修正を適用する
    - `backend/src/services/PropertyListingService.ts` と同一の変更内容
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - distribution_date による降順ソート
    - **IMPORTANT**: タスク1で書いた同じテストを再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしており、修正後に PASS するはず
    - バグ条件の探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 保全プロパティテストが引き続き PASS することを確認する
    - **Property 2: Preservation** - フィルター・検索・ページネーションの動作保持
    - **IMPORTANT**: タスク2で書いた同じテストを再実行する（新しいテストを書かない）
    - 保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - フィルター・検索・ページネーション・詳細モーダルの動作が変わっていないことを確認する

- [x] 4. チェックポイント - 全テストの PASS を確認する
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
