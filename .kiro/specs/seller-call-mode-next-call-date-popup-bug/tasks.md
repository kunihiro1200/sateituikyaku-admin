# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 次電日変更後ポーリング発生時のダイアログ誤表示
  - **重要**: このテストは未修正コードで**必ず失敗する** — 失敗がバグの存在を証明する
  - **修正前にテストを実行してもコードを修正しないこと**
  - **目的**: バグが存在することを示す反例（counterexample）を発見する
  - **スコープ**: 次電日を変更後にポーリングが発生した具体的なケースに絞る
  - テスト内容（design.md の Bug Condition より）:
    - `statusChangedRef.current = true`（ユーザーが編集中）の状態でポーリングが走ると `setEditedNextCallDate` は呼ばれない
    - しかし `setSavedNextCallDate` も呼ばれないため `savedNextCallDate` が古い値のまま残る
    - 結果として `editedNextCallDate === savedNextCallDate` が誤って `true` になる
  - プロパティベーステスト: 任意の次電日の値（例: `'2025-07-01'` → `'2025-07-15'`）でポーリング後に `editedNextCallDate !== savedNextCallDate` が成立することを検証
  - テストを未修正コードで実行する
  - **期待される結果**: テストが**失敗**する（バグの存在を確認）
  - 発見した反例を記録する（例: 「次電日を `2025-07-01` → `2025-07-15` に変更後ポーリング発生 → `savedNextCallDate` が `2025-07-01` のまま → 両者が一致してダイアログ誤表示」）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バグ条件が成立しない場合の既存動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`isBugCondition` が `false` になるケース）の動作を観察する:
    - 観察1: 次電日を変更せずにポーリングが走った場合 → `editedNextCallDate === savedNextCallDate` は `true`（正しい）→ ダイアログ表示
    - 観察2: 反響日付が3日未満の場合 → `isElapsed = false` → ダイアログ非表示
    - 観察3: 追客中でない場合 → `isFollowingUp = false` → ダイアログ非表示
    - 観察4: `pageEdited = false` の場合 → ダイアログ非表示
  - プロパティベーステスト: `shouldShowReminderDialog` の4条件（`isElapsed`, `isFollowingUp`, `pageEdited`, `nextCallDateUnchanged`）の全組み合わせで純粋関数としての正しさを検証
  - 保全要件（design.md の Preservation Requirements より）:
    - 次電日未変更時のダイアログ表示ロジック（要件 3.4）
    - 反響日付3日未満の場合はダイアログ非表示（要件 3.1）
    - 追客中でない場合はダイアログ非表示（要件 3.2）
    - `pageEdited = false` の場合はダイアログ非表示（要件 3.3）
    - `statusChangedRef` による既存のポーリング上書き防止ロジック
  - テストを未修正コードで実行する
  - **期待される結果**: テストが**成功**する（保全すべきベースライン動作を確認）
  - テストを作成・実行し、成功を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 次電日変更後ポーリング発生時のダイアログ誤表示バグを修正する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/CallModePage.tsx` のバックグラウンドポーリング処理（`freshData` 更新ブロック、行 1599〜1620 付近）を修正する
    - `statusChangedRef.current === false` ブロック内で `setEditedNextCallDate(freshData.nextCallDate || '')` を呼ぶ直後に `setSavedNextCallDate(freshData.nextCallDate || '')` を1行追加する
    - 変更前:
      ```typescript
      if (!statusChangedRef.current) {
        setEditedStatus(freshData.status);
        setEditedConfidence(freshData.confidence || '');
        setEditedNextCallDate(freshData.nextCallDate || '');  // editedのみ更新
        setEditedPinrichStatus(freshData.pinrichStatus || '');
        // ...
      }
      ```
    - 変更後:
      ```typescript
      if (!statusChangedRef.current) {
        setEditedStatus(freshData.status);
        setEditedConfidence(freshData.confidence || '');
        setEditedNextCallDate(freshData.nextCallDate || '');
        setSavedNextCallDate(freshData.nextCallDate || '');  // savedも同時に更新
        setEditedPinrichStatus(freshData.pinrichStatus || '');
        // ...
      }
      ```
    - `statusChangedRef.current === true` の場合は変更不要（ユーザーが編集中のため）
    - _Bug_Condition: `editedNextCallDate !== savedNextCallDate_actual` かつ `editedNextCallDate === savedNextCallDate_stale` かつ `pollingHasOccurred` かつ `statusChangedRef` が true（design.md の isBugCondition より）_
    - _Expected_Behavior: 修正後は `shouldShowReminderDialog` に渡される `nextCallDateUnchanged` が `false` となり、ダイアログは表示されない（design.md の Property 1 より）_
    - _Preservation: バグ条件が成立しない全ての入力で修正前後の動作が完全に一致すること（design.md の Preservation Requirements より）_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが成功することを確認する
    - **Property 1: Expected Behavior** - 次電日変更後ポーリング発生時にダイアログが表示されない
    - **重要**: タスク1で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待動作をエンコードしている
    - このテストが成功すれば、期待動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが**成功**する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き成功することを確認する
    - **Property 2: Preservation** - バグ条件が成立しない場合の既存動作の保全
    - **重要**: タスク2で作成した**同じテスト**を再実行する — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが**成功**する（リグレッションがないことを確認）
    - 修正後も全ての保全要件が満たされていることを確認する

- [x] 4. チェックポイント — 全テストが成功することを確認する
  - タスク1のバグ条件探索テスト（修正後は成功するはず）を実行する
  - タスク2の保全プロパティテストを実行する
  - 全テストが成功することを確認する
  - 疑問点があればユーザーに確認する
