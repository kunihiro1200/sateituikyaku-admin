# buyer-7614-db-sync-missing バグ修正設計

## Overview

スプレッドシート→DB同期時に、論理削除済み（`deleted_at IS NOT NULL`）の買主レコードが検出された場合、`deleted_at: null` を含む更新データでレコードを復元する修正。

現状では `syncSingleBuyer()` が `deleted_at` フィルタなしで既存レコードを検索するため、論理削除済みレコードを「既存の買主」として検出し、`deleted_at: null` を含まない更新を行う。その結果、論理削除フラグが残ったままとなり、`getByBuyerNumber()` の `deleted_at IS NULL` フィルタで該当レコードが見つからず「データなし」となる。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — DBに論理削除済みレコードが存在し、かつスプレッドシートにも同じ買主番号が存在する場合
- **Property (P)**: 期待される正しい動作 — 同期後に `deleted_at` が `null` にリセットされ、買主が「アクティブ」状態に戻ること
- **Preservation**: 修正によって変更してはならない既存の動作 — アクティブな買主の通常更新処理、新規挿入処理、`detectMissingBuyers()` の動作
- **syncSingleBuyer**: `backend/src/services/EnhancedAutoSyncService.ts` 内のメソッド。スプレッドシートの1行を受け取り、DBへの挿入または更新を行う
- **deleted_at**: 論理削除フラグ。`null` の場合はアクティブ、値がある場合は論理削除済み
- **maybeSingle**: Supabaseクエリメソッド。0件または1件を返す（複数件の場合はエラー）

## Bug Details

### Bug Condition

バグは、DBに論理削除済みの買主レコードが存在する状態でスプシ→DB同期を実行したときに発生する。`syncSingleBuyer()` は `deleted_at` フィルタなしで既存レコードを検索するため、論理削除済みレコードを「既存の買主」として検出し、`deleted_at: null` を含まない更新を行う。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type BuyerSyncInput { buyer_number: string, row: SpreadsheetRow }
  OUTPUT: boolean

  RETURN EXISTS(buyer IN DB WHERE buyer.buyer_number = X.buyer_number
                              AND buyer.deleted_at IS NOT NULL)
         AND EXISTS(row IN Spreadsheet WHERE row['買主番号'] = X.buyer_number)
END FUNCTION
```

### Examples

- **例1（バグ発生）**: 買主番号7614がDBで論理削除済み（`deleted_at = '2025-01-01'`）、スプシに7614が存在 → 同期後も `deleted_at` が残り、買主詳細で「データなし」
- **例2（バグ発生）**: 買主番号1234がDBで論理削除済み、スプシに1234が存在 → 同期後も論理削除フラグが残る
- **例3（正常ケース）**: 買主番号5678がDBにアクティブ（`deleted_at IS NULL`）、スプシに5678が存在 → 通常の更新処理（`deleted_at` は変更しない）
- **例4（正常ケース）**: 買主番号9999がDBに存在しない、スプシに9999が存在 → 新規挿入処理

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `deleted_at IS NULL` のアクティブな買主に対する同期は、引き続き通常の更新処理（`deleted_at` を変更しない）を行う
- スプレッドシートに存在しない買主番号に対する同期は、引き続き「Row not found in spreadsheet」エラーを記録してスキップする
- DBにも論理削除レコードにも存在しない新規買主の同期は、引き続き新規挿入処理を行う
- `detectMissingBuyers()` は引き続き `deleted_at IS NULL` のアクティブな買主のみをDBから取得し、スプレッドシートと比較する

**スコープ:**
バグ条件（論理削除済みレコードが存在する状態での同期）に該当しない全ての入力は、この修正によって完全に影響を受けない。

## Hypothesized Root Cause

バグ説明の分析に基づき、最も可能性の高い原因は以下の通り:

1. **`deleted_at` フィルタの欠如**: 既存レコード確認クエリが `deleted_at IS NULL` フィルタを含んでいないため、論理削除済みレコードも「既存の買主」として検出される
   - 現在のクエリ: `.select('buyer_id').eq('buyer_number', buyerNumber).maybeSingle()`
   - 必要なクエリ: `.select('buyer_id, deleted_at').eq('buyer_number', buyerNumber).maybeSingle()`

2. **更新データに `deleted_at: null` が含まれない**: 論理削除済みレコードを更新する際、`deleted_at: null` を明示的に含めていないため、論理削除フラグがリセットされない

3. **論理削除状態の分岐処理がない**: アクティブなレコードと論理削除済みレコードを区別する分岐が存在しない

## Correctness Properties

Property 1: Bug Condition - 論理削除済み買主の復元

_For any_ 入力 X において isBugCondition(X) が true を返す場合（DBに論理削除済みレコードが存在し、スプシにも同じ買主番号が存在する場合）、修正後の `syncSingleBuyer'` は `deleted_at: null` を含む更新を行い、同期後に `getByBuyerNumber(X.buyer_number)` が非 null のレコードを返し、かつそのレコードの `deleted_at` が `null` であること。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - アクティブな買主・新規買主の動作保持

_For any_ 入力 X において isBugCondition(X) が false を返す場合（アクティブな買主の更新、新規買主の挿入、スプシに存在しない買主のスキップ）、修正後の `syncSingleBuyer'` は元の `syncSingleBuyer` と同一の結果を生成し、既存の動作を保持すること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合:

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Function**: `syncSingleBuyer()`

**Specific Changes**:

1. **既存レコード確認クエリの変更**: `buyer_id` のみ取得から `buyer_id, deleted_at` を取得するよう変更
   - 変更前: `.select('buyer_id')`
   - 変更後: `.select('buyer_id, deleted_at')`

