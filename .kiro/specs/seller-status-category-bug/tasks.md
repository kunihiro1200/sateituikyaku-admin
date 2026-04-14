# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - exclusion_date を持つ売主が当日TEL_未着手に誤って分類されるバグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正前にテストが失敗しても、テストやコードを修正しないこと**
  - **注意**: このテストは期待される動作をエンコードしており、実装後に PASS することで修正を検証する
  - **目的**: バグの存在を示す反例を発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `frontend/frontend/src/utils/sellerStatusFilters.ts` の `isTodayCallNotStarted()` 関数
  - バグ条件（design.md の isBugCondition より）:
    - `seller.exclusion_date` が null でなく空でもない
    - `isTodayCallBase(seller) == true`
    - `seller.status == "追客中"`
    - `seller.unreachable_status == ""`
    - `seller.confidence_level` が "ダブり", "D", "AI査定" のいずれでもない
    - `seller.inquiry_date >= "2026-01-01"`
  - テストアサーション: 上記条件を満たす売主に対して `isTodayCallNotStarted()` が `false` を返すこと
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト FAIL（バグの存在を証明）
  - 発見した反例を記録する（例: AA13967相当のデータで `isTodayCallNotStarted()` が `true` を返す）
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - exclusion_date を持たない売主の動作が変わらないこと
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで、バグ条件を満たさない入力（`exclusion_date` が空または未設定）の動作を観察する
  - 観察: `exclusion_date` なし + 当日TEL_未着手の全条件を満たす売主 → `isTodayCallNotStarted()` が `true` を返す
  - 観察: `exclusion_date` なし + 不通あり → `isTodayCallNotStarted()` が `false` を返す
  - 観察: `exclusion_date` なし + 確度が「ダブり」 → `isTodayCallNotStarted()` が `false` を返す
  - 観察: `exclusion_date` なし + 未査定条件を満たす → `isUnvaluated()` が `true` を返す
  - プロパティベーステスト: `exclusion_date` が空/null/未設定の全パターンで修正前後の結果が一致すること
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト PASS（保全すべきベースライン動作を確認）
  - 修正前のコードでテストが PASS したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. exclusion_date チェック欠落バグの修正

  - [x] 3.1 フロントエンド `isTodayCallNotStarted()` に exclusion_date チェックを追加する
    - ファイル: `frontend/frontend/src/utils/sellerStatusFilters.ts`
    - 不通チェックの直後に以下を追加する:
      ```typescript
      const exclusionDate = seller.exclusionDate || seller.exclusion_date || '';
      if (exclusionDate && exclusionDate.trim() !== '') {
        return false;
      }
      ```
    - _Bug_Condition: isBugCondition(seller) — exclusion_date が設定されているにもかかわらず isTodayCallNotStarted() が true を返す_
    - _Expected_Behavior: exclusion_date が設定されている売主は isTodayCallNotStarted() が false を返す_
    - _Preservation: exclusion_date が空または未設定の売主に対しては動作が変わらない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 バックエンド `SellerSidebarCountsUpdateService.ts` に exclusion_date チェックを追加する
    - ファイル: `backend/src/services/SellerSidebarCountsUpdateService.ts`
    - `todayCallNotStartedCount` 計算内の `inquiryDate` チェックの前に以下を追加する:
      ```typescript
      const exclusionDate = (s as any).exclusion_date || '';
      if (exclusionDate && exclusionDate.trim() !== '') return false;
      ```
    - _Bug_Condition: exclusion_date が設定されている売主が todayCallNotStartedCount に誤ってカウントされる_
    - _Expected_Behavior: exclusion_date が設定されている売主は todayCallNotStartedCount から除外される_
    - _Preservation: exclusion_date が空または未設定の売主のカウントは変わらない_
    - _Requirements: 2.3_

  - [x] 3.3 バックエンド `SellerService.supabase.ts` に exclusion_date チェックを追加する
    - ファイル: `backend/src/services/SellerService.supabase.ts`
    - `getSidebarCountsFallback()` 内の `todayCallNotStartedCount` 計算に以下を追加する:
      - 既存の `exclusionDate` 変数宣言の後に `if` チェックを追加する:
      ```typescript
      const exclusionDate = (s as any).exclusion_date || '';
      if (exclusionDate && exclusionDate.trim() !== '') return false;
      ```
    - _Bug_Condition: getSidebarCountsFallback の todayCallNotStartedCount に exclusion_date チェックが欠落している_
    - _Expected_Behavior: exclusion_date が設定されている売主は getSidebarCountsFallback のカウントからも除外される_
    - _Preservation: exclusion_date が空または未設定の売主のカウントは変わらない_
    - _Requirements: 2.3_

  - [x] 3.4 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - exclusion_date を持つ売主が当日TEL_未着手から除外される
    - **重要**: タスク1で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされたことを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - exclusion_date を持たない売主の動作が変わらないこと
    - **重要**: タスク2で作成した同じテストを再実行すること — 新しいテストを書かないこと
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
