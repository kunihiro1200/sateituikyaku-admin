# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 採番結果が文字列連結になるバグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正やコードを変更しようとしないこと（FAIL は正しい結果）**
  - **注意**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目的**: バグが存在することを示す反例を発見する
  - **スコープ限定PBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `rawValue = "7358"` のとき `getNextBuyerNumber()` が `"7359"` を返すか確認（文字列連結なら `"73581"` になる）
    - `rawValue = "1"` のとき `"2"` を返すか確認
    - `rawValue = "9999"` のとき `"10000"` を返すか確認（桁上がりのエッジケース）
  - テストアサーション: `result === String(parseInt(String(rawValue), 10) + 1)` を満たすこと
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見した反例を記録して根本原因を理解する（例: `"7358"` → `"73581"` が返される）
  - テストを作成・実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [ ] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - エラーハンドリング動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ入力（エラーケース）の動作を観察する
    - `rawValue = ""` のとき `"Buyer number cell B2 is empty"` エラーをスローすることを確認
    - `rawValue = "abc"` のとき `"Buyer number cell value is not a valid number: abc"` エラーをスローすることを確認
    - `readRawRange` が例外をスローするとき `"Failed to access buyer number spreadsheet"` エラーをスローすることを確認
  - 観察した動作パターンをキャプチャするプロパティベーステストを作成する
  - 修正前のコードでテストを実行する
  - **期待される結果**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成・実行し、修正前コードで PASS を確認したらタスク完了とする
  - _Requirements: 3.3, 3.4_

- [ ] 3. 買主番号採番バグの修正

  - [x] 3.1 根本原因を特定して修正を実装する
    - タスク1の探索テスト結果に基づいて根本原因を確定する
    - `BuyerNumberSpreadsheetClient.getNextBuyerNumber()` の修正:
      - `const n: number = parseInt(String(rawValue), 10);` と明示的な型注釈を付ける
      - `const next: number = n + 1;` と中間変数で数値加算を明確にする
      - `return String(next);` で文字列に変換して返す
    - 必要に応じて `GoogleSheetsClient.writeRawCell()` の `valueInputOption` を `'RAW'` から `'USER_ENTERED'` に変更する（探索テスト結果次第）
    - _Bug_Condition: isBugCondition(input) — `getNextBuyerNumber(rawValue) !== String(parseInt(String(rawValue), 10) + 1)` となる入力_
    - _Expected_Behavior: `result === String(parseInt(String(rawValue), 10) + 1)` かつ `isNaN(parseInt(result, 10)) === false`_
    - _Preservation: エラーハンドリング（空欄・非数値・アクセス失敗）の動作は変わらない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 採番結果が数値加算であること
    - **重要**: タスク1と同じテストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - エラーハンドリング動作の保全
    - **重要**: タスク2と同じテストを再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後もすべてのテストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — すべてのテストが PASS することを確認する
  - すべてのテストが PASS することを確認する。疑問点があればユーザーに確認する。
