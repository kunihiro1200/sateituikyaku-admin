# Implementation Plan

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - vendor_survey='未' かつ broker_inquiry='業者問合せ' の場合に Priority 2 を返さないバグ
  - **CRITICAL**: このテストは未修正コードで FAIL する — FAIL することがバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示す反例を見つける
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト対象: `backend/src/services/__tests__/BuyerStatusCalculator.vendor-inquiry.bugfix.test.ts` を新規作成
  - `vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'` の買主データで `calculateBuyerStatus` を呼び出す（Bug Condition: `isBugCondition(buyer)` = `vendor_survey='未' AND broker_inquiry='業者問合せ'`）
  - テストアサーション: `result.status === '業者問合せあり'` かつ `result.priority === 2` を期待する（Expected Behavior）
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが FAIL する（Priority 2 の除外条件 `!equals(buyer.broker_inquiry, '業者問合せ')` により、より低い優先度のステータスが返るため）
  - 反例を記録する（例: `calculateBuyerStatus({ vendor_survey: '未', broker_inquiry: '業者問合せ' })` が `{ status: '業者問合せあり', priority: 2 }` を返さない）
  - テストを作成し、実行し、FAIL を確認したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保持確認プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - broker_inquiry が '業者問合せ' 以外の場合の既存動作を保持する
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - テスト対象: `backend/src/services/__tests__/BuyerStatusCalculator.vendor-inquiry.preservation.test.ts` を新規作成
  - 観察1: `vendor_survey = '未'`, `broker_inquiry = null` → 未修正コードで Priority 2 を返すことを確認
  - 観察2: `vendor_survey = '未'`, `broker_inquiry = ''` → 未修正コードで Priority 2 を返すことを確認
  - 観察3: `vendor_survey = '未'`, `broker_inquiry = '業者（両手）'` → 未修正コードで Priority 2 を返すことを確認
  - 観察4: `vendor_survey = '済'`, `broker_inquiry = '業者問合せ'` → 未修正コードで Priority 2 を返さないことを確認
  - 観察5: `valuation_survey` 入力済み かつ `vendor_survey = '未'` → 未修正コードで Priority 1 が優先されることを確認
  - プロパティベーステスト: `vendor_survey = '未'` かつ `broker_inquiry` が `'業者問合せ'` 以外の任意の値（null, '', '業者（両手）' など）の場合、常に Priority 2 を返すことを検証（fast-check 使用）
  - 未修正コードで実行する
  - **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作の確認）
  - テストを作成し、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. vendor_survey='未' かつ broker_inquiry='業者問合せ' の買主がサイドバーに表示されないバグを修正する

  - [x] 3.1 修正を実装する
    - `backend/src/services/BuyerStatusCalculator.ts` の Priority 2 条件を修正する
    - `!equals(buyer.broker_inquiry, '業者問合せ')` の除外条件を削除する
    - 修正前: `if (equals(buyer.vendor_survey, '未') && !equals(buyer.broker_inquiry, '業者問合せ'))`
    - 修正後: `if (equals(buyer.vendor_survey, '未'))`
    - コメントも更新: 「業者からの問合せ自体は除外」という誤ったコメントを削除し、正しい仕様を記載する
    - _Bug_Condition: `isBugCondition(buyer)` = `equals(buyer.vendor_survey, '未') AND equals(buyer.broker_inquiry, '業者問合せ')`_
    - _Expected_Behavior: `{ status: '業者問合せあり', priority: 2 }` を返す_
    - _Preservation: `vendor_survey = '未'` かつ `broker_inquiry` が `'業者問合せ'` 以外の場合は引き続き Priority 2 を返す。Priority 1 の優先順位は変わらない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - vendor_survey='未' かつ broker_inquiry='業者問合せ' → Priority 2 を返す
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク1のテスト（`BuyerStatusCalculator.vendor-inquiry.bugfix.test.ts`）を再実行する
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保持確認テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - broker_inquiry が '業者問合せ' 以外の場合の既存動作を保持する
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する — 新しいテストを書かない
    - タスク2のテスト（`BuyerStatusCalculator.vendor-inquiry.preservation.test.ts`）を再実行する
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションがないことを確認）
    - 既存の保持確認テスト（`BuyerStatusCalculator.preservation.test.ts`）も PASS することを確認する

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - `BuyerStatusCalculator.vendor-inquiry.bugfix.test.ts` が PASS することを確認する
  - `BuyerStatusCalculator.vendor-inquiry.preservation.test.ts` が PASS することを確認する
  - 既存の `BuyerStatusCalculator.preservation.test.ts` が PASS することを確認する
  - 疑問点があればユーザーに確認する
