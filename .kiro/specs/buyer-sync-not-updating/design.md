# 買主リスト自動同期バグ修正 デザイン

## Overview

買主リスト（`buyers`テーブル）の自動同期において、スプレッドシートに存在する買主番号がデータベースに追加されない問題を修正する。

具体的には、買主番号7137がスプレッドシートに存在するにもかかわらずDBに存在しない。`BuyerSyncService.syncAll()` は全件upsert方式を採用しており、新規レコードも追加されるべきだが、何らかの理由でinsertが機能していない。

修正方針は、upsertのinsert部分が失敗する根本原因を特定し、最小限の変更で修正する。

## Glossary

- **Bug_Condition (C)**: スプレッドシートに買主番号が存在するが、DBに対応するレコードが存在しない状態
- **Property (P)**: `syncAll()` 実行後、スプレッドシートの全買主番号がDBに存在すること
- **Preservation**: 既存の重複防止・スキップ・エラーハンドリング・ログ記録の動作が変わらないこと
- **BuyerSyncService**: `backend/src/services/BuyerSyncService.ts` の同期サービス。`syncAll()` → `processBatch()` の流れでスプレッドシートの全行をupsertする
- **buyer_number**: `buyers`テーブルの一意識別子（UNIQUE制約あり）。upsertの競合解決キーとして使用される
- **isSyncing**: 重複実行防止フラグ。`isSyncInProgress()` で参照される

## Bug Details

### Bug Condition

スプレッドシートに買主番号が存在するにもかかわらず、`syncAll()` 実行後もDBにレコードが追加されない。`processBatch()` 内のupsertが新規レコードに対してinsertを実行していないか、upsert自体がエラーで失敗している可能性がある。

**Formal Specification:**
```
FUNCTION isBugCondition(buyerNumber)
  INPUT: buyerNumber of type string
  OUTPUT: boolean

  spreadsheetHasBuyer := buyerNumber EXISTS IN spreadsheet['買主リスト']
  dbHasBuyer          := buyerNumber EXISTS IN buyers table

  RETURN spreadsheetHasBuyer = true
         AND dbHasBuyer = false
         AND buyerNumber IS NOT NULL
         AND buyerNumber.trim() != ''
END FUNCTION
```

### Examples

- 買主番号7137: スプレッドシートに存在 → DBに存在しない（バグ発現）
- 買主番号7137: `syncAll()` 実行後 → DBに存在する（期待される動作）
- 買主番号が空の行: スキップされる（正常動作・変更なし）
- 既存の買主番号: upsertでupdateされる（正常動作・変更なし）

## Expected Behavior

### Preservation Requirements

**変わらない動作:**
- `buyer_number` が空またはnullの行はスキップされ続ける
- 同期中（`isSyncInProgress() === true`）の場合、重複実行が防止され続ける
- 個別行のエラーはログに記録され、残りの行の処理が継続され続ける
- 同期完了後、`buyer_sync_logs` テーブルに結果（created/updated/failed数）が記録され続ける
- DBに既存の買主番号はupsertでupdateされ続ける

**スコープ:**
バグ条件（スプレッドシートに存在するがDBに存在しない買主番号）に該当しない全ての入力は、この修正によって影響を受けない。具体的には:
- 既存レコードの更新処理
- 空行のスキップ処理
- 重複実行防止ロジック
- エラーハンドリング

## Hypothesized Root Cause

コードを分析した結果、最も可能性の高い原因は以下の通り:

1. **`buyer_number` UNIQUE制約の未適用**: `onConflict: 'buyer_number'` を指定したupsertは、`buyer_number` カラムにUNIQUE制約またはUNIQUEインデックスが存在しないと機能しない。マイグレーション `094_add_buyer_number_unique_constraint.sql` が実行されていない場合、upsertがinsertではなくエラーになる可能性がある。

2. **スプレッドシートの取得範囲の問題**: `range: '${SHEET_NAME}'!A2:GZ` で取得しているが、買主番号7137の行がこの範囲外にある可能性がある（行数が多い場合）。

3. **`buyer_number` カラムのマッピング問題**: `BuyerColumnMapper.mapSpreadsheetToDatabase()` が `buyer_number` を正しくマッピングできていない場合、`data.buyer_number` がnullになりスキップされる。

4. **upsertのエラーがサイレントに処理されている**: `processBatch()` 内でupsertエラーが `result.failed` にカウントされるが、ログが不十分で根本原因が特定できていない可能性がある。

## Correctness Properties

Property 1: Bug Condition - スプレッドシートの買主番号がDBに追加される

_For any_ 買主番号において、スプレッドシートに存在しDBに存在しない（isBugCondition が true を返す）場合、修正後の `syncAll()` は当該買主番号のレコードをDBに新規挿入し、`result.created` をインクリメントする。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存の同期動作が変わらない

