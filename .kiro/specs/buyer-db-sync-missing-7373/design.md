# buyer-db-sync-missing-7373 バグ修正設計書

## Overview

`EnhancedAutoSyncService` の `detectMissingBuyers()` メソッドが、DB上の買主番号を取得する際に `getAllDbBuyerNumbers()`（`deleted_at` フィルタなし）を使用しているため、ソフトデリート済みの買主番号も「DBに存在する」と誤判定する。

その結果、スプレッドシートに存在する買主番号7373が「欠損なし」と判断されて同期されない。

修正方針：`detectMissingBuyers()` 内の `getAllDbBuyerNumbers()` 呼び出しを `getAllActiveBuyerNumbers()`（`.is('deleted_at', null)` フィルタあり）に置き換える。変更は1行のみで、他の処理には一切影響しない。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — スプレッドシートに買主番号が存在し、かつDBに同じ番号のソフトデリート済みレコード（`deleted_at` が非null）が存在する
- **Property (P)**: 期待される正しい動作 — `detectMissingBuyers()` がその買主番号を「欠損あり」として検出し、同期対象に含める
- **Preservation**: 修正によって変更してはならない既存の動作
- **getAllDbBuyerNumbers**: `backend/src/services/EnhancedAutoSyncService.ts` 内のプライベートメソッド。`deleted_at` フィルタなしで全買主番号を取得する
- **getAllActiveBuyerNumbers**: 同ファイル内のプライベートメソッド。`.is('deleted_at', null)` でアクティブな買主番号のみを取得する
- **detectMissingBuyers**: スプレッドシートにあってDBにない買主番号を検出するメソッド。現在は `getAllDbBuyerNumbers()` を使用しているためバグが発生している
- **ソフトデリート**: `deleted_at` カラムに日時をセットすることで論理削除された状態。物理削除ではなくレコードはDBに残る

## Bug Details

### Bug Condition

`detectMissingBuyers()` がDB上の買主番号を取得する際に `getAllDbBuyerNumbers()` を呼び出すため、`deleted_at` がセットされたソフトデリート済みレコードも「DBに存在する」と判断される。スプレッドシートに存在する買主番号がDBにソフトデリート状態で残っている場合、欠損として検出されず同期がスキップされる。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyerNumber: string, dbRecord: BuyerRecord | null }
  OUTPUT: boolean

  RETURN input.buyerNumber EXISTS IN spreadsheet
         AND input.dbRecord != null
         AND input.dbRecord.deleted_at != null
         AND input.buyerNumber IN getAllDbBuyerNumbers()  -- deleted_atフィルタなし
