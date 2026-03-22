# AA13831 削除同期バグ 設計ドキュメント

## Overview

売主AA13831がスプレッドシートから削除されて1時間以上経過しているにもかかわらず、DBの `deleted_at` が設定されていないバグを修正する。

コード調査の結果、**根本原因は `executeSoftDelete()` メソッドがソフトデリート（`deleted_at` の設定）ではなくハードデリート（`.delete()`）を実行していること**が判明した。メソッド名は「SoftDelete」だが、実装はハードデリートになっており、名前と実装が乖離している。

修正方針：`executeSoftDelete()` を真のソフトデリート（`deleted_at` に現在時刻を設定する `UPDATE`）に修正する。

---

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — 売主がスプレッドシートから削除されており、DBに `deleted_at = null` で存在する状態
- **Property (P)**: 期待される正しい動作 — 同期実行後に `deleted_at` が設定される（ソフトデリート完了）
- **Preservation**: 修正によって変更してはいけない既存の動作
- **executeSoftDelete()**: `backend/src/services/EnhancedAutoSyncService.ts` 内のメソッド。本来はソフトデリートを行うべきだが、現在はハードデリート（`.delete()`）を実行している
- **getAllActiveDbSellerNumbers()**: `deleted_at = null` の売主のみを返すメソッド。ソフトデリート後は削除済み売主を除外する
- **runSellersOnlySync()**: GASから呼び出される Phase 1-3 の同期メソッド。Phase 3 で `detectDeletedSellers()` → `syncDeletedSellers()` → `executeSoftDelete()` の順に実行される
- **DELETION_SYNC_ENABLED**: 削除同期の有効/無効を制御する環境変数（デフォルト: `true`）

---

## Bug Details

### Bug Condition

バグは `executeSoftDelete()` が呼び出されたとき（売主がスプレッドシートから削除されており、DBに `deleted_at = null` で存在する場合）に発現する。メソッドは `deleted_at` を設定する代わりに、レコードを完全削除（ハードデリート）しようとする。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller のデータベースレコード
  OUTPUT: boolean

  RETURN seller.deleted_at = null
         AND seller_number NOT IN spreadsheet_seller_numbers
END FUNCTION
```

### Examples

- **AA13831（今回のケース）**: スプレッドシートから削除済み、DB に `deleted_at = null` で存在 → 同期後も `deleted_at` が設定されない（ハードデリートが試みられるが、RLSポリシーや外部キー制約でブロックされる可能性もある）
- **正常ケース（スプレッドシートに存在する売主）**: `isBugCondition = false` → 削除対象として検出されない → `deleted_at` は変更されない
- **アクティブ契約ありの売主**: `validateDeletion()` でブロック → `manualReviewSellerNumbers` に追加 → `executeSoftDelete()` は呼ばれない

---

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- スプレッドシートに存在する売主の `deleted_at` は変更しない
- アクティブな契約ステータス（「専任契約中」「一般契約中」）を持つ売主の削除はブロックする
- 削除同期が新規追加同期（Phase 1）・更新同期（Phase 2）に影響しない
- ソフトデリートされた売主は `getAllActiveDbSellerNumbers()` から除外し続ける

**Scope:**
`isBugCondition = false` の入力（スプレッドシートに存在する売主、アクティブ契約ありの売主）は、この修正によって完全に影響を受けない。

---

## Hypothesized Root Cause

コード調査により、根本原因を**特定済み**。

### 根本原因（確定）: `executeSoftDelete()` がハードデリートを実行している

**ファイル**: `backend/src/services/EnhancedAutoSyncService.ts`

**問題のコード（現在）**:
```typescript
private async executeSoftDelete(sellerNumber: string): Promise<DeletionResult> {
  try {
    // 売主を完全削除（ハードデリート）  ← コメントも「ハードデリート」と明記
    const { error: deleteError } = await this.supabase
      .from('sellers')
      .delete()                          // ← .delete() = ハードデリート
      .eq('seller_number', sellerNumber);
    ...
  }
}
```

メソッド名は `executeSoftDelete` だが、実装は `.delete()` によるハードデリートになっている。本来は `.update({ deleted_at: new Date().toISOString() })` によるソフトデリートであるべき。

### 副次的な確認事項

以下は調査済みで問題なし：

1. **`detectDeletedSellers()` の検出ロジック**: `getAllActiveDbSellerNumbers()`（`deleted_at = null` のみ）とスプレッドシートの差分を正しく計算している
2. **`getAllActiveDbSellerNumbers()` の実装**: `.is('deleted_at', null)` で正しくフィルタリングしている
3. **`validateDeletion()` のバリデーション**: 「専任契約中」「一般契約中」のみブロック。AA13831 のステータスが該当しなければ通過する
4. **GAS の `syncSellerList`**: `sellersOnly=true` で `/api/sync/trigger` を呼び出し、Phase 3（削除同期）を含む `runSellersOnlySync()` が実行される
5. **スプレッドシートの読み取り範囲**: `rowToObject()` でヘッダー名をキーとしてマッピング。`売主番号` 列（B列）を正しく読み取っている
6. **`DELETION_SYNC_ENABLED`**: デフォルト `true`。`isDeletionSyncEnabled()` が `false` を返す場合は Phase 3 がスキップされるが、環境変数が正しく設定されていれば問題ない

---

## Correctness Properties

Property 1: Bug Condition - 削除同期でソフトデリートが完了する

_For any_ 売主レコードで `isBugCondition` が true（スプレッドシートに存在せず、`deleted_at = null`）の場合、修正後の `executeSoftDelete()` は `deleted_at` に現在時刻を設定し、レコードをDBに残したままソフトデリートを完了する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - スプレッドシートに存在する売主は影響を受けない

_For any_ 売主レコードで `isBugCondition` が false（スプレッドシートに存在する、または `deleted_at` が既に設定済み）の場合、修正後のコードは元のコードと同じ動作をし、`deleted_at` を変更しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

**ファイル**: `backend/src/services/EnhancedAutoSyncService.ts`

**メソッド**: `executeSoftDelete()`

**変更内容**:

1. **ハードデリートをソフトデリートに変更**:
   - 現在: `.delete().eq('seller_number', sellerNumber)`
   - 修正後: `.update({ deleted_at: new Date().toISOString() }).eq('seller_number', sellerNumber).is('deleted_at', null)`

2. **コメントを修正**:
   - 現在: `// 売主を完全削除（ハードデリート）`
   - 修正後: `// 売主をソフトデリート（deleted_at を設定）`

