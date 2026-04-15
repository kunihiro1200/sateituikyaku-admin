# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 次電日フィールドクリック時の statusChanged 未更新
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL することでバグの存在が確認される
  - **修正前にテストが失敗しても、テストやコードを修正しないこと**
  - **注意**: このテストは期待される動作をエンコードしている — 実装後にパスすることで修正を検証する
  - **目的**: バグの存在を示すカウンターエグザンプルを発見する
  - **スコープ付き PBT アプローチ**: 決定論的なバグのため、具体的な失敗ケース（次電日フィールドへの onClick のみ）にスコープを絞る
  - `frontend/frontend/src/pages/CallModePage.tsx` の次電日フィールドの `onClick` ハンドラを対象にテストを作成する
  - `onChange` を発火させずに次電日フィールドの `onClick` イベントのみをシミュレートする
  - `onClick` 後に `statusChanged` が `true` にならないことを確認する（修正前コードで失敗することを期待）
  - `onClick` 後に「ステータスを更新」ボタンが `disabled` のままであることを確認する
  - テストを修正前のコードで実行する
  - **期待される結果**: テストが FAIL する（バグの存在を証明）
  - カウンターエグザンプルを記録する（例: `onClick` 後に `statusChanged` が `false` のまま、保存ボタンが `disabled` のまま）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保存性プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 他フィールドの変更検知・保存処理・リセット動作の維持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（次電日フィールド以外のフィールド変更）の動作を観察する
  - 観察: 状況（当社）フィールドの `onChange` が `statusChanged` を `true` にすることを確認
  - 観察: 確度フィールドの `onChange` が `statusChanged` を `true` にすることを確認
  - 観察: Pinrichステータスフィールドの `onChange` が `statusChanged` を `true` にすることを確認
  - 観察: 保存成功後に `statusChanged` が `false` にリセットされることを確認
  - 観察: 売主データ読み込み時に `statusChanged` が `false` に初期化されることを確認
  - プロパティベーステストを作成: 全ての非バグ条件入力（次電日以外のフィールド）に対して上記の動作が維持されることを検証
  - プロパティベーステストを推奨する理由: 多様なフィールド名・値の組み合わせを自動生成でき、保存性を強く保証できる
  - テストを修正前のコードで実行する
  - **期待される結果**: テストが PASS する（ベースライン動作を確認）
  - テストを作成し、実行し、修正前コードでパスしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. 次電日クリック遅延バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/CallModePage.tsx` の次電日フィールドの `onClick` ハンドラを修正する（行 7045 付近）
    - `onClick` ハンドラに `setStatusChanged(true)` の呼び出しを追加する
    - `onClick` ハンドラに `statusChangedRef.current = true` の設定を追加する
    - `showPicker()` の呼び出しは引き続き維持する
    - 修正後の `onClick` ハンドラ:
      ```tsx
      onClick={() => {
        nextCallDateRef.current?.showPicker?.();
        setStatusChanged(true);
        statusChangedRef.current = true;
      }}
      ```
    - 他のフィールドや処理フローは一切変更しない
    - _Bug_Condition: isBugCondition(input) — input.fieldName = 'nextCallDate' AND input.action = 'click' AND onChangeDidNotFire(input) AND statusChanged IS false_
    - _Expected_Behavior: onClick 後に statusChanged が true になり、statusChangedRef.current が true になり、「ステータスを更新」ボタンが即座に有効化される_
    - _Preservation: 他フィールドの onChange による statusChanged 更新、保存成功後のリセット、初回ロード時の初期化、バリデーション処理、遷移ブロック機能、保存処理中のボタン無効化_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 3.2 バグ条件の探索テストがパスすることを確認する
    - **Property 1: Expected Behavior** - 次電日フィールドクリック時の即時 statusChanged 更新
    - **重要**: タスク1で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがパスすることで、期待される動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保存性テストが引き続きパスすることを確認する
    - **Property 2: Preservation** - 他フィールドの変更検知・保存処理・リセット動作の維持
    - **重要**: タスク2で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク2の保存性プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全てのテストがパスすることを確認する

- [x] 4. チェックポイント — 全テストのパスを確認する
  - 全テストがパスすることを確認する
  - 疑問点があればユーザーに確認する
