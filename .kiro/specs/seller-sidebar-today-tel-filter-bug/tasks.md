# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 追客不要ステータスの除外漏れ
  - **CRITICAL**: このテストは修正前のコードで FAIL することが期待される — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正が正しいことを検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
    - `status = '追客不要'`、`next_call_date` = 今日以前、`visit_assignee` = null の売主
    - `status = '除外済追客不要'`、`next_call_date` = 今日以前、`visit_assignee` = null の売主
  - `filteredTodayCallSellers` に「追客不要」を含む売主が含まれないことをアサートする（Bug Condition: `isBugCondition(seller)` = `seller.status.includes('追客不要')`）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（バグの存在を証明）
  - カウンターサンプルを記録して根本原因を理解する（例: `status='追客不要'` の売主が `filteredTodayCallSellers` に含まれる）
  - テストを作成し、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 通常ステータスの売主への影響なし
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで「追客不要」を含まない売主の動作を観察する:
    - `status = '追客中'`、`next_call_date` = 今日以前、`visit_assignee` = null → `filteredTodayCallSellers` に含まれることを確認
    - `status = '他決→追客'`、`next_call_date` = 今日以前、`visit_assignee` = null → `filteredTodayCallSellers` に含まれることを確認
    - `status = '除外後追客中'`、`next_call_date` = 今日以前、`visit_assignee` = null → `filteredTodayCallSellers` に含まれることを確認
  - プロパティベーステスト: 「追客不要」を含まない全ステータスの売主に対して、`filteredTodayCallSellers` への包含状態が修正前後で変化しないことを検証
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（保全すべきベースライン動作を確認）
  - テストを作成し、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [-] 3. 「追客不要」ステータス除外バグの修正

  - [x] 3.1 `filteredTodayCallSellers` フィルタに「追客不要」除外条件を追加する
    - `backend/src/services/SellerSidebarCountsUpdateService.ts` を編集する
    - `filteredTodayCallSellers` の生成ロジックに `status.includes('追客不要')` の除外条件を追加する:
      ```typescript
      const filteredTodayCallSellers = todayCallBaseSellers.filter(s => {
        // 追客不要を含むステータスを除外（架電対象外）
        const status = s.status || '';
        if (status.includes('追客不要')) return false;
        return !hasValidVisitAssignee(s.visit_assignee);
      });
      ```
    - `SellerService.supabase.ts` の `todayCall` ケース（行 1299-1303）の実装を参考にする
    - _Bug_Condition: `isBugCondition(seller)` = `(seller.status || '').includes('追客不要')` AND seller is in `filteredTodayCallSellers`_
    - _Expected_Behavior: 「追客不要」を含む全ての売主が `filteredTodayCallSellers` から除外され、「当日TEL分」「当日TEL（内容）」「当日TEL_未着手」「Pinrich空欄」のカウントに含まれない_
    - _Preservation: 「追客不要」を含まない全ての売主の `filteredTodayCallSellers` への包含状態は変化しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 追客不要ステータスの除外
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS することで期待動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 通常ステータスの売主への影響なし
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [-] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
