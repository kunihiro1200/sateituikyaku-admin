# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 誤ったvaluationReasonEmailAssignee書き込みの検出
  - **CRITICAL**: このテストは修正前のコードで必ずFAILすること — FAILがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている — 修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `handleConfirmSend` 内のフォールバック判定ロジックを純粋関数として抽出してテスト
  - テスト対象: `EMAIL_TEMPLATE_ASSIGNEE_MAP` にIDが存在しない「査定額案内」ラベルのテンプレート
    - `{ id: 'seller_sheet_99', label: '査定額案内メール（相続以外）' }` → `valuationReasonEmailAssignee` が設定されないこと
    - `{ id: 'seller_sheet_100', label: '査定理由確認メール' }` → `valuationReasonEmailAssignee` が設定されないこと
  - テストアサーション: `assigneeKeyForDirect !== 'valuationReasonEmailAssignee'`
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストFAIL（バグが存在することを証明）
  - カウンターサンプルを記録して根本原因を理解する（例: `template.label.includes('査定額案内')` が `true` を返し `valuationReasonEmailAssignee` が設定される）
  - テストを作成・実行・失敗を記録したらタスク完了とする
  - _Requirements: 2.3, 2.4_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 既存のIDベースマッピングの保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力に対する動作を観察する
  - 観察: `reason_relocation_3day` → `valuationReasonEmailAssignee` が返される（IDマッピング使用）
  - 観察: `visit_reminder` ラベルを含むテンプレート → `visitReminderAssignee` が返される
  - 観察: `remind` ラベルを含むテンプレート → `callReminderEmailAssignee` が返される
  - 観察: `キャンセル案内` ラベルを含むテンプレート → `cancelNoticeAssignee` が返される
  - 観察: `長期客` または `除外前` ラベルを含むテンプレート → `longTermEmailAssignee` が返される
  - プロパティベーステスト: `EMAIL_TEMPLATE_ASSIGNEE_MAP` の全エントリに対して、修正前後で同じ `assigneeKey` が返されること
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストPASS（保全すべきベースライン動作を確認）
  - テストを作成・実行・PASSを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. ラベルフォールバック判定の誤条件を削除する

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/CallModePage.tsx` の `handleConfirmSend` 関数を修正
    - **メイン処理（約3080行目付近）**: 以下のブロックを削除する
      ```typescript
      } else if (template.label.includes('査定額案内') || template.label.includes('査定理由')) {
        assigneeKeyForDirect = 'valuationReasonEmailAssignee';
      ```
    - **バックグラウンド処理（約3130行目付近）**: 以下のブロックを削除する
      ```typescript
      } else if (template.label.includes('査定額案内') || template.label.includes('査定理由')) {
        assigneeKey = 'valuationReasonEmailAssignee';
      ```
    - 両箇所とも、次の `} else if (template.label.includes('長期客') || template.label.includes('除外前')) {` に直接つながるようにする
    - _Bug_Condition: isBugCondition(template) — EMAIL_TEMPLATE_ASSIGNEE_MAP[template.id] が undefined かつ ラベルに '査定額案内' または '査定理由' を含む_
    - _Expected_Behavior: valuationReasonEmailAssignee が設定されない（reason_*_3day IDはIDマッピングで処理されるため不要）_
    - _Preservation: EMAIL_TEMPLATE_ASSIGNEE_MAP の全IDマッピング、訪問前日・リマインド・キャンセル・長期客のラベルフォールバック判定は変更しない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.2 バグ条件の探索テストが今度はPASSすることを確認する
    - **Property 1: Expected Behavior** - 誤ったvaluationReasonEmailAssignee書き込みの防止
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストPASS（バグが修正されたことを確認）
    - _Requirements: 2.3, 2.4_

  - [x] 3.3 保全テストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - 既存のIDベースマッピングの保持
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストPASS（リグレッションがないことを確認）
    - 修正後も全テストがPASSすることを確認する

- [x] 4. チェックポイント — 全テストがPASSすることを確認する
  - 全テスト（バグ条件テスト・保全テスト）がPASSすることを確認する
  - 疑問点があればユーザーに確認する