_For any_ 入力において、バグ条件に該当しない（isBugCondition が false を返す）場合、修正後の `syncAll()` は修正前と同じ動作を保持する。具体的には、空行のスキップ・重複防止・エラーハンドリング・ログ記録・既存レコードの更新が変わらない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合:

**File**: `backend/migrations/094_add_buyer_number_unique_constraint.sql`（既存）

**確認事項**: このマイグレーションが実際にSupabaseに適用されているか確認する。未適用の場合は適用する。

---

**File**: `backend/src/services/BuyerSyncService.ts`

**Function**: `processBatch()`

**Specific Changes**:

1. **エラーログの強化**: upsertエラー時に `error.code` と `error.details` を含む詳細ログを出力し、根本原因を特定しやすくする
   ```typescript
   console.error(`Error syncing row ${rowNumber} (${data.buyer_number}):`, 
     error.message, error.code, error.details);
   ```

2. **upsertの `ignoreDuplicates` オプション確認**: Supabase の upsert は `onConflict` が正しく機能するためにUNIQUE制約が必要。制約が存在しない場合は `insert` + `update` の2段階処理に変更する

3. **スプレッドシート取得範囲の確認**: `A2:GZ` の範囲が全行をカバーしているか確認。必要に応じて `A2:GZ10000` のように明示的な行数上限を設定する

4. **`buyer_number` マッピングの確認**: `BuyerColumnMapper` が `買主番号` → `buyer_number` を正しくマッピングしているか確認（`buyer-column-mapping.json` では正しく定義されている）

5. **新規/更新の判定ロジック**: 現在は `existing` チェックでcreated/updatedを判定しているが、upsert後の実際の結果（`data` の有無）で判定するよう改善する

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを再現するカウンターサンプルを確認し、次に修正後の動作とPreservationを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因を確認する。

**Test Plan**: スプレッドシートに存在するがDBに存在しない買主番号に対して `syncAll()` を実行し、DBへの追加が行われないことを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **新規買主番号のupsert**: `buyer_number` が存在しない状態でupsertを実行 → DBに追加されない（未修正コードで失敗）
2. **UNIQUE制約なしのupsert**: `onConflict: 'buyer_number'` がUNIQUE制約なしで動作するか → エラーまたはinsertされない
3. **スプレッドシート全行取得**: `A2:GZ` の範囲で全行が取得できるか → 特定行が欠落する可能性
4. **buyer_numberマッピング**: `買主番号` カラムが正しく `buyer_number` にマッピングされるか

**Expected Counterexamples**:
- upsertがエラーを返す（UNIQUE制約なし）
- upsertが成功するが `result.created` が0のまま（insertではなくupdateとして処理）
- 可能な原因: UNIQUE制約未適用、スプレッドシート範囲外、マッピングエラー

### Fix Checking

**Goal**: バグ条件に該当する全入力に対して、修正後の関数が期待される動作を示すことを確認する。

**Pseudocode:**
```
FOR ALL buyerNumber WHERE isBugCondition(buyerNumber) DO
  result := syncAll_fixed()
  ASSERT buyerNumber EXISTS IN buyers table
  ASSERT result.created > 0
END FOR
```

### Preservation Checking

**Goal**: バグ条件に該当しない全入力に対して、修正後の関数が修正前と同じ動作を示すことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncAll_original(input) = syncAll_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由:
- 多様な入力（空行、既存レコード、エラーケース）を自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 修正前後の動作が一致することを強力に保証できる

**Test Cases**:
1. **空行スキップの保存**: `buyer_number` が空の行がスキップされ続けることを確認
2. **重複防止の保存**: `isSyncInProgress()` が true の場合に同期がスキップされることを確認
3. **既存レコード更新の保存**: 既存の買主番号がupdateされ続けることを確認
4. **ログ記録の保存**: `buyer_sync_logs` への記録が継続されることを確認

### Unit Tests

- `processBatch()` が新規買主番号に対してinsertを実行することをテスト
- `processBatch()` が空の `buyer_number` をスキップすることをテスト
- upsertエラー時に `result.failed` がインクリメントされることをテスト

### Property-Based Tests

- ランダムな買主番号セットに対して、syncAll後に全番号がDBに存在することを検証
- 既存レコードを含む入力に対して、updated/created の合計が入力行数と一致することを検証
- 空行を含む入力に対して、スキップ数が空行数と一致することを検証

### Integration Tests

- 実際のスプレッドシートデータを使用して `syncAll()` を実行し、全買主番号がDBに存在することを確認
- Cron Jobエンドポイント `/api/cron/buyer-sync` が正しく `syncAll()` を呼び出すことを確認
- 同期完了後に `buyer_sync_logs` に正しい結果が記録されることを確認
