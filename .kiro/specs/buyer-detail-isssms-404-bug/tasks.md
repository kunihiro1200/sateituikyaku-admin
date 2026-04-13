# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - isSms未定義・論理削除済み買主404バグ
  - **CRITICAL**: このテストは修正前のコードで必ずFAILする - FAILすることでバグの存在を確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしている - 修正後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターエグザンプルを発見する
  - **Scoped PBT Approach**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - バグ1テスト: `action === 'call'` または `action === 'phone_call'` のアクティビティを含む買主データで `BuyerDetailPage` をレンダリング → `isSms is not defined` ReferenceErrorが発生することを確認（修正前コードで失敗）
  - バグ2テスト: `deleted_at IS NOT NULL` の買主番号で `GET /buyers/:id/related` を呼び出す → 404が返ることを確認（修正前コードで失敗）
  - 修正前コードでテストを実行する
  - **EXPECTED OUTCOME**: テストがFAILする（これが正しい - バグの存在を証明する）
  - カウンターエグザンプルを記録して根本原因を理解する（例: `isSms is not defined` ReferenceError、`GET /buyers/7359/related` が404を返す）
  - テストを書き、実行し、FAILを記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - メール・SMS履歴セクションとアクティブ買主の動作保持
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - バグ条件が成立しない入力（`isBugCondition` が false を返すケース）で修正前コードの動作を観察する
  - 観察1: `action === 'email'` のアクティビティで `isSms` が `false` に評価されることを確認
  - 観察2: `action === 'sms'` のアクティビティで `isSms` が `true` に評価されることを確認
  - 観察3: `deleted_at IS NULL` のアクティブな買主番号で `/:id/related` が200を返すことを確認
  - 観察4: 通話履歴が存在しない買主の詳細画面が正常にレンダリングされることを確認
  - プロパティベーステスト: ランダムなメール・SMS履歴データを生成し、`isSms` 評価が正しく動作することを検証
  - プロパティベーステスト: ランダムなアクティブ買主番号を生成し、`/:id/related` が200を返すことを検証
  - 修正前コードでテストを実行する
  - **EXPECTED OUTCOME**: テストがPASSする（これがベースライン動作を確認する）
  - テストを書き、実行し、修正前コードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix for isSms未定義・論理削除済み買主404バグ

  - [x] 3.1 Implement the fix
    - **修正1**: `frontend/frontend/src/pages/BuyerDetailPage.tsx` 1550行目
      - `const hasBody = !isSms && !!metadata.body;` → `const hasBody = !!metadata.body;`
      - 通話履歴セクション（`action === 'call'` または `action === 'phone_call'`）では `isSms` は常に `false` のため、`!isSms` は常に `true`。変数参照を削除する
    - **修正2**: `backend/src/routes/buyers.ts` 682行目
      - `const buyer = await buyerService.getByBuyerNumber(id);` → `const buyer = await buyerService.getByBuyerNumber(id, true);`
      - `/:id/related` エンドポイントは論理削除済み買主の詳細画面からも呼び出されるため、`includeDeleted = true` を渡す
    - _Bug_Condition: C1: activity.action === 'call' OR activity.action === 'phone_call' かつ isSms変数がスコープ外; C2: buyer.deleted_at IS NOT NULL かつ getByBuyerNumber(id, false) が null を返す_
    - _Expected_Behavior: 通話履歴セクションが isSms is not defined エラーなく正常にレンダリングされ、hasBody === !!metadata.body; /:id/related が論理削除済み買主番号で200を返す_
    - _Preservation: メール・SMS履歴セクションの isSms 変数は引き続き正しく定義・参照される; アクティブな買主番号での /:id/related は引き続き正常に動作する_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - isSms未定義・論理削除済み買主404バグ修正確認
    - **IMPORTANT**: タスク1と同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすると、期待される動作が満たされたことを確認する
    - タスク1のバグ条件探索テストを実行する
    - **EXPECTED OUTCOME**: テストがPASSする（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - メール・SMS履歴セクションとアクティブ買主の動作保持確認
    - **IMPORTANT**: タスク2と同じテストを再実行する - 新しいテストを書かない
    - タスク2の保持プロパティテストを実行する
    - **EXPECTED OUTCOME**: テストがPASSする（リグレッションがないことを確認）
    - 修正後も全テストがPASSすることを確認する（リグレッションなし）

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストがPASSすることを確認する。疑問が生じた場合はユーザーに確認する。
