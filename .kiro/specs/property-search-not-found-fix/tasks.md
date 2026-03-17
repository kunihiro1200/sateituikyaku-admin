# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 全件取得の打ち切りバグ・buyer_name欠落バグ
  - **CRITICAL**: このテストは未修正コードで**FAIL**することが期待される — FAILがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしており、修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターエグザンプルを発見する
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - バグ1テスト: `total=1500`、`limit=1000`の場合に`fetchAllData`が1000件で打ち切られることを確認（未修正コードで失敗）
  - バグ2テスト: `getAll`のレスポンスに`buyer_name`が含まれないことを確認（未修正コードで失敗）
  - テストアサーション: 修正後の期待動作（全件取得・buyer_name含有）を記述する
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストがFAILする（これが正しい — バグの存在を証明する）
  - カウンターエグザンプルを記録して根本原因を理解する（例: `total=1500`で1000件止まり、`buyer_name`が`undefined`）
  - テストを作成・実行し、FAILを確認したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存フィルタリング・ページネーション動作の保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（検索バー未使用時）の動作を観察する
  - 観察: サイドバーフィルタが正しく動作することを確認
  - 観察: 担当者フィルタが正しく動作することを確認
  - 観察: ページネーション操作が正しく動作することを確認
  - 観察: 物件行クリックで詳細ページへ遷移することを確認
  - 観察した動作をプロパティベーステストとして記述する（Preservation Requirementsに基づく）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストがPASSする（これがベースライン動作を確認する）
  - テストを作成・実行し、PASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 物件リスト検索バグの修正

  - [x] 3.1 フロントエンドのページネーション終了条件を修正する
    - `frontend/frontend/src/pages/PropertyListingsPage.tsx`の`fetchAllData`関数を修正する
    - `allListingsData.length >= listingsRes.data.total`の条件を削除し、`fetchedData.length < limit`のみで終了判定する
    - 修正前: `if (fetchedData.length < limit || allListingsData.length >= listingsRes.data.total)`
    - 修正後: `if (fetchedData.length < limit)`
    - _Bug_Condition: isBugCondition(input) where total > limit かつ allListingsData.length < total で打ち切りが発生_
    - _Expected_Behavior: fetchAllData_fixed() で result.length == total が成立する_
    - _Preservation: 検索バー未使用時のフィルタ・ページネーション動作は変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 バックエンドのSELECT文にbuyer_nameを追加する
    - `backend/src/services/PropertyListingService.ts`の`getAll`メソッドのSELECT文に`buyer_name`カラムを追加する
    - _Bug_Condition: isBugCondition(input) where searchQuery targets buyer_name かつ buyer_name IS undefined_
    - _Expected_Behavior: getAll_fixed() のレスポンスに buyer_name が含まれる_
    - _Preservation: buyer_name以外のフィールドのレスポンス内容は変更しない_
    - _Requirements: 2.3_

  - [x] 3.3 バグ条件の探索テストがPASSすることを確認する
    - **Property 1: Expected Behavior** - 全件取得の完全性・buyer_name検索の正確性
    - **IMPORTANT**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしており、修正後にPASSすることで修正を検証する
    - バグ1テスト: `total=1500`の場合に全1500件が取得されることを確認
    - バグ2テスト: `getAll`のレスポンスに`buyer_name`が含まれることを確認
    - **EXPECTED OUTCOME**: テストがPASSする（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 保全テストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - 既存フィルタリング・ページネーション動作の保持
    - **IMPORTANT**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かない
    - **EXPECTED OUTCOME**: テストがPASSする（リグレッションがないことを確認）
    - 修正後も全てのフィルタ・ページネーション動作が保持されていることを確認する

- [x] 4. チェックポイント — 全テストがPASSすることを確認する
  - 全テストがPASSすることを確認する。疑問点があればユーザーに確認する。
