# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 訪問済み他決の通知ラベル誤り
  - **重要**: このテストは修正前のコードで **FAIL** することが期待される — 失敗がバグの存在を証明する
  - **修正やコードを変更しないこと（テストが失敗しても）**
  - **目的**: バグが存在することを示すカウンターエグザンプルを発見する
  - **スコープ**: `frontend/frontend/src/pages/CallModePage.tsx` の `handleSendChatNotification` 関数のエンドポイント選択ロジック
  - テスト内容:
    - `visit_assignee = "KN"`（訪問済み）、`status = 'other_decision_follow_up'`（`statusLabel = '他決→追客'`）の場合、`post-visit-other-decision` エンドポイントが呼ばれることを期待するテストを作成
    - 未修正コードでは `pre-visit-other-decision` が呼ばれるため FAIL する
    - `visit_assignee = null` の場合は `pre-visit-other-decision` が呼ばれることを確認（正常動作）
  - 修正前のコードで実行し、カウンターエグザンプルを記録する
  - **期待される結果**: テスト FAIL（バグが存在することを確認）
  - カウンターエグザンプルの例: `visit_assignee = "KN"` なのに `pre-visit-other-decision` が呼ばれる
  - _Requirements: 1.1_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 未訪問他決・その他通知への影響なし
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで以下の動作を観察・記録する:
    - `visit_assignee = null` の場合に `pre-visit-other-decision` が呼ばれること
    - `visit_assignee = "外す"` の場合に `pre-visit-other-decision` が呼ばれること
    - `visit_assignee = ""` の場合に `pre-visit-other-decision` が呼ばれること
    - `statusLabel.includes('専任')` の場合に `exclusive-contract` が呼ばれること
    - `statusLabel.includes('一般')` の場合に `general-contract` が呼ばれること
  - 観察した動作をプロパティベーステストとして記述する
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト PASS（保全すべきベースライン動作を確認）
  - _Requirements: 2.2, 3.1, 3.2, 3.3_

- [-] 3. 訪問状況判定ロジックのバグを修正する

  - [x] 3.1 `handleSendChatNotification` のエンドポイント選択ロジックを修正する
    - `frontend/frontend/src/pages/CallModePage.tsx` の `handleSendChatNotification` 関数（約3810行目）を修正
    - 他決ステータスの条件分岐に `seller.visitAssignee` の有無チェックを追加する
    - **修正前（バグあり）**:
      ```typescript
      } else if (statusLabel.includes('未訪問他決') || statusLabel.includes('他決')) {
        endpoint = `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
      }
      ```
    - **修正後（バグ修正）**:
      ```typescript
      } else if (statusLabel.includes('未訪問他決')) {
        endpoint = `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
      } else if (statusLabel.includes('他決')) {
        // visit_assigneeが設定されている（訪問済み）場合は訪問後他決、それ以外は未訪問他決
        const isVisited = seller.visitAssignee && seller.visitAssignee !== '' && seller.visitAssignee !== '外す';
        endpoint = isVisited
          ? `/api/chat-notifications/post-visit-other-decision/${seller.id}`
          : `/api/chat-notifications/pre-visit-other-decision/${seller.id}`;
      }
      ```
    - `backend/` 配下のファイルは変更不要（`ChatNotificationService.ts` は既に正しく実装されている）
    - _Bug_Condition: `visit_assignee` が設定されているにもかかわらず `pre-visit-other-decision` が呼ばれる_
    - _Expected_Behavior: `visit_assignee` が設定されている場合は `post-visit-other-decision` を呼び、Chat本文に「訪問後他決」が表示される_
    - _Preservation: `visit_assignee` が未設定の場合は引き続き `pre-visit-other-decision` を呼ぶ_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 訪問済み他決の通知ラベル修正
    - **重要**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - `visit_assignee = "KN"` の場合に `post-visit-other-decision` が呼ばれることを確認
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 未訪問他決・その他通知への影響なし
    - **重要**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - `visit_assignee = null/空文字/「外す」` の場合に `pre-visit-other-decision` が呼ばれることを確認
    - 専任・一般媒介通知のエンドポイント選択が変わらないことを確認
    - **期待される結果**: テスト PASS（リグレッションなしを確認）

- [x] 4. チェックポイント — 全テストの通過確認
  - タスク1のバグ条件テストが PASS していることを確認
  - タスク2の保全テストが PASS していることを確認
  - 修正箇所（`handleSendChatNotification` の他決エンドポイント選択ロジック）をコードレビューで確認
  - `visit_assignee` の判定条件（null・空文字・「外す」を未訪問扱い）が正しいことを確認
  - 疑問点があればユーザーに確認する
