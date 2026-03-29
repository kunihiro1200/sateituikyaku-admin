# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 訪問査定取得者の自動設定バグ＆訪問統計表示バグ
  - **重要**: このテストは修正前のコードで実行し、**失敗することを確認する**
  - **目的**: バグが実際に存在することを証明するカウンターエグザンプルを記録する
  - **スコープ付きPBTアプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - バグ1のテスト: `employees = []` の状態で `handleSaveAppointment` を呼び出し、`visitValuationAcquirer` が空のまま送信されることを確認（Bug Conditionより: `editedVisitValuationAcquirer` が空 かつ `employee.email` が存在する）
  - バグ2のテスト: `loadVisitStats` が `useEffect` より後に定義されている状態で呼び出しを試み、`TypeError: loadVisitStats is not a function` が発生することを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**失敗**する（これがバグの存在を証明する）
  - カウンターエグザンプルを記録する（例: `visitValuationAcquirer` が空のまま送信される、`loadVisitStats is not a function` エラー）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存の保存ロジックと訪問統計非表示条件の保全
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力に対する動作を観察する
  - 観察1: `editedVisitValuationAcquirer = "Y"` の場合、`"Y"` がそのまま送信される（手動入力値が優先される）
  - 観察2: `visitDate` が未設定の場合、`loadVisitStats` が呼ばれない
  - 観察3: `appointmentDate`、`assignedTo`、`appointmentNotes` の保存動作は変わらない
  - プロパティベーステスト: 任意の非空 `editedVisitValuationAcquirer` に対して、常にその値が優先されることを検証
  - プロパティベーステスト: `visitDate` と `appointmentDate` が両方未設定の場合、`loadVisitStats` が呼ばれないことを検証
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが**成功**する（これがベースラインの動作を確認する）
  - テストを作成・実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 売主通話モードページの訪問関連バグを修正する

  - [x] 3.1 `loadVisitStats` の定義を `useEffect` より前に移動する（バグ2の修正）
    - `frontend/frontend/src/pages/CallModePage.tsx` を編集する
    - `loadVisitStats` の定義ブロック全体（行1742付近の `const loadVisitStats = async () => {...}`）を、呼び出し元の `useEffect`（行965付近）より前の位置に移動する
    - ロジックの変更は一切行わない（定義位置の移動のみ）
    - `const` の TDZ（Temporal Dead Zone）問題を解消する
    - _Bug_Condition: isBugCondition_2(codeState) where useEffectCallLine < loadVisitStatsDefinitionLine AND loadVisitStats IS DECLARED WITH const_
    - _Expected_Behavior: loadVisitStats が useEffect から正常に呼び出せる_
    - _Preservation: loadVisitStats の実行条件（visitDate または appointmentDate がある場合のみ）は変更しない_
    - _Requirements: 2.3, 2.4, 3.3_

  - [x] 3.2 `handleSaveAppointment` にフォールバックロジックを追加する（バグ1の修正）
    - `frontend/frontend/src/pages/CallModePage.tsx` を編集する
    - `handleSaveAppointment`（行1934付近）に以下のフォールバックロジックを追加する
    - `editedVisitValuationAcquirer` が空の場合、以下の順序でフォールバックを試みる：
      1. `employees` ステートから `employee.email` で検索
      2. `getActiveEmployees()` を呼び出して再検索
      3. `employee.initials` を使用
    - 手動入力済みの `editedVisitValuationAcquirer` は上書きしない（自動設定は空の場合のみ）
    - `visitValuationAcquirer: acquirer || null` として送信する
    - _Bug_Condition: isBugCondition_1(state) where editedVisitValuationAcquirer IS EMPTY AND employee.email IS NOT EMPTY AND employees.find() IS undefined_
    - _Expected_Behavior: handleSaveAppointment が employees ステートまたは getActiveEmployees() の再呼び出しによってログインユーザーのイニシャルを取得し visitValuationAcquirer に設定して保存する_
    - _Preservation: 手動入力済みの visitValuationAcquirer は上書きしない。appointmentDate・assignedTo・appointmentNotes の保存動作は変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.3 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - 訪問査定取得者の自動設定＆訪問統計表示
    - **重要**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストはExpected Behaviorをエンコードしている
    - このテストが成功すれば、バグが修正されたことを確認できる
    - バグ1テスト: `employees = []` の状態で保存しても `visitValuationAcquirer` が正しく設定されることを確認
    - バグ2テスト: `visitDate` がある状態でコンポーネントをマウントしても `loadVisitStats` が正常に呼び出されることを確認
    - **期待される結果**: テストが**成功**する（バグが修正されたことを証明する）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - 既存の保存ロジックと訪問統計非表示条件の保全
    - **重要**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - 修正後も全ての保全テストが成功することを確認する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを証明する）
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. チェックポイント - 全テストの成功を確認してデプロイする
  - 全テストが成功していることを確認する
  - 疑問点があればユーザーに確認する
  - 以下のコマンドでデプロイする（git pushによる自動デプロイ）:
    ```
    git add frontend/frontend/src/pages/CallModePage.tsx
    git commit -m "fix: seller call mode visit bugs - loadVisitStats position and handleSaveAppointment fallback"
    git push origin main
    ```
  - Vercelの自動デプロイが完了することを確認する
