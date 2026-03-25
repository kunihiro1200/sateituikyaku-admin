# buyer-spreadsheet-deletion-sync Bugfix Design

## Overview

GASによるスプレッドシート→DB同期において、スプレッドシートに存在しない買主データがソフトデリート（`deleted_at`設定）されているバグを修正する。

`EnhancedAutoSyncService.ts`の`executeBuyerSoftDelete()`メソッドをハードデリート（`DELETE FROM buyers WHERE buyer_number = ?`）に変更する。既存の安全ガード（3つ）はそのまま維持する。

## Glossary

- **Bug_Condition (C)**: スプレッドシートに存在しない買主番号がDBに存在する状態
- **Property (P)**: バグ条件が成立する場合、DBからレコードが物理削除されること
- **Preservation**: 既存の安全ガード・データ更新処理・スプレッドシートに存在する買主の保護が変更後も維持されること
- **executeBuyerSoftDelete**: `backend/src/services/EnhancedAutoSyncService.ts`内のメソッド。現在はソフトデリートを実行しているが、ハードデリートに変更する対象
- **buyer_number**: `buyers`テーブルの主キー（TEXT型）。`id`や`buyer_id`は存在しない
- **buyer_deletion_audit**: 削除前のバックアップを保存する監査ログテーブル
- **安全ガード**: 誤大量削除を防ぐ3つのチェック（0件スキップ・50%比率・10%閾値）

## Bug Details

### Bug Condition

スプレッドシートに存在しない買主番号がDBに存在する場合、`executeBuyerSoftDelete()`が`deleted_at`を設定するソフトデリートを実行しており、物理削除（`DELETE FROM buyers WHERE buyer_number = ?`）が行われていない。

**Formal Specification:**
```
FUNCTION isBugCondition(buyerNumber)
  INPUT: buyerNumber of type string
  OUTPUT: boolean

  sheetBuyerNumbers := getAllBuyerNumbersFromSpreadsheet()
  dbActiveBuyerNumbers := getAllActiveBuyerNumbers()  -- deleted_at IS NULL

  RETURN buyerNumber IN dbActiveBuyerNumbers
         AND buyerNumber NOT IN sheetBuyerNumbers
         AND safetyGuardsPass(sheetBuyerNumbers, dbActiveBuyerNumbers)
END FUNCTION
```

### Examples

- 買主番号7205はスプレッドシートに存在しない → DBに`deleted_at`が設定されたまま残り続ける（バグ）→ 修正後はDBから物理削除される
- 買主番号7200はスプレッドシートに存在する → 削除されない（正常動作・変更なし）
- スプレッドシートが0件 → 安全ガード1が発動し削除処理をスキップ（変更なし）
- 削除対象が10件でアクティブ買主が50件（20%） → 安全ガード3が発動しスキップ（変更なし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- スプレッドシートに存在する買主は削除しない（要件3.1）
- スプレッドシートが0件の場合は削除処理をスキップ（安全ガード1・要件3.2）
- スプレッドシートの買主数がDBのアクティブ買主数の50%未満の場合はスキップ（安全ガード2・要件3.3）
- 削除対象がアクティブ買主の10%以上の場合はスキップ（安全ガード3・要件3.4）
- スプレッドシートに存在する買主のデータ更新は正常に動作する（要件3.5）

**Scope:**
バグ条件が成立しない全ての入力（スプレッドシートに存在する買主・安全ガードが発動するケース）は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

`executeBuyerSoftDelete()`メソッドが売主の`executeSoftDelete()`と同じパターンで実装されており、買主テーブルに対してもソフトデリートが適用されている。

1. **設計上の誤り**: 売主はソフトデリート（復元可能）が要件だが、買主はハードデリートが要件。`executeBuyerSoftDelete()`は売主用の`executeSoftDelete()`をコピーして作成されたため、同じソフトデリートロジックが使われている。

2. **メソッド名の誤解**: `executeBuyerSoftDelete`という名前自体がソフトデリートを示しており、ハードデリートへの変更が必要であることが見落とされていた。

3. **監査ログの存在**: `buyer_deletion_audit`テーブルへのバックアップ処理が実装されており、ハードデリートへの変更後もこの監査ログは維持すべきか検討が必要（要件上は不要だが、データ保護の観点から維持することを推奨）。

## Correctness Properties

Property 1: Bug Condition - ハードデリートの実行

_For any_ 買主番号において、バグ条件が成立する（isBugConditionがtrueを返す）場合、修正後の`executeBuyerHardDelete`関数はDBから該当レコードを物理削除し、`SELECT * FROM buyers WHERE buyer_number = ?`の結果が0件になること。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 安全ガードと既存動作の維持

