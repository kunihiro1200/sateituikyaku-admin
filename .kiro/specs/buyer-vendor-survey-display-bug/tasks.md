# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - スプシ空欄時に「未」が保存されるバグ
  - **重要**: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
  - **修正を試みないこと**: テストが失敗しても、コードやテストを修正しない
  - **注意**: このテストは期待動作をエンコードしており、修正後に PASS することで修正を検証する
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ限定PBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.mdのBug Conditionより）:
    - `isBugCondition(buyer)`: `buyer.vendor_survey = '未'` かつスプシのFZ列が空欄
    - GASの `buyerMapRowToRecord` にスプシ空欄行を渡し、`vendor_survey` が「未」になることを確認
    - DBの `vendor_survey = '未'` のとき、フロントエンドが「業者向けアンケート」フィールドを表示することを確認（バグ）
    - 買主ID 7319 の実データで `vendor_survey` の値を確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト FAIL（バグの存在を証明）
  - 見つかった反例を記録する（例: 「スプシ空欄 → vendor_survey = '未' が保存される」）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 有効な値の表示動作の保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`vendor_survey` が null/空文字でも「未」でもない有効な値）の動作を観察する
  - 観察: `vendor_survey = '確認済み'` のとき、フロントエンドが「業者向けアンケート: 確認済み」を表示する
  - 観察: `vendor_survey = '済'` のとき、フロントエンドが「業者向けアンケート: 済」を表示する
  - 観察: スプシに「未」が明示的に入力されている場合、DBに「未」が保存され画面に表示される
  - プロパティベーステスト: 有効な値（非null・非空文字）を持つ買主データに対して、フィールドが表示されることを確認（design.mdのPreservation Requirementsより）
  - 未修正コードでテストを実行する
  - **期待される結果**: テスト PASS（保全すべきベースライン動作を確認）
  - テストを作成・実行し、未修正コードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. 「スプシ空欄時にvendor_surveyが「未」として保存される」バグの修正

  - [x] 3.1 GASの buyerMapRowToRecord 関数を修正する
    - `gas/buyer-sync/BuyerSync.gs` の `buyerMapRowToRecord` 関数を確認する
    - スプシのFZ列（業者向けアンケート）が空欄のとき「未」ではなく null を保存するよう修正する
    - 現在の推定コード: `vendor_survey: cellValue || '未'`
    - 修正後のコード: `vendor_survey: cellValue || null`
    - _Bug_Condition: isBugCondition(buyer) where buyer.vendor_survey = '未' かつスプシFZ列が空欄_
    - _Expected_Behavior: スプシ空欄時は vendor_survey = null が保存され、フロントエンドで非表示になる_
    - _Preservation: 有効な値（「済」「未」など）が入力されている場合は従来通り保存・表示される_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 バックエンドの BuyerService.ts でデフォルト値を確認・修正する（必要な場合）
    - `backend/src/services/BuyerService.ts` で `vendor_survey` のデフォルト値を確認する
    - デフォルト値が「未」に設定されている場合は null に変更する
    - _Requirements: 1.2, 2.2_

  - [x] 3.3 GASをデプロイする
    - 修正したGASスクリプトをGoogle Apps Scriptにデプロイする
    - デプロイ後、スプシ空欄行の同期をテストして `vendor_survey = null` が保存されることを確認する
    - _Requirements: 2.1_

  - [x] 3.4 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - スプシ空欄時の非表示
    - **重要**: タスク1で作成した同じテストを再実行すること（新しいテストを書かない）
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされていることを確認できる
    - バグ条件の探索テスト（タスク1）を実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.5 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 有効な値の表示動作の保全
    - **重要**: タスク2で作成した同じテストを再実行すること（新しいテストを書かない）
    - 保全プロパティテスト（タスク2）を実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する

- [x] 4. チェックポイント - 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する
  - 疑問点があればユーザーに確認する
