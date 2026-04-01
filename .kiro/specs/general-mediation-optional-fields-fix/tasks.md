# Implementation Plan

- [x] 1. バグ条件探索テストを作成（修正前に実行）
  - **Property 1: Bug Condition** - 一般媒介の任意項目化
  - **重要**: このテストは修正前のコードで実行し、失敗することを確認する
  - **目的**: バグが実際に存在することを実証し、根本原因を理解する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、修正後にパスすることで修正を検証する
  - **GOAL**: バグを実証する反例を表面化させる
  - **Scoped PBT Approach**: 決定論的なバグのため、具体的な失敗ケースにプロパティをスコープする
  - テスト実装の詳細:
    - 状況（当社）= "一般媒介" の場合、`requiresDecisionDate()` が `false` を返すことをテスト
    - 状況（当社）= "一般媒介" かつ 競合 = [] かつ 専任・他決要因 = [] の場合、保存が成功することをテスト
    - テストアサーションは Expected Behavior Properties（design.md）と一致させる
  - 修正前のコードで実行
  - **EXPECTED OUTCOME**: テスト失敗（これは正しい - バグが存在することを証明）
  - 失敗例を記録して根本原因を理解する
  - タスク完了条件: テストが作成され、実行され、失敗が記録されたとき
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4_

- [x] 2. 保存プロパティテストを作成（修正前に実行）
  - **Property 2: Preservation** - 専任・他決関連の必須項目維持
  - **重要**: 観察優先の方法論に従う
  - 修正前のコードで非バグ条件入力（専任・他決関連のステータス）の動作を観察する
  - 観察された動作パターンをキャプチャするプロパティベーステストを作成:
    - 状況（当社） IN ("専任媒介", "他決→専任", "リースバック（専任）", "他決→追客", "他決→追客不要", "一般→他決", "他社買取") の場合、`requiresDecisionDate()` が `true` を返すことをテスト
    - 上記ステータスで競合 = [] かつ 専任・他決要因 = [] の場合、保存が失敗することをテスト（バリデーションエラー）
  - プロパティベーステストは多くのテストケースを自動生成し、より強力な保証を提供する
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストパス（ベースライン動作を確認）
  - タスク完了条件: テストが作成され、実行され、修正前のコードでパスしたとき
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 一般媒介の任意項目化修正

  - [x] 3.1 `requiresDecisionDate()` 関数を修正
    - ファイル: `frontend/frontend/src/pages/CallModePage.tsx`（行3068-3072）
    - 変更内容: 「一般媒介」を条件から除外
    - 修正前: `return label.includes('専任') || label.includes('他決') || label.includes('一般媒介');`
    - 修正後: `return label.includes('専任') || label.includes('他決');`
    - _Bug_Condition: isBugCondition(input) where input.status = "一般媒介"_
    - _Expected_Behavior: requiresDecisionDate("一般媒介") = false from design_
    - _Preservation: 専任・他決関連のステータスでは requiresDecisionDate() = true を維持_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件探索テストが成功することを確認
    - **Property 1: Expected Behavior** - 一般媒介の任意項目化
    - **重要**: タスク1で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすることで、期待される動作が満たされていることを確認
    - バグ条件探索テスト（タスク1）を再実行
    - **EXPECTED OUTCOME**: テストパス（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design (2.1, 2.2, 2.3, 2.4)_

  - [x] 3.3 保存プロパティテストが引き続きパスすることを確認
    - **Property 2: Preservation** - 専任・他決関連の必須項目維持
    - **重要**: タスク2で作成した同じテストを再実行する - 新しいテストを作成しない
    - 保存プロパティテスト（タスク2）を再実行
    - **EXPECTED OUTCOME**: テストパス（リグレッションがないことを確認）
    - 全てのテストがパスすることを確認（リグレッションなし）

- [x] 4. チェックポイント - 全てのテストがパスすることを確認
  - 全てのテストを実行し、パスすることを確認
  - 質問があればユーザーに確認する
