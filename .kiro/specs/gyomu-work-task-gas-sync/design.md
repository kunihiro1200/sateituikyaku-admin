# 業務依頼GAS同期 Bugfix Design

## Overview

業務依頼（`work_tasks`）スプレッドシートのデータがDBに自動同期されていないバグを修正する。

根本原因は `EnhancedAutoSyncService.runFullSync()` の Phase 4 が空実装（コメントのみ）であること。
修正方針は、既存の物件リスト同期（`gas/property-listing-sync/PropertyListingSync.gs`）および買主同期（`gas/buyer-sync/BuyerSync.gs`）と同様に、**GASスクリプトが Supabase REST API を直接呼び出して upsert する方式**を採用する。

## Glossary

- **Bug_Condition (C)**: `EnhancedAutoSyncService.runFullSync()` が実行されるという条件 — Phase 4 が空のため業務依頼同期がスキップされる
- **Property (P)**: GASスクリプトが10分ごとに実行され、業務依頼スプレッドシートのデータが `work_tasks` テーブルに正しく upsert される
- **Preservation**: 既存の手動同期API（`POST /api/work-tasks/sync`）および他のフェーズ（売主・物件・買主同期）の動作が変わらない
- **WorkTaskSyncService**: `backend/src/services/WorkTaskSyncService.ts` — 既存の手動同期サービス（変更しない）
- **EnhancedAutoSyncService**: `backend/src/services/EnhancedAutoSyncService.ts` — Phase 4 が空実装になっているサービス
- **GASスクリプト**: Google Apps Script — スプレッドシートから直接 Supabase REST API を呼び出す

## Bug Details

### Bug Condition

`EnhancedAutoSyncService.runFullSync()` が定期実行されるとき、Phase 4 は以下のコードで何もしない：

```typescript
// Phase 4: 作業タスク同期（既存）
console.log('\n📋 Phase 4: Work Task Sync');
// Note: Work task sync is handled elsewhere
console.log('✅ Work task sync (handled by existing service)');
```

`WorkTaskSyncService.syncAll()` は呼び出されておらず、「handled elsewhere」というコメントは誤りで、実際にはどこからも自動呼び出しされていない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SyncTrigger
  OUTPUT: boolean

  RETURN input.phase = 'Phase4'
         AND WorkTaskSyncService.syncAll() が呼び出されていない
         AND 業務依頼スプレッドシートのデータがDBに未反映
