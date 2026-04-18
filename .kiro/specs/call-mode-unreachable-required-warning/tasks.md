# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 不通未入力時の遷移警告欠落バグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL することでバグの存在が確認される
  - **修正やコードを変更しないこと（テストが失敗しても）**
  - **注意**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.md の Bug Condition より）:
    - `isBugCondition(input)` が true となる入力（反響日2026年1月1日以降 かつ `unreachableStatus === null` かつ ナビゲーション操作）で `navigateWithWarningCheck` を呼び出す
    - 修正前: `setNavigationWarningDialog` が `warningType: 'unreachable'` で呼ばれず、`onConfirm` が直接実行される
    - テストケース1: 反響日2026年3月1日・不通未入力 → ナビゲーションバーから遷移 → 警告なしに遷移（バグ）
    - テストケース2: 反響日2026年1月1日・不通未入力 → 「一覧に戻る」ボタン → 警告なしに遷移（バグ）
    - テストケース3: 反響日2026年2月1日・不通未入力 → 別売主への遷移 → 警告なしに遷移（バグ）
    - 境界値: 反響日2025年12月31日・不通未入力 → 警告なし（正常動作・バグ条件外）
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト FAIL（これが正しい — バグの存在を証明する）
  - カウンターエグザンプルを記録して根本原因を理解する
  - テストを作成・実行・失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. 保持プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非バグ条件入力の動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ条件の入力（`isBugCondition` が false となる入力）の動作を観察する:
    - 観察1: `unreachableStatus = '不通'` の場合 → 不通警告なしに既存チェックが実行される
    - 観察2: `unreachableStatus = '通電OK'` の場合 → 不通警告なしに既存チェックが実行される
    - 観察3: 反響日2025年12月31日・不通未入力 → 不通警告なしに遷移する
    - 観察4: 次電日未入力かつ不通未入力 → 次電日ブロックが優先される（不通警告は表示されない）
    - 観察5: 不通入力済み・確度未入力 → 確度警告が表示される（不通警告は表示されない）
  - 観察した動作パターンをプロパティベーステストとして記述する（design.md の Preservation Requirements より）
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト PASS（これが正しい — 保持すべきベースライン動作を確認する）
  - 修正前のコードでテストが PASS したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. 不通未入力警告の修正を実装する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/CallModePage.tsx` の3箇所を修正する
    - **変更1**: `warningType` の型定義に `'unreachable'` を追加（Line 921付近）
      ```typescript
      // 変更前
      warningType?: 'firstCall' | 'confidence';
      // 変更後
      warningType?: 'firstCall' | 'confidence' | 'unreachable';
      ```
    - **変更2**: `navigateWithWarningCheck` 関数に不通未入力チェックを追加（Line 2041付近）
      - 次電日変更確認ダイアログの後、確度チェックの前に追加する
      - `seller?.inquiryDate >= '2026-01-01'` かつ `!unreachableStatus` の場合に `warningType: 'unreachable'` のダイアログを表示する
    - **変更3**: `NavigationWarningDialog` のUIに `'unreachable'` ケースを追加（Line 8176付近）
      - DialogTitle: `'⚠️ 不通が未入力です'`
      - DialogContent: `'不通が未入力です。このまま移動しますか？'`
    - _Bug_Condition: `isBugCondition(input)` — 反響日2026年1月1日以降 かつ `unreachableStatus === null` かつ ナビゲーション操作_
    - _Expected_Behavior: `setNavigationWarningDialog({ open: true, warningType: 'unreachable', onConfirm })` が呼ばれ、ユーザーが「このまま遷移する」または「戻って入力する」を選択できる_
    - _Preservation: 不通入力済み・反響日2026年以前・次電日ブロック・確度警告・1番電話警告・保存ボタンバリデーションは変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 不通未入力時の遷移警告表示
    - **重要**: タスク1で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS することで、期待される動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 保持プロパティテストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非バグ条件入力の動作保持
    - **重要**: タスク2で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認する）
    - 修正後も全ての保持テストが PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
