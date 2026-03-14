# 物件リスト・業務依頼 自動同期バグ修正 設計ドキュメント

## Overview

業務依頼（`WorkTaskSyncService`）の自動定期同期が `backend/src/index.ts` の `startServer()` にスケジュールされていないバグを修正する。

物件リストについては、`EnhancedPeriodicSyncManager` の `runFullSync()` 内で Phase 4.5（更新同期）・Phase 4.6（新規追加同期）・Phase 4.7（property_details同期）として**既に実装されている**ため、追加対応は不要。

業務依頼については、`EnhancedAutoSyncService.ts` の Phase 4 に `// Note: Work task sync is handled elsewhere` とコメントされているが、実際には `WorkTaskSyncService` の定期実行はどこにも登録されていない。`WorkTaskSyncService` は `syncAll()` メソッドを持ち、手動同期エンドポイントも動作しているが、サーバー起動時の定期実行スケジューリングが抜けている。

共有（`SharedItemsService`）はスプレッドシートを直接読み取る設計のためDB同期自体が存在せず、現状維持が適切。

修正は `startServer()` 内に `WorkTaskSyncService` の `setTimeout` + `setInterval` パターンを追加するだけで完結する。ただし、`WorkTaskSyncService` には `isSyncInProgress()` メソッドが存在しないため、重複防止のためにこのメソッドも追加する。

---

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — サーバーが起動しているが、業務依頼の定期同期がスケジュールされていない状態
- **Property (P)**: 期待される正しい動作 — サーバー起動後、業務依頼の定期同期が自動的に開始される
- **Preservation**: 修正によって変更してはいけない既存の動作 — 手動同期、売主・買主・物件リスト同期、共有の直接読み取り
- **WorkTaskSyncService**: `backend/src/services/WorkTaskSyncService.ts` に定義されたクラス。`syncAll()` で業務依頼データをスプレッドシートからDBに同期する。`isSyncInProgress()` は未実装のため追加が必要
- **EnhancedPeriodicSyncManager**: `backend/src/services/EnhancedAutoSyncService.ts` に定義された売主リスト用の定期同期マネージャー。Phase 4.5/4.6/4.7 で物件リスト同期も担当している
- **startServer()**: `backend/src/index.ts` に定義されたサーバー起動関数。売主（10秒後）・買主（20秒後）の定期同期はここでスケジュールされている

---

## Bug Details

### Bug Condition

`startServer()` 内で `WorkTaskSyncService` の定期実行がスケジュールされていない。`EnhancedAutoSyncService.ts` の Phase 4 に `// Note: Work task sync is handled elsewhere` とコメントされているが、実際には `startServer()` にも他のどこにも業務依頼の定期同期スケジューラーが存在しない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ServerState
  OUTPUT: boolean

  RETURN input.serverStarted = true
         AND input.sellerPeriodicSyncScheduled = true
         AND input.buyerPeriodicSyncScheduled = true
         AND input.propertyListingPeriodicSyncScheduled = true  // EnhancedPeriodicSyncManager Phase 4.5/4.6/4.7 で対応済み
         AND input.workTaskPeriodicSyncScheduled = false        // ← バグ：未スケジュール
