# 実装計画

- [x] 1. バグ条件探索テストを実行する（修正前）
  - **Property 1: Bug Condition** - address が暗号化されたままスプレッドシートに書き込まれる
  - **CRITICAL**: このテストは未修正コードで FAIL することが期待される — FAIL がバグの存在を証明する
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待動作をエンコードしている — 修正後に PASS することで修正を検証する
  - **GOAL**: バグが存在することを示すカウンターサンプルを表面化する
  - **Scoped PBT Approach**: バグ条件を具体的なケースに絞る
    - `SellerService.createSeller()` で `address` が `encrypt(data.address)` で暗号化されてDBに保存される
    - `SellerService.updateSeller()` で `address` が `encrypt(data.address)` で暗号化されてDBに保存される
    - `SpreadsheetSyncService.decryptSellerFields()` が `address` を復号しないため、暗号文がスプレッドシートに書き込まれる
  - テストファイル: `backend/src/services/__tests__/SpreadsheetSyncService.bug.test.ts`（既存）
  - 未修正コードでテストを実行: `npx jest SpreadsheetSyncService.bug.test.ts --no-coverage`
  - **EXPECTED OUTCOME**: テストが FAIL する（バグの存在を証明）
  - カウンターサンプルを記録して根本原因を理解する（例: 「name・phone_number・email は復号されるが address は暗号文のまま書き込まれる」）
  - タスク完了条件: テストを実行し、FAIL を確認・記録したとき
  - _Requirements: 1.1, 1.2_

- [x] 2. 保全プロパティテストを実行する（修正前）
  - **Property 2: Preservation** - name・phone_number・email の復号動作が変わらない
  - **IMPORTANT**: 観察優先メソドロジーに従う
  - 未修正コードで非バグ条件の入力（平文の name・phone_number・email を持つ売主）の動作を観察する
  - テストファイル: `backend/src/services/__tests__/SpreadsheetSyncService.preservation.test.ts`（既存）
  - 未修正コードでテストを実行: `npx jest SpreadsheetSyncService.preservation.test.ts --no-coverage`
  - **EXPECTED OUTCOME**: テストが PASS する（ベースライン動作を確認）
  - タスク完了条件: テストを実行し、PASS を確認したとき
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. address 暗号化バグの修正

  - [x] 3.1 SellerService から address の encrypt を除去する
    - `backend/src/services/SellerService.supabase.ts` の `createSeller()` を修正
      - `address: encrypt(data.address)` → `address: data.address`（平文のまま保存）
    - `backend/src/services/SellerService.supabase.ts` の `updateSeller()` を修正
      - `updates.address = encrypt(data.address)` → `updates.address = data.address`（平文のまま保存）
    - _Bug_Condition: isBugCondition(seller) where seller.address が encrypt() で暗号化されてDBに保存される_
    - _Expected_Behavior: address は平文のままDBに保存され、スプレッドシートにも平文で書き込まれる_
    - _Preservation: name・phone_number・email の encrypt() 呼び出しは変更しない_
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 SpreadsheetSyncService の decryptSellerFields に address の復号を追加する（既存暗号化データ対応）
    - `backend/src/services/SpreadsheetSyncService.ts` の `decryptSellerFields()` を修正
    - 既存の暗号化済み address データを安全に復号するため、try-catch で復号を試みる
    - 復号に失敗した場合（平文データの場合）はそのまま返す
    - 実装例:
      ```typescript
      address: (() => {
        if (!seller.address) return seller.address;
        try {
          return decrypt(seller.address);
        } catch {
          return seller.address; // 平文の場合はそのまま返す
        }
      })(),
      ```
    - _Bug_Condition: decryptSellerFields が address を復号しないため暗号文がスプレッドシートに書き込まれる_
    - _Expected_Behavior: address が平文でスプレッドシートのD列に書き込まれる_
    - _Preservation: name・phone_number・email の復号ロジックは変更しない_
    - _Requirements: 2.2, 3.4_

  - [x] 3.3 バグ条件探索テストが PASS することを確認する
    - **Property 1: Expected Behavior** - address が平文でスプレッドシートに書き込まれる
    - **IMPORTANT**: タスク1と同じテストを再実行する — 新しいテストを書かない
    - タスク1のテストは期待動作をエンコードしている
    - このテストが PASS すれば、期待動作が満たされたことを確認できる
    - `npx jest SpreadsheetSyncService.bug.test.ts --no-coverage`
    - **EXPECTED OUTCOME**: テストが PASS する（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 保全テストが引き続き PASS することを確認する
    - **Property 2: Preservation** - name・phone_number・email の復号動作が変わらない
    - **IMPORTANT**: タスク2と同じテストを再実行する — 新しいテストを書かない
    - `npx jest SpreadsheetSyncService.preservation.test.ts --no-coverage`
    - **EXPECTED OUTCOME**: テストが PASS する（リグレッションなし）
    - 修正後も全テストが PASS することで、既存動作が壊れていないことを確認する

- [x] 4. 既存の暗号化済み address データのバックフィル修正スクリプトを作成・実行する
  - `backend/backfill-decrypt-seller-address.ts` を作成する
  - Supabase から全売主の address を取得し、暗号文かどうかを判定する
  - 暗号文の場合は decrypt() で復号して平文に更新する
  - 実行前に対象件数を確認し、ユーザーに報告する
  - 実行: `npx ts-node backend/backfill-decrypt-seller-address.ts`
  - 実行後、スプレッドシートへの再同期が必要な場合はユーザーに確認する
  - _Requirements: 2.1_

- [ ] 5. チェックポイント — 全テストが PASS することを確認する
  - `npx jest SpreadsheetSyncService.bug.test.ts SpreadsheetSyncService.preservation.test.ts --no-coverage` を実行する
  - 全テストが PASS することを確認する
  - 疑問点があればユーザーに確認する
