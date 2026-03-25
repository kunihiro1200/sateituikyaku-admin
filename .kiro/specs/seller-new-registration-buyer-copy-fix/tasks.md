# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 数字のみの買主番号で500エラーが発生する
  - **CRITICAL**: このテストは修正前のコードで必ず FAIL する — 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターエクザンプルを見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る（例: `"7211"`, `"1234"`, `"12345"`）
  - テスト対象: `BuyerService.search()` に数字のみのクエリ（2文字以上）を渡したとき
  - Bug Condition: `/^\d+$/.test(input) && input.length >= 2`
  - テストの検証内容（Expected Behavior）:
    - `search("7211")` がエラーなく配列を返すこと
    - レスポンスの `buyer_number` フィールドが文字列であること
    - フロントエンドで `option.buyer_number` が `undefined` にならないこと
  - 修正前のコードで実行 → **EXPECTED OUTCOME: FAIL**（バグの存在を確認）
  - カウンターエクザンプルを記録（例: `search("7211")` が500エラーを返す）
  - タスク完了条件: テストを書き、実行し、失敗を記録したとき
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 数字以外のクエリでの既存動作が維持される
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（`isBugCondition` が false の入力）の動作を観察する
  - 観察対象:
    - `search("田中")` → `ilike` 検索が実行され、結果が返ること
    - `search("田中123")` → `ilike` 検索が実行され、結果が返ること
    - 1文字入力 → 検索が実行されないこと（フロントエンドの制御）
  - プロパティベーステスト: 文字列を含む任意のクエリ（2文字以上）で `ilike` 検索が実行されることを確認
  - 修正前のコードで実行 → **EXPECTED OUTCOME: PASS**（ベースライン動作を確認）
  - タスク完了条件: テストを書き、修正前コードで実行し、PASS を確認したとき
  - _Requirements: 3.1, 3.2, 3.4_

- [x] 3. Fix for 数字のみの買主番号検索バグ（バックエンド型不一致 + フロントエンドフィールド名不一致）

  - [x] 3.1 Implement the fix
    - **バックエンド修正** (`backend/src/services/BuyerService.ts`):
      - `search()` メソッドの `buyerNumberMatch` 変数を修正
      - 数字のみのクエリに対して `.or()` の文字列フィルタ形式ではなく、別途 `.eq('buyer_number', query)` を使って文字列として渡す形式に変更
      - これにより Supabase が TEXT 型カラムと正しく比較できるようになる
    - **フロントエンド修正** (`frontend/frontend/src/pages/NewSellerPage.tsx`):
      - `buyerCopyOptions` の型定義を `{buyerNumber: string; name: string}` から `{buyer_number: string; name: string}` に変更
      - `getOptionLabel` の `option.buyerNumber` を `option.buyer_number` に変更
      - `isOptionEqualToValue` の `option.buyerNumber` を `option.buyer_number` に変更
      - `handleBuyerCopySelect` の `option.buyerNumber` を `option.buyer_number` に変更
    - _Bug_Condition: isBugCondition(input) = /^\d+$/.test(input) && input.length >= 2_
    - _Expected_Behavior: search(input) が配列を返し、option.buyer_number が文字列として参照できる_
    - _Preservation: 文字列クエリでの ilike 検索、2文字未満の入力制限、売主コピー機能は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 数字のみの買主番号で買主が正しく検索される
    - **IMPORTANT**: タスク1で書いた同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - バグ条件探索テスト（タスク1）を実行
    - **EXPECTED OUTCOME: PASS**（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 数字以外のクエリでの既存動作が維持される
    - **IMPORTANT**: タスク2で書いた同じテストを再実行する — 新しいテストを書かない
    - 保存プロパティテスト（タスク2）を実行
    - **EXPECTED OUTCOME: PASS**（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
