# 買主リスト新規レコード同期バグ修正 設計書

## Overview

本番環境（Vercel サーバーレス）において、買主リスト・業務依頼リストの定期同期が動作しない問題を修正する。

根本原因は `backend/src/index.ts` の定期同期スケジューラー（`setInterval`）が `if (process.env.VERCEL !== '1')` ブロック内にのみ存在するため、Vercel サーバーレス環境では一切実行されないこと。

修正方針は、既存の `/api/cron/sync-inquiries` エンドポイントと同じパターンで、買主・業務依頼・売主の各同期用 Cron Job エンドポイントを `backend/src/index.ts` に追加し、`backend/vercel.json` に Vercel Cron Job 設定を追加する。

## Glossary

- **Bug_Condition (C)**: バグが発現する条件 — `process.env.VERCEL === '1'` の環境でサーバーが起動し、定期同期が必要な状態
- **Property (P)**: バグ条件が成立する入力に対して期待される正しい動作 — Cron Job エンドポイントが呼ばれたとき、対応する同期サービスが実行され、スプレッドシートの新規レコードがDBに挿入される
- **Preservation**: 修正によって変更してはいけない既存の動作 — 手動同期エンドポイント、ローカル環境の `setInterval` 定期同期、重複防止ロジック
- **BuyerSyncService**: `backend/src/services/BuyerSyncService.ts` の同期サービス。`syncAll()` でスプレッドシート全件を upsert する
- **WorkTaskSyncService**: `backend/src/services/WorkTaskSyncService.ts` の同期サービス。`syncAll()` で業務依頼スプレッドシートを upsert する
- **EnhancedPeriodicSyncManager**: `backend/src/services/EnhancedAutoSyncService.ts` の売主定期同期マネージャー
- **CRON_SECRET**: Vercel Cron Job エンドポイントへの不正アクセスを防ぐ認証トークン（環境変数）
- **isBugCondition**: バグ条件を判定する疑似コード関数

## Bug Details

### Bug Condition

`backend/src/index.ts` の `startServer()` 関数内で、買主・業務依頼・売主の定期同期スケジューラーが `if (process.env.VERCEL !== '1')` ブロック内の `app.listen()` コールバック内にのみ存在する。Vercel サーバーレス環境では `app.listen()` が呼ばれないため、これらのスケジューラーが一切起動しない。

**Formal Specification:**
```
FUNCTION isBugCondition(env)
  INPUT: env — 実行環境の環境変数セット
  OUTPUT: boolean

  RETURN env.VERCEL === '1'
         AND NOT existsCronEndpoint('/api/cron/buyer-sync')
         AND NOT existsCronEndpoint('/api/cron/work-task-sync')
END FUNCTION
```

### Examples

- **本番環境（Vercel）でスプレッドシートに新規買主を追加** → DBに挿入されない（バグ条件成立）
- **本番環境（Vercel）で業務依頼スプレッドシートに新規行を追加** → DBに挿入されない（バグ条件成立）
- **ローカル環境でスプレッドシートに新規買主を追加** → 20秒後に `setInterval` が起動し、10分以内にDBに挿入される（バグ条件不成立）
- **本番環境でユーザーが「スプレッドシートから同期」ボタンを押す** → `POST /api/buyers/sync` が呼ばれ正常に挿入される（バグ条件不成立 — 手動同期は動作中）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `POST /api/buyers/sync` による手動同期が引き続き正常に動作すること
- `BuyerSyncService.isSyncInProgress()` による重複防止ロジックが維持されること
- ローカル環境（`VERCEL !== '1'`）での `setInterval` 定期同期が引き続き動作すること
- `WorkTaskSyncService.isSyncInProgress()` による重複防止ロジックが維持されること
- 売主同期（`EnhancedPeriodicSyncManager`）が独立して動作し続けること
- 既存の `/api/cron/sync-inquiries` エンドポイントが変更されないこと

**Scope:**
Vercel 環境での定期同期の欠如のみを修正する。既存の手動同期エンドポイント、ローカル環境の動作、他のルートには一切影響を与えない。

## Hypothesized Root Cause

1. **setInterval の Vercel サーバーレス非対応**: Vercel サーバーレス関数はリクエストごとに起動・終了するため、`setInterval` によるプロセス常駐型のスケジューラーが動作しない。`app.listen()` コールバック内に定期同期を配置したことで、Vercel 環境では完全にスキップされている。

2. **売主同期との非対称性**: 売主同期（`EnhancedPeriodicSyncManager`）も同じ `if (process.env.VERCEL !== '1')` ブロック内にあり、同じ問題を抱えている。既存の `/api/cron/sync-inquiries` エンドポイントは Vercel Cron Job パターンで正しく実装されているが、買主・業務依頼・売主の同期には同等のエンドポイントが存在しない。

3. **backend/vercel.json に cron 設定がない**: `backend/vercel.json` には `builds` と `routes` のみが定義されており、`crons` セクションが存在しない。Vercel Cron Job を有効化するには `crons` 設定が必要。

## Correctness Properties

Property 1: Bug Condition — Cron エンドポイントが買主同期を実行する

_For any_ リクエストで `VERCEL === '1'` 環境の `/api/cron/buyer-sync` エンドポイントが正しい `CRON_SECRET` で呼ばれた場合、修正後の実装は `BuyerSyncService.syncAll()` を実行し、スプレッドシートに存在してDBに存在しない買主レコードをDBに挿入する。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — 手動同期・重複防止・ローカル動作が変わらない

_For any_ 入力でバグ条件が成立しない場合（手動同期リクエスト、ローカル環境での `setInterval` 実行、同期中の重複リクエスト）、修正後の実装は元の実装と同じ動作を保持し、既存の手動同期・重複防止・ローカル定期同期を変更しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

