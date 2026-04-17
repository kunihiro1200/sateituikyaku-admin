# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - AT列物件番号に紐づくBR列（物件担当者）が同期されないバグ
  - **重要**: このテストは未修正コードで必ず**FAIL**する - 失敗がバグの存在を証明する
  - **このテストが失敗しても、テストやコードを修正しないこと**
  - **目的**: バグが存在することを示すカウンターサンプルを発見する
  - **スコープ**: `property_number` が非null・非空文字で、`property_listings` に対応レコードが存在するケース
  - `updateWithSync` を呼び出し、`property_number` を含む更新データを渡す
  - `allowedData` に `property_assignee` が含まれないことを確認（Bug Conditionの確認）
  - `buyer-column-mapping.json` の `databaseToSpreadsheet` に `property_assignee` キーが存在しないことを確認
  - `create` 関数でも同様に `property_assignee` が `appendData` に含まれないことを確認
  - テストを未修正コードで実行する
  - **期待される結果**: テストが**FAIL**する（これが正しい - バグの存在を証明する）
  - 発見されたカウンターサンプルを記録する（例: `allowedData` に `property_assignee` が含まれない）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 物件番号なし・他フィールド更新時の既存動作維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`property_number` が空・null・未定義）の動作を観察する
  - 観察1: `property_number` を含まない更新で、AU列・AY列・BQ列・BR列が変更されないことを確認
  - 観察2: `property_number = ''`（空文字）の場合、物件情報取得処理がスキップされることを確認
  - 観察3: `property_listings` に対応物件がない場合、エラーなく処理継続することを確認
  - 観察4: 内覧日・最新状況など他フィールドの同期が正常に動作することを確認
  - プロパティベーステスト: `property_number` が空・null・未定義の全ケースで、AU列・AY列・BQ列・BR列が変更されないことを検証
  - テストを未修正コードで実行する
  - **期待される結果**: テストが**PASS**する（ベースライン動作を確認する）
  - テストを作成・実行し、パスを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. AT列物件番号同期バグの修正

  - [x] 3.1 `BuyerService.ts` の `updateWithSync` 関数を修正する
    - `select('address, display_address, price')` を `select('address, display_address, price, sales_assignee')` に変更
    - `allowedData.property_assignee = propertyListing.sales_assignee ?? null;` を追加（`price` の代入の直後）
    - _Bug_Condition: isBugCondition(X) where X.property_number が非null かつ 非空文字 AND property_listings に対応レコードが存在する_
    - _Expected_Behavior: allowedData.property_assignee = property_listings[X.property_number].sales_assignee_
    - _Preservation: property_number が含まれない更新リクエスト、または property_number が空の場合は影響を受けない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 `BuyerService.ts` の `create` 関数を修正する
    - `select('address, display_address, price')` を `select('address, display_address, price, sales_assignee')` に変更
    - `appendData.property_assignee = propertyListing.sales_assignee ?? null;` を追加
    - _Bug_Condition: isBugCondition(X) where X.property_number が非null かつ 非空文字 AND property_listings に対応レコードが存在する_
    - _Expected_Behavior: appendData.property_assignee = property_listings[X.property_number].sales_assignee_
    - _Preservation: property_number が空・null の場合は物件情報取得処理がスキップされる_
    - _Requirements: 2.1, 2.2, 3.4_

  - [x] 3.3 `buyer-column-mapping.json` の `databaseToSpreadsheet` セクションを修正する
    - `databaseToSpreadsheet` セクションに `"property_assignee": "物件担当者"` を追加
    - `spreadsheetToDatabase` には既に `"物件担当者": "property_assignee"` が存在することを確認
    - _Bug_Condition: databaseToSpreadsheet に property_assignee キーが存在しない_
    - _Expected_Behavior: databaseToSpreadsheet["property_assignee"] = "物件担当者" → スプレッドシートのBR列に書き込まれる_
    - _Preservation: 既存のマッピングエントリは変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 バグ条件の探索テストが現在パスすることを確認する
    - **Property 1: Expected Behavior** - AT列物件番号に紐づく全列の同期
    - **重要**: タスク1で作成した**同じテスト**を再実行する - 新しいテストを作成しないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが**PASS**する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 保持テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 物件番号なし・他フィールド更新の動作維持
    - **重要**: タスク2で作成した**同じテスト**を再実行する - 新しいテストを作成しないこと
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テストが**PASS**する（リグレッションがないことを確認する）
    - 修正後も全テストがパスすることを確認する

- [x] 4. チェックポイント - 全テストのパスを確認する
  - 全テスト（バグ条件探索テスト・保持テスト）がパスすることを確認する
  - 疑問点があればユーザーに確認する