END FUNCTION
```

### Examples

- AA9195の「サイト登録締め日」がスプレッドシートで更新されても、DBの `work_tasks.site_registration_deadline` が変わらない
- 新規物件の業務依頼行がスプレッドシートに追加されても、DBに `work_tasks` レコードが作成されない
- 手動で `POST /api/work-tasks/sync` を叩いた場合のみDBが更新される（正常動作）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `POST /api/work-tasks/sync` による手動全件同期
- `POST /api/work-tasks/sync/:propertyNumber` による単一物件同期
- Phase 1〜3（売主同期）の動作
- Phase 4.5〜4.8（物件リスト同期）の動作
- Phase 5（買主同期）の動作

**スコープ:**
GASスクリプトの追加は新規ファイル作成のみ。既存のバックエンドコードは変更しない（または最小限の変更に留める）。

## Hypothesized Root Cause

1. **Phase 4 の空実装**: `runFullSync()` の Phase 4 に `WorkTaskSyncService.syncAll()` の呼び出しが実装されていない。コメントに「handled elsewhere」とあるが、実際にはどこからも自動呼び出しされていない。

2. **設計上の判断**: 物件リスト・買主リストは GAS → Supabase 直接書き込み方式に移行済みだが、業務依頼は移行されていなかった。

3. **修正方針**: GASスクリプトを新規作成し、物件リスト・買主リストと同じパターンで実装する。`EnhancedAutoSyncService` は変更しない（または Phase 4 のコメントを更新するのみ）。

## Correctness Properties

Property 1: Bug Condition - 業務依頼GAS同期の実行

_For any_ 業務依頼スプレッドシートの行（`isBugCondition` が true = 物件番号が存在する行）において、GASスクリプトが実行されたとき、固定された `work_tasks` テーブルへの upsert SHALL 成功し、スプレッドシートの値がDBに反映される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存同期APIの動作維持

_For any_ 手動同期APIの呼び出し（`isBugCondition` が false = GASスクリプト以外の同期トリガー）において、修正後のコードは修正前と同じ動作を SHALL 維持し、`WorkTaskSyncService.syncAll()` および他フェーズの同期が正常に動作する。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**新規ファイル**: `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs`

物件リスト同期（`gas/property-listing-sync/PropertyListingSync.gs`）と同じパターンで実装する：

1. **CONFIG 設定**:
   - `SPREADSHEET_ID`: `1MO2vs0mDUFCgM-rjXXPRIy3pKKdfIFvUDwacM-2174g`
   - `SHEET_NAME`: `業務依頼`
   - `TABLE_NAME`: `work_tasks`
   - `BATCH_SIZE`: 100
   - `SYNC_INTERVAL_MINUTES`: 10

2. **COLUMN_MAPPING**: `work-task-column-mapping.json` の `spreadsheetToDatabase`、`spreadsheetToDatabase2`、`spreadsheetToDatabase3` を統合したマッピング

3. **TYPE_CONVERSIONS**: `work-task-column-mapping.json` の `typeConversions` に基づく型変換

4. **syncGyomuWorkTasks()**: メイン同期関数（トリガーから呼び出される）

5. **upsertToSupabase()**: Supabase REST API への upsert（`on_conflict=property_number`）

6. **setupTrigger()**: 10分ごとのトリガー設定

7. **testSync()**: 動作確認用テスト関数

**オプション変更**: `backend/src/services/EnhancedAutoSyncService.ts`
- Phase 4 のコメントを「GASスクリプトで処理」に更新（コード変更なし、コメントのみ）

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：
1. **探索フェーズ**: 修正前のコードでバグを確認（Phase 4 が何もしないことを確認）
2. **検証フェーズ**: GASスクリプト実装後、DBへの反映を確認

### Exploratory Bug Condition Checking

**Goal**: Phase 4 が `WorkTaskSyncService.syncAll()` を呼び出していないことを確認し、バグの存在を証明する。

**Test Plan**: `EnhancedAutoSyncService.runFullSync()` を実行し、Phase 4 のログを確認する。その後、DBの `work_tasks` テーブルを確認して、スプレッドシートの最新データが反映されていないことを確認する。

**Test Cases**:
1. **Phase 4 スキップ確認**: `runFullSync()` を実行し、ログに「Work task sync (handled by existing service)」が出力されることを確認（実際には何もしていない）
2. **DBデータ未反映確認**: AA9195の「サイト登録締め日」をスプレッドシートで更新し、`runFullSync()` 後もDBに反映されないことを確認（unfixed code で FAIL が期待される）

**Expected Counterexamples**:
- `work_tasks.site_registration_deadline` がスプレッドシートの値と異なる
- Phase 4 のログに `WorkTaskSyncService.syncAll()` の実行ログが出ない

### Fix Checking

**Goal**: GASスクリプト実装後、業務依頼スプレッドシートのデータが `work_tasks` テーブルに正しく upsert されることを確認する。

**Pseudocode:**
```
FOR ALL row WHERE isBugCondition(row) DO
  // GASスクリプトを実行
  result := syncGyomuWorkTasks(row)
  ASSERT work_tasks[row.property_number].site_registration_deadline = row.サイト登録締め日
  ASSERT work_tasks[row.property_number].synced_at IS NOT NULL
END FOR
```

### Preservation Checking

**Goal**: 既存の手動同期APIが引き続き正常に動作することを確認する。

**Pseudocode:**
```
FOR ALL trigger WHERE NOT isBugCondition(trigger) DO
  // 手動API呼び出し
  ASSERT POST /api/work-tasks/sync = 修正前と同じ動作
  ASSERT POST /api/work-tasks/sync/:propertyNumber = 修正前と同じ動作
END FOR
```

**Testing Approach**: 手動APIを呼び出し、修正前後で同じ結果が返ることを確認する。

**Test Cases**:
1. **手動全件同期の動作確認**: `POST /api/work-tasks/sync` が正常に動作することを確認
2. **単一物件同期の動作確認**: `POST /api/work-tasks/sync/AA9195` が正常に動作することを確認
3. **他フェーズの動作確認**: `runFullSync()` で Phase 1〜3、4.5〜4.8、5 が正常に動作することを確認

### Unit Tests

- GASスクリプトの `mapRowToRecord()` が正しくカラムマッピングを行うことを確認
- GASスクリプトの `convertValue()` が日付・数値を正しく変換することを確認
- 物件番号が空の行がスキップされることを確認

### Property-Based Tests

- ランダムな業務依頼データで GAS upsert が成功することを確認
- 全カラムマッピングが `work-task-column-mapping.json` と一致することを確認

### Integration Tests

- GASスクリプト実行後、スプレッドシートの値が `work_tasks` テーブルに反映されることを確認
- バッチ処理（100件ずつ）が正常に動作することを確認
- エラー行（物件番号なし）がスキップされ、他の行は正常に処理されることを確認
