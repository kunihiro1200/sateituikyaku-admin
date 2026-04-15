# Implementation Plan

- [x] 1. バグ条件の探索テストを書く
  - **Property 1: Bug Condition** - 買付フィールド不在時に通知が送信されるバグ
  - **重要**: このテストは未修正コードで必ず FAIL する（バグの存在を確認するため）
  - **目的**: バグが存在することを示すカウンターエグザンプルを記録する
  - `notifyGoogleChatOfferSaved` をモックし、買付フィールドを含まないリクエストを送信
  - テストケース: `{ special_notes: "テスト" }` のみ → 通知が呼ばれないことをアサート
  - 未修正コードで実行 → **FAIL が期待される結果**（バグ確認）
  - カウンターエグザンプルを記録: 「`special_notes` のみのリクエストで `notifyGoogleChatOfferSaved` が呼ばれた」
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを書く（修正前に実施）
  - **Property 2: Preservation** - 買付フィールド存在時は通知が送信される
  - **重要**: 観察ファーストで実施（未修正コードで動作を確認してからテストを書く）
  - 観察: `{ offer_date: "2026-01-01" }` を送信 → 未修正コードでは通知が呼ばれる
  - 観察: `{ offer_status: "交渉中" }` を送信 → 未修正コードでは通知が呼ばれる
  - プロパティテスト: 買付フィールド（`offer_date`, `offer_status`, `offer_amount`, `offer_comment`）のいずれかを含む全リクエストで通知が送信されること
  - 未修正コードで実行 → **PASS が期待される結果**（ベースライン確認）
  - _Requirements: 3.1, 3.2, 3.3_

- [-] 3. 買付チャット誤送信バグの修正

  - [x] 3.1 `notifyGoogleChatOfferSaved` の呼び出しを `if (hasOfferUpdate)` で囲む
    - `backend/src/routes/propertyListings.ts` の `router.put('/:propertyNumber', ...)` を修正
    - `notifyGoogleChatOfferSaved(...)` の呼び出し全体を `if (hasOfferUpdate) { ... }` ブロックで囲む
    - _Bug_Condition: isBugCondition(X) = NOT (X.updates contains any of OFFER_FIELDS)_
    - _Expected_Behavior: hasOfferUpdate が false の場合、notifyGoogleChatOfferSaved を呼び出さない_
    - _Preservation: hasOfferUpdate が true の場合、引き続き通知を送信する_
    - _Requirements: 2.1, 2.2, 3.1_

  - [ ] 3.2 バグ条件探索テストが PASS することを確認
    - **Property 1: Expected Behavior** - 買付フィールド不在時は通知を送信しない
    - タスク1で書いたテストをそのまま再実行する（新しいテストは書かない）
    - **期待される結果**: PASS（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 保全テストが引き続き PASS することを確認
    - **Property 2: Preservation** - 買付フィールド存在時は通知が送信される
    - タスク2で書いたテストをそのまま再実行する（新しいテストは書かない）
    - **期待される結果**: PASS（リグレッションなし）

- [ ] 4. チェックポイント - 全テストが PASS することを確認
  - 全テストが通ることを確認する。不明点があればユーザーに確認する。
