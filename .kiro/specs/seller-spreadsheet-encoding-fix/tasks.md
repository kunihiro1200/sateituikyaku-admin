# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - 暗号化フィールドがそのままスプレッドシートに書き込まれる
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: `isBugCondition(seller)` が true（`name`・`phone_number`・`email` のいずれかが AES-256-GCM Base64 暗号文）の売主データを対象にスコープする
  - テストファイル: `backend/src/services/__tests__/SpreadsheetSyncService.bug.test.ts`
  - `encrypt('田中太郎')` で暗号化した `name` を持つモック売主データを用意する
  - `encrypt('09012345678')` で暗号化した `phone_number` を持つモック売主データを用意する
  - `encrypt('test@example.com')` で暗号化した `email` を持つモック売主データを用意する
  - Supabase クライアントと GoogleSheetsClient をモックし、`syncToSpreadsheet()` を呼び出す
  - `ColumnMapper.mapToSheet()` に渡される値（または `updateRowPartial` / `appendRow` に渡される SheetRow）の `名前(漢字のみ）`・`電話番号\nハイフン不要`・`メールアドレス` が暗号文のままであることをアサートする
  - 未修正コードで実行 → **EXPECTED OUTCOME**: Test FAILS（バグの存在を証明）
  - 反例を記録する（例: `名前(漢字のみ）` 列に `acLCZeMGRDaf/DM8rFZBircz+...` が書き込まれる）
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - 非暗号化フィールドの書き込み動作が変わらない
  - **IMPORTANT**: Follow observation-first methodology
  - テストファイル: `backend/src/services/__tests__/SpreadsheetSyncService.preservation.test.ts`
  - `isBugCondition(seller)` が false（`name`・`phone_number`・`email` が平文）の売主データを用意する
  - Observe: 未修正コードで `status`・`next_call_date`・`seller_number` 等の非暗号化フィールドが正しく書き込まれることを確認する
  - Observe: `email = null` の場合にクラッシュせず「メールアドレス」列が空のまま書き込まれることを確認する
  - プロパティベーステスト: ランダムな平文の `status`・`next_call_date`・`seller_number` 値を持つ売主データで、修正前後の `mapToSheet()` 出力が同一であることを検証する
  - `seller_number` による既存行検索（`findRowBySellerId`）が正しく動作することを確認する
  - 既存行がない場合の新規行追加（`appendRow`）ロジックが変更されていないことを確認する
  - 未修正コードで実行 → **EXPECTED OUTCOME**: Tests PASS（ベースライン動作を確認）
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Fix: SpreadsheetSyncService に復号処理を追加

  - [x] 3.1 Implement the fix
    - `backend/src/services/SpreadsheetSyncService.ts` に `import { decrypt } from '../utils/encryption';` を追加する
    - クラス内に `private decryptSellerFields(seller: any): any` ヘルパーメソッドを追加する
      - `name: decrypt(seller.name || '')`
      - `phone_number: decrypt(seller.phone_number || '')`
      - `email: seller.email ? decrypt(seller.email) : seller.email`（null-safe）
    - `syncToSpreadsheet()` 内の `mapToSheet(seller as SellerData)` 呼び出し前に `const decryptedSeller = this.decryptSellerFields(seller);` を追加し、`mapToSheet(decryptedSeller as SellerData)` に変更する
    - `syncBatchToSpreadsheet()` 内の for ループ内でも同様に `decryptSellerFields()` を呼び出してから `mapToSheet()` に渡す
    - `ENCRYPTION_KEY` は変更しない
    - `backend/api/` は触らない
    - _Bug_Condition: isBugCondition(seller) where seller.name / phone_number / email が AES-256-GCM Base64 暗号文_
    - _Expected_Behavior: スプレッドシートの「名前(漢字のみ）」「電話番号\nハイフン不要」「メールアドレス」列に平文が書き込まれる_
    - _Preservation: 非暗号化フィールド（status・next_call_date・seller_number 等）の書き込み動作は変更しない。email = null の場合はクラッシュしない_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - 暗号化フィールドが復号されてスプレッドシートに書き込まれる
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - タスク1で作成した `SpreadsheetSyncService.bug.test.ts` をそのまま再実行する
    - 修正後コードで実行 → **EXPECTED OUTCOME**: Test PASSES（バグが修正されたことを確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - 非暗号化フィールドの書き込み動作が変わらない
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - タスク2で作成した `SpreadsheetSyncService.preservation.test.ts` をそのまま再実行する
    - 修正後コードで実行 → **EXPECTED OUTCOME**: Tests PASS（リグレッションなしを確認）
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - 全テストが通ることを確認する。疑問点があればユーザーに確認する。
  - デプロイ: `git add . && git commit -m "fix: decrypt seller fields before writing to spreadsheet" && git push origin main`