END FUNCTION
```

### Examples

- サーバー起動後、スプレッドシートで業務依頼の「担当者」を更新しても、DBには反映されない（手動同期ボタンを押すまで古いデータが表示される）
- サーバー起動後、スプレッドシートで業務依頼の「ステータス」を更新しても、DBには反映されない
- 売主・買主・物件リストは定期自動同期されるが、業務依頼は同期されない（非対称な動作）
- エッジケース: 同期中に別の同期リクエストが来た場合、重複防止が機能しない（`isSyncInProgress()` が未実装）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- UIの手動同期ボタンによる業務依頼の手動同期が引き続き正常に動作する
- `EnhancedPeriodicSyncManager` による売主リスト・物件リストの自動定期同期が引き続き正常に起動する
- `BuyerSyncService` による買主リストの自動定期同期が引き続き正常に起動する
- `SharedItemsService` によるスプレッドシート直接読み取りが引き続き正常に機能する
- 各同期処理は独立して動作し、互いに影響を与えない

**Scope:**
業務依頼の定期同期スケジューラーを追加し、`WorkTaskSyncService` に `isSyncInProgress()` メソッドを追加するだけであり、既存の手動同期ロジック・売主・買主・物件リスト同期ロジックは一切変更しない。

---

## Hypothesized Root Cause

`backend/src/index.ts` の `startServer()` 内に、業務依頼の定期同期を起動するコードが実装されていない。

`EnhancedAutoSyncService.ts` の Phase 4 に以下のコメントがある：

```typescript
// Phase 4: 作業タスク同期（既存）
console.log('\n📋 Phase 4: Work Task Sync');
// Note: Work task sync is handled elsewhere
console.log('✅ Work task sync (handled by existing service)');
```

「handled elsewhere」と書かれているが、実際には `startServer()` にも他のどこにも業務依頼の定期同期スケジューラーが存在しない。実装が抜けたまま「別の場所で処理される」というコメントだけが残っている状態。

加えて、`WorkTaskSyncService` には `isSyncInProgress()` メソッドが存在しないため、重複防止のためにこのメソッドも追加する必要がある。

---

## Correctness Properties

Property 1: Bug Condition - 業務依頼定期同期の自動起動

_For any_ サーバー起動イベントにおいて、`startServer()` が実行された後、業務依頼の定期同期スケジューラーが起動され、`WorkTaskSyncService.syncAll()` が定期的に呼び出される。

**Validates: Requirements 2.2, 2.4, 2.5**

Property 2: Preservation - 手動同期・既存定期同期・共有の維持

_For any_ 入力において、業務依頼の定期同期スケジューラー追加後も、手動同期エンドポイント、売主・物件リストの定期同期（`EnhancedPeriodicSyncManager`）、買主リストの定期同期（`BuyerSyncService`）、および共有の直接読み取りが修正前と同一の動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Changes Required

#### 変更1: `WorkTaskSyncService` に `isSyncInProgress()` を追加

**File**: `backend/src/services/WorkTaskSyncService.ts`

`BuyerSyncService` と同様のパターンで `isSyncing` フラグと `isSyncInProgress()` メソッドを追加し、`syncAll()` 実行中はフラグを立てる。

```typescript
export class WorkTaskSyncService {
  private supabase: SupabaseClient;
  private columnMapper: WorkTaskColumnMapper;
  private sheets: sheets_v4.Sheets | null = null;
  private isSyncing: boolean = false; // 追加

  isSyncInProgress(): boolean { // 追加
    return this.isSyncing;
  }

