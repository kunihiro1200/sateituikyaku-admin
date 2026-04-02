# 買主リスト「★エリア」フィールド同期問題 Bugfix Design

## Overview

買主リストスプレッドシートのT列「★エリア」フィールドがデータベースの`buyers.desired_area`カラムに同期されていない問題を修正する。この問題により、買主配信サービスがエリアベースマッチングを正しく実行できず、買主候補サービスがエリア条件でフィルタリングできない状態になっている。

修正アプローチは、GASの`syncUpdatesToSupabase_()`関数に`desired_area`フィールドの同期処理を追加し、既存の8つの同期フィールドと同様に扱うことで、スプレッドシートの値をデータベースに正しく反映させる。

## Glossary

- **Bug_Condition (C)**: スプレッドシートのT列「★エリア」に値が入力されているが、データベースの`buyers.desired_area`カラムの値と異なる状態
- **Property (P)**: GASの`syncBuyerList()`実行後、データベースの`desired_area`カラムがスプレッドシートの値と一致する状態
- **Preservation**: 既存の8つの同期フィールド（`latest_status`、`next_call_date`など）の動作、サイドバーカウント更新、追加同期・削除同期の動作が変更されないこと
- **syncBuyerList()**: GASのメイン同期関数（10分トリガー）
- **syncUpdatesToSupabase_()**: Supabase直接更新関数（Phase 2）
- **desired_area**: データベースの`buyers`テーブルのTEXT型カラム（希望エリア）
- **★エリア**: スプレッドシートのT列カラム名（希望エリア）

## Bug Details

### Bug Condition

買主リストスプレッドシートのT列「★エリア」に値が入力されている買主（例: 買主番号7272）について、GASの`syncBuyerList()`関数が10分ごとに実行されても、データベースの`buyers.desired_area`カラムに値が保存されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type BuyerSyncInput
  OUTPUT: boolean
  
  // input.spreadsheet_desired_area: スプレッドシートのT列「★エリア」の値
  // input.db_desired_area: データベースの buyers.desired_area カラムの値
  
  RETURN input.spreadsheet_desired_area IS NOT NULL 
         AND input.spreadsheet_desired_area != input.db_desired_area
