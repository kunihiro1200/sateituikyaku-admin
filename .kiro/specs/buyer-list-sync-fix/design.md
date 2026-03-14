# 買主リスト自動同期バグ修正 設計ドキュメント

## Overview

買主リストの自動定期同期が実装されていないバグを修正する。

売主リストには `EnhancedPeriodicSyncManager` による自動定期同期（10分ごと）が `backend/src/index.ts` の `startServer()` 内でスケジュールされているが、買主リストには同等の仕組みがない。`BuyerSyncService` は存在し、手動同期エンドポイント（`POST /api/buyers/sync`）も動作しているが、サーバー起動時に定期実行がスケジュールされていない。

修正は `backend/src/index.ts` の `startServer()` 内に、売主リストの定期同期と同様のパターンで買主リストの定期同期スケジューラーを追加するだけで完結する。

---

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — サーバーが起動しているが、買主リストの定期同期がスケジュールされていない状態
- **Property (P)**: 期待される正しい動作 — サーバー起動後、買主リストの定期同期が自動的に開始される
- **Preservation**: 修正によって変更してはいけない既存の動作 — 手動同期、重複防止、売主リスト同期
- **BuyerSyncService**: `backend/src/services/BuyerSyncService.ts` に定義されたクラス。`syncAll()` で全買主データをスプレッドシートからDBに同期し、`isSyncInProgress()` で重複防止を行う
- **EnhancedPeriodicSyncManager**: `backend/src/services/EnhancedAutoSyncService.ts` に定義された売主リスト用の定期同期マネージャー。`start()` で定期実行を開始する
- **startServer()**: `backend/src/index.ts` に定義されたサーバー起動関数。売主リストの定期同期はここでスケジュールされている

---

## Bug Details

### Bug Condition

`startServer()` 内で `BuyerSyncService` の定期実行がスケジュールされていない。売主リストの `EnhancedPeriodicSyncManager` は `setTimeout` + `setInterval` パターンで起動されているが、買主リストには同等のコードが存在しない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ServerState
  OUTPUT: boolean

  RETURN input.serverStarted = true
         AND input.sellerPeriodicSyncScheduled = true
         AND input.buyerPeriodicSyncScheduled = false
