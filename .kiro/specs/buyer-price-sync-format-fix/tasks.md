# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - priceフィールドのマッピング欠落バグ
  - **重要**: このプロパティベーステストは修正前に作成すること
  - **目的**: バグが存在することを示す反例を発見する
  - **スコープ限定PBTアプローチ**: 具体的な失敗ケースにスコープを絞る: `{ price: 23800000 }` を含む任意の買主レコード
  - `BuyerColumnMapper.mapDatabaseToSpreadsheet({ price: 23800000 })` を呼び出し、結果に `"価格"` キーが存在しないことを確認（design.mdのBug Conditionより）
  - `mapDatabaseToSpreadsheet({ price: 23800000 })` の結果に `"価格": 23800000` が含まれることをアサートする（修正後に通過するテスト）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが失敗する（これがバグの存在を証明する）
  - 発見された反例を記録する（例: `mapDatabaseToSpreadsheet({ price: 23800000 })` の結果に `"価格"` キーが存在しない）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.3, 2.3_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - price以外のフィールドの同期動作保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`price` フィールドを含まないレコード）の動作を観察する
  - 観察例: `mapDatabaseToSpreadsheet({ name: '田中太郎' })` → `{ "●氏名・会社名": '田中太郎' }` が返される
  - 観察例: `mapDatabaseToSpreadsheet({ viewing_date: '2024-01-01' })` → 日付フィールドが正しく変換される
  - プロパティベーステスト: `price` フィールドを含まない全ての入力に対して、修正前後で変換結果が同一であることを確認（design.mdのPreservation Requirementsより）
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが通過する（これがベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードで通過することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. priceフィールドのスプシ同期フォーマットバグを修正する

  - [x] 3.1 buyer-column-mapping.jsonにpriceマッピングを追加する
    - `backend/src/config/buyer-column-mapping.json` の `databaseToSpreadsheet` セクションに `"price": "価格"` を追加する
    - `spreadsheetToDatabaseExtended` セクションには既に `"価格": "price"` が存在するため、逆方向（DB→スプシ）のマッピングを追加するのみ
    - _Bug_Condition: isBugCondition(X) where "price" IN X.updatedFields AND "price" NOT IN databaseToSpreadsheetMapping.keys()_
    - _Expected_Behavior: mapDatabaseToSpreadsheet({ price: 23800000 }) が { "価格": 23800000 } を返す_
    - _Preservation: price以外の全フィールドの変換結果は修正前後で同一_
    - _Requirements: 1.3, 2.1, 2.3_

  - [x] 3.2 BuyerColumnMapper.tsにnumber型の明示的処理を追加する（推奨）
    - `backend/src/services/BuyerColumnMapper.ts` の `formatValueForSpreadsheet` メソッドに `number` 型の明示的処理を追加する
    - `typeConversions` に `"price": "number"` が既に定義されているため、`type === 'number'` の場合に数値として返す処理を追加する
    - 実装例: `if (type === 'number' && value !== null && value !== undefined) { const num = Number(value); return isNaN(num) ? value : num; }`
    - 万円表示の文字列（例: `"2380万円"`）が誤って渡された場合でも `NaN` を返さず元の値を返す安全な実装にする
    - _Bug_Condition: isBugCondition(X) where typeof(X.price) = "string" AND X.price MATCHES /^\d+万円?$/_
    - _Expected_Behavior: formatValueForSpreadsheet(23800000, 'number') が 23800000（数値）を返す_
    - _Preservation: number型以外のフィールドの処理は変更しない_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 バグ条件の探索テストが通過することを確認する
    - **Property 1: Expected Behavior** - priceフィールドの正しい数値書き込み
    - **重要**: タスク1で作成した同じテストを再実行する。新しいテストを作成しないこと
    - タスク1のテストはExpected Behaviorをエンコードしている
    - このテストが通過すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが通過する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.3_

  - [x] 3.4 保全テストが引き続き通過することを確認する
    - **Property 2: Preservation** - price以外のフィールドへの影響なし
    - **重要**: タスク2で作成した同じテストを再実行する。新しいテストを作成しないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが通過する（リグレッションがないことを確認）
    - 修正後も全テストが通過することを確認する

- [x] 4. チェックポイント - 全テストの通過を確認する
  - 全テスト（バグ条件探索テスト・保全テスト）が通過することを確認する
  - 疑問点があればユーザーに確認する
