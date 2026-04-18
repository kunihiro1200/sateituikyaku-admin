# 買主詳細画面削除後サイドバー即時同期 Bugfix Design

## Overview

買主詳細画面の削除ボタンで買主をDBから削除した後、`BuyersPage` のサイドバーカテゴリーが即座に更新されないバグ。

`BuyerDetailPage.handleDeleteBuyer` は削除API呼び出し後に `navigate('/buyers')` するだけで、`pageDataCache` の `BUYERS_WITH_STATUS` キャッシュを無効化しない。そのため `BuyersPage` に戻った際にキャッシュが有効なまま残り、削除済みの買主がサイドバーに表示され続ける。

修正方針は最小限：削除成功後に `pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS)` を呼び出してキャッシュを無効化し、`BuyersPage` が再マウント時に最新データを取得するようにする。

## Glossary

- **Bug_Condition (C)**: 買主詳細画面の削除ボタンで買主を削除した直後にサイドバーが更新されない条件
- **Property (P)**: 削除後に `BuyersPage` へ遷移した際、削除済み買主がサイドバーに表示されないこと
- **Preservation**: 削除以外の操作（閲覧・編集・再読み込み）でサイドバー表示が変化しないこと
- **handleDeleteBuyer**: `BuyerDetailPage.tsx` 内の削除処理関数。削除API呼び出し後に `/buyers` へ遷移する
- **pageDataCache**: `frontend/frontend/src/store/pageDataCache.ts` のシングルトンキャッシュ。`BUYERS_WITH_STATUS` キーでサイドバーカウントと全買主データを保持する
- **BUYERS_WITH_STATUS**: `pageDataCache` のキャッシュキー。`BuyersPage` がサイドバーカウントと全買主データを10分間キャッシュするために使用する
- **sidebarLoadedRef**: `BuyersPage` 内のフラグ。`true` の場合はAPIを呼ばずキャッシュからサイドバーを表示する

## Bug Details

### Bug Condition

削除ボタンを押して買主が正常にDBから削除された後、`handleDeleteBuyer` が `pageDataCache` を無効化せずに `navigate('/buyers')` する。`BuyersPage` は再マウント時に `pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)` がヒットするため、古いキャッシュデータでサイドバーを表示する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: string, buyerNumber: string }
  OUTPUT: boolean

  RETURN input.action === 'delete'
         AND buyerExistsInCache(input.buyerNumber, CACHE_KEYS.BUYERS_WITH_STATUS)
         AND NOT cacheInvalidatedBeforeNavigation()
