# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - カウント計算とフィルタリングの条件不一致
  - **重要**: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしており、修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `SellerService.listSellers()` の `todayCall`, `todayCallNotStarted`, `unvaluated` カテゴリ
  - 差異2の再現: `status='追客中'`, `next_call_date=today`, `unreachable_status=''`, `confidence_level=''`, `inquiry_date='2026-02-01'`, コミュニケーション情報なし, 営担なし の売主 → カウント計算では `todayCallNotStarted` にカウントされ `todayCall` から除外されるが、フィルタリングでは `todayCall` に含まれる（不一致）
  - 差異1の再現: `status='追客中'`, `next_call_date=today`, `exclusion_date='2026-03-01'`, `inquiry_date='2026-02-01'`, コミュニケーション情報なし, 営担なし の売主 → カウント計算では `todayCallNotStarted` にカウントされるが、フィルタリングでは除外される（不一致）
  - 差異3の再現: `status='追客中'`, `inquiry_date='2026-02-01'`, `exclusion_date='2026-03-01'`, 査定額なし, 営担なし の売主 → カウント計算では `unvaluated` にカウントされるが、フィルタリングでは除外される（不一致）
  - 未修正コードでテストを実行する
  - **期待結果**: テストが FAIL する（バグの存在を証明）
  - 見つかった反例を記録して根本原因を理解する
  - テストを書き、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.2, 1.3, 1.4_

- [ ] 2. 保全プロパティテストを書く（修正実装の前に）
  - **Property 2: Preservation** - 修正対象外カテゴリの動作維持
  - **重要**: observation-first メソドロジーに従うこと
  - 未修正コードで修正対象外カテゴリ（`visitDayBefore`, `visitCompleted`, `todayCallAssigned`, `todayCallWithInfo`, `mailingPending`, `exclusive`, `general`, `visitOtherDecision`, `unvisitedOtherDecision`, `visitAssigned:xxx`）の動作を観察・記録する
  - 観察: `visitDayBefore` フィルタが訪問日前日の売主のみを返すことを確認
  - 観察: `visitCompleted` フィルタが訪問済みの売主のみを返すことを確認
  - 観察: `todayCallAssigned` フィルタが営担あり + 次電日が今日以前の売主のみを返すことを確認
  - 観察: `exclusive`/`general`/`visitOtherDecision`/`unvisitedOtherDecision` フィルタの動作を確認
  - 観察した動作パターンをプロパティベーステストとして記述する
  - 未修正コードでテストを実行する
  - **期待結果**: テストが PASS する（ベースライン動作を確認）
  - テストを書き、実行し、未修正コードで PASS することを確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [ ] 3. カウント・リスト件数不一致バグの修正

  - [ ] 3.1 修正1: `todayCall` ケースへの未着手除外ロジック追加
    - `backend/src/services/SellerService.supabase.ts` の `todayCall` ケースを修正
    - `todayCall` のクエリで `unreachable_status`, `confidence_level`, `inquiry_date` を SELECT に追加する
    - JSフィルタ内に `isNotStarted` 判定を追加し、未着手条件を満たす売主を除外する
    - 除外条件: `status === '追客中'` かつ `!unreachable_status` かつ `confidence_level` が「ダブり」「D」「AI査定」でない かつ `inquiry_date >= '2026-01-01'`
    - `isNotStarted` が true の売主は `todayCallNotStarted` に分類されるため `todayCall` から除外する
    - _Bug_Condition: isBugCondition(seller, 'todayCall') — unreachable_status/confidence_level/inquiry_date チェックなしで未着手売主が除外されない_
    - _Expected_Behavior: todayCall フィルタが未着手売主を除外し、カウント計算と同一の売主集合を返す_
    - _Preservation: todayCallAssigned, todayCallWithInfo など他カテゴリのロジックは変更しない_
    - _Requirements: 1.3, 2.3_

  - [ ] 3.2 修正2: `todayCallNotStarted` の `exclusion_date` チェック削除
    - `backend/src/services/SellerService.supabase.ts` の `todayCallNotStarted` ケースを修正
    - `isTodayCallNotStarted` 判定から `!exclusionDate` チェックを削除する
    - カウント計算（`SellerSidebarCountsUpdateService`）に合わせて条件を統一する
    - _Bug_Condition: isBugCondition(seller, 'todayCallNotStarted') — exclusion_date ありの売主がフィルタで除外されるがカウントには含まれる_
    - _Expected_Behavior: todayCallNotStarted フィルタが exclusion_date の有無に関わらずカウント計算と同一の売主集合を返す_
    - _Preservation: todayCallNotStarted 以外のカテゴリのロジックは変更しない_
    - _Requirements: 1.2, 2.2_

  - [ ] 3.3 修正3: `unvaluated` の `isTodayCallNotStarted` 判定の `exclusion_date` チェック削除
    - `backend/src/services/SellerService.supabase.ts` の `unvaluated` ケースを修正
    - `unvaluated` 内の `isTodayCallNotStarted` 判定から `!exclusionDate` チェックを削除する
    - カウント計算（`SellerSidebarCountsUpdateService`）に合わせて条件を統一する
    - _Bug_Condition: isBugCondition(seller, 'unvaluated') — exclusion_date ありの売主がフィルタで除外されるがカウントには含まれる_
    - _Expected_Behavior: unvaluated フィルタが exclusion_date の有無に関わらずカウント計算と同一の売主集合を返す_
    - _Preservation: unvaluated 以外のカテゴリのロジックは変更しない_
    - _Requirements: 1.4, 2.4_

  - [ ] 3.4 バグ条件探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - カウントとリスト件数の一致
    - **重要**: タスク1で書いた同じテストを再実行する（新しいテストを書かない）
    - タスク1のテストは期待動作をエンコードしており、修正後に PASS することで修正を検証する
    - タスク1のバグ条件探索テストを実行する
    - **期待結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.5 保全テストが引き続き PASS することを確認
    - **Property 2: Preservation** - 修正対象外カテゴリの動作維持
    - **重要**: タスク2で書いた同じテストを再実行する（新しいテストを書かない）
    - タスク2の保全プロパティテストを実行する
    - **期待結果**: テストが PASS する（リグレッションなしを確認）
    - 修正後も全ての修正対象外カテゴリが同一の動作をすることを確認する

- [ ] 4. チェックポイント - 全テストの PASS を確認
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
