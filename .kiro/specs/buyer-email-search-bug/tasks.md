# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - メールアドレス検索で買主が返されないバグ
  - **CRITICAL**: このテストは未修正コードで必ず FAIL する - 失敗がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている - 修正後にパスすることでバグ修正を検証する
  - **GOAL**: バグの存在を示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: メールアドレス形式（`@` を含む文字列）を検索クエリとして渡し、DBに対応する買主が存在する場合に0件が返ることを確認する
  - テスト内容: `getAll({ search: "test@example.com" })` を呼び出し、結果が0件になることを確認（未修正コードでの失敗を確認）
  - バグ条件（design.mdより）: `isBugCondition(input)` = `input.search` が `@` を含む文字列 かつ 対応する買主がDBに存在する
  - 期待動作（design.mdより）: `result.data.length > 0` かつ `result.data.every(buyer => buyer.email.includes(input.search))`
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい - バグの存在を証明する）
  - 発見したカウンターサンプルを記録して根本原因を理解する（例: `getAll({ search: "test@example.com" })` が0件を返す）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 既存検索フィールド（買主番号・氏名・電話番号・物件番号）の動作が変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（メールアドレス以外）の動作を観察する
  - 観察: `getAll({ search: "12345" })` → 買主番号完全一致で正常に返る
  - 観察: `getAll({ search: "田中" })` → 氏名部分一致で正常に返る
  - 観察: `getAll({ search: "090" })` → 電話番号部分一致で正常に返る
  - 観察: `getAll({ search: "A-001" })` → 物件番号部分一致で正常に返る
  - プロパティベーステスト: 4〜5桁の数字以外の非メールアドレス文字列に対して、修正前後でクエリ条件が同一であることを検証
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これがベースライン動作を確認する）
  - テストを作成・実行し、未修正コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. メールアドレス検索バグの修正

  - [x] 3.1 修正を実装する
    - `backend/src/services/BuyerService.ts` の `getAll()` メソッドを修正する
    - `or()` の条件文字列に `email.ilike.%${search}%` を追加する
    - 修正前: `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,property_number.ilike.%${search}%`
    - 修正後: `buyer_number.ilike.%${search}%,name.ilike.%${search}%,phone_number.ilike.%${search}%,email.ilike.%${search}%,property_number.ilike.%${search}%`
    - _Bug_Condition: `isBugCondition(input)` = `input.search` が `@` を含む文字列 かつ 対応する買主がDBに存在する_
    - _Expected_Behavior: `result.data.length > 0` かつ `result.data.every(buyer => buyer.email.includes(input.search))`_
    - _Preservation: 買主番号・氏名・電話番号・物件番号の検索動作は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが今度はパスすることを確認する
    - **Property 1: Expected Behavior** - メールアドレス検索で買主が返される
    - **IMPORTANT**: タスク1と同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストがパスすれば、期待動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保持テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 既存検索フィールドの動作が変わらない
    - **IMPORTANT**: タスク2と同じテストを再実行する - 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストがパスすることを確認する（リグレッションなし）

- [x] 4. チェックポイント - 全テストがパスすることを確認する
  - 全テストがパスすることを確認する。疑問が生じた場合はユーザーに確認する。
