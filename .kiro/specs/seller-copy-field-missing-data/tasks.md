# Implementation Tasks

## Phase 1: Exploratory Bug Condition Checking（バグ再現）

- [x] 1.1 バグ再現テストを作成する（未修正コードで実行）
  - `backend/src/routes/sellers.ts` の `/by-number/:sellerNumber` エンドポイントを呼び出し、レスポンスに `address`・`phoneNumber`・`email` が含まれないことを確認するテストを書く
  - 未修正コードで実行してバグを観察し、根本原因分析を裏付ける

## Phase 2: Fix Implementation（修正実装）

- [x] 2.1 バックエンドのレスポンスに欠落フィールドを追加する
  - `backend/src/routes/sellers.ts` の `GET /by-number/:sellerNumber` ルートハンドラの `res.json()` に `address`・`phoneNumber`・`email` を追加する

## Phase 3: Fix Checking（修正確認）

- [x] 3.1 修正後のエンドポイントが全フィールドを返すことを確認するユニットテストを書く
  - レスポンスに `address`・`phoneNumber`・`email` が含まれることをアサートする
  - `address`・`phone_number`・`email` が null/空の売主に対するエッジケースもテストする

- [x] 3.2 `handleSellerCopySelect` が全フィールドを state にセットすることを確認するユニットテストを書く
  - `requestorAddress`・`phoneNumber`・`email` の state が正しく更新されることをアサートする

## Phase 4: Preservation Checking（保持確認）

- [x] 4.1 `name` のコピー動作が保持されることを確認するテストを書く（Property 2）
  - 修正後も `name` が正しくコピーされることをアサートする

- [x] 4.2 `propertyAddress` がフォームにセットされないことを確認するテストを書く（Property 2）
  - `propertyAddress` は依頼者住所フィールドにセットされないことをアサートする

- [x] 4.3 買主コピー動作が保持されることを確認するテストを書く（Property 2）
  - 買主コピー選択時の `name`・`phone_number`・`email` のコピー動作が変わらないことをアサートする

- [x] 4.4 検索最小文字数の動作が保持されることを確認するテストを書く（Property 2）
  - 2文字未満の入力で検索が実行されないことをアサートする
