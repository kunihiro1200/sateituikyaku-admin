# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 「当社調べ」面積フィールドが無視されるバグ
  - **重要**: このテストは修正前のコードで実行し、**失敗することを確認する**（失敗 = バグの存在を証明）
  - **修正前にテストが失敗しても、コードを修正しないこと**
  - **目的**: バグが存在することを示すカウンター例を発見する
  - **スコープ付きPBTアプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
    - `landAreaVerified=165.3`, `landArea=150.0`, `buildingAreaVerified=null` の場合、メール本文に `165.3` が含まれることを確認（修正前は失敗）
    - `buildingAreaVerified=99.2`, `buildingArea=90.0`, `landAreaVerified=null` の場合、メール本文に `99.2` が含まれることを確認（修正前は失敗）
    - `landAreaVerified=165.3`, `buildingAreaVerified=99.2` の場合、両方がメール本文に含まれることを確認（修正前は失敗）
  - テスト対象: `handleShowValuationEmailConfirm` 関数（`frontend/frontend/src/pages/CallModePage.tsx` 約2660行目）
  - バグ条件: `property.landAreaVerified IS NOT NULL AND != ''` または `property.buildingAreaVerified IS NOT NULL AND != ''`
  - 期待される動作: 「当社調べ」フィールドの値がメール本文の面積表示に使用される
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**失敗**する（バグの存在を証明）
  - 発見したカウンター例を記録する（例: `landAreaVerified=165.3` があるのにメール本文に `150.0` が表示される）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 「当社調べ」フィールドがない場合の既存動作保持
  - **重要**: 観察優先メソドロジーに従う
  - 修正前のコードで「当社調べ」フィールドがない入力（バグ条件外）の動作を観察する
    - 観察: `landAreaVerified=null`, `buildingAreaVerified=null`, `landArea=150.0`, `buildingArea=90.0` の場合、メール本文に `150.0` と `90.0` が含まれる
    - 観察: `landAreaVerified=undefined`, `buildingAreaVerified=undefined` の場合も同様
    - 観察: 全てnullの場合、「未設定」が表示される
  - 観察した動作パターンをプロパティベーステストとして記述する
    - プロパティ: `landAreaVerified` と `buildingAreaVerified` が両方null/undefinedの場合、メール本文は `landArea` / `buildingArea` の値を使用する
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが**成功**する（ベースラインの動作を確認）
  - テストを作成し、実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2_

- [x] 3. 「当社調べ」面積フィールド優先度バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/CallModePage.tsx` の `handleShowValuationEmailConfirm` 関数（約2660行目）を修正する
    - 修正前: `const landArea = property.landArea || '未設定';`
    - 修正後: `const landArea = property.landAreaVerified || property.landArea || '未設定';`
    - 修正前: `const buildingArea = property.buildingArea || '未設定';`
    - 修正後: `const buildingArea = property.buildingAreaVerified || property.buildingArea || '未設定';`
    - _Bug_Condition: isBugCondition(property) = (property.landAreaVerified IS NOT NULL AND != '') OR (property.buildingAreaVerified IS NOT NULL AND != '')_
    - _Expected_Behavior: メール本文の面積表示に `landAreaVerified || landArea` および `buildingAreaVerified || buildingArea` を使用する_
    - _Preservation: 「当社調べ」フィールドが両方null/undefinedの場合、通常の `landArea` / `buildingArea` を使用する動作を維持する_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2_

  - [x] 3.2 バグ条件探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - 「当社調べ」面積フィールドが優先使用される
    - **重要**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保持テストが引き続き成功することを確認する
    - **Property 2: Preservation** - 「当社調べ」フィールドがない場合の既存動作保持
    - **重要**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認）
    - 修正後も全テストが成功することを確認する

- [x] 4. チェックポイント - 全テストの成功を確認する
  - 全テストが成功していることを確認する。疑問点があればユーザーに確認する。