  async syncAll(): Promise<SyncResult> {
    this.isSyncing = true; // 追加
    try {
      // ... 既存の実装 ...
    } finally {
      this.isSyncing = false; // 追加（エラー時も必ずリセット）
    }
  }
}
```

#### 変更2: `startServer()` に業務依頼の定期同期スケジューラーを追加

**File**: `backend/src/index.ts`

**Function**: `startServer()`

買主リストの定期同期スケジューラー（20秒後）の直後に、業務依頼（40秒後）のスケジューラーを追加する。30秒は録音クリーンアップが使用しているため40秒とする。

```typescript
// 業務依頼定期同期を非同期で実行（サーバー起動をブロックしない）
setTimeout(async () => {
  try {
    const { WorkTaskSyncService } = await import('./services/WorkTaskSyncService');
    const workTaskSyncService = new WorkTaskSyncService();
    const intervalMinutes = parseInt(process.env.WORK_TASK_SYNC_INTERVAL_MINUTES || '10', 10);

    const runWorkTaskSync = async () => {
      if (workTaskSyncService.isSyncInProgress()) {
        console.log('⚠️ Work task sync already in progress, skipping scheduled run');
        return;
      }
      try {
        await workTaskSyncService.syncAll();
        console.log('✅ Work task periodic sync completed');
      } catch (error: any) {
        console.error('⚠️ Work task periodic sync error (non-blocking):', error.message);
      }
    };

    await runWorkTaskSync();
    setInterval(runWorkTaskSync, intervalMinutes * 60 * 1000);
    console.log(`📋 Work task periodic sync started (every ${intervalMinutes} minutes)`);
  } catch (error: any) {
    console.error('⚠️ Work task periodic sync failed to start (non-blocking):', error.message);
  }
}, 40000); // 40秒後に実行（買主同期の20秒後、クォータ分散）
```

**追加する環境変数（オプション）:**
- `WORK_TASK_SYNC_INTERVAL_MINUTES`: 業務依頼同期間隔（デフォルト: 10分）

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後の動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `startServer()` が業務依頼の定期同期をスケジュールしないことを確認する。

**Test Plan**: `backend/src/index.ts` のソースコードを静的解析して、`WorkTaskSyncService` の定期実行スケジューラーが存在しないことを確認する。

**Test Cases**:
1. **業務依頼定期同期の不在確認**: `startServer()` のソースに `WorkTaskSyncService` の `setInterval` が存在しないことを確認（未修正コードで失敗するはず）
2. **売主・買主・物件リスト同期との非対称性確認**: `EnhancedPeriodicSyncManager` と `BuyerSyncService` は存在するが、業務依頼の同等処理は存在しないことを確認

**Expected Counterexamples**:
- `WorkTaskSyncService` の定期実行コードが `startServer()` に存在しない
- 原因: `startServer()` 内に業務依頼の定期同期スケジューラーが実装されていない（Phase 4 の「handled elsewhere」コメントは誤り）

### Fix Checking

**Goal**: 修正後、サーバー起動時に業務依頼の定期同期が自動的に開始されることを確認する。

**Pseudocode:**
```
FOR ALL serverStartEvent WHERE isBugCondition(serverStartEvent) DO
  result := startServer_fixed()
  ASSERT workTaskPeriodicSyncScheduled(result) = true
  ASSERT workTaskSyncService.syncAll() called periodically
END FOR
```

### Preservation Checking

**Goal**: 修正後も手動同期・売主・買主・物件リスト同期・共有が変更前と同一の動作を維持することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT sellerSync_original(input) = sellerSync_fixed(input)
  ASSERT buyerSync_original(input) = buyerSync_fixed(input)
  ASSERT propertyListingSync_original(input) = propertyListingSync_fixed(input)
  ASSERT manualSync_original(input) = manualSync_fixed(input)
  ASSERT sharedItemsRead_original(input) = sharedItemsRead_fixed(input)
END FOR
```

**Testing Approach**: 手動同期エンドポイントと既存の定期同期ロジックは変更しないため、既存のテストがそのまま通ることを確認する。

**Test Cases**:
1. **売主同期の保持**: `EnhancedPeriodicSyncManager` の起動コードが引き続き存在することを確認
2. **買主同期の保持**: `BuyerSyncService` の起動コードが引き続き存在することを確認
3. **重複防止の保持**: `isSyncInProgress()` チェックが業務依頼の定期同期コードに含まれることを確認

### Unit Tests

- `startServer()` 実行後に業務依頼の定期同期がスケジュールされることを確認（ソース静的解析）
- `WorkTaskSyncService.isSyncInProgress()` が `true` の場合、定期同期がスキップされることを確認
- 定期同期中にエラーが発生しても、次回スケジュールが継続されることを確認

### Property-Based Tests

- 任意の `WORK_TASK_SYNC_INTERVAL_MINUTES` 設定（1〜60分）に対して、スケジューラーが正しい間隔で動作することを確認
- 任意のタイミングで手動同期と定期同期が重複した場合、常に重複防止が機能することを確認（`isSyncInProgress()` が `true` ならスキップ）

### Integration Tests

- サーバー起動後、実際に `WorkTaskSyncService.syncAll()` が呼ばれることを確認
- 売主・買主・物件リスト・業務依頼の定期同期が独立して動作することを確認
- 手動同期エンドポイントが修正後も正常に動作することを確認
