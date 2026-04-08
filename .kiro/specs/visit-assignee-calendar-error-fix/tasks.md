# 実装計画

- [x] 1. バグ条件探索テストを作成
  - **Property 1: Bug Condition** - イニシャル変換失敗時のvisitAssigneeInitials保持
  - **重要**: このテストは修正前のコードで実行し、失敗することを確認する
  - **目的**: バグが存在することを確認し、根本原因を理解する
  - **スコープ付きPBTアプローチ**: 決定的なバグのため、具体的な失敗ケース（イニシャル「U」、yurine~またはmariko~アカウント）にプロパティをスコープする
  - テスト実装の詳細（Bug Conditionセクションより）:
    - イニシャル「U」がemployeesテーブルに存在しない、または異なる名前にマッピングされている状態で訪問予約を保存
    - `SellerService.decryptSeller()`が`initialsMap["U"]`でイニシャルからフルネームへの変換を試みる
    - 変換失敗時に`visitAssigneeInitials`が元のイニシャル値（"U"）を保持することをテスト
  - 修正前のコードで実行
  - **期待される結果**: テストが失敗する（これによりバグの存在を確認）
  - 反例を記録して根本原因を理解する（例: `visitAssignee`と`visitAssigneeInitials`が両方とも`undefined`になる）
  - タスクを完了としてマークするのは、テストを作成・実行し、失敗を記録した時点
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. 保存プロパティテストを作成（修正実装前）
  - **Property 2: Preservation** - 正常なイニシャルマッピングの保持
  - **重要**: 観察優先の方法論に従う
  - 修正前のコードで非バグ入力（イニシャルがemployeesテーブルに正しく登録されている場合）の動作を観察
  - 観察: tomoko~アカウント（イニシャル「T」）で訪問予約を保存すると、`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される
  - 観察: genta~アカウント（イニシャル「G」）で訪問予約を保存すると、`visitAssignee`（フルネーム）と`visitAssigneeInitials`（イニシャル）の両方が正しく返される
  - Preservation Requirementsセクションから観察された動作パターンをキャプチャするプロパティベーステストを作成
  - プロパティベーステストは多くのテストケースを生成し、より強力な保証を提供する
  - 修正前のコードでテストを実行
  - **期待される結果**: テストが成功する（これによりベースライン動作を確認）
  - タスクを完了としてマークするのは、テストを作成・実行し、修正前のコードで成功することを確認した時点
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 訪問予約カレンダー送信エラーの修正

  - [x] 3.1 修正を実装
    - employeesテーブルにイニシャル「U」が存在するか確認（`SELECT * FROM employees WHERE initials = 'U'`）
    - イニシャル「U」が存在しない場合、適切なレコードを追加（名前: "裏天真"、イニシャル: "U"）
    - `backend/src/services/SellerService.supabase.ts`の`decryptSeller()`メソッドにデバッグログを追加して`visitAssigneeInitials`の値を確認
    - フロントエンド（`CallModePage.tsx`）で`seller.visitAssigneeInitials`が正しく処理されているか確認
    - APIレスポンスとフロントエンドの間でデータが失われていないか確認
    - _Bug_Condition: isBugCondition(input) where input.visitAssignee IN employeesTable.initials AND initialsMap[input.visitAssignee] === null AND userAccount IN ['yurine~', 'mariko~']_
    - _Expected_Behavior: visitAssigneeInitialsが元のイニシャル値（例: "U"）を保持し、フロントエンドで営担チェックとカレンダー送信が成功する_
    - _Preservation: イニシャルがemployeesテーブルに正しく登録されている売主の訪問予約保存時に、visitAssignee（フルネーム）とvisitAssigneeInitials（イニシャル）の両方が正しく返される_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件探索テストが成功することを確認
    - **Property 1: Expected Behavior** - イニシャル変換失敗時のvisitAssigneeInitials保持
    - **重要**: タスク1で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが成功すると、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行
    - **期待される結果**: テストが成功する（バグが修正されたことを確認）
    - _Requirements: Expected Behavior Properties from design_

  - [x] 3.3 保存テストが引き続き成功することを確認
    - **Property 2: Preservation** - 正常なイニシャルマッピングの保持
    - **重要**: タスク2で作成した同じテストを再実行する - 新しいテストを作成しない
    - タスク2の保存プロパティテストを実行
    - **期待される結果**: テストが成功する（リグレッションがないことを確認）
    - 修正後も全てのテストが成功することを確認（リグレッションなし）

- [x] 4. チェックポイント - 全てのテストが成功することを確認
  - 全てのテストが成功することを確認し、疑問点があればユーザーに質問する
