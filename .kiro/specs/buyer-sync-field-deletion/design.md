# 買主リスト同期バグ修正 設計書

## Overview

買主リストスプレッドシートでフィールドの値を削除（空欄に）しても、データベースには古い値が残り続けるバグを修正します。根本原因は、GASの`syncUpdatesToSupabase_`関数が、スプレッドシートの値がnull（空欄）でデータベースの値もnullの場合に「変更なし」と判断してしまうことです。正しくは、スプレッドシートの値がnullでデータベースの値が非nullの場合に「削除が必要」と判断すべきです。

## Glossary

- **Bug_Condition (C)**: スプレッドシートでフィールドの値を削除（空欄に）したが、データベースには古い値が残っている状態
- **Property (P)**: スプレッドシートでフィールドを空欄にした場合、データベースの該当カラムもnullまたは空文字列に更新される
- **Preservation**: 新しい値を入力した場合の同期、サイドバーカウント更新、10分トリガー、追加同期、削除同期は変更しない
- **syncUpdatesToSupabase_**: GASの`gas_buyer_complete_code.js`内の関数で、スプレッドシートとデータベースの差分を検出してSupabaseに直接更新する
- **needsUpdate**: 更新が必要かどうかを判定するフラグ。現在の実装では、スプレッドシートの値とデータベースの値が異なる場合にtrueになるが、両方がnullの場合はfalseになってしまう

## Bug Details

### Bug Condition

バグは、スプレッドシートでフィールドの値を削除（空欄に）したときに発生します。`syncUpdatesToSupabase_`関数は、スプレッドシートの値とデータベースの値を比較しますが、比較ロジックに欠陥があります。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { sheetValue: any, dbValue: any }
  OUTPUT: boolean
  
  RETURN (input.sheetValue === null OR input.sheetValue === '')
         AND (input.dbValue !== null AND input.dbValue !== '')
         AND NOT fieldIsUpdatedInDatabase(input.sheetValue, input.dbValue)
END FUNCTION
```

### Examples

- **買主番号7230の内覧日削除**: スプレッドシートで内覧日を削除（空欄に）→ データベースの`viewing_date`カラムには古い値（例: "2026-01-15"）が残る
- **買主番号7230の最新状況削除**: スプレッドシートで最新状況を削除（空欄に）→ データベースの`latest_status`カラムには古い値（例: "追客中"）が残る
- **買主番号7230の次電日削除**: スプレッドシートで次電日を削除（空欄に）→ データベースの`next_call_date`カラムには古い値（例: "2026-01-20"）が残る
- **Edge case**: スプレッドシートで新しい値を入力 → データベースには正しく同期される（この動作は保持される）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 新しい値を入力した場合の同期は引き続き正しく動作する
- サイドバーカウント更新処理（`updateBuyerSidebarCounts_`）は引き続き正しく動作する
- 10分トリガーによる定期同期は引き続き正しく動作する

**Scope:**
スプレッドシートで新しい値を入力する操作は完全に影響を受けません。これには以下が含まれます：
- 空欄から値を入力する操作
- 既存の値を別の値に変更する操作
- 追加同期（Phase 1）、削除同期（Phase 3）の動作

## Hypothesized Root Cause

バグ説明に基づくと、最も可能性が高い問題は以下の通りです：

1. **不完全な比較ロジック**: `syncUpdatesToSupabase_`関数が、スプレッドシートの値（null）とデータベースの値（非null）を比較する際、`sheetValue !== dbValue`という単純な比較を使用している。しかし、JavaScriptでは`null !== "2026-01-15"`はtrueだが、実際には`needsUpdate`フラグがfalseのままになっている可能性がある。

2. **null値の正規化不足**: スプレッドシートから取得した値が空文字列（`""`）の場合、データベースの値がnullの場合と比較すると、`"" !== null`はtrueだが、実際には両方とも「空」として扱うべき。

3. **条件分岐の欠陥**: 現在のコードは、スプレッドシートの値とデータベースの値が異なる場合に`needsUpdate = true`を設定しているが、スプレッドシートの値がnullまたは空文字列の場合の特別な処理が不足している。

4. **フィールドごとの比較ロジックの不統一**: 日付フィールド（`next_call_date`、`viewing_date`など）と文字列フィールド（`latest_status`、`initial_assignee`など）で比較ロジックが異なる可能性がある。

## Correctness Properties

Property 1: Bug Condition - フィールド削除時のデータベース更新

_For any_ スプレッドシートのフィールドが空欄（nullまたは空文字列）で、データベースの該当カラムが非null（古い値が存在）の場合、修正後の`syncUpdatesToSupabase_`関数 SHALL データベースの該当カラムをnullまたは空文字列に更新し、`needsUpdate`フラグをtrueに設定する。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 新しい値入力時の同期動作

_For any_ スプレッドシートのフィールドに新しい値が入力された場合（空欄から値を入力、または既存の値を別の値に変更）、修正後のコードは引き続き元のコードと同じ動作を行い、データベースに正しく同期される。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定すると、以下の変更が必要です：

**File**: `gas_buyer_complete_code.js`

**Function**: `syncUpdatesToSupabase_`

**Specific Changes**:

1. **null値の正規化**: スプレッドシートから取得した値とデータベースの値を比較する前に、両方をnullまたは空文字列に正規化する
   - 空文字列（`""`）→ null
   - undefined → null
   - 空白文字列（`"   "`）→ null

2. **比較ロジックの修正**: 各フィールドの比較で、以下のロジックを使用する
   ```javascript
   // 修正前（間違い）
   if (sheetValue !== dbValue) { updateData.field = sheetValue; needsUpdate = true; }
   
   // 修正後（正しい）
   var normalizedSheetValue = normalizeValue(sheetValue);
   var normalizedDbValue = normalizeValue(dbValue);
   if (normalizedSheetValue !== normalizedDbValue) { 
     updateData.field = normalizedSheetValue; 
     needsUpdate = true; 
   }
   ```

3. **normalizeValue関数の追加**: 値を正規化するヘルパー関数を追加
   ```javascript
   function normalizeValue(value) {
     if (value === null || value === undefined || value === '') return null;
     if (typeof value === 'string' && value.trim() === '') return null;
     return value;
   }
   ```

4. **全フィールドへの適用**: 以下の全フィールドに正規化ロジックを適用
   - `latest_status`（最新状況）
   - `next_call_date`（次電日）
   - `initial_assignee`（初動担当）
   - `follow_up_assignee`（後続担当）
   - `inquiry_email_phone`（問合メール電話対応）
   - `three_calls_confirmed`（3回架電確認済み）
   - `reception_date`（受付日）
   - `distribution_type`（配信種別）
   - `desired_area`（エリア）

5. **ログ出力の改善**: 削除（null化）が検出された場合、ログに明示的に出力
   ```javascript
   if (normalizedSheetValue === null && normalizedDbValue !== null) {
     Logger.log('  🗑️ ' + buyerNumber + ': ' + fieldName + ' を削除 (旧値: ' + normalizedDbValue + ')');
   }
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2段階のアプローチに従います：まず、修正前のコードでバグを再現する探索的テストを実行し、次に修正後のコードで正しく動作することを検証します。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は、再度根本原因を仮説立てする必要がある。

