# サイドバーカウント即時反映 Bugfix Design

## Overview

買主リストおよび売主リストにおいて、ブラウザUIからデータベースを更新した際、サイドバーカテゴリーのカウントが即座に反映されない問題を修正します。

現在、サイドバーカウントは`buyer_sidebar_counts`テーブル（買主）と`seller_sidebar_counts`テーブル（売主）に保存され、GASが10分ごとに更新しています。そのため、ブラウザUIからデータベースを直接更新しても、GASの次回同期（最大10分後）まで反映されません。

この問題を解決するため、データベース更新時にサイドバーカウントテーブルを即座に更新する仕組みを実装します。

## Glossary

- **Bug_Condition (C)**: ブラウザUIからデータベースを更新した際、サイドバーカウントが即座に反映されない状態
- **Property (P)**: データベース更新後、サイドバーカウントが即座に更新され、UIに反映される状態
- **Preservation**: GASの10分同期が正しく動作し続けること
- **`buyer_sidebar_counts`**: 買主リストのサイドバーカウントを保存するテーブル
- **`seller_sidebar_counts`**: 売主リストのサイドバーカウントを保存するテーブル
- **`BuyerService`**: 買主データのCRUD操作を行うサービス（`backend/src/services/BuyerService.ts`）
- **`SellerService`**: 売主データのCRUD操作を行うサービス（`backend/src/services/SellerService.supabase.ts`）

## Bug Details

### Bug Condition

ブラウザUIから買主または売主のデータを更新した際、以下の条件が揃うとバグが発生します：

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { updateType: 'buyer' | 'seller', field: string, value: any }
  OUTPUT: boolean
  
  RETURN (input.updateType == 'buyer' AND input.field IN ['next_call_date', 'follow_up_assignee', 'viewing_date', 'notification_sender'])
         OR (input.updateType == 'seller' AND input.field IN ['next_call_date', 'visit_assignee', 'visit_date', 'status'])
         AND sidebarCountsNotUpdatedImmediately()
