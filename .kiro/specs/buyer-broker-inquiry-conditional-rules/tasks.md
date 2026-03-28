# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - broker_inquiry = '業者問合せ' の場合の条件分岐バグ
  - **重要**: このテストは未修正コードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正を試みないこと** — テストまたはコードが失敗しても修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 実装後に PASS することで修正を検証する
  - **目標**: バグが存在することを示す反例を発見する
  - **スコープ付き PBT アプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - バグ2の探索テスト: `broker_inquiry = '業者問合せ'`、`latest_viewing_date = 明日` → `calculateBuyerStatus` が「内覧日前日」を返さないことを確認（design.md の Bug Condition より）
  - バグ2の探索テスト（木曜）: `broker_inquiry = '業者問合せ'`、`latest_viewing_date = 木曜日（2日後）` → 「内覧日前日」を返さないことを確認
  - バグ1の探索テスト: `broker_inquiry = '業者問合せ'`、`inquiry_source = null` → `checkMissingFields` が `inquiry_source` を返さないことを確認
  - BuyerData 型確認: `broker_inquiry` フィールドが `BuyerData` インターフェースに存在するか確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（これが正しい — バグの存在を証明する）
  - 発見された反例を記録して根本原因を理解する
  - テストを作成し、実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保持プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - broker_inquiry が '業者問合せ' 以外の場合の既存動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ入力の動作を観察する
  - 観察1: `broker_inquiry = null`（空欄）かつ `inquiry_source = null` → `checkMissingFields` が `inquiry_source` を返すことを確認
  - 観察2: `broker_inquiry = null`（空欄）かつ `latest_viewing_date = 明日` → `calculateBuyerStatus` が「内覧日前日」を返すことを確認
  - 観察3: `broker_inquiry = '業者（両手）'` かつ `inquiry_source = null` → 必須エラーが発生することを確認
  - 観察4: `broker_inquiry = '業者問合せ'` かつ `inquiry_source = 'SUUMO'` → 値が保持されることを確認
  - 観察されたパターンを捉えるプロパティベーステストを作成する（design.md の Preservation Requirements より）
  - プロパティベーステストは多くのテストケースを自動生成し、より強い保証を提供する
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（これが保持すべきベースライン動作を確認する）
  - テストを作成し、実行し、未修正コードで PASS したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. broker_inquiry = '業者問合せ' の条件分岐バグを修正する

  - [x] 3.1 修正を実装する
    - `backend/src/services/BuyerStatusCalculator.ts` の `BuyerData` インターフェースに `broker_inquiry` フィールドが定義されているか確認し、未定義の場合は追加する
    - `BuyerStatusCalculator.ts` の Priority 3 判定で `not(equals(buyer.broker_inquiry, '業者問合せ'))` の条件が正しく動作しているか確認・修正する
    - `frontend/frontend/src/pages/BuyerDetailPage.tsx` の `checkMissingFields` 関数で `broker_inquiry !== '業者問合せ'` の条件が正しく機能しているか確認・修正する
    - `BuyerDetailPage.tsx` の `fetchBuyer` 初期化処理（`initialMissing` 構築部分）で `broker_inquiry !== '業者問合せ'` の条件が適用されているか確認・修正する
    - `InlineEditableField` の `validation` プロパティで `inquiry_source` フィールドの `broker_inquiry` チェックが行われているか確認・修正する
    - 買主用サイドバーコンポーネントが `BuyerStatusCalculator.ts` の結果を使用しているか確認し、独自ロジックがある場合は除外条件を追加する
    - _Bug_Condition: isBugCondition(input) where input.broker_inquiry = '業者問合せ' AND (inquiry_source が空 OR latest_viewing_date が明日/木曜2日後)_
    - _Expected_Behavior: broker_inquiry = '業者問合せ' の場合、inquiry_source を必須チェックしない、かつ「内覧日前日」ステータスに分類しない_
    - _Preservation: broker_inquiry が '業者問合せ' 以外の全入力に対して、inquiry_source 必須チェックおよびステータス計算の動作を変更しない_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - broker_inquiry = '業者問合せ' の場合の条件分岐バグ修正
    - **重要**: タスク1と同じテストを再実行する — 新しいテストを作成しない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保持テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - broker_inquiry が '業者問合せ' 以外の場合の既存動作保持
    - **重要**: タスク2と同じテストを再実行する — 新しいテストを作成しない
    - タスク2の保持プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テスト（バグ条件テスト・保持テスト）が PASS することを確認する
  - 疑問が生じた場合はユーザーに確認する