**Test Plan**: スプレッドシートで各フィールドを削除（空欄に）し、GASの`syncUpdatesToSupabase_`関数を実行して、データベースに古い値が残ることを確認する。修正前のコードで実行してエラーを観察し、根本原因を理解する。

**Test Cases**:
1. **内覧日削除テスト**: 買主番号7230の内覧日をスプレッドシートで削除 → GAS実行 → データベースの`viewing_date`に古い値が残る（修正前のコードで失敗）
2. **最新状況削除テスト**: 買主番号7230の最新状況をスプレッドシートで削除 → GAS実行 → データベースの`latest_status`に古い値が残る（修正前のコードで失敗）
3. **次電日削除テスト**: 買主番号7230の次電日をスプレッドシートで削除 → GAS実行 → データベースの`next_call_date`に古い値が残る（修正前のコードで失敗）
4. **複数フィールド削除テスト**: 買主番号7230の複数フィールド（内覧日、最新状況、次電日）を同時に削除 → GAS実行 → データベースの全フィールドに古い値が残る（修正前のコードで失敗）

**Expected Counterexamples**:
- `needsUpdate`フラグがfalseのままで、データベース更新がスキップされる
- 可能性のある原因: 比較ロジックの欠陥、null値の正規化不足、条件分岐の欠陥

### Fix Checking

**Goal**: バグ条件が成立する全ての入力に対して、修正後の関数が期待される動作を行うことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := syncUpdatesToSupabase_fixed(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全ての入力に対して、修正後の関数が元の関数と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncUpdatesToSupabase_original(input) = syncUpdatesToSupabase_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストは保全チェックに推奨されます。理由は以下の通りです：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動ユニットテストでは見逃す可能性のあるエッジケースを捕捉する
- 非バグ入力に対して動作が変わらないことを強力に保証する

**Test Plan**: 修正前のコードで新しい値を入力した場合の動作を観察し、その動作を捕捉するプロパティベーステストを作成する。

**Test Cases**:
1. **新しい値入力の保全**: スプレッドシートで空欄から値を入力 → 修正後のコードでも引き続き正しく同期される
2. **既存値変更の保全**: スプレッドシートで既存の値を別の値に変更 → 修正後のコードでも引き続き正しく同期される
3. **サイドバーカウント更新の保全**: `updateBuyerSidebarCounts_`関数が引き続き正しく動作する
4. **10分トリガーの保全**: 定期同期が引き続き正しく動作する

### Unit Tests

- 各フィールドの削除（null化）をテスト
- 各フィールドの新しい値入力をテスト
- 複数フィールドの同時削除をテスト
- エッジケース（空白文字列、undefined、null）をテスト

### Property-Based Tests

- ランダムな買主データを生成し、フィールド削除が正しく同期されることを検証
- ランダムな買主データを生成し、新しい値入力の動作が保持されることを検証
- 多くのシナリオで全ての非バグ入力が引き続き正しく動作することをテスト

### Integration Tests

- スプレッドシートからデータベースへの完全な同期フローをテスト
- GASの10分トリガーによる定期同期をテスト
- サイドバーカウント更新を含む完全な同期フローをテスト