END FUNCTION
```

### Examples

- **買主番号7272**: スプレッドシートのT列「★エリア」= "㊵㊶"、データベースの`desired_area` = NULL → バグ条件を満たす（期待: "㊵㊶"がDBに保存される、実際: NULLのまま）
- **買主番号7271**: スプレッドシートのT列「★エリア」= "㊵"、データベースの`desired_area` = NULL → バグ条件を満たす（期待: "㊵"がDBに保存される、実際: NULLのまま）
- **買主番号7270**: スプレッドシートのT列「★エリア」= "㊶"、データベースの`desired_area` = "㊶" → バグ条件を満たさない（既に同期済み）
- **買主番号7269**: スプレッドシートのT列「★エリア」= 空欄、データベースの`desired_area` = NULL → バグ条件を満たさない（両方とも空）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 既存の8つの同期フィールド（`latest_status`、`next_call_date`、`initial_assignee`、`follow_up_assignee`、`inquiry_email_phone`、`three_calls_confirmed`、`reception_date`、`distribution_type`）は引き続き正しく同期される
- サイドバーカウント更新（`updateBuyerSidebarCounts_()`関数）は正しく実行され、`buyer_sidebar_counts`テーブルが更新される
- Phase 1（追加同期）とPhase 3（削除同期）は正しく実行される

**Scope:**
`desired_area`フィールド以外の全ての同期処理は完全に変更されない。これには以下が含まれる:
- 既存の8つの同期フィールドの比較・更新ロジック
- `fetchAllBuyersFromSupabase_()`関数の動作
- `updateBuyerSidebarCounts_()`関数の動作
- Phase 1（追加同期）とPhase 3（削除同期）の動作

## Hypothesized Root Cause

bugfix.mdの分析に基づき、最も可能性が高い根本原因は以下の通り:

1. **同期対象フィールドの不足**: `gas_buyer_complete_code.js`の`syncUpdatesToSupabase_()`関数が、`desired_area`フィールドを同期対象に含めていない
   - 現在の同期対象は8つのフィールドのみ（`latest_status`、`next_call_date`、`initial_assignee`、`follow_up_assignee`、`inquiry_email_phone`、`three_calls_confirmed`、`reception_date`、`distribution_type`）
   - `desired_area`フィールドの同期処理が存在しない

2. **fetchAllBuyersFromSupabase_()のselect句不足**: `fetchAllBuyersFromSupabase_()`関数のselect句に`desired_area`フィールドが含まれていない可能性
   - DBから買主データを取得する際、`desired_area`カラムを取得していない
   - そのため、スプレッドシートの値と比較できない

3. **手動入力優先ロジックとの競合**: バックエンドの`EnhancedAutoSyncService.ts`が`desired_area`を`manualPriorityFields`配列に含めている
   - `db_updated_at > last_synced_at`の場合、スプレッドシートの値で上書きされない
   - しかし、GASの`syncUpdatesToSupabase_()`が`desired_area`を同期していないため、スプレッドシートの値がDBに反映されない

## Correctness Properties

Property 1: Bug Condition - desired_area フィールドの同期

_For any_ 買主について、スプレッドシートのT列「★エリア」に値が入力されており、データベースの`buyers.desired_area`カラムの値と異なる場合、修正後のGAS `syncBuyerList()`関数を実行すると、データベースの`desired_area`カラムがスプレッドシートの値と一致する状態になる。

**Validates: Requirements 2.1**

Property 2: Preservation - 既存同期フィールドの動作

_For any_ 買主について、既存の8つの同期フィールド（`latest_status`、`next_call_date`など）が更新される場合、修正後のGAS `syncBuyerList()`関数は、修正前と同じ動作でこれらのフィールドを同期し、サイドバーカウント更新、追加同期、削除同期も正しく実行される。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合、以下の変更が必要:

**File**: `gas_buyer_complete_code.js`

**Function**: `syncUpdatesToSupabase_()`

**Specific Changes**:
1. **desired_areaフィールドの同期処理を追加**: スプレッドシートのT列「★エリア」の値を取得し、データベースの`buyers.desired_area`カラムと比較
   - スプレッドシートから`row['★エリア']`を取得
   - データベースから`dbBuyer.desired_area`を取得
   - 値が異なる場合、`updateData.desired_area`に新しい値を設定
   - `needsUpdate = true`を設定

2. **fetchAllBuyersFromSupabase_()のselect句に追加**: `select`句に`desired_area`フィールドを追加
   - 現在のselect句に`desired_area`を追加
   - DBから買主データを取得する際、`desired_area`カラムも取得

3. **既存の同期処理を維持**: 既存の8つの同期フィールドの処理は変更しない
   - `latest_status`、`next_call_date`などの処理はそのまま維持
   - `updateBuyerSidebarCounts_()`関数の呼び出しもそのまま維持

4. **手動入力優先ロジックの維持**: バックエンドの`EnhancedAutoSyncService.ts`の`manualPriorityFields`配列は変更しない
   - `desired_area`が`manualPriorityFields`に含まれている状態を維持
   - DBで手動更新された`desired_area`がスプレッドシートの値で上書きされないようにする

5. **実装例**:
   ```javascript
   // gas_buyer_complete_code.js の syncUpdatesToSupabase_() 関数に追加
   var sheetDesiredArea = row['★エリア'] ? String(row['★エリア']) : null;
   var dbDesiredArea = dbBuyer.desired_area || null;
   if (sheetDesiredArea !== dbDesiredArea) { 
     updateData.desired_area = sheetDesiredArea; 
     needsUpdate = true; 
   }
   ```

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従う: まず、修正前のコードでバグを再現し、根本原因分析を確認する。次に、修正後のコードでバグが修正され、既存の動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は、再度根本原因を仮説立てする必要がある。

**Test Plan**: 買主番号7272のスプレッドシートデータ（T列「★エリア」= "㊵㊶"）を確認し、GASの`syncBuyerList()`を実行して、データベースの`desired_area`カラムがNULLのままであることを確認する。

**Test Cases**:
1. **買主番号7272のバグ再現**: スプレッドシートのT列「★エリア」= "㊵㊶"、データベースの`desired_area` = NULL → GAS実行後もNULLのまま（修正前のコードで失敗することを確認）
2. **買主番号7271のバグ再現**: スプレッドシートのT列「★エリア」= "㊵"、データベースの`desired_area` = NULL → GAS実行後もNULLのまま（修正前のコードで失敗することを確認）
3. **既存同期フィールドの動作確認**: スプレッドシートの「★最新状況」が変更された買主 → GAS実行後、`latest_status`が正しく更新される（修正前のコードで成功することを確認）
4. **空欄の場合の動作確認**: スプレッドシートのT列「★エリア」= 空欄、データベースの`desired_area` = NULL → GAS実行後もNULLのまま（期待通りの動作）

**Expected Counterexamples**:
- 買主番号7272と7271で、`desired_area`カラムがNULLのまま更新されない
- 可能性のある原因: `syncUpdatesToSupabase_()`に`desired_area`の同期処理が存在しない、`fetchAllBuyersFromSupabase_()`のselect句に`desired_area`が含まれていない

### Fix Checking

**Goal**: バグ条件を満たす全ての買主について、修正後のGAS `syncBuyerList()`関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := syncBuyerList_fixed(input)
  ASSERT result.db_desired_area = input.spreadsheet_desired_area
END FOR
```

