# 実装計画：買主番号スプレッドシート採番

## 概要

`BuyerNumberSpreadsheetClient` クラスを新規作成し、`BuyerService.generateBuyerNumber()` の内部実装をスプレッドシート参照方式に変更する。外部インターフェース（`GET /api/buyers/next-buyer-number`、`POST /api/buyers`）は変更しない。

## タスク

- [x] 1. `BuyerNumberSpreadsheetClient` クラスを実装する
  - `backend/src/services/BuyerNumberSpreadsheetClient.ts` を新規作成する
  - コンストラクタで `GoogleSheetsClient` インスタンスと参照セルアドレス（`cell`）を受け取る
  - `getNextBuyerNumber(): Promise<string>` メソッドを実装する
    - `sheetsClient.readRange(cell)` でセルの値を取得する
    - `SheetRow` オブジェクトから値を取り出す（`rows[0]` の最初のプロパティ値）
    - 空欄の場合は `Buyer number cell <cell> is empty` エラーをスロー
    - `parseInt()` で数値変換し、`NaN` の場合は `Buyer number cell value is not a valid number: <値>` エラーをスロー
    - `String(n + 1)` を返す
    - エラーは `console.error('[BuyerNumberSpreadsheetClient] ...')` でログ出力する
  - _要件: 1.1, 1.2, 1.4, 2.1, 2.2, 2.3, 2.4_

  - [ ]* 1.1 `getNextBuyerNumber()` のユニットテストを作成する
    - `backend/src/services/__tests__/BuyerNumberSpreadsheetClient.test.ts` を新規作成する
    - `GoogleSheetsClient` をモック化する
    - B2セルの値が `"4370"` のとき `"4371"` を返すこと
    - B2セルの値が `"0"` のとき `"1"` を返すこと（エッジケース）
    - B2セルの値が空文字列のときエラーをスローすること（要件 2.3）
    - B2セルの値が `"abc"` のときエラーをスローすること（要件 2.2）
    - スプレッドシートアクセスが失敗したときエラーをスローすること（要件 2.1）
    - _要件: 1.2, 2.1, 2.2, 2.3_

  - [ ]* 1.2 Property 1 のプロパティテストを作成する
    - `backend/src/services/__tests__/BuyerNumberSpreadsheetClient.property.test.ts` を新規作成する
    - `fast-check` を使用する
    - **Property 1: B2セルの値+1が次の買主番号になる**
    - **Validates: Requirements 1.2**
    - `fc.integer({ min: 0, max: 99999 })` で任意の非負整数 n を生成し、B2=String(n) のとき結果が `String(n+1)` であることを検証する（numRuns: 100）
    - _要件: 1.2_

  - [ ]* 1.3 Property 2 のプロパティテストを作成する
    - **Property 2: 数値でない入力値はエラーをスローする**
    - **Validates: Requirements 2.2, 2.3**
    - `fc.oneof(fc.constant(''), fc.string().filter(s => isNaN(parseInt(s, 10))))` などで数値として解釈できない文字列を生成し、エラーがスローされることを検証する（numRuns: 100）
    - _要件: 2.2, 2.3_

- [x] 2. `BuyerService` に `initBuyerNumberClient()` を追加し `generateBuyerNumber()` を変更する
  - `backend/src/services/BuyerService.ts` を編集する
  - `initBuyerNumberClient(): Promise<BuyerNumberSpreadsheetClient>` プライベートメソッドを追加する
    - 環境変数 `BUYER_NUMBER_SPREADSHEET_ID` が未設定の場合は `BUYER_NUMBER_SPREADSHEET_ID is not set` エラーをスロー（要件 3.4）
    - `GoogleSheetsConfig` を構築する（`spreadsheetId`、`sheetName`、サービスアカウント認証情報）
    - `BUYER_NUMBER_SHEET_NAME` のデフォルト値は `連番`（要件 3.2）
    - `BUYER_NUMBER_CELL` のデフォルト値は `B2`（要件 3.3）
    - `GoogleSheetsClient` を生成して `authenticate()` を呼び出す
    - `BuyerNumberSpreadsheetClient` を生成して返す
  - `generateBuyerNumber()` の実装を `initBuyerNumberClient()` 経由に変更する（DBクエリを削除）
  - _要件: 1.1, 1.3, 1.4, 3.1, 3.2, 3.3, 3.4_

  - [ ]* 2.1 環境変数まわりのユニットテストを追加する
    - `BuyerNumberSpreadsheetClient.test.ts` に追記する
    - `BUYER_NUMBER_SPREADSHEET_ID` が未設定のときエラーをスローすること（要件 3.4）
    - `BUYER_NUMBER_SHEET_NAME` が設定されているときその値が使われること（要件 3.2）
    - `BUYER_NUMBER_SHEET_NAME` が未設定のときデフォルト値 `連番` が使われること（要件 3.2）
    - `BUYER_NUMBER_CELL` が設定されているときその値が使われること（要件 3.3）
    - `BUYER_NUMBER_CELL` が未設定のときデフォルト値 `B2` が使われること（要件 3.3）
    - _要件: 3.1, 3.2, 3.3, 3.4_

- [x] 3. チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

- [x] 4. 統合確認：エンドポイントの動作を検証する
  - `GET /api/buyers/next-buyer-number` が `BuyerService.generateBuyerNumber()` を呼び出していることを確認する（`backend/src/routes/buyers.ts` は変更不要）
  - `POST /api/buyers` が `BuyerService.create()` → `generateBuyerNumber()` の順で呼び出されることを確認する
  - スプレッドシートアクセス失敗時に 500 エラーが返ることを確認する（エラー伝播の確認）
  - _要件: 1.1, 1.3, 2.1_

  - [ ]* 4.1 統合テストを作成する
    - `BuyerService.generateBuyerNumber()` が `BuyerNumberSpreadsheetClient.getNextBuyerNumber()` を呼び出すことをテストする
    - `BuyerNumberSpreadsheetClient` をモック化して `BuyerService` の動作を検証する
    - _要件: 1.1, 1.3_

- [x] 5. 最終チェックポイント — 全テストが通ることを確認する
  - 全テストが通ることを確認する。問題があればユーザーに確認する。

## 注意事項

- `*` が付いたサブタスクはオプションであり、スキップ可能
- 各タスクは前のタスクの成果物を前提とする
- `BuyerService` の外部インターフェース（エンドポイント、`create()` のシグネチャ）は変更しない
- `buyers` テーブルの主キーは `buyer_number`（TEXT型）であり、`id` や `buyer_id` は存在しない
- プロパティテストは `fast-check` を使用し、各プロパティにつき 100 回以上実行する
