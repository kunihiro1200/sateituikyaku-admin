# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 全角文字での検索が0件になるバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する - 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている - 修正後にパスすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `filteredListings` の検索ロジック（`normalizeText` を使わない現在の実装）
  - 全角英数字テスト: 物件番号「AA12345」を持つ物件に対して「ＡＡ１２３４５」で検索 → 0件になることを確認
  - 全角カタカナテスト: 売主名「アイウ商事」を持つ物件に対して「アイウ」で検索 → 0件になることを確認
  - 全角英字テスト: 所在地「ABC町」を持つ物件に対して「ＡＢＣ」で検索 → 0件になることを確認
  - 混在テスト: 「ＡＡ12345」（全角・半角混在）で検索 → 0件になることを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい - バグの存在を証明する）
  - カウンターサンプルを記録して根本原因を理解する（例：「ＡＡ１２３４５」で検索すると `includes()` が false を返し全件除外される）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 全角文字を含まない入力での検索動作が変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで全角文字を含まない入力の動作を観察・記録する
  - 観察: 「AA12345」で検索すると対応する物件がヒットすることを確認
  - 観察: 「東京都」などの日本語で検索すると対応する物件がヒットすることを確認
  - 観察: 空クエリで全件が返ることを確認
  - プロパティベーステスト: 全角文字を含まない任意のクエリに対して、修正前後で同一結果になることを検証
  - テスト対象: 半角英数字・ひらがな・漢字・空クエリ（isBugCondition が false を返すケース）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成・実行し、パスを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 全角文字検索バグの修正

  - [x] 3.1 normalizeText ヘルパー関数を追加し、検索ロジックを修正する
    - `frontend/frontend/src/pages/PropertyListingsPage.tsx` を編集する
    - コンポーネント外（ファイル先頭付近）に `normalizeText` 関数を追加する
      ```typescript
      // 全角→半角の正規化（NFKC）+ 小文字化
      const normalizeText = (text: string): string =>
        text.normalize('NFKC').toLowerCase();
      ```
    - `filteredListings` 内の `searchQuery.toLowerCase()` を `normalizeText(searchQuery)` に変更する
    - 各フィールドの `.toLowerCase()` を `normalizeText(...)` に変更する（optional chaining を考慮）
    - _Bug_Condition: isBugCondition(searchQuery) - searchQuery に全角英数字・全角カタカナ・全角英字が1文字以上含まれる AND normalize('NFKC') を適用していない_
    - _Expected_Behavior: 全角文字を含む検索クエリが、対応する半角文字で検索した場合と同一の結果を返す_
    - _Preservation: 半角英数字・ひらがな・漢字・空クエリでの検索動作は一切変化しない（NFKC正規化はこれらの文字を変換しない）_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 全角文字での検索が対応する半角文字と同じ結果を返す
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストがパスすることで、期待動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 全角文字を含まない入力での検索動作が変わらない
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認する）
    - 修正後も全てのテストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント - 全テストのパスを確認する
  - 全テストがパスすることを確認する。疑問点があればユーザーに確認する。
