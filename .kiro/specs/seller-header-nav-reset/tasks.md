# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - ヘッダー「売主リスト」ボタンがフィルターをリセットしないバグ
  - **CRITICAL**: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `SellersPage` をレンダリングし、サイドバーで `selectedCategory = 'todayCall'` を設定した状態で `PageNavigation` の「売主リスト」ボタンをクリックする
  - テストアサーション: ボタンクリック後に `selectedCategory` が `'all'` になること（Bug Condition: `isBugCondition` が true の場合）
  - 複合カテゴリ `'visitAssigned:山田'` でも同様にテストする
  - `sessionStorage` に `selectedStatusCategory` が保存された状態でボタンをクリックし、クリアされることを確認する
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: ボタンクリック後も `selectedCategory` が `'todayCall'` のまま）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保持プロパティテストを書く（修正実装前に）
  - **Property 2: Preservation** - バグ条件に該当しない操作の動作が変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで、バグ条件に該当しない入力（`isBugCondition` が false を返すケース）の動作を観察する
  - 観察1: サイドバーのカテゴリ（例：「当日TEL分」）をクリックすると `selectedCategory` が `'todayCall'` に変わる
  - 観察2: 「← 全件表示」ボタンを押すと `selectedCategory` が `'all'` にリセットされる
  - 観察3: ヘッダーの「買主リスト」「物件リスト」ボタンを押すと、それぞれのページに遷移する（`selectedCategory` は変化しない）
  - 観察4: 検索・フィルター操作は `selectedCategory` に影響しない
  - プロパティベーステスト: `'/'` 以外のパスへのナビゲーション（`onNavigate` コールバック）では `selectedCategory` が変化しないことを検証
  - プロパティベーステスト: サイドバークリックで任意のカテゴリが正しく設定されることを検証
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これがベースラインの動作を確認する）
  - テストを書き、実行し、修正前コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. ヘッダー「売主リスト」ボタンのフィルターリセットバグを修正する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/SellersPage.tsx` を編集する
    - `PageNavigation` コンポーネントに `onNavigate` コールバックを渡す
    - `path === '/'` のとき `setSelectedCategory('all')` を呼び出す
    - `path === '/'` のとき `setPage(0)` を呼び出す
    - `path === '/'` のとき `sessionStorage.removeItem('selectedStatusCategory')` を呼び出す
    - `navigate(path)` は既存通り呼び出す（他のナビゲーションパスへの影響なし）
    - _Bug_Condition: `isBugCondition(input)` — `input.buttonClicked === 'seller-list-header-nav'` AND `input.selectedCategory !== 'all'` AND `NOT categoryResetTriggered(input)`_
    - _Expected_Behavior: ボタン押下後に `selectedCategory === 'all'`、`page === 0`、`sessionStorage.getItem('selectedStatusCategory') === null`_
    - _Preservation: サイドバークリック、「全件表示」ボタン、検索・フィルター操作、他のナビゲーションボタンの動作は変化しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - ヘッダー「売主リスト」ボタンがフィルターをリセットする
    - **IMPORTANT**: タスク1で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保持テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - バグ条件に該当しない操作の動作が変わらない
    - **IMPORTANT**: タスク2で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後もすべてのテストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — すべてのテストが PASS することを確認する
  - すべてのテストが PASS することを確認する。疑問が生じた場合はユーザーに確認する。
