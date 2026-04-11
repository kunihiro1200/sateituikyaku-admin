# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - サイドバーカウントとフィルタ件数の不一致
  - **CRITICAL**: このテストは未修正コードで FAIL することが期待される（バグの存在を確認）
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしており、修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象カテゴリ（Bug Condition より）:
    - `todayCallAssigned`: `status='専任媒介'` かつ `visit_assignee='TK'` かつ `next_call_date=今日` の売主がフィルタに含まれてしまうことを確認
    - `todayCallNotStarted`: `status='他決→追客'` かつ未着手条件を満たす売主がカウントに含まれるがフィルタに含まれないことを確認
    - `pinrichEmpty`: `status='他決→追客'` かつ `pinrich_status=null` の売主がカウントに含まれるがフィルタに含まれないことを確認
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（バグの存在を証明）
  - 反例を記録して根本原因を理解する（例: `todayCallAssigned` でフィルタ件数 > カウント）
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.2, 1.3, 1.4_

- [x] 2. 保存プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 修正対象外カテゴリの動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで修正対象外カテゴリの動作を観察・記録する:
    - `visitDayBefore`: 訪問日前日の売主が返されることを確認
    - `visitCompleted`: 訪問済みの売主が返されることを確認
    - `todayCall`: 当日TEL分の売主が返されることを確認
    - `unvaluated`: 未査定の売主が返されることを確認
    - `mailingPending`: 査定郵送待ちの売主が返されることを確認
    - `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`: 各カテゴリの動作を確認
  - 観察した動作パターンをプロパティベーステストとして記述する（Preservation Requirements より）
  - 未修正コードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（保存すべきベースライン動作を確認）
  - テストを書き、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. サイドバーカウント不一致バグの修正

  - [x] 3.1 `todayCallAssigned` に `追客中` チェックと `他社買取` 除外を追加
    - `backend/src/services/SellerService.supabase.ts` の `statusCategory` スイッチ文を修正
    - `.ilike('status', '%追客中%')` を追加（カウント計算と一致させる）
    - `.not('status', 'ilike', '%他社買取%')` を追加（カウント計算と一致させる）
    - _Bug_Condition: isBugCondition('todayCallAssigned') = countCondition includes '%追客中%' AND filterCondition does NOT include '%追客中%'_
    - _Expected_Behavior: getSellers({ statusCategory: 'todayCallAssigned' }) の件数 = seller_sidebar_counts.todayCallAssigned_
    - _Preservation: visitDayBefore, visitCompleted, todayCall, unvaluated, mailingPending, exclusive, general, visitOtherDecision, unvisitedOtherDecision, visitAssigned:xxx のフィルタリングロジックは変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 `todayCallNotStarted` を `他決→追客` を含むよう修正
    - `backend/src/services/SellerService.supabase.ts` の `todayCallNotStarted` ケースを修正
    - カウント計算の `filteredTodayCallSellers`（追客中 OR 他決→追客）と同じ条件にする
    - design.md の「変更2」に記載の JS フィルタリング方式を実装する
    - 注意: `todayCallNotStartedCount` は `status === '追客中'` のみカウントするため、フィルタも同様に `status === '追客中'` のみを対象とする
    - _Bug_Condition: isBugCondition('todayCallNotStarted') = countCondition includes '他決→追客' AND filterCondition does NOT include '他決→追客'_
    - _Expected_Behavior: getSellers({ statusCategory: 'todayCallNotStarted' }) の件数 = seller_sidebar_counts.todayCallNotStarted_
    - _Preservation: 修正対象外カテゴリのフィルタリングロジックは変更しない_
    - _Requirements: 2.1, 2.3_

  - [x] 3.3 `pinrichEmpty` を `他決→追客` を含むよう修正
    - `backend/src/services/SellerService.supabase.ts` の `pinrichEmpty` ケースを修正
    - カウント計算の `filteredTodayCallSellers`（追客中 OR 他決→追客）から派生させる
    - design.md の「変更3」に記載の JS フィルタリング方式を実装する
    - _Bug_Condition: isBugCondition('pinrichEmpty') = countCondition includes '他決→追客' AND filterCondition does NOT include '他決→追客'_
    - _Expected_Behavior: getSellers({ statusCategory: 'pinrichEmpty' }) の件数 = seller_sidebar_counts.pinrichEmpty_
    - _Preservation: 修正対象外カテゴリのフィルタリングロジックは変更しない_
    - _Requirements: 2.1, 2.4_

  - [x] 3.4 バグ条件探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - サイドバーカウントとフィルタ件数の一致
    - **IMPORTANT**: タスク1で書いた SAME テストを再実行する（新しいテストを書かない）
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 保存プロパティテストが引き続き PASS することを確認
    - **Property 2: Preservation** - 修正対象外カテゴリの動作保持
    - **IMPORTANT**: タスク2で書いた SAME テストを再実行する（新しいテストを書かない）
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションなしを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント - 全テストの PASS を確認
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