END FUNCTION
```

### Examples

**買主の例**:
- 買主番号5641の「次電日」を今日に設定 → データベースには保存されるが、サイドバーの「当日TEL」カテゴリーには反映されない（GASの10分同期を待つ必要がある）
- 買主番号7187の「内覧日」を明日に設定 → データベースには保存されるが、サイドバーの「内覧日前日」カテゴリーには反映されない

**売主の例**:
- 売主番号AA13501の「次電日」を今日に設定 → データベースには保存されるが、サイドバーの「当日TEL分」カテゴリーには反映されない
- 売主番号AA13729の「訪問日」を明日に設定 → データベースには保存されるが、サイドバーの「訪問日前日」カテゴリーには反映されない

**Edge Case**:
- 複数のユーザーが同時にデータを更新 → 各ユーザーのサイドバーカウントが正しく更新される（競合が発生しない）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- GASの10分同期が正しく動作し、サイドバーカウントが定期的に更新される
- サイドバーカテゴリーをクリックすると、該当する買主/売主の一覧が正しく表示される
- ページをリロードすると、サイドバーカウントが正しく表示される

**Scope:**
GASの10分同期に関連する全ての処理は、この修正の影響を受けません。既存の同期ロジックは変更せず、追加の即時更新ロジックのみを実装します。

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **サイドバーカウントテーブルの更新タイミング**: `buyer_sidebar_counts`および`seller_sidebar_counts`テーブルは、GASの10分同期でのみ更新されている。ブラウザUIからのデータベース更新時には、これらのテーブルが更新されない。

2. **サービス層の更新処理**: `BuyerService.update()`および`SellerService.updateSeller()`メソッドは、データベースの`buyers`/`sellers`テーブルのみを更新し、サイドバーカウントテーブルを更新していない。

3. **キャッシュ無効化の不足**: サイドバーカウントのキャッシュ（Redis）が無効化されていないため、古いカウントが表示され続ける可能性がある。

4. **フロントエンドのキャッシュ**: フロントエンドがサイドバーカウントをキャッシュしている場合、データベース更新後にキャッシュが無効化されない。

## Correctness Properties

Property 1: Bug Condition - サイドバーカウント即時反映

_For any_ データベース更新（買主または売主）において、サイドバーカテゴリーに影響するフィールド（`next_call_date`, `visit_assignee`, `viewing_date`等）が変更された場合、更新後に`buyer_sidebar_counts`または`seller_sidebar_counts`テーブルが即座に更新され、フロントエンドのサイドバーUIに反映される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - GAS同期の維持

_For any_ GASの10分同期実行において、サイドバーカウントテーブルが正しく更新され、既存の動作が保持される。即時更新ロジックとGAS同期が競合せず、両方が正しく動作する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

#### 1. サイドバーカウント更新サービスの作成

**File**: `backend/src/services/SidebarCountsUpdateService.ts`（新規作成）

**Purpose**: サイドバーカウントテーブルを即座に更新するサービス

**Specific Changes**:
1. **買主サイドバーカウント更新メソッド**: `updateBuyerSidebarCounts(buyerId: string)`
   - 買主データを取得
   - 各カテゴリー条件をチェック（`todayCall`, `viewingDayBefore`, `assigned:xxx`, `todayCallAssigned:xxx`）
   - `buyer_sidebar_counts`テーブルを更新（増減のみ、全件再計算は不要）
   - Redisキャッシュを無効化

2. **売主サイドバーカウント更新メソッド**: `updateSellerSidebarCounts(sellerId: string)`
   - 売主データを取得
   - 各カテゴリー条件をチェック（`todayCall`, `visitDayBefore`, `visitCompleted`, `assigned:xxx`, `todayCallAssigned:xxx`）
   - `seller_sidebar_counts`テーブルを更新（増減のみ、全件再計算は不要）
   - Redisキャッシュを無効化

3. **差分更新ロジック**: 更新前後のカテゴリー所属を比較し、増減のみを反映
   - 例: 買主が「当日TEL」から「担当(Y)」に移動した場合、`todayCall`を-1、`assigned:Y`を+1

#### 2. BuyerServiceの更新

**File**: `backend/src/services/BuyerService.ts`

**Function**: `update(id: string, updateData: Partial<any>, userId?: string, userEmail?: string)`

**Specific Changes**:
1. **サイドバーカウント更新の追加**: データベース更新後、`SidebarCountsUpdateService.updateBuyerSidebarCounts(id)`を呼び出す
2. **非同期実行**: サイドバーカウント更新はレスポンスをブロックしない（`await`なし、エラーハンドリングのみ）
3. **条件付き実行**: サイドバーカテゴリーに影響するフィールドが更新された場合のみ実行

**Implementation**:
```typescript
// データベース更新後
const { data, error } = await this.supabase
  .from('buyers')
  .update(allowedData)
  .eq('buyer_number', buyerNumber)
  .select()
  .single();

// サイドバーカウント更新（非同期、ノンブロッキング）
if (this.shouldUpdateSidebarCounts(allowedData)) {
  SidebarCountsUpdateService.updateBuyerSidebarCounts(buyerNumber).catch(err => {
    console.error('⚠️ Failed to update buyer sidebar counts:', err);
  });
}
```

#### 3. SellerServiceの更新

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `updateSeller(sellerId: string, data: UpdateSellerRequest)`

**Specific Changes**:
1. **サイドバーカウント更新の追加**: データベース更新後、`SidebarCountsUpdateService.updateSellerSidebarCounts(sellerId)`を呼び出す
2. **非同期実行**: サイドバーカウント更新はレスポンスをブロックしない（`await`なし、エラーハンドリングのみ）
3. **条件付き実行**: サイドバーカテゴリーに影響するフィールドが更新された場合のみ実行

**Implementation**:
```typescript
// データベース更新後
const { data: seller, error } = await this.table('sellers')
  .update(updates)
  .eq('id', sellerId)
  .select()
  .single();

