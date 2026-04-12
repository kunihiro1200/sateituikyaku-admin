# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 買付削除後のlatest_statusクリア漏れ
  - **重要**: このテストは修正前のコードで必ず**FAIL**すること（バグの存在を確認するため）
  - **修正前のコードでテストを実行し、FAILを確認してから次のステップへ進む**
  - **テストがFAILしても修正しないこと（バグの存在証明が目的）**
  - **目標**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ限定PBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `latest_status` に「買」を含む買主（例: 「買（専任　両手）」「買（一般　両手）」）を削除した場合
  - テスト内容（`backend/src/services/BuyerService.ts` の `softDelete` を対象）:
    - `latest_status` が「買（専任　両手）」の買主に対して `softDelete` を呼び出す
    - 実行後、DBの `buyers.latest_status` が「買」を含んだままであることをアサート（修正前はFAIL）
    - 実行後、`/api/property-listings/:propertyNumber/buyers` のレスポンスに当該買主の「買」ステータスが残ることをアサート
  - テストを実行し、FAILを確認する（期待通りの結果）
  - カウンターエグザンプルを記録する（例: 「softDelete後もlatest_statusが『買（専任　両手）』のまま残っている」）
  - _Requirements: 1.1, 1.2_

- [x] 2. 保存プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非買付ステータス買主の削除動作保存
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（`isBugCondition` が false を返すケース）の動作を観察する:
    - `latest_status` が「内覧済み」「追客中」「検討中」等（「買」を含まない）の買主を削除
    - 削除後の動作を観察・記録する
  - 観察した動作をプロパティベーステストとして記述:
    - 「買」を含まない任意の `latest_status` 値を持つ買主を削除しても、ヘッダーの買付バッジ表示に影響しないことを検証
    - 買付新規登録後にヘッダーが正しく更新されることを検証
    - 物件情報（価格・住所等）の更新でヘッダー表示が変わらないことを検証
    - 同一物件に複数の「買」ステータス買主がいる場合、1件削除後も残りの買主がいればヘッダーが表示されたままであることを検証
  - 修正前のコードでテストを実行し、**PASS**することを確認する（ベースライン動作の確認）
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 買付削除後のヘッダー即時消去バグを修正する

  - [x] 3.1 BuyerService.softDelete() で latest_status をクリアする
    - `backend/src/services/BuyerService.ts` の `softDelete(buyerId: string)` メソッドを修正
    - `deleted_at` を設定する際、同時に `latest_status` を空文字列（`''`）に更新する
    - これにより、論理削除後に `/api/property-listings/:propertyNumber/buyers` が当該買主を返しても `hasBuyerPurchaseStatus` が `false` を返すようになる
    - _Bug_Condition: isBugCondition(input) where input.action == "delete_buyer" AND input.buyerLatestStatus INCLUDES "買"_
    - _Expected_Behavior: softDelete後、buyers.latest_status が空文字列になり、ヘッダーの買付バッジが即座に消える_
    - _Preservation: 「買」を含まないlatest_statusを持つ買主の削除動作は変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 削除後に property_listings.offer_status を直接DB更新する
    - `backend/src/routes/buyers.ts` の `router.delete('/:id', ...)` ハンドラーを修正
    - 削除対象買主の `latest_status` に「買」が含まれる場合、紐づく物件の `property_listings.offer_status` を直接DBで更新する
    - 同一物件に他の「買」ステータス買主が存在する場合はクリアしない（複数買主の正常動作を保持）
    - _Bug_Condition: isBugCondition(input) where input.buyerLatestStatus INCLUDES "買"_
    - _Expected_Behavior: 他に「買」ステータス買主がいない場合、property_listings.offer_status が即座にクリアされる_
    - _Preservation: 他に「買」ステータス買主が残っている場合はoffer_statusを変更しない_
    - _Requirements: 2.1, 2.2, 3.1_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 買付削除後のlatest_statusクリア漏れ
    - **重要**: タスク1で作成した**同じテスト**を再実行すること（新しいテストを書かない）
    - タスク1のテストは期待動作をエンコードしており、修正後にPASSすることでバグ修正を確認する
    - バグ条件の探索テストを実行する
    - **期待結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保存プロパティテストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非買付ステータス買主の削除動作保存
    - **重要**: タスク2で作成した**同じテスト**を再実行すること（新しいテストを書かない）
    - 保存プロパティテストを実行する
    - **期待結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正前と同一の動作が保持されていることを確認する

- [x] 4. チェックポイント - 全テストのパスを確認する
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
