# Implementation Plan

- [x] 1. バグ条件の探索テストを作成する
  - **Property 1: Bug Condition** - 内覧形態マッピング不一致バグ
  - **重要**: このテストは未修正コードで必ず FAIL すること（バグの存在を確認するため）
  - **修正を試みないこと**: テストが失敗しても、コードやテストを修正しない
  - **注意**: このテストは期待動作をエンコードしており、修正後に PASS することで修正を検証する
  - **目的**: バグの存在を示すカウンターサンプルを発見する
  - **スコープ付きPBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - `gas/buyer-sync/BuyerSync.gs` の `BUYER_COLUMN_MAPPING['内覧形態']` が `'viewing_type'` であることを確認（Bug Conditionより）
  - `buyer-column-mapping.json` の `'内覧形態'` が `'viewing_mobile'` であることを確認し、不一致を検証
  - DBの `buyers` テーブルに `viewing_mobile` カラムが存在しないことを確認
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが FAIL する（バグの存在を証明）
  - 発見されたカウンターサンプルを記録して根本原因を理解する（例: `BUYER_COLUMN_MAPPING['内覧形態']` が `'viewing_mobile'` ではなく `'viewing_type'` を返す）
  - テストを作成・実行し、失敗を記録したらタスク完了とする
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを作成する（修正実装前に）
  - **Property 2: Preservation** - 内覧形態以外のフィールドの同期動作保全
  - **重要**: 観察優先メソドロジーに従うこと
  - 未修正コードで非バグ条件の入力（`'内覧形態'` 以外の全フィールド）の動作を観察する
  - 観察: `BUYER_COLUMN_MAPPING['viewing_type_general']` が `'viewing_type_general'` を返すことを確認
  - 観察: `BUYER_COLUMN_MAPPING['viewing_date']` が `'viewing_date'` を返すことを確認
  - 観察: `BUYER_COLUMN_MAPPING['viewing_time']` が `'viewing_time'` を返すことを確認
  - 観察された動作パターンを捉えるプロパティベーステストを作成する（Preservation Requirementsより）
  - プロパティベーステストは多くのテストケースを自動生成し、より強い保証を提供する
  - 未修正コードでテストを実行する
  - **期待される結果**: テストが PASS する（保全すべきベースライン動作を確認）
  - テストを作成・実行し、未修正コードでPASSしたらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3_

- [x] 3. viewing-type-sync バグの修正

  - [x] 3.1 GASのBUYER_COLUMN_MAPPINGを修正する
    - `gas/buyer-sync/BuyerSync.gs` の `BUYER_COLUMN_MAPPING` を編集する
    - `'内覧形態': 'viewing_type'` を `'内覧形態': 'viewing_mobile'` に変更する
    - `buyer-column-mapping.json` の `"内覧形態": "viewing_mobile"` との整合性を確保する
    - _Bug_Condition: isBugCondition(mapping) where mapping.key === '内覧形態' AND mapping.value === 'viewing_type'_
    - _Expected_Behavior: BUYER_COLUMN_MAPPING['内覧形態'] === 'viewing_mobile' となり、スプレッドシートの値がbuyers.viewing_mobileに書き込まれる_
    - _Preservation: '内覧形態'以外の全フィールドのマッピングは変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 DBマイグレーションSQLを作成・適用する
    - `backend/migrations/114_add_viewing_mobile_to_buyers.sql` を新規作成する
    - `ALTER TABLE buyers ADD COLUMN IF NOT EXISTS viewing_mobile TEXT;` を追加する
    - 必要に応じて `viewing_type` カラムのデータを `viewing_mobile` にコピーする
    - マイグレーションをDBに適用する
    - _Bug_Condition: columnExistsInDB('viewing_mobile') === false_
    - _Expected_Behavior: buyers テーブルに viewing_mobile カラムが存在する_
    - _Requirements: 2.1, 2.2_

  - [x] 3.3 バグ条件の探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - 内覧形態マッピング不一致バグ
    - **重要**: タスク1と同じテストを再実行すること（新しいテストを書かない）
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS することで、期待動作が満たされていることを確認する
    - タスク1のバグ条件探索テストを実行する
    - **期待される結果**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - 内覧形態以外のフィールドの同期動作保全
    - **重要**: タスク2と同じテストを再実行すること（新しいテストを書かない）
    - タスク2の保全プロパティテストを実行する
    - **期待される結果**: テストが PASS する（リグレッションがないことを確認）
    - 修正後も全テストが PASS することを確認する（リグレッションなし）

- [x] 4. デプロイ（git commit & push）
  - 変更ファイルをステージングする（`gas/buyer-sync/BuyerSync.gs`、`backend/migrations/114_add_viewing_mobile_to_buyers.sql`）
  - git commit を実行する
  - git push を実行する
  - デプロイ後、物件番号7344の買主レコードで `viewing_mobile` がDBに反映されることを確認する

- [x] 5. チェックポイント - 全テストが PASS することを確認する
  - 全テストが PASS していることを確認する。疑問点があればユーザーに確認する。