// サイドバーカウント更新（非同期、ノンブロッキング）
if (this.shouldUpdateSidebarCounts(updates)) {
  SidebarCountsUpdateService.updateSellerSidebarCounts(sellerId).catch(err => {
    console.error('⚠️ Failed to update seller sidebar counts:', err);
  });
}
```

#### 4. キャッシュ無効化の追加

**File**: `backend/src/services/SidebarCountsUpdateService.ts`

**Specific Changes**:
1. **Redisキャッシュ無効化**: `CacheHelper.del('buyers:sidebar-counts')`および`CacheHelper.del('sellers:sidebar-counts')`を呼び出す
2. **インメモリキャッシュ無効化**: フロントエンドのキャッシュを無効化するため、レスポンスヘッダーに`Cache-Control: no-cache`を追加（オプション）

#### 5. GAS同期との整合性確保

**File**: `gas_complete_code.js`（売主用）、`gas_buyer_complete_code.js`（買主用）

**Specific Changes**:
1. **競合回避**: GAS同期時に`updated_at`タイムスタンプをチェックし、即時更新が最近行われた場合はスキップ（オプション）
2. **全件再計算**: GAS同期は引き続き全件再計算を行い、即時更新の誤差を修正

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that update buyer/seller data via API and check if sidebar counts are updated immediately. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **買主「次電日」更新テスト**: 買主5641の「次電日」を今日に設定 → サイドバーの「当日TEL」カウントが即座に+1されるか確認（will fail on unfixed code）
2. **売主「訪問日」更新テスト**: 売主AA13729の「訪問日」を明日に設定 → サイドバーの「訪問日前日」カウントが即座に+1されるか確認（will fail on unfixed code）
3. **買主「担当」更新テスト**: 買主7187の「後続担当」を"Y"に設定 → サイドバーの「担当(Y)」カウントが即座に+1されるか確認（will fail on unfixed code）
4. **複数ユーザー同時更新テスト**: 2人のユーザーが同時に異なる買主を更新 → 両方のサイドバーカウントが正しく更新されるか確認（may fail on unfixed code）

**Expected Counterexamples**:
- サイドバーカウントが更新されない（GASの10分同期を待つ必要がある）
- Possible causes: サイドバーカウントテーブルが更新されていない、キャッシュが無効化されていない

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := updateBuyerOrSeller_fixed(input)
  ASSERT sidebarCountsUpdatedImmediately(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateBuyerOrSeller_original(input) = updateBuyerOrSeller_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for GAS sync and sidebar display, then write property-based tests capturing that behavior.

**Test Cases**:
1. **GAS同期保持テスト**: GASの10分同期を実行 → サイドバーカウントが正しく更新されることを確認
2. **サイドバー表示保持テスト**: サイドバーカテゴリーをクリック → 該当する買主/売主の一覧が正しく表示されることを確認
3. **ページリロード保持テスト**: ページをリロード → サイドバーカウントが正しく表示されることを確認

### Unit Tests

- データベース更新時にサイドバーカウントテーブルが更新されることをテスト
- 各カテゴリー条件（`todayCall`, `visitDayBefore`等）が正しく判定されることをテスト
- キャッシュが無効化されることをテスト

### Property-Based Tests

- ランダムな買主/売主データを生成し、サイドバーカウントが正しく更新されることを検証
- ランダムな更新パターンを生成し、GAS同期との整合性を検証
- 複数ユーザーの同時更新をシミュレートし、競合が発生しないことを検証

### Integration Tests

- ブラウザUIから買主/売主を更新 → サイドバーカウントが即座に反映されることを確認
- GASの10分同期を実行 → サイドバーカウントが正しく維持されることを確認
- 複数のユーザーが同時にデータを更新 → 各ユーザーのサイドバーカウントが正しく更新されることを確認
