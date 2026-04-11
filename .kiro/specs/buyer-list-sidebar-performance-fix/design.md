# 買主リストサイドバーパフォーマンス修正 Bugfix Design

## Overview

買主リストページを開いた際、サイドバーのカテゴリー（ステータス別件数）が表示されるまでに約20秒かかるパフォーマンス問題。

**バグの本質**: `invalidateBuyerStatusCache()` 関数が買主データ更新のたびに `buyer_sidebar_counts` テーブルを全削除する。その結果、次回ページアクセス時に `getSidebarCounts()` がフォールバック計算（全件取得 + ステータス計算）を実行し、約20秒かかる。

**修正方針**: `invalidateBuyerStatusCache()` から `buyer_sidebar_counts` テーブルの全削除処理を除去し、代わりに `vercel.json` に買主サイドバーカウントの定期更新Cronジョブを追加する（売主と同様の仕組み）。

---

## Glossary

- **Bug_Condition (C)**: `buyer_sidebar_counts` テーブルが空の状態でサイドバーカウントAPIが呼ばれる条件
- **Property (P)**: サイドバーカウントAPIが5秒未満で応答すること
- **Preservation**: 既存のカテゴリー件数の正確性・フィルタリング動作・一覧表示機能が変わらないこと
- **getSidebarCounts()**: `backend/src/services/BuyerService.ts` の高速パス（テーブルから取得）とフォールバック（動的計算）を持つメソッド
- **getSidebarCountsFallback()**: 全買主データを取得してステータスを動的計算する重い処理（約20秒）
- **invalidateBuyerStatusCache()**: 買主データ更新時に呼ばれるキャッシュ無効化関数。現在は `buyer_sidebar_counts` テーブルも全削除している（これがバグの原因）
- **buyer_sidebar_counts**: サイドバーカウントを事前計算して保存するテーブル。このテーブルにデータがある場合は高速パスが使われる
- **Cronジョブ**: Vercelの定期実行機能。売主サイドバーは10分ごとに更新されているが、買主サイドバーは未設定

---

## Bug Details

### Bug Condition

`buyer_sidebar_counts` テーブルが空の状態でサイドバーカウントAPIが呼ばれると、`getSidebarCountsFallback()` が実行される。このフォールバック処理は全買主データの取得（ページネーション付き）と全件のステータス計算を行うため約20秒かかる。

テーブルが空になる原因は `invalidateBuyerStatusCache()` 関数にある。この関数は買主データ更新（`BuyerService.update()`）やスプレッドシート同期（`POST /buyers/sync`）のたびに呼ばれ、`buyer_sidebar_counts` テーブルを全削除する。

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request to GET /api/buyers/sidebar-counts
  OUTPUT: boolean

  tableIsEmpty := buyer_sidebar_counts テーブルの行数 = 0
  RETURN tableIsEmpty