END FUNCTION
```

### Examples

- サーバー起動後、スプレッドシートで買主の「最新状況」を更新しても、DBには反映されない（手動同期ボタンを押すまで古いデータが表示される）
- サーバー起動後、スプレッドシートで買主の「次電日」を更新しても、DBには反映されない
- 売主リストは10分ごとに自動同期されるが、買主リストは同期されない（非対称な動作）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `POST /api/buyers/sync` エンドポイントによる手動同期が引き続き正常に動作する
- `BuyerSyncService.isSyncInProgress()` による重複同期防止が引き続き機能する（手動同期中に定期同期が重複しない）
- `EnhancedPeriodicSyncManager` による売主リストの自動定期同期が引き続き正常に起動する
- 売主リストと買主リストの同期処理は独立して動作し、互いに影響しない

**Scope:**
買主リストの定期同期スケジューラーを追加するだけであり、既存の手動同期ロジック・重複防止ロジック・売主リスト同期ロジックは一切変更しない。

---

## Hypothesized Root Cause

`backend/src/index.ts` の `startServer()` 内に、買主リストの定期同期を起動するコードが実装されていない。

売主リストの定期同期は以下のパターンで実装されている：

```typescript
setTimeout(async () => {
  const { getEnhancedPeriodicSyncManager, isAutoSyncEnabled } = await import('./services/EnhancedAutoSyncService');
  if (!isAutoSyncEnabled()) return;
  const periodicSyncManager = getEnhancedPeriodicSyncManager();
  await periodicSyncManager.start();
}, 10000); // 10秒後に実行
```

買主リストには同等のコードが存在しない。`BuyerSyncService` は実装済みで手動同期は動作しているが、定期実行のスケジューリングが抜けている。

---

## Correctness Properties

Property 1: Bug Condition - 買主リスト定期同期の自動起動

_For any_ サーバー起動イベントにおいて、`startServer()` が実行された後、買主リストの定期同期スケジューラーが起動され、`BuyerSyncService.syncAll()` が定期的に呼び出される。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 手動同期・重複防止・売主同期の維持

_For any_ 入力において、買主リストの定期同期スケジューラー追加後も、手動同期エンドポイント（`POST /api/buyers/sync`）、重複防止チェック（`isSyncInProgress()`）、および売主リストの定期同期（`EnhancedPeriodicSyncManager`）が修正前と同一の動作を維持する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

**File**: `backend/src/index.ts`

**Function**: `startServer()`

**Specific Changes**:

1. **買主リスト定期同期スケジューラーの追加**: 売主リストの定期同期スケジューラー（`setTimeout` ブロック）の直後に、買主リスト用の同等ブロックを追加する

2. **重複防止の考慮**: `BuyerSyncService.isSyncInProgress()` を使って、定期同期実行時に手動同期と重複しないようにする

3. **非同期・非ブロッキング**: 売主リストと同様に `setTimeout` で遅延起動し、サーバー起動をブロックしない

**実装イメージ:**
```typescript
// 買主リスト定期同期を非同期で実行（サーバー起動をブロックしない）
setTimeout(async () => {
  try {
    const { BuyerSyncService } = await import('./services/BuyerSyncService');
    const buyerSyncService = new BuyerSyncService();
    const intervalMinutes = parseInt(process.env.BUYER_SYNC_INTERVAL_MINUTES || '10', 10);

    console.log(`📋 Starting buyer list periodic sync (interval: ${intervalMinutes} minutes)`);

    // 初回同期を実行
    const runBuyerSync = async () => {
      if (buyerSyncService.isSyncInProgress()) {
        console.log('⚠️ Buyer sync already in progress, skipping scheduled run');
        return;
      }
      try {
        await buyerSyncService.syncAll();
        console.log('✅ Buyer periodic sync completed');
      } catch (error: any) {
        console.error('⚠️ Buyer periodic sync error (non-blocking):', error.message);
      }
    };

    await runBuyerSync();

    // 定期実行を設定
    setInterval(runBuyerSync, intervalMinutes * 60 * 1000);
    console.log(`✅ Buyer list periodic sync started (every ${intervalMinutes} minutes)`);
  } catch (error: any) {
    console.error('⚠️ Buyer periodic sync failed to start (non-blocking):', error.message);
  }
}, 20000); // 20秒後に実行（売主同期の10秒後に開始してクォータ分散）
```

**追加する環境変数（オプション）:**
- `BUYER_SYNC_INTERVAL_MINUTES`: 買主リスト同期間隔（デフォルト: 10分）

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後の動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `startServer()` が買主リストの定期同期をスケジュールしないことを確認する。

**Test Plan**: `backend/src/index.ts` の `startServer()` をモックして、`BuyerSyncService.syncAll()` が定期的に呼ばれないことを確認する。

**Test Cases**:
1. **起動後の定期同期確認**: `startServer()` 実行後、一定時間経過しても `BuyerSyncService.syncAll()` が呼ばれないことを確認（未修正コードで失敗するはず）
2. **売主同期との非対称性確認**: `EnhancedPeriodicSyncManager.start()` は呼ばれるが、買主の同等処理は呼ばれないことを確認

**Expected Counterexamples**:
- `BuyerSyncService.syncAll()` が定期的に呼ばれない
- 原因: `startServer()` 内に買主リストの定期同期スケジューラーが存在しない

### Fix Checking

**Goal**: 修正後、サーバー起動時に買主リストの定期同期が自動的に開始されることを確認する。

**Pseudocode:**
```
FOR ALL serverStartEvent WHERE isBugCondition(serverStartEvent) DO
  result := startServer_fixed()
  ASSERT buyerPeriodicSyncScheduled(result) = true
  ASSERT buyerSyncService.syncAll() called periodically
END FOR
```

### Preservation Checking

**Goal**: 修正後も手動同期・重複防止・売主同期が変更前と同一の動作を維持することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT manualSync_original(input) = manualSync_fixed(input)
  ASSERT duplicatePrevention_original(input) = duplicatePrevention_fixed(input)
  ASSERT sellerSync_original(input) = sellerSync_fixed(input)
END FOR
```

**Testing Approach**: 手動同期エンドポイントと重複防止ロジックは変更しないため、既存のテストがそのまま通ることを確認する。

**Test Cases**:
1. **手動同期の保持**: `POST /api/buyers/sync` が修正後も正常に動作することを確認
2. **重複防止の保持**: 同期中に別の同期リクエストが来た場合、409を返すことを確認
3. **売主同期の独立性**: `EnhancedPeriodicSyncManager.start()` が引き続き呼ばれることを確認

### Unit Tests

- `startServer()` 実行後に買主リストの定期同期がスケジュールされることを確認
- `BuyerSyncService.isSyncInProgress()` が `true` の場合、定期同期がスキップされることを確認
- 定期同期中にエラーが発生しても、次回スケジュールが継続されることを確認

### Property-Based Tests

- 任意の `BUYER_SYNC_INTERVAL_MINUTES` 設定（1〜60分）に対して、スケジューラーが正しい間隔で動作することを確認
- 任意のタイミングで手動同期と定期同期が重複した場合、常に重複防止が機能することを確認

### Integration Tests

- サーバー起動後、実際に `BuyerSyncService.syncAll()` が呼ばれることを確認
- 売主リストの定期同期と買主リストの定期同期が独立して動作することを確認
- 手動同期エンドポイントが修正後も正常に動作することを確認
