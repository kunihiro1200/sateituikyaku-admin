# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 買主件数の一覧・詳細不一致バグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — 失敗がバグの存在を証明する
  - **修正やコードを変更しないこと（テストが失敗しても）**
  - **目的**: バグが存在することを示すカウンターサンプルを発見する
  - **スコープ付き PBT アプローチ**: 決定論的バグのため、具体的な失敗ケース（AA9729）にスコープを絞る
  - `getBuyerCountsForProperties(['AA9729'])` の結果と `getBuyersForProperty('AA9729').length` を比較するテストを作成する（design.md の Bug Condition 参照）
  - テストのアサーション: `countFromList === countFromDetail` が成立することを期待する（修正前は失敗する）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例: `getBuyerCountsForProperties(['AA9729'])` が 2 を返し、`getBuyersForProperty('AA9729').length` が 8 を返す）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.3, 2.1, 2.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非バグ条件入力の動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 観察: 未修正コードで買主が 0 件の物件に対して `getBuyerCountsForProperties` が 0 を返すことを確認する
  - 観察: 未修正コードで `deleted_at IS NOT NULL` の買主が存在する物件で、削除済みが除外されることを確認する
  - 観察: 未修正コードで `getBuyersForProperty` の動作が変わらないことを確認する
  - プロパティベーステストを作成する: `isBugCondition(X)` が false の全入力に対して、修正前後の `getBuyerCountsForProperties` が同じ結果を返すことを検証する（design.md の Preservation Requirements 参照）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成・実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 買主件数表示バグの修正

  - [x] 3.1 `getBuyerCountsForProperties` のクエリロジックを修正する
    - `backend/src/services/BuyerLinkageService.ts` を編集する
    - 全件取得 + アプリケーション側集計のロジックを削除する
    - 各物件番号に対して `Promise.all` で並列に `.eq('property_number', propNum)` + `.is('deleted_at', null)` + `{ count: 'exact', head: true }` を使用した直接カウントに変更する
    - エラー時は 0 件を返す（`console.error` でログ出力）
    - _Bug_Condition: `getBuyerCountsForProperties([X.propertyNumber])[X.propertyNumber] ≠ getBuyersForProperty(X.propertyNumber).length` (design.md Bug Condition 参照)_
    - _Expected_Behavior: `countFromList' === countFromDetail` — 一覧と詳細の件数が一致する (design.md Fix Implementation 参照)_
    - _Preservation: 0件物件・削除済み除外・詳細画面の動作は変更しない (design.md Preservation Requirements 参照)_
    - _Requirements: 2.1, 2.3, 3.2, 3.3_

  - [x] 3.2 `BuyerLinkageCache` のキャッシュ TTL を見直す
    - `backend/src/services/BuyerLinkageCache.ts` を編集する
    - `CACHE_TTL` を 3600秒（1時間）から短縮する（例: 300秒 = 5分）
    - または買主追加・削除時にキャッシュを無効化する処理を追加することを検討する
    - _Bug_Condition: キャッシュの古い値が返される場合も `isBugCondition` が true になる (design.md Bug Details 参照)_
    - _Requirements: 2.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 買主件数の一覧・詳細一致
    - **重要**: タスク 1 で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク 1 のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされたことを確認できる
    - タスク 1 のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.3_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非バグ条件入力の動作保持
    - **重要**: タスク 2 で作成した同じテストを再実行する — 新しいテストを書かないこと
    - タスク 2 の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - タスク 1 のバグ条件探索テスト（Property 1）が PASS することを確認する
  - タスク 2 の保全プロパティテスト（Property 2）が PASS することを確認する
  - 疑問点があればユーザーに確認する
