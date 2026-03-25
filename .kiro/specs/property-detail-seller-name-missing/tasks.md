# 物件詳細画面 売主氏名未表示バグ タスクリスト

## Tasks

- [ ] 1. 暗号化文字列検出ロジックのプロパティベーステストを作成する
  - [ ] 1.1 テストファイル `backend/src/__tests__/isEncryptedValue.pbt.test.ts` を作成する
  - [ ] 1.2 Property 2（Preservation）: 任意の平文を渡すと `isEncryptedValue` が false を返すことを検証するプロパティテストを書く
  - [ ] 1.3 Property 1（Bug Condition）: `encrypt()` で生成した暗号化文字列を渡すと `isEncryptedValue` が true を返すことを検証するプロパティテストを書く
  - [ ] 1.4 `decrypt(encrypt(text)) === text` の恒等性プロパティテストを書く
  - [ ] 1.5 未修正コードでテストを実行し、`isEncryptedValue` 関数が存在しないためテストが失敗することを確認する（Exploratory）

- [ ] 2. 一括修正スクリプトを作成する
  - [ ] 2.1 `backend/fix-seller-name-in-property-listings.ts` を新規作成する
  - [ ] 2.2 `isEncryptedValue(value: string): boolean` 関数を実装する（Base64デコード後96バイト以上で true）
  - [ ] 2.3 `property_listings` から `seller_name` が NULL でない全レコードを取得する処理を実装する
  - [ ] 2.4 各レコードに対して `isBugCondition` を評価し、暗号化文字列のみを対象とするフィルタリングを実装する
  - [ ] 2.5 `property_number` で `sellers` テーブルを検索し、`decrypt(sellers.name)` で復号した値を `property_listings.seller_name` に更新する処理を実装する
  - [ ] 2.6 `sellers` が見つからない場合のスキップ処理とログ出力を実装する
  - [ ] 2.7 実行結果サマリー（更新件数・スキップ件数・エラー件数）をコンソールに出力する処理を実装する
  - [ ] 2.8 ドライランモード（`--dry-run` フラグ）を実装する（実際には更新しない）

- [ ] 3. プロパティベーステストを通過させる
  - [ ] 3.1 スクリプト内の `isEncryptedValue` 関数をテストファイルからインポートできるようにエクスポートする
  - [ ] 3.2 プロパティベーステストを実行し、全テストが通過することを確認する

- [ ] 4. 修正スクリプトを実行して既存レコードを修正する
  - [ ] 4.1 ドライランモードで実行し、対象レコード数を確認する（`npx ts-node backend/fix-seller-name-in-property-listings.ts --dry-run`）
  - [ ] 4.2 本番実行する（`npx ts-node backend/fix-seller-name-in-property-listings.ts`）
  - [ ] 4.3 実行後、`property_listings` テーブルに暗号化文字列が残っていないことをクエリで確認する（Fix Checking）
  - [ ] 4.4 平文が入っていたレコードが変更されていないことを確認する（Preservation Checking）
  - [ ] 4.5 物件詳細画面で売主氏名が正しく表示されることをブラウザで確認する
