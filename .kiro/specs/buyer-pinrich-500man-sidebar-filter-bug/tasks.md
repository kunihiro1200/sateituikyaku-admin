# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - pinrich500manUnregistered フィルタリング未実装バグ
  - **CRITICAL**: このテストは修正前のコードで FAIL することが期待される — FAIL することでバグの存在が確認される
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される振る舞いをエンコードしている — 実装後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容: 4条件（email非空・price≤500万・pinrich_500man_registration未・reception_date≥2026-01-01）を満たす買主データを用意し、`getBuyersByStatus('pinrich500manUnregistered')` を呼ぶ → 空配列が返ることを確認（修正前コードで FAIL）
  - バグ条件: `isBugCondition(X)` = `X.status === 'pinrich500manUnregistered'`（design.md の Bug Condition 参照）
  - 期待される振る舞い: 4条件を全て満たす買主配列が返る（design.md の Property 1 参照）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見したカウンターサンプルを記録して根本原因を理解する（例: `getBuyersByStatus('pinrich500manUnregistered')` が空配列を返す）
  - テストを作成し、実行し、FAIL を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 他カテゴリへの非影響
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 修正前のコードで非バグ条件の入力（`status !== 'pinrich500manUnregistered'`）の振る舞いを観察する
  - 観察1: `getBuyersByStatus('todayCall')` が既存ロジックで正常にフィルタリングされることを確認
  - 観察2: `getBuyersByStatus('viewingDayBefore')` が既存ロジックで正常に動作することを確認
  - 観察3: `getBuyersByStatus('inquiryEmailUnanswered')` が空配列を返すことを確認（未実装カテゴリ）
  - 観察4: `getSidebarCountsFallback` で `pinrich500manUnregistered` 以外のカテゴリーのカウントが正常に計算されることを確認
  - 観察した振る舞いパターンをキャプチャするプロパティベーステストを作成する（design.md の Preservation Requirements 参照）
  - 修正前のコードでテストを実行する
  - **EXPECTED OUTCOME**: テストが PASS する（これが修正前の基準動作を確認する）
  - テストを作成し、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. pinrich500manUnregistered フィルタリングバグの修正

  - [x] 3.1 修正1: getBuyersByStatus に pinrich500manUnregistered の専用分岐を追加
    - `backend/src/services/BuyerService.ts` の約2504行目付近を修正
    - 既存の `else if (status === 'inquiryEmailUnanswered' || ...)` ブロックの直前に新しい `else if` 分岐を追加
    - 4条件でフィルタリング: email非空 AND price≤500万 AND pinrich_500man_registration未 AND reception_date≥2026-01-01
    - **注意**: 日本語を含むファイルのため、Pythonスクリプトを使用して編集すること（file-encoding-protection.md のルール）
    - _Bug_Condition: `isBugCondition(X)` = `X.status === 'pinrich500manUnregistered'`（design.md 参照）_
    - _Expected_Behavior: 4条件を全て満たす買主配列を返す（design.md の Property 1 参照）_
    - _Preservation: `status !== 'pinrich500manUnregistered'` の全入力は修正前後で同一の結果を返す（design.md の Preservation Requirements 参照）_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 修正2: getSidebarCountsFallback のカウント計算に reception_date 条件を追加
    - `backend/src/services/BuyerService.ts` の約2183行目付近を修正
    - `pinrich500manUnregistered` のカウント計算に `buyer.reception_date && buyer.reception_date >= '2026-01-01'` を追加
    - **注意**: `reception_date` は `YYYY-MM-DD` 形式の文字列のため、文字列比較で正しく動作する（Date変換不要）
    - **注意**: 日本語を含むファイルのため、Pythonスクリプトを使用して編集すること（file-encoding-protection.md のルール）
    - _Bug_Condition: カウント計算で reception_date 条件が欠落している（design.md の Bug Details 参照）_
    - _Expected_Behavior: reception_date >= '2026-01-01' の買主のみカウントする（design.md の Property 1 参照）_
    - _Requirements: 2.3_

  - [x] 3.3 修正3: updateBuyerSidebarCounts のカウント計算にも reception_date 条件を追加
    - `backend/src/services/BuyerService.ts` 内の `pinrich500manUnregistered` カウント計算箇所を修正
    - `getSidebarCountsFallback` と同様に `buyer.reception_date && buyer.reception_date >= '2026-01-01'` を追加
    - **注意**: 日本語を含むファイルのため、Pythonスクリプトを使用して編集すること（file-encoding-protection.md のルール）
    - _Requirements: 2.4_

  - [x] 3.4 バグ条件の探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - pinrich500manUnregistered フィルタリング
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待される振る舞いをエンコードしている
    - このテストが PASS すれば、期待される振る舞いが満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.5 保全テストが引き続き PASS することを確認
    - **Property 2: Preservation** - 他カテゴリへの非影響
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2の保全プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. チェックポイント — 全テストの PASS を確認
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
  - タスク1のバグ条件探索テスト（Property 1）が PASS していることを確認
  - タスク2の保全プロパティテスト（Property 2）が PASS していることを確認
  - サイドバーの「Pinrich500万以上登録未」カテゴリーをクリックして買主リストが表示されることを確認
  - reception_date が 2025-12-31 の買主がリストに含まれないことを確認
  - reception_date が 2026-01-01 の買主がリストに含まれることを確認
  - 他のサイドバーカテゴリーが正常に動作することを確認