**修正後のコード（概要）**:
```typescript
private async executeSoftDelete(sellerNumber: string): Promise<DeletionResult> {
  try {
    // 売主をソフトデリート（deleted_at を設定）
    const deletedAt = new Date().toISOString();
    const { error: updateError } = await this.supabase
      .from('sellers')
      .update({ deleted_at: deletedAt })
      .eq('seller_number', sellerNumber)
      .is('deleted_at', null); // 二重削除防止

    if (updateError) {
      console.error(`❌ Failed to soft-delete seller ${sellerNumber}:`, updateError.message);
      return {
        sellerNumber,
        success: false,
        error: `Seller soft-deletion failed: ${updateError.message}`,
      };
    }

    console.log(`✅ ${sellerNumber}: Soft-deleted successfully (deleted_at: ${deletedAt})`);

    return {
      sellerNumber,
      success: true,
      deletedAt: new Date(deletedAt),
    };

  } catch (error: any) {
    console.error(`❌ Soft-delete error for ${sellerNumber}:`, error.message);
    return {
      sellerNumber,
      success: false,
      error: error.message,
    };
  }
}
```

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現し根本原因を確認、次に修正後のコードで正しい動作と既存動作の保全を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因（ハードデリート）を確認する。

**Test Plan**: `executeSoftDelete()` を直接呼び出し、DBに `.delete()` が発行されることを確認する。未修正コードでは `deleted_at` が設定されず、レコードが削除（またはエラー）されることを観察する。

**Test Cases**:
1. **ソフトデリート未実行テスト**: `executeSoftDelete('AA13831')` を呼び出し、DBに `deleted_at` が設定されないことを確認（未修正コードで失敗するはず）
2. **ハードデリート確認テスト**: 未修正コードで `.delete()` が呼ばれることをモックで確認
3. **Phase 3 フロー確認テスト**: `syncDeletedSellers(['AA13831'])` を呼び出し、`deleted_at` が設定されないことを確認

**Expected Counterexamples**:
- `deleted_at` が設定されず、レコードが削除されるか、外部キー制約エラーが発生する
- 根本原因: `executeSoftDelete()` が `.delete()` を使用している

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が true の全入力に対して `deleted_at` が設定されることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := executeSoftDelete_fixed(seller.seller_number)
  ASSERT result.success = true
  ASSERT DB.sellers[seller.seller_number].deleted_at IS NOT NULL
  ASSERT DB.sellers[seller.seller_number] EXISTS  // ハードデリートされていない
END FOR
```

### Preservation Checking

**Goal**: バグ条件が false の全入力に対して、修正後のコードが元のコードと同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT executeSoftDelete_original(seller) = executeSoftDelete_fixed(seller)
  // スプレッドシートに存在する売主は detectDeletedSellers() で検出されない
  // → executeSoftDelete() は呼ばれない
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。様々な売主ステータスと状態の組み合わせを自動生成し、保全を検証する。

**Test Cases**:
1. **スプレッドシート存在売主の保全**: スプレッドシートに存在する売主が `detectDeletedSellers()` で検出されないことを確認
2. **アクティブ契約ブロックの保全**: 「専任契約中」「一般契約中」の売主が `validateDeletion()` でブロックされることを確認
3. **既存ソフトデリート済み売主の保全**: `deleted_at` が既に設定済みの売主が `getAllActiveDbSellerNumbers()` から除外されることを確認

### Unit Tests

- `executeSoftDelete()` が `deleted_at` を設定することを確認
- `executeSoftDelete()` がレコードを削除しないことを確認（ハードデリートでないこと）
- `validateDeletion()` がアクティブ契約ありの売主をブロックすることを確認
- `detectDeletedSellers()` がスプレッドシートにない売主を正しく検出することを確認

### Property-Based Tests

- ランダムな売主番号リストで `detectDeletedSellers()` が正しく差分を計算することを検証
- ランダムなステータスの売主で `validateDeletion()` が正しくブロック/通過を判定することを検証
- 修正後の `executeSoftDelete()` が常に `deleted_at` を設定し、レコードを削除しないことを検証

### Integration Tests

- GAS の `syncSellerList` → `/api/sync/trigger?sellersOnly=true` → `runSellersOnlySync()` → Phase 3 の全フローを確認
- スプレッドシートから削除された売主が最大10分以内に `deleted_at` が設定されることを確認
- 修正後も Phase 1（追加）・Phase 2（更新）が正常に動作することを確認