修正は `backend/src/index.ts` と `backend/vercel.json` の2ファイルのみ。`backend/api/` や `frontend/` は一切触らない。

**File 1**: `backend/src/index.ts`

**追加する Cron Job エンドポイント（既存の `/api/cron/sync-inquiries` の直後に追加）:**

1. **`GET /api/cron/buyer-sync`** — 買主リスト同期
   - `CRON_SECRET` 認証チェック（既存エンドポイントと同じパターン）
   - `BuyerSyncService.isSyncInProgress()` で重複防止
   - `BuyerSyncService.syncAll()` を呼び出す
   - 結果（created/updated/failed 件数）をレスポンスで返す

2. **`GET /api/cron/work-task-sync`** — 業務依頼同期
   - `CRON_SECRET` 認証チェック
   - `WorkTaskSyncService.isSyncInProgress()` で重複防止
   - `WorkTaskSyncService.syncAll()` を呼び出す
   - 結果をレスポンスで返す

3. **`GET /api/cron/seller-sync`** — 売主リスト同期
   - `CRON_SECRET` 認証チェック
   - `EnhancedPeriodicSyncManager` を使用して同期を実行
   - 結果をレスポンスで返す

**File 2**: `backend/vercel.json`

**`crons` セクションを追加:**

```json
{
  "version": 2,
  "builds": [...],
  "routes": [...],
  "crons": [
    {
      "path": "/api/cron/buyer-sync",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/work-task-sync",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/seller-sync",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

スケジュール間隔はローカル環境の `setInterval` 設定と一致させる:
- 買主同期: 10分ごと（`BUYER_SYNC_INTERVAL_MINUTES` のデフォルト値）
- 業務依頼同期: 10分ごと（`WORK_TASK_SYNC_INTERVAL_MINUTES` のデフォルト値）
- 売主同期: 5分ごと（`AUTO_SYNC_INTERVAL_MINUTES` のデフォルト値）

**注意**: Vercel Cron Job は Vercel Pro/Enterprise プランでのみ利用可能。Hobby プランでは1日1回のみ。`CRON_SECRET` 環境変数が Vercel ダッシュボードに設定されていることを確認する。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ: まず未修正コードでバグを確認し、次に修正後のコードで正しい動作と既存動作の保存を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを確認し、根本原因分析を検証する。

**Test Plan**: `backend/src/index.ts` の Vercel 環境分岐をシミュレートし、買主・業務依頼の定期同期が起動しないことを確認する。

**Test Cases**:
1. **Vercel 環境シミュレーション**: `process.env.VERCEL = '1'` を設定してサーバー初期化をシミュレートし、`BuyerSyncService.syncAll()` が呼ばれないことを確認（未修正コードで失敗）
2. **Cron エンドポイント不在確認**: `/api/cron/buyer-sync` へのリクエストが 404 を返すことを確認（未修正コードで失敗）
3. **業務依頼同期不在確認**: `/api/cron/work-task-sync` へのリクエストが 404 を返すことを確認（未修正コードで失敗）

**Expected Counterexamples**:
- Vercel 環境では `BuyerSyncService.syncAll()` が一度も呼ばれない
- `/api/cron/buyer-sync` エンドポイントが存在しない（404）

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の実装が期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(env) AND request.path === '/api/cron/buyer-sync' DO
  result := cronBuyerSyncEndpoint_fixed(request)
  ASSERT result.status === 200
  ASSERT result.body.success === true
  ASSERT BuyerSyncService.syncAll() was called
  ASSERT newRecordsInDB === newRecordsInSpreadsheet
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の実装が元の実装と同じ動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(env) DO
  ASSERT manualSync_original(request) === manualSync_fixed(request)
  ASSERT localSetInterval_original() === localSetInterval_fixed()
  ASSERT duplicatePrevention_original() === duplicatePrevention_fixed()
END FOR
```

**Testing Approach**: 手動同期エンドポイント・重複防止・ローカル環境動作は変更されないため、既存の動作をユニットテストで確認する。

**Test Cases**:
1. **手動同期保存**: `POST /api/buyers/sync` が修正後も正常に動作することを確認
2. **重複防止保存**: `isSyncInProgress() === true` の場合、Cron エンドポイントがスキップすることを確認
3. **認証チェック保存**: `CRON_SECRET` が一致しない場合、401 を返すことを確認
4. **ローカル環境保存**: `VERCEL !== '1'` の場合、`setInterval` が引き続き設定されることを確認

### Unit Tests

- Cron エンドポイントが正しい `CRON_SECRET` で `syncAll()` を呼び出すことを確認
- Cron エンドポイントが不正な `CRON_SECRET` で 401 を返すことを確認
- 同期中（`isSyncInProgress() === true`）の場合、Cron エンドポイントがスキップすることを確認
- `syncAll()` がエラーを投げた場合、Cron エンドポイントが 500 を返すことを確認

### Property-Based Tests

- 任意の有効な `CRON_SECRET` で Cron エンドポイントを呼び出した場合、常に `syncAll()` が実行されることを確認
- 任意の無効な `CRON_SECRET`（空文字、null、異なる値）で Cron エンドポイントを呼び出した場合、常に 401 を返すことを確認
- `syncAll()` の結果（created/updated/failed の任意の組み合わせ）に対して、レスポンスが正しく集計されることを確認

### Integration Tests

- 修正後の `backend/vercel.json` に `crons` セクションが存在することを確認
- Cron スケジュールがローカル環境の `setInterval` 間隔と一致することを確認
- 買主・業務依頼・売主の3つの Cron エンドポイントが全て定義されていることを確認