END FUNCTION
```

### Examples

- **バグ発現の例（買主番号7373）**: スプレッドシートに7373が存在し、DBに `deleted_at = '2024-xx-xx'` のレコードが存在する → `getAllDbBuyerNumbers()` が7373を返すため「DBに存在する」と誤判定 → 同期スキップ
- **正常ケース（修正後）**: 同じ状況で `getAllActiveBuyerNumbers()` を使用 → `deleted_at IS NULL` フィルタにより7373が返されない → 「DBに存在しない」と正しく判定 → 同期対象として検出
- **影響なしのケース**: スプレッドシートに存在し、DBにアクティブなレコード（`deleted_at = null`）が存在する → 修正前後ともに「DBに存在する」と判定 → 同期スキップ（正しい動作）
- **エッジケース**: スプレッドシートに存在し、DBにレコードが全く存在しない → 修正前後ともに「DBに存在しない」と判定 → 同期対象として検出（正しい動作）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- スプレッドシートに存在し、DBにもアクティブなレコード（`deleted_at = null`）が存在する買主番号は、引き続き「DBに存在する」と判定され `detectMissingBuyers()` の検出対象に含まれない
- `detectDeletedBuyers()` は引き続き `getAllActiveBuyerNumbers()` を使用しており、この修正の影響を受けない
- `detectUpdatedBuyers()` の動作は変わらない
- `syncBuyers()` の安全ガード（スプレッドシート0件チェック、50%比率チェック、10%削除閾値チェック）は変わらない
- `is_deleted` 列（スプレッドシートの「削除」列）は同期処理に一切影響しない（この修正でも無視する）

**Scope:**
バグ条件が成立しない入力（スプレッドシートに存在し、DBにアクティブなレコードが存在する買主番号）は、この修正の影響を一切受けない。変更箇所は `detectMissingBuyers()` 内の1行のみ。

## Hypothesized Root Cause

コードを確認した結果、根本原因は以下の通り特定済み：

1. **`detectMissingBuyers()` での誤ったメソッド使用**: `backend/src/services/EnhancedAutoSyncService.ts` の `detectMissingBuyers()` メソッド（Line 2830付近）が `getAllDbBuyerNumbers()` を呼び出している
   - `getAllDbBuyerNumbers()`（Line 2793）: `deleted_at` フィルタなし → ソフトデリート済みレコードも含む
   - `getAllActiveBuyerNumbers()`（Line 3298）: `.is('deleted_at', null)` フィルタあり → アクティブなレコードのみ

2. **非対称な実装**: `detectDeletedBuyers()` は正しく `getAllActiveBuyerNumbers()` を使用しているが、`detectMissingBuyers()` は誤って `getAllDbBuyerNumbers()` を使用している。実装時に誤ったメソッドが選択されたと考えられる。

3. **影響範囲の限定**: `getAllDbBuyerNumbers()` は `detectMissingBuyers()` 内でのみ使用されており、他のメソッドへの影響はない。

## Correctness Properties

Property 1: Bug Condition - ソフトデリート済み買主番号の欠損検出

_For any_ スプレッドシートに存在し、かつDBに `deleted_at` が非nullのレコードのみが存在する買主番号において、バグ条件が成立する（`isBugCondition` が true を返す）場合、修正後の `detectMissingBuyers()` 関数はその買主番号を欠損として検出し、返却リストに含めなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - アクティブ買主番号の非検出保持

_For any_ スプレッドシートに存在し、かつDBに `deleted_at = null` のアクティブなレコードが存在する買主番号において、バグ条件が成立しない（`isBugCondition` が false を返す）場合、修正後の `detectMissingBuyers()` 関数は修正前と同じ動作（その買主番号を欠損リストに含めない）を保持しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Function**: `detectMissingBuyers()`（Line 2830付近）

**Specific Changes**:

1. **`getAllDbBuyerNumbers()` を `getAllActiveBuyerNumbers()` に置き換える**: `detectMissingBuyers()` 内の以下の1行を変更する

   ```typescript
   // 修正前
   const dbBuyerNumbers = await this.getAllDbBuyerNumbers();

   // 修正後
   const dbBuyerNumbers = await this.getAllActiveBuyerNumbers();
   ```

2. **ログメッセージの更新**: 変更に合わせてログメッセージを更新する（任意）

   ```typescript
   // 修正前
   console.log(`📊 Database buyers: ${dbBuyerNumbers.size}`);

   // 修正後
   console.log(`📊 Active database buyers: ${dbBuyerNumbers.size}`);
   ```

変更はこの2箇所のみ。`getAllDbBuyerNumbers()` メソッド自体は削除しない（他の用途で使用される可能性があるため）。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する。まず修正前のコードでバグを再現するテストを実行してバグの存在を確認し、次に修正後のコードでバグが解消され既存動作が保持されていることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は再仮説が必要。

**Test Plan**: `detectMissingBuyers()` をモックして、スプレッドシートにある買主番号がDBにソフトデリート状態で存在する場合に欠損として検出されないことを確認するテストを作成し、修正前のコードで実行して失敗を確認する。

**Test Cases**:
1. **ソフトデリート済み買主の欠損検出テスト**: スプレッドシートに7373が存在し、DBに `deleted_at` が非nullのレコードが存在する場合、`detectMissingBuyers()` が7373を返さないことを確認（修正前は失敗するはず）
2. **複数ソフトデリート済み買主テスト**: 複数の買主番号がソフトデリート状態の場合、全て欠損として検出されないことを確認（修正前は失敗するはず）
3. **混在ケーステスト**: アクティブな買主とソフトデリート済み買主が混在する場合、ソフトデリート済みのみが欠損として検出されることを確認（修正前は失敗するはず）
4. **DBにレコードなしのケース**: スプレッドシートに存在し、DBにレコードが全く存在しない場合、欠損として検出されることを確認（修正前後ともに成功するはず）

**Expected Counterexamples**:
- 修正前: `detectMissingBuyers()` がソフトデリート済み買主番号を欠損リストに含めない（`getAllDbBuyerNumbers()` がソフトデリート済みレコードも返すため）

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待される動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL buyerNumber WHERE isBugCondition(buyerNumber) DO
  result := detectMissingBuyers_fixed()
  ASSERT buyerNumber IN result
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同じ動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL buyerNumber WHERE NOT isBugCondition(buyerNumber) DO
  ASSERT detectMissingBuyers_original() = detectMissingBuyers_fixed()
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する理由：
- 多様な買主番号の組み合わせ（アクティブ/ソフトデリート済み/存在しない）に対して自動的に多数のテストケースを生成できる
- 手動テストでは見落としがちなエッジケース（大量の買主番号、境界値など）を検出できる
- 既存動作が保持されていることを強く保証できる

**Test Plan**: 修正前のコードでアクティブな買主番号の非検出動作を観察し、その動作を保持するプロパティベーステストを作成する。

**Test Cases**:
1. **アクティブ買主の非検出保持**: DBにアクティブなレコードが存在する買主番号は、修正前後ともに欠損リストに含まれないことを確認
2. **`detectDeletedBuyers()` への影響なし**: `detectDeletedBuyers()` の動作が修正前後で変わらないことを確認
3. **`detectUpdatedBuyers()` への影響なし**: `detectUpdatedBuyers()` の動作が修正前後で変わらないことを確認
4. **安全ガードの保持**: `syncBuyers()` の安全ガードが修正前後で変わらないことを確認

### Unit Tests

- スプレッドシートに存在し、DBにソフトデリート済みレコードのみが存在する買主番号が欠損として検出されることを検証
- スプレッドシートに存在し、DBにアクティブなレコードが存在する買主番号が欠損として検出されないことを検証
- スプレッドシートに存在し、DBにレコードが全く存在しない買主番号が欠損として検出されることを検証
- `is_deleted` 列の値に関わらず、同期処理の結果が変わらないことを検証

### Property-Based Tests

- ランダムな買主番号セット（アクティブ/ソフトデリート済み/存在しない）を生成し、ソフトデリート済みの買主番号が常に欠損として検出されることを検証
- ランダムなDB状態に対して、アクティブな買主番号が欠損リストに含まれないことを検証
- 多様な買主番号の組み合わせに対して、`detectDeletedBuyers()` の動作が変わらないことを検証

### Integration Tests

- 実際のSupabaseデータを使用して、ソフトデリート済み買主番号がスプレッドシートに存在する場合に同期対象として検出されることを検証
- `syncBuyers()` の全フロー（欠損検出 → 同期 → 安全ガード）が正しく動作することを検証
- 修正後に買主番号7373が実際に同期されることを確認するエンドツーエンドテスト
