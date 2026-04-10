# 実装計画

- [x] 1. バグ条件探索テストを作成する
  - **Property 1: Bug Condition** - 内覧日・メール返信の変更がDBに反映されない
  - **重要**: このテストは未修正コードで実行し、**FAIL することが正しい**（バグの存在を確認）
  - **修正やコードを変えようとしないこと**（FAILはバグ存在の証明）
  - **目的**: バグが存在することを示す反例を見つける
  - **スコープ限定PBTアプローチ**: 決定論的バグのため、具体的な失敗ケースにスコープを絞る
  - テスト内容（design.mdのBug Conditionより）:
    - 条件A: 買主7243・7246のスプレッドシート内覧日 ≠ DB `viewing_date` の状態でGAS同期を実行し、`viewing_date`が更新されないことを確認
    - 条件B: 買主7312の`'【問合メール】メール返信'` = `"済"` の状態でGAS同期を実行し、`inquiry_email_reply`が更新されないことを確認
    - `BuyerSync.gs`のupsert後、`latest_viewing_date`は更新されるが`viewing_date`は更新されないことを確認
  - 未修正コードで実行する
  - **期待される結果**: テストFAIL（バグが存在することを証明）
  - 反例を記録する（例: 「GAS同期後もDB `viewing_date`がスプレッドシートの内覧日と一致しない」）
  - テスト作成・実行・FAIL記録が完了したらタスク完了とする
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. 保全プロパティテストを作成する（修正前に実施）
  - **Property 2: Preservation** - バグ条件が成立しない入力の動作が変わらない
  - **重要**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ入力（`isBugCondition`がfalseを返すケース）の動作を観察・記録する
  - 観察内容（design.mdのPreservation Requirementsより）:
    - 新規買主のINSERT動作を観察（スプレッドシートに新規追加 → DBにINSERTされる）
    - 変更なしレコードの動作を観察（値が変わっていない既存レコード → DBの値が変わらない）
    - `latest_status`、`next_call_date`等の他カラムの同期動作を観察
    - 売主リスト同期（`gas/seller-sync-clean.gs`）が影響を受けないことを観察
  - 観察した動作パターンをプロパティベーステストとして記述する
  - 未修正コードでテストを実行する
  - **期待される結果**: テストPASS（修正前のベースライン動作を確認）
  - テスト作成・実行・PASS確認が完了したらタスク完了とする
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. 買主リストGAS同期・既存レコード更新不具合の修正

  - [x] 3.1 `gas/buyer-sync/BuyerSync.gs`のカラムマッピングを修正する
    - `BUYER_COLUMN_MAPPING`の`'●内覧日(最新）'`マッピング先を`latest_viewing_date`→`viewing_date`に変更
    - `BUYER_TYPE_CONVERSIONS`の型変換ルールも`latest_viewing_date`→`viewing_date`に変更
    - **注意**: 日本語を含むファイルのため、Pythonスクリプト経由でUTF-8保護ルールに従って編集すること
    - `latest_viewing_date`を参照している他の処理（`EnhancedAutoSyncService.ts`等）への影響を確認する
    - _Bug_Condition: isBugCondition(row) — 既存買主の`'●内覧日(最新）'`がDBの`viewing_date`と異なる（条件A）_
    - _Expected_Behavior: GAS同期後にDB `viewing_date`がスプレッドシートの最新値に更新される_
    - _Preservation: `BUYER_COLUMN_MAPPING`の他カラムの同期動作は変更しない_
    - _Requirements: 2.1, 2.2, 2.4_

  - [x] 3.2 `gas/buyer-sync/BuyerSync.gs`のPreferヘッダーを修正する（推奨）
    - upsertリクエストの`'Prefer'`ヘッダーに`return=minimal`を追加
    - `'resolution=merge-duplicates'` → `'resolution=merge-duplicates,return=minimal'`
    - **注意**: 日本語を含むファイルのため、Pythonスクリプト経由でUTF-8保護ルールに従って編集すること
    - _Requirements: 2.4_

  - [x] 3.3 `gas_buyer_complete_code.js`の`fetchAllBuyersFromSupabase_`関数に`inquiry_email_reply`を追加する
    - `fields`変数の末尾に`inquiry_email_reply`を追加する
    - **注意**: `gas_buyer_complete_code.js`は`.kiroignore`で除外されているため、直接パスで読み込む
    - _Bug_Condition: isBugCondition(row) — 既存買主の`'【問合メール】メール返信'`がDBの`inquiry_email_reply`と異なる（条件B）_
    - _Requirements: 2.3, 2.4_

  - [x] 3.4 `gas_buyer_complete_code.js`の`syncUpdatesToSupabase_`関数に`inquiry_email_reply`の差分チェックを追加する
    - 既存の`inquiry_email_phone`の処理パターンに倣って実装する
    - `normalizeValue`を使用してシート値とDB値を比較する
    - 差分がある場合は`updateData.inquiry_email_reply`に値をセットし`needsUpdate = true`にする
    - 削除ケース（nullへの変更）のログ出力も追加する
    - **注意**: `gas_buyer_complete_code.js`は`.kiroignore`で除外されているため、直接パスで読み込む
    - _Bug_Condition: isBugCondition(row) — 既存買主の`'【問合メール】メール返信'`がDBの`inquiry_email_reply`と異なる（条件B）_
    - _Expected_Behavior: GAS同期後にDB `inquiry_email_reply`がスプレッドシートの最新値に更新される_
    - _Preservation: 他カラムの差分チェック・更新処理は変更しない_
    - _Requirements: 2.3, 2.4, 3.2, 3.3_

  - [x] 3.5 バグ条件探索テストが修正後にPASSすることを確認する
    - **Property 1: Expected Behavior** - 内覧日・メール返信の変更がDBに反映される
    - **重要**: タスク1で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - タスク1のテストは期待される動作をエンコードしており、修正後はPASSするはず
    - 修正後のコードでテストを実行する
    - **期待される結果**: テストPASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.6 保全テストが引き続きPASSすることを確認する
    - **Property 2: Preservation** - バグ条件が成立しない入力の動作が変わらない
    - **重要**: タスク2で作成した**同じテスト**を再実行する（新しいテストを書かない）
    - 修正後のコードでテストを実行する
    - **期待される結果**: テストPASS（リグレッションがないことを確認）
    - 全ての保全テストがPASSすることを確認する

- [x] 4. チェックポイント — 全テストのPASSを確認する
  - タスク1の探索テスト（修正後）がPASSすることを確認する
  - タスク2の保全テストがPASSすることを確認する
  - 買主7243・7246のDB `viewing_date`がスプレッドシートの内覧日と一致することを確認する
  - 買主7312のDB `inquiry_email_reply`が`"済"`に更新されていることを確認する
  - 「問合せメール未対応」サイドバーカウントから買主7312が除外されることを確認する
  - 疑問点があればユーザーに確認する
