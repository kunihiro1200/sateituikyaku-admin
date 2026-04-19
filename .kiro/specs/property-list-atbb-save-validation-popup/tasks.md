# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - ATBB非公開時の保存バリデーション警告未表示バグ
  - **重要**: このテストは修正前のコードで実行し、**FAIL することを確認する**（バグの存在を証明する）
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `atbb_status` が「非公開」系の値（例: `"非公開"`）
    - `offer_status` が null または空文字列
    - `isPreToPublicTransition` が false を返すケース
  - `handleSaveHeader` を呼び出した際に `setSnackbar` が呼ばれないことを確認（未修正コードでは PASS → バグの証明）
  - バリデーション失敗時に `setOfferErrors` と `setIsOfferEditMode(true)` は呼ばれるが `setSnackbar` は呼ばれないことを確認
  - カウンターエグザンプルを記録する（例: 「ATBB状況=非公開、offer_status=空文字で保存 → setSnackbar が呼ばれない」）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バグ条件非成立時の動作保持
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで以下の非バグ条件ケースの動作を観察・記録する:
    - ATBB状況が「非公開」かつ `offer_status` が入力済みの場合 → 正常に保存処理が実行される
    - ATBB状況が「公開中」の場合 → バリデーションをスキップして正常に保存処理が実行される
    - `isPreToPublicTransition` が true を返す場合（例: 「専任・公開前」→「専任・公開中」）→ バリデーションをスキップして正常に保存処理が実行される
  - 観察した動作をプロパティベーステストとして記述する:
    - `for all X where NOT isBugCondition(X)` → 保存処理が正常に実行される
  - 未修正コードでテストを実行し、**PASS することを確認する**（ベースライン動作の確認）
  - テストを作成・実行し、通過を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. ATBB非公開保存バリデーション警告未表示バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の `handleSaveHeader` 関数を修正する
    - バリデーション失敗時（`offer_status` が未入力）の `return` 前に `setSnackbar` 呼び出しを追加する
    - 追加するコード:
      ```typescript
      setSnackbar({
        open: true,
        message: 'ATBB状況を非公開にする場合、買付フィールドの入力が必要です',
        severity: 'warning',
      });
      ```
    - `setOfferErrors` と `setIsOfferEditMode(true)` の呼び出しは変更しない（既存動作を維持）
    - 変更箇所は `setSnackbar` 呼び出しの追加のみ
    - _Bug_Condition: isBugCondition(X) where X.atbb_status が「非公開」系 AND X.offer_status が null または空文字列 AND isPreToPublicTransition が false_
    - _Expected_Behavior: setSnackbar が severity='warning' で呼ばれ、ユーザーに「買付フィールドの入力が必要」であることを伝える_
    - _Preservation: ATBB状況が「非公開」以外の場合・offer_status が入力済みの場合・isPreToPublicTransition が true の場合は修正前と同一の動作を維持する_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件探索テストが通過することを確認する
    - **Property 1: Expected Behavior** - ATBB非公開時の保存バリデーション警告表示
    - **重要**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストは期待動作をエンコードしており、修正後は PASS するはず
    - バグ条件探索テストを実行する
    - **期待結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き通過することを確認する
    - **Property 2: Preservation** - バグ条件非成立時の動作保持
    - **重要**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - 保全プロパティテストを実行する
    - **期待結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も非バグ条件ケースで同一の動作が維持されていることを確認する

- [-] 4. チェックポイント - 全テストの通過確認
  - 全テスト（バグ条件探索テスト・保全テスト）が通過していることを確認する
  - 疑問点があればユーザーに確認する