_For any_ 入力において、バグ条件が成立しない（isBugConditionがfalseを返す）場合、修正後のコードは元のコードと同じ動作を維持し、スプレッドシートに存在する買主の削除・安全ガードのスキップ動作・データ更新処理が変更されないこと。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Function**: `executeBuyerSoftDelete`（メソッド名も`executeBuyerHardDelete`に変更を推奨）

**Specific Changes**:

1. **ソフトデリートをハードデリートに変更**:
   ```typescript
   // 変更前（ソフトデリート）
   const { error: buyerDeleteError } = await this.supabase
     .from('buyers')
     .update({ deleted_at: deletedAt.toISOString() })
     .eq('buyer_number', buyerNumber);

   // 変更後（ハードデリート）
   const { error: buyerDeleteError } = await this.supabase
     .from('buyers')
     .delete()
     .eq('buyer_number', buyerNumber);
   ```

2. **監査ログの維持**: `buyer_deletion_audit`テーブルへのバックアップ処理はそのまま維持する（ハードデリート前にバックアップを作成）

3. **メソッド名の変更**: `executeBuyerSoftDelete` → `executeBuyerHardDelete`（呼び出し元の`syncDeletedBuyers`も更新）

4. **ログメッセージの更新**: `Soft deleted successfully` → `Hard deleted successfully`

5. **呼び出し元の更新**: `syncDeletedBuyers`内の`executeBuyerSoftDelete`呼び出しを`executeBuyerHardDelete`に変更

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを確認し、次に修正後のコードで正しい動作とリグレッションがないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `executeBuyerSoftDelete`を直接呼び出し、実行後にDBのレコードが`deleted_at`設定で残っていることを確認する。

**Test Cases**:
1. **ソフトデリート確認**: 買主番号7205に対して`executeBuyerSoftDelete`を実行 → `deleted_at`が設定されてレコードが残ることを確認（未修正コードで失敗するはず）
2. **ハードデリート不実行確認**: 実行後に`SELECT * FROM buyers WHERE buyer_number = '7205'`でレコードが存在することを確認（未修正コードで失敗するはず）

**Expected Counterexamples**:
- `executeBuyerSoftDelete`実行後、`buyers`テーブルに`deleted_at IS NOT NULL`のレコードが残る
- `DELETE FROM buyers`が実行されていない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が物理削除を実行することを検証する。

**Pseudocode:**
```
FOR ALL buyerNumber WHERE isBugCondition(buyerNumber) DO
  result := executeBuyerHardDelete_fixed(buyerNumber)
  ASSERT result.success = true
  ASSERT SELECT COUNT(*) FROM buyers WHERE buyer_number = buyerNumber = 0
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後のコードが元のコードと同じ動作を維持することを検証する。

**Pseudocode:**
```
FOR ALL buyerNumber WHERE NOT isBugCondition(buyerNumber) DO
  ASSERT executeBuyerHardDelete_original(buyerNumber) = executeBuyerHardDelete_fixed(buyerNumber)
END FOR
```

**Testing Approach**: プロパティベーステストにより、多様な入力パターンで保護動作が維持されることを確認する。

**Test Cases**:
1. **安全ガード1の維持**: スプレッドシートが0件の場合、削除処理がスキップされることを確認
2. **安全ガード2の維持**: スプレッドシートの買主数がDBの50%未満の場合、スキップされることを確認
3. **安全ガード3の維持**: 削除対象が10%以上の場合、スキップされることを確認
4. **スプレッドシート存在買主の保護**: スプレッドシートに存在する買主が削除されないことを確認
5. **データ更新の維持**: `syncUpdatedBuyers`が正常に動作することを確認

### Unit Tests

- `executeBuyerHardDelete`が`DELETE`クエリを実行することを確認
- 実行後にレコードが存在しないことを確認
- 監査ログ（`buyer_deletion_audit`）が作成されることを確認
- 存在しない買主番号に対してエラーを返すことを確認

### Property-Based Tests

- ランダムな買主番号セットで安全ガード1〜3が正しく機能することを確認
- スプレッドシートに存在する買主が削除されないことを多様なデータセットで確認
- ハードデリート後にレコードが完全に消えることを確認

### Integration Tests

- `syncBuyers()`を実行し、スプレッドシートに存在しない買主がDBから物理削除されることを確認
- `syncBuyers()`実行後、スプレッドシートに存在する買主が正常に残っていることを確認
- 安全ガードが発動するシナリオで`syncBuyers()`が削除をスキップすることを確認