END FUNCTION
```

### Examples

- 買主番号 AA1234 を詳細画面から削除 → `/buyers` に遷移 → サイドバーに AA1234 が残る（バグ）
- 削除後にブラウザをリロード → サイドバーが最新状態に更新される（キャッシュが消えるため正常）
- 削除後にサイドバーの残存 AA1234 をクリック → 「データなし」と表示される（バグの二次症状）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 買主を削除せずに詳細画面を閲覧した場合、サイドバーカテゴリーの表示は変化しない
- 買主の情報を編集・保存した（削除ではない）場合、既存のサイドバー更新ロジックを通じてカテゴリーが正しく反映される
- 削除されていない買主をサイドバーからクリックした場合、該当買主の詳細画面が正常に表示される
- 買主リストページを再読み込みした場合、最新のDB状態を反映したサイドバーカテゴリーが表示される

**Scope:**
削除操作以外のすべての操作（閲覧・編集・ページ遷移・再読み込み）は、このバグ修正によって影響を受けない。

## Hypothesized Root Cause

1. **キャッシュ無効化の欠落**: `handleDeleteBuyer` が削除API成功後に `pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS)` を呼び出していない
   - `BuyersPage.handleSync` では同様の処理が正しく実装されている（参考実装あり）
   - `BuyerDetailPage` は `pageDataCache` をインポートしていない

2. **sidebarLoadedRef のリセット欠落**: `BuyersPage` は `sidebarLoadedRef.current === true` かつキャッシュヒット時にAPIを呼ばない。キャッシュが残ったまま遷移するとサイドバーが再取得されない

3. **navigate のみの遷移**: `navigate('/buyers')` は `BuyersPage` を再マウントするが、キャッシュが有効な場合は `sidebarLoadedRef` が `true` のままなのでサイドバーAPIが呼ばれない

## Correctness Properties

Property 1: Bug Condition - 削除後サイドバー即時更新

_For any_ 買主削除操作（`isBugCondition` が true を返す入力）において、修正後の `handleDeleteBuyer` は `pageDataCache` の `BUYERS_WITH_STATUS` キャッシュを無効化してから `/buyers` へ遷移し、`BuyersPage` が最新のサイドバーデータを取得して削除済み買主を表示しないこと。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非削除操作のサイドバー不変性

_For any_ 削除操作以外の操作（閲覧・編集・再読み込み・削除されていない買主のクリック）において、修正後のコードは元のコードと同一の動作を保ち、サイドバーカテゴリーの表示・カウント・遷移動作が変化しないこと。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Function**: `handleDeleteBuyer`

**Specific Changes**:

1. **インポート追加**: `pageDataCache` と `CACHE_KEYS` を `../store/pageDataCache` からインポートする

2. **キャッシュ無効化**: 削除API成功後、`navigate('/buyers')` の前に以下を追加する
   ```typescript
   pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS);
   ```

3. **変更後のhandleDeleteBuyer**:
   ```typescript
   const handleDeleteBuyer = async () => {
     if (!buyer?.buyer_number) return;
     setDeleting(true);
     try {
       await api.delete(`/api/buyers/${buyer.buyer_number}/permanent`);
       setDeleteDialogOpen(false);
       // キャッシュを無効化してサイドバーを即時更新
       pageDataCache.invalidate(CACHE_KEYS.BUYERS_WITH_STATUS);
       navigate('/buyers');
     } catch (err) {
       console.error('Delete buyer error:', err);
       setSnackbar({
         open: true,
         message: '削除に失敗しました',
         severity: 'error',
       });
     } finally {
       setDeleting(false);
     }
   };
   ```

変更は2箇所のみ（インポート追加 + 1行追加）で、既存ロジックへの影響は最小限。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後のコードで正しい動作とリグレッションがないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因（キャッシュ無効化の欠落）を確認する。

**Test Plan**: `handleDeleteBuyer` を呼び出した後、`pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)` がまだ有効なキャッシュを返すことを確認する。

**Test Cases**:
1. **削除後キャッシュ残存テスト**: `pageDataCache` に `BUYERS_WITH_STATUS` データをセットした状態で `handleDeleteBuyer` を呼び出し、削除後もキャッシュが残っていることを確認（未修正コードで失敗するはず）
2. **サイドバー古いデータ表示テスト**: 削除後に `BuyersPage` に遷移した際、削除済み買主がサイドバーカウントに含まれていることを確認（未修正コードで失敗するはず）

**Expected Counterexamples**:
- 削除後に `pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)` が `null` ではなく古いデータを返す
- 原因: `handleDeleteBuyer` が `pageDataCache.invalidate` を呼び出していない

### Fix Checking

**Goal**: 修正後のコードで、削除操作時にキャッシュが無効化されることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleDeleteBuyer_fixed(input)
  ASSERT pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS) === null
  ASSERT navigate called with '/buyers'
END FOR
```

### Preservation Checking

**Goal**: 削除以外の操作でキャッシュが変化しないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  cacheBefore := pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)
  handleOperation_fixed(input)
  cacheAfter := pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)
  ASSERT cacheBefore === cacheAfter
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。削除以外の操作（閲覧・編集・保存）を多数生成し、キャッシュが変化しないことを確認する。

**Test Cases**:
1. **閲覧操作保持テスト**: 詳細画面を閲覧するだけではキャッシュが変化しないことを確認
2. **編集・保存操作保持テスト**: 買主情報を編集・保存してもキャッシュが変化しないことを確認
3. **削除キャンセル保持テスト**: 削除ダイアログを開いてキャンセルした場合、キャッシュが変化しないことを確認

### Unit Tests

- `handleDeleteBuyer` 呼び出し後に `pageDataCache.get(CACHE_KEYS.BUYERS_WITH_STATUS)` が `null` を返すことを確認
- 削除API失敗時にキャッシュが変化しないことを確認
- 削除成功後に `navigate('/buyers')` が呼ばれることを確認

### Property-Based Tests

- ランダムな買主番号で削除操作を実行し、常にキャッシュが無効化されることを確認
- 削除以外のランダムな操作（閲覧・編集）でキャッシュが変化しないことを確認
- 複数の削除操作を連続実行した場合でも、各削除後にキャッシュが無効化されることを確認

### Integration Tests

- 買主詳細画面から削除 → `/buyers` 遷移 → サイドバーに削除済み買主が表示されないことを確認
- 削除後のサイドバーカウントが正しく減算されていることを確認
- 削除されていない買主をサイドバーからクリックした場合、詳細画面が正常に表示されることを確認
