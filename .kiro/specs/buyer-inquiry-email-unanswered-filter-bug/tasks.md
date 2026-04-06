# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - サイドバーカウントとフィルタリング結果の不一致
  - **CRITICAL**: このテストは修正前のコードで実行し、FAIL（失敗）することを確認する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作をエンコードしており、実装後にPASSすることで修正を検証する
  - **GOAL**: バグが存在することを示す具体例（counterexample）を発見する
  - **Scoped PBT Approach**: 決定的なバグのため、具体的な失敗ケースにスコープを絞って再現性を確保する
  - テスト実装の詳細（Bug Condition仕様より）:
    - サイドバーカウント計算で `viewing_date` を参照している買主データを生成
    - ステータス計算で `latest_viewing_date` を参照している買主データを生成
    - `viewing_date` と `latest_viewing_date` の値が異なる買主データでテスト
    - サイドバーカウント結果とフィルタリング結果が不一致であることを確認
  - テストアサーションは設計書のExpected Behavior Propertiesに一致させる:
    - サイドバーカウントとステータス計算の両方で同じフィールド（`latest_viewing_date`）を使用
    - 同じ判定結果が得られる
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストがFAIL（これは正しい - バグが存在することを証明）
  - counterexampleを記録してroot causeを理解する
  - テストが書かれ、実行され、失敗が記録されたらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 他のサイドバーカテゴリのカウント計算
  - **IMPORTANT**: observation-first methodologyに従う
  - 修正前のコードで非バグ条件の入力（「問合メール未対応」以外のカテゴリ）の動作を観察
  - Preservation Requirements仕様から観察された動作パターンをキャプチャするproperty-based testを記述:
    - 「内覧日前日」カテゴリのカウント計算が正常に動作
    - 「当日TEL」カテゴリのカウント計算が正常に動作
    - 「担当(Y)」カテゴリのカウント計算が正常に動作
    - ステータス計算ロジックの他の優先順位（Priority 1-4, 6-38）の判定が変更されない
  - Property-based testingで多数のテストケースを生成し、より強力な保証を提供
  - 修正前のコードでテストを実行
  - **EXPECTED OUTCOME**: テストがPASS（ベースライン動作を確認）
  - テストが書かれ、実行され、修正前のコードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [ ] 3. Fix for 「問合メール未対応」フィルタバグ

  - [x] 3.1 Implement the fix
    - `backend/src/services/BuyerService.ts` の1813行目を修正
    - `const viewingDate = buyer.viewing_date || '';` を `const latestViewingDate = buyer.latest_viewing_date || '';` に変更
    - 1818行目の条件式も `!viewingDate` から `!latestViewingDate` に変更
    - _Bug_Condition: isBugCondition(buyer) where サイドバーカウント計算で viewing_date を参照 AND ステータス計算で latest_viewing_date を参照 AND viewing_date != latest_viewing_date_
    - _Expected_Behavior: サイドバーカウント計算とステータス計算の両方で同じフィールド（latest_viewing_date）を使用し、同じ判定結果が得られる（設計書より）_
    - _Preservation: 他のサイドバーカテゴリ（「内覧日前日」「当日TEL」など）のカウント計算は引き続き正常に動作する。ステータス計算ロジックの他の優先順位（Priority 1-4, 6-38）の判定は変更されない。「問合メール未対応」以外のフィルタリングは影響を受けない（設計書Preservation Requirementsより）_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - サイドバーカウントとフィルタリング結果の一致
    - **IMPORTANT**: タスク1で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク1のテストは期待される動作をエンコードしている
    - このテストがPASSすることで、期待される動作が満たされていることを確認
    - タスク1のbug condition exploration testを実行
    - **EXPECTED OUTCOME**: テストがPASS（バグが修正されたことを確認）
    - _Requirements: 設計書のExpected Behavior Propertiesより_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 他のサイドバーカテゴリのカウント計算
    - **IMPORTANT**: タスク2で作成した同じテストを再実行する - 新しいテストを書かない
    - タスク2のpreservation property testsを実行
    - **EXPECTED OUTCOME**: テストがPASS（リグレッションがないことを確認）
    - 修正後も全てのテストがPASSすることを確認（リグレッションなし）

- [ ] 4. Checkpoint - Ensure all tests pass
  - 全てのテストがPASSすることを確認
  - 問題が発生した場合はユーザーに質問する