END FUNCTION
```

### Examples

- **例1（バグあり）**: 買主詳細ページで次電日を更新 → `invalidateBuyerStatusCache()` が呼ばれ `buyer_sidebar_counts` が全削除 → 買主リストページを開く → `getSidebarCounts()` がフォールバック計算を実行 → 約20秒待機
- **例2（バグあり）**: スプレッドシートから同期ボタンを押す → `invalidateBuyerStatusCache()` が呼ばれ `buyer_sidebar_counts` が全削除 → 買主リストページを開く → 約20秒待機
- **例3（正常）**: `buyer_sidebar_counts` テーブルにデータがある状態でページを開く → テーブルから直接取得 → 300ms以内で表示
- **例4（エッジケース）**: 初回デプロイ直後（テーブルが空）→ フォールバック計算が実行される（これは許容範囲）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- サイドバーの各カテゴリー件数は正確に表示され続ける（`buyer_sidebar_counts` テーブルの値が正しく保たれる）
- 買主データが更新された後、サイドバーのカテゴリー件数に変更が反映され続ける（`SidebarCountsUpdateService` による差分更新は維持）
- ユーザーがサイドバーのカテゴリーをクリックしてフィルタリングする機能は正常に動作し続ける
- 買主リストページの一覧表示機能は正常に動作し続ける

**Scope:**
`buyer_sidebar_counts` テーブルの削除処理を除去するだけであり、以下は一切変更しない：
- `getSidebarCounts()` の高速パス・フォールバックロジック
- `SidebarCountsUpdateService.updateBuyerSidebarCounts()` による差分更新
- フロントエンドのサイドバー表示コンポーネント
- 買主一覧取得API

---

## Hypothesized Root Cause

コードの調査により、根本原因は以下の2点が重なっていることが判明した：

1. **`invalidateBuyerStatusCache()` による不必要なテーブル全削除**
   - `backend/src/services/BuyerService.ts` の `invalidateBuyerStatusCache()` 関数（Line 47）が `buyer_sidebar_counts` テーブルを全削除している
   - この関数は `BuyerService.update()` と `POST /buyers/sync` から呼ばれるため、買主データ更新のたびにテーブルが空になる
   - コメントに「次回アクセス時に動的計算を強制」とあり、意図的に追加された処理だが、フォールバック計算の重さを考慮していなかった

2. **買主サイドバーカウントのCronジョブが未設定**
   - `backend/vercel.json` に売主サイドバーカウントの更新Cronジョブ（`*/10 * * * *`）は設定されているが、買主用は存在しない
   - テーブルが空になった後、自動的に再構築する仕組みがない
   - 手動で `/api/buyers/update-sidebar-counts` を呼ぶか、フォールバック計算が完了するまで待つしかない

3. **フォールバック計算の処理時間**
   - `getSidebarCountsFallback()` は全買主データをページネーションで取得し、全件のステータス計算を実行する
   - 買主数が多い場合（数百〜数千件）、この処理に約20秒かかる
   - `property_listings` テーブルとの結合も並列実行されているが、それでも重い

---

## Correctness Properties

Property 1: Bug Condition - サイドバーカウントの高速応答

_For any_ リクエストで `buyer_sidebar_counts` テーブルが空の状態（isBugCondition が true）であっても、修正後の `getSidebarCounts()` は `buyer_sidebar_counts` テーブルにデータが存在する状態を維持することで、5秒未満で応答する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存機能の保持

_For any_ 買主データ更新操作（`BuyerService.update()` 呼び出し）において、修正後のコードは `SidebarCountsUpdateService` による差分更新を維持し、`buyer_sidebar_counts` テーブルのデータを削除せず、カテゴリー件数の正確性を保持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**変更1: `invalidateBuyerStatusCache()` から `buyer_sidebar_counts` テーブル削除処理を除去**

**File**: `backend/src/services/BuyerService.ts`

**Function**: `invalidateBuyerStatusCache()` (Line 47)

**Specific Changes**:
1. `buyer_sidebar_counts` テーブルを全削除するブロック（Line 55-76）を削除する
2. インメモリキャッシュ（`_moduleLevelStatusCache`）と買付率統計キャッシュのクリアは維持する
3. `SidebarCountsUpdateService` による差分更新は既に別途実行されているため、テーブル全削除は不要

**変更前のコード（削除する部分）**:
```typescript
// buyer_sidebar_countsテーブルをクリア（次回アクセス時に動的計算を強制）
try {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  const { error } = await supabase
    .from('buyer_sidebar_counts')
    .delete()
    .neq('category', '___never___'); // 全件削除
  
  if (error) {
    console.error('[BuyerService] Failed to clear buyer_sidebar_counts:', error);
  } else {
    console.log('[BuyerService] buyer_sidebar_counts table cleared - next access will recalculate');
  }
} catch (e) {
  console.error('[BuyerService] Error clearing buyer_sidebar_counts:', e);
}
```

**変更後のコード（この部分を削除するだけ）**:
```typescript
export async function invalidateBuyerStatusCache(): Promise<void> {
  _moduleLevelStatusCache = null;
  console.log('[BuyerService] Buyer status cache invalidated');
  
  // 買付率統計のキャッシュを無効化
  purchaseRateStatisticsCache.flushAll();
  console.log('[BuyerService] Purchase rate statistics cache invalidated');
  
  // ※ buyer_sidebar_counts テーブルは削除しない
  // SidebarCountsUpdateService が差分更新するため、全削除は不要
  // 全削除するとフォールバック計算（約20秒）が実行されてしまう
}
```

---

**変更2: 買主サイドバーカウントのCronジョブを追加**

**File**: `backend/vercel.json`

**Specific Changes**:
- `crons` 配列に買主サイドバーカウント更新のエントリを追加する
- 売主と同様に10分ごとに実行する

**変更後のコード**:
```json
{
  "crons": [
    {
      "path": "/api/sellers/sidebar-counts/update",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/buyers/update-sidebar-counts",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現してフォールバック計算が実行されることを確認し、次に修正後にテーブルが削除されないことと高速応答を確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `invalidateBuyerStatusCache()` が `buyer_sidebar_counts` テーブルを削除し、次回アクセス時にフォールバック計算が実行されることを確認する。

**Test Plan**: `invalidateBuyerStatusCache()` を呼び出した後に `getSidebarCounts()` を呼び出し、フォールバック計算が実行されることを確認する。未修正コードでこのテストを実行して失敗（5秒超過）を観察する。

**Test Cases**:
1. **テーブル削除確認テスト**: `invalidateBuyerStatusCache()` 呼び出し後に `buyer_sidebar_counts` テーブルが空になることを確認（未修正コードで PASS するはず）
2. **フォールバック実行確認テスト**: テーブルが空の状態で `getSidebarCounts()` を呼び出し、フォールバック計算が実行されることを確認（未修正コードで PASS するはず）
3. **応答時間テスト**: テーブルが空の状態での `getSidebarCounts()` の応答時間が5秒を超えることを確認（未修正コードで PASS するはず）

**Expected Counterexamples**:
- `invalidateBuyerStatusCache()` 呼び出し後、`buyer_sidebar_counts` テーブルが空になる
- テーブルが空の状態での `getSidebarCounts()` が5秒以上かかる

### Fix Checking

**Goal**: 修正後に `invalidateBuyerStatusCache()` が `buyer_sidebar_counts` テーブルを削除しないことを確認する。

**Pseudocode:**
```
FOR ALL call to invalidateBuyerStatusCache() DO
  tableCountBefore := COUNT(*) FROM buyer_sidebar_counts
  invalidateBuyerStatusCache()
  tableCountAfter := COUNT(*) FROM buyer_sidebar_counts
  ASSERT tableCountAfter = tableCountBefore  // テーブルが削除されていない
END FOR
```

### Preservation Checking

**Goal**: 修正後も `SidebarCountsUpdateService` による差分更新が正しく動作し、カテゴリー件数の正確性が保たれることを確認する。

**Pseudocode:**
```
FOR ALL buyer update operation DO
  ASSERT SidebarCountsUpdateService.updateBuyerSidebarCounts() is called
  ASSERT buyer_sidebar_counts table is NOT empty after update
  ASSERT getSidebarCounts() returns correct counts
END FOR
```

**Testing Approach**: 単体テストで `invalidateBuyerStatusCache()` の動作変更を確認し、統合テストで差分更新の正確性を確認する。

**Test Cases**:
1. **差分更新保持テスト**: 買主データ更新後に `SidebarCountsUpdateService` が呼ばれ、テーブルが正しく更新されることを確認
2. **カウント正確性テスト**: テーブルから取得したカウントとフォールバック計算のカウントが一致することを確認
3. **フィルタリング動作テスト**: サイドバーカテゴリーをクリックした際のフィルタリングが正しく動作することを確認

### Unit Tests

- `invalidateBuyerStatusCache()` が `buyer_sidebar_counts` テーブルを削除しないことを確認
- `getSidebarCounts()` がテーブルにデータがある場合に高速パスを使用することを確認
- `getSidebarCounts()` がテーブルが空の場合にフォールバックを使用することを確認（フォールバック自体は維持）

### Property-Based Tests

- 任意の買主データ更新後に `buyer_sidebar_counts` テーブルが空にならないことを確認
- テーブルにデータがある状態での `getSidebarCounts()` の応答時間が5秒未満であることを確認
- 任意のカテゴリーに対してテーブルから取得した件数とフォールバック計算の件数が一致することを確認

### Integration Tests

- 買主詳細ページで次電日を更新した後、買主リストページのサイドバーが5秒未満で表示されることを確認
- スプレッドシート同期後、買主リストページのサイドバーが5秒未満で表示されることを確認
- Cronジョブ（`/api/buyers/update-sidebar-counts`）が正常に実行され、テーブルが更新されることを確認