### Preservation Checking

**Goal**: バグ条件を満たさない全ての買主について、修正後のGAS `syncBuyerList()`関数が修正前と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncBuyerList_original(input) = syncBuyerList_fixed(input)
END FOR
```

**Testing Approach**: Property-based testingは、保存チェックに推奨される。理由:
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動単体テストが見逃す可能性のあるエッジケースをキャッチする
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: まず、修正前のコードでマウスクリックやその他のインタラクションの動作を観察し、その後、その動作をキャプチャするproperty-based testを書く。

**Test Cases**:
1. **既存同期フィールドの保存**: 修正前のコードで「★最新状況」の更新が正しく動作することを観察し、修正後も同じ動作が継続することをテスト
2. **サイドバーカウント更新の保存**: 修正前のコードで`updateBuyerSidebarCounts_()`が正しく動作することを観察し、修正後も同じ動作が継続することをテスト
3. **追加同期・削除同期の保存**: 修正前のコードでPhase 1とPhase 3が正しく動作することを観察し、修正後も同じ動作が継続することをテスト
4. **空欄の場合の保存**: スプレッドシートのT列「★エリア」が空欄の買主について、修正前と修正後で同じ動作（NULLのまま）が継続することをテスト

### Unit Tests

- 買主番号7272のT列「★エリア」= "㊵㊶"の同期をテスト（修正後、DBに"㊵㊶"が保存される）
- 買主番号7271のT列「★エリア」= "㊵"の同期をテスト（修正後、DBに"㊵"が保存される）
- 既存の同期フィールド（`latest_status`など）が引き続き正しく同期されることをテスト
- T列「★エリア」が空欄の買主について、DBの`desired_area`がNULLのままであることをテスト

### Property-Based Tests

- ランダムな買主データを生成し、T列「★エリア」に値がある場合、修正後のGASが正しくDBに保存することを検証
- ランダムな買主データを生成し、既存の同期フィールドが引き続き正しく同期されることを検証
- 多くのシナリオで、非バグ入力（T列「★エリア」が空欄、または既に同期済み）に対して修正前と修正後で同じ動作が継続することをテスト

### Integration Tests

- GASの`syncBuyerList()`を実行し、買主番号7272のT列「★エリア」= "㊵㊶"がDBに保存されることをテスト
- GASの`syncBuyerList()`を実行し、既存の同期フィールドが引き続き正しく同期されることをテスト
- GASの`syncBuyerList()`を実行し、サイドバーカウント更新が正しく実行されることをテスト
