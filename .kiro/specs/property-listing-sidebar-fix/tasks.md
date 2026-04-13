# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - サイドバー枠線 & 「林専任公開中」フィルター不具合
  - **CRITICAL**: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしており、修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - バグ1テスト: `PropertySidebarStatus` をレンダリングし、`<Paper>` コンポーネントに `boxShadow: 'none'` と `border: 'none'` が設定されていないことを確認（`isBugCondition_Border`: `component.elevation IS NOT 0 AND component.sx.boxShadow IS NOT 'none'`）
  - バグ2テスト: `sidebarStatus === '林専任公開中'` の場合に `filteredListings` が空になることを確認（`isBugCondition_Filter`: `sidebarStatus === '林専任公開中' AND '林専任公開中' NOT IN filterArray AND '林専任公開中' NOT IN assigneeMap`）
  - バグ2テスト（古いデータ）: `sidebar_status === '専任・公開中'` かつ `sales_assignee === '林田'` の物件が `sidebarStatus === '林専任公開中'` でフィルタリングされないことを確認
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見したカウンターサンプルを記録して根本原因を理解する
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 既存の専任公開中フィルター動作の維持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（`sidebarStatus !== '林専任公開中'`）の動作を観察する
  - 観察1: `sidebarStatus === 'Y専任公開中'` の場合、担当者「Y」の物件が正しくフィルタリングされる
  - 観察2: `sidebarStatus === '生・専任公開中'` の場合、担当者「生田」の物件が正しくフィルタリングされる
  - 観察3: `sidebarStatus === '未完了'` などその他カテゴリーが正しく動作する
  - 観察4: `<List>` コンポーネントに `maxHeight: 'calc(100vh - 200px)'` と `overflow: 'auto'` が維持されている
  - プロパティベーステスト: `'林専任公開中'` 以外の全 sidebarStatus で修正前後の `filteredListings` が一致することを確認
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成し、実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 物件リストサイドバーの2バグ修正

  - [x] 3.1 バグ1修正: PropertySidebarStatus.tsx の Paper コンポーネントにスタイルを追加
    - `frontend/frontend/src/components/PropertySidebarStatus.tsx` を編集する
    - `<Paper sx={{ width: 210, flexShrink: 0 }}>` を `<Paper sx={{ width: 210, flexShrink: 0, boxShadow: 'none', border: 'none' }}>` に変更する
    - _Bug_Condition: isBugCondition_Border(component) where component.elevation IS NOT 0 AND component.sx.boxShadow IS NOT 'none'_
    - _Expected_Behavior: Paper コンポーネントに boxShadow: 'none', border: 'none' が適用され、枠線が表示されない_
    - _Preservation: List コンポーネントの maxHeight と overflow: 'auto' は変更しない_
    - _Requirements: 2.1, 3.3_

  - [x] 3.2 バグ2修正: PropertyListingsPage.tsx の assigneeMap とフィルタリング条件配列に「林専任公開中」を追加
    - `frontend/frontend/src/pages/PropertyListingsPage.tsx` を編集する
    - `assigneeMap` に `'林専任公開中': '林田'` を追加する
    - フィルタリング条件配列 `['Y専任公開中', '生・専任公開中', '久・専任公開中', 'U専任公開中', '林・専任公開中', 'K専任公開中', 'R専任公開中', 'I専任公開中']` に `'林専任公開中'` を追加する
    - _Bug_Condition: isBugCondition_Filter(sidebarStatus, assigneeMap, filterArray) where sidebarStatus === '林専任公開中' AND '林専任公開中' NOT IN filterArray AND '林専任公開中' NOT IN assigneeMap_
    - _Expected_Behavior: sidebarStatus === '林専任公開中' の場合、sidebar_status === '林専任公開中' の物件、または sidebar_status === '専任・公開中' かつ sales_assignee === '林田' の物件が filteredListings に含まれる_
    - _Preservation: '林専任公開中' 以外の sidebarStatus による filteredListings の結果は変更しない_
    - _Requirements: 2.2, 3.1, 3.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - サイドバー枠線 & 「林専任公開中」フィルター修正確認
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 既存の専任公開中フィルター動作の維持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
