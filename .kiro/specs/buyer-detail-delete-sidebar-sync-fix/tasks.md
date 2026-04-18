# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 削除後キャッシュ残存バグ
  - **重要**: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
  - **修正やコードを変えようとしないこと**（FAIL が正しい結果）
  - **目的**: バグが存在することを示すカウンターサンプルを見つける
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `pageDataCache` に `BUYERS_WITH_STATUS` データをセットした状態で `handleDeleteBuyer` を呼び出す
  - 削除後に `pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)` が `null` ではなく古いデータを返すことを確認（Bug Condition: `cacheInvalidatedBeforeNavigation() === false`）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（バグが存在することの証明）
  - カウンターサンプルを記録する（例: 「削除後も `pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)` が古いデータを返す」）
  - テストを書き、実行し、FAIL を確認したらタスク完了とする
  - _Requirements: 1.1_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 非削除操作のキャッシュ不変性
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（削除以外の操作）を実行して動作を観察する
  - 観察: 詳細画面を閲覧するだけでは `pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)` が変化しない
  - 観察: 買主情報を編集・保存しても `pageDataCache.invalidate` は呼ばれない（既存の更新ロジックを通じて処理される）
  - 観察: 削除ダイアログをキャンセルしてもキャッシュが変化しない
  - プロパティベーステスト: 削除以外のランダムな操作（閲覧・編集・キャンセル）に対して、操作前後でキャッシュが変化しないことを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（保全すべきベースライン動作の確認）
  - テストを書き、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 削除後サイドバー即時同期バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/BuyerDetailPage.tsx` を編集する
    - `pageDataCache` と `CACHE_KEYS` を `../store/pageDataCache` からインポートする
    - `handleDeleteBuyer` 内の `navigate('/buyers')` の直前に `pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS)` を追加する
    - _Bug_Condition: `input.action === 'delete' AND buyerExistsInCache(input.buyerNumber, CACHE_KEYS.BUYERS_WITH_STATUS) AND NOT cacheInvalidatedBeforeNavigation()`_
    - _Expected_Behavior: `pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS) === null` かつ `navigate('/buyers')` が呼ばれること_
    - _Preservation: 削除以外の操作（閲覧・編集・キャンセル）ではキャッシュが変化しないこと_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 削除後キャッシュ無効化
    - **重要**: タスク1で書いた同じテストを再実行すること（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことの確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非削除操作のキャッシュ不変性
    - **重要**: タスク2で書いた同じテストを再実行すること（新しいテストを書かない）
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことの確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント - 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
