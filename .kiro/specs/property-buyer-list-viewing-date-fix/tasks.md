# 実装計画

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 内覧日フィールド名不一致バグ
  - **重要**: このテストは修正前のコードで必ず FAIL すること — FAIL がバグの存在を証明する
  - **修正を試みないこと** — テストが失敗しても、コードやテストを修正しない
  - **注意**: このテストは期待される動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ付き PBT アプローチ**: 決定論的なバグのため、具体的な失敗ケースにスコープを絞る
  - バグ条件（design.md の Bug Condition より）: `buyer.latest_viewing_date` が非 null・非 undefined であるにもかかわらず、`buyer.viewing_date` を参照するため `undefined` になる
  - `CompactBuyerListForProperty` に `{ latest_viewing_date: "2025-03-15", name: "テスト太郎", buyer_number: "B001" }` を渡し、内覧日列が `2025/03/15` ではなく `-` と表示されることを確認
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト FAIL（これが正しい — バグの存在を証明する）
  - 見つかった反例を記録する（例: `latest_viewing_date: "2025-03-15"` を持つ買主の内覧日が `-` と表示される）
  - テストを作成し、実行し、FAIL を確認したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - 非バグ入力の動作保持
  - **重要**: 観察優先メソドロジーに従うこと
  - 修正前のコードで非バグ入力（`latest_viewing_date` が null/undefined の場合）の動作を観察する
  - 観察: `latest_viewing_date: null` の買主の内覧日列が `-` と表示されることを確認
  - 観察: 氏名・受付日・時間・最新状況の各列が正しく表示されることを確認
  - プロパティベーステスト: `latest_viewing_date` が null/undefined の全ての買主データに対して、内覧日列が `-` と表示されることを検証（design.md の Preservation Requirements より）
  - プロパティベーステスト: 氏名・受付日・時間・最新状況のフィールドがランダムな値でも正しく表示されることを検証
  - 修正前のコードでテストを実行する
  - **期待される結果**: テスト PASS（これが正しい — 保全すべきベースライン動作を確認する）
  - テストを作成し、実行し、PASS を確認したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 内覧日フィールド名不一致バグの修正

  - [x] 3.1 修正を実装する
    - `frontend/frontend/src/pages/PropertyListingDetailPage.tsx` の `Buyer` インターフェースを変更する
    - `viewing_date?: string;` を `latest_viewing_date?: string;` に変更する
    - `frontend/frontend/src/components/CompactBuyerListForProperty.tsx` の `BuyerWithDetails` インターフェースを変更する
    - `viewing_date?: string;` を `latest_viewing_date?: string;` に変更する
    - `CompactBuyerListForProperty.tsx` のテーブルセルの参照を変更する
    - `formatDate(buyer.viewing_date)` を `formatDate(buyer.latest_viewing_date)` に変更する
    - _Bug_Condition: `buyer.latest_viewing_date` が非 null・非 undefined であるにもかかわらず、`buyer.viewing_date` を参照するため `undefined` になる（isBugCondition: `buyer.latest_viewing_date IS NOT NULL AND buyer.viewing_date IS UNDEFINED`）_
    - _Expected_Behavior: `latest_viewing_date` が正しくマッピングされ、内覧日が `YYYY/MM/DD` 形式で表示される_
    - _Preservation: 内覧日が null の場合は `-` を表示、他の列（氏名・受付日・時間・最新状況）は変更なし、行クリックで買主詳細ページが新しいタブで開く_
    - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 内覧日の正しい表示
    - **重要**: タスク 1 と同じテストを再実行する — 新しいテストを書かない
    - タスク 1 のテストは期待される動作をエンコードしている
    - このテストが PASS すれば、期待される動作が満たされていることを確認できる
    - タスク 1 のバグ条件探索テストを実行する
    - **期待される結果**: テスト PASS（バグが修正されたことを確認する）
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 非バグ入力の動作保持
    - **重要**: タスク 2 と同じテストを再実行する — 新しいテストを書かない
    - タスク 2 の保全プロパティテストを実行する
    - **期待される結果**: テスト PASS（リグレッションがないことを確認する）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. チェックポイント — 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認すること。