2. **論理削除状態の分岐追加**: `existingBuyer` が存在する場合、`deleted_at` の値を確認して分岐
   - `existingBuyer.deleted_at !== null` の場合 → 論理削除済みレコードの復元処理
   - `existingBuyer.deleted_at === null` の場合 → 従来通りの更新処理

3. **論理削除済みレコードの復元処理**: 更新データに `deleted_at: null` を明示的に含める
   - 変更前: `update({ ...buyerData, created_at: undefined })`
   - 変更後（論理削除済みの場合）: `update({ ...buyerData, created_at: undefined, deleted_at: null })`

4. **アクティブなレコードの更新処理**: 従来通り `deleted_at` を変更しない
   - 変更なし: `update({ ...buyerData, created_at: undefined })`

5. **（オプション）ログ出力**: 論理削除済みレコードを復元した場合にログを出力し、追跡可能にする

**修正後のコードイメージ:**
```typescript
// 既存の買主を確認（deleted_at も取得）
const { data: existingBuyer, error: checkError } = await this.supabase
  .from('buyers')
  .select('buyer_id, deleted_at')
  .eq('buyer_number', buyerNumber)
  .maybeSingle();

if (checkError) {
  throw new Error(`Failed to check existing buyer: ${checkError.message}`);
}

if (existingBuyer) {
  // 論理削除済みレコードの場合は deleted_at: null で復元
  const updateData: any = {
    ...buyerData,
    created_at: undefined,
  };

  if (existingBuyer.deleted_at !== null) {
    updateData.deleted_at = null; // 論理削除フラグをリセット
  }

  const { error: updateError } = await this.supabase
    .from('buyers')
    .update(updateData)
    .eq('buyer_number', buyerNumber);

  if (updateError) {
    throw new Error(updateError.message);
  }
} else {
  // 新規買主を挿入
  const { error: insertError } = await this.supabase
    .from('buyers')
    .insert(buyerData);

  if (insertError) {
    throw new Error(insertError.message);
  }
}
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズアプローチに従う: まず未修正コードでバグを実証する反例を見つけ、次に修正が正しく動作し既存の動作を保持することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正を実装する前に、未修正コードでバグを実証する反例を見つける。根本原因分析を確認または反証する。反証された場合は再仮説が必要。

**Test Plan**: 論理削除済みの買主レコードをDBに用意し、スプシ同期をシミュレートして `syncSingleBuyer()` を呼び出す。未修正コードで実行し、同期後も `deleted_at` が残ることを確認する。

**Test Cases**:
1. **論理削除済み買主の同期テスト**: `deleted_at` がセットされた買主番号7614に対して `syncSingleBuyer()` を呼び出す（未修正コードで失敗する）
2. **同期後の取得テスト**: 同期後に `getByBuyerNumber('7614')` を呼び出し、`null` が返ることを確認（未修正コードで失敗する）
3. **`deleted_at` フラグ確認テスト**: 同期後のDBレコードを直接確認し、`deleted_at` が残っていることを確認（未修正コードで失敗する）

**Expected Counterexamples**:
- 同期後も `deleted_at` が `null` にリセットされない
- 原因: 更新クエリに `deleted_at: null` が含まれていない

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  syncSingleBuyer'(X.buyer_number, X.row)
  result := getByBuyerNumber(X.buyer_number)
  ASSERT result IS NOT NULL
  ASSERT result.deleted_at IS NULL
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同一の結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT syncSingleBuyer'(X) = syncSingleBuyer(X)
END FOR
```

**Testing Approach**: 保持確認にはプロパティベーステストを推奨する。理由:
- 入力ドメイン全体で多数のテストケースを自動生成できる
- 手動ユニットテストが見逃すエッジケースを検出できる
- バグ条件に該当しない全ての入力で動作が変わらないことを強く保証できる

**Test Plan**: まず未修正コードでアクティブな買主・新規買主の動作を観察し、その動作をキャプチャするプロパティベーステストを作成する。

**Test Cases**:
1. **アクティブな買主の更新保持**: `deleted_at IS NULL` の買主に対して同期を実行し、`deleted_at` が変更されないことを確認
2. **新規買主の挿入保持**: DBに存在しない買主番号に対して同期を実行し、新規挿入が正常に行われることを確認
3. **`detectMissingBuyers()` の動作保持**: `deleted_at IS NULL` のアクティブな買主のみが取得されることを確認

### Unit Tests

- 論理削除済み買主に対する `syncSingleBuyer()` のテスト（`deleted_at: null` で復元されることを確認）
- アクティブな買主に対する `syncSingleBuyer()` のテスト（`deleted_at` が変更されないことを確認）
- 新規買主に対する `syncSingleBuyer()` のテスト（新規挿入が正常に行われることを確認）
- エッジケース: `deleted_at` が `null` の既存レコードに対して `deleted_at: null` を含む更新を行わないことを確認

### Property-Based Tests

- ランダムな買主番号と論理削除状態を生成し、同期後に `deleted_at` が正しくリセットされることを検証
- ランダムなアクティブ買主データを生成し、同期後に `deleted_at` が変更されないことを検証（保持確認）
- 多数のシナリオにわたって、バグ条件に該当しない入力で動作が変わらないことを検証

### Integration Tests

- 買主番号7614の完全な同期フロー: 論理削除 → スプシ同期 → 買主詳細表示
- 複数の論理削除済み買主を含む一括同期テスト
- 論理削除済み買主とアクティブな買主が混在する状態での同期テスト
