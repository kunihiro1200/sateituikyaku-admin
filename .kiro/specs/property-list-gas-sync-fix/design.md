# 物件リスト GAS 同期バグ修正 デザインドキュメント

## Overview

物件リストのスプレッドシート → データベース同期が、`PropertyListingSyncService`（Google Sheets API / サービスアカウント認証）経由でエラーになっている。

修正方針は、買主リスト（`BuyerSync.gs`）で実績のある GAS（Google Apps Script）方式に移行すること。GAS がスプレッドシートの「物件」シートを直接読み取り、Supabase REST API に `property_number` をキーとして upsert する新しいスクリプト `gas/property-listing-sync/PropertyListingSync.gs` を作成する。

既存の `PropertyListingRestSyncService` を使った手動同期エンドポイントや、他の同期フェーズには影響を与えない。

---

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `EnhancedAutoSyncService.runFullSync()` の Phase 4.5 / 4.6 が実行される、または GAS 経由で物件リストを同期しようとする
- **Property (P)**: 期待される正しい動作 — `property_listings` テーブルに `property_number` をキーとして正しく upsert される
- **Preservation**: 修正によって変えてはいけない既存の動作 — 買主同期・売主同期・手動同期エンドポイントの継続動作
- **PropertyListingSync.gs**: 新規作成する GAS スクリプト（`gas/property-listing-sync/PropertyListingSync.gs`）
- **BuyerSync.gs**: 参考にする既存の買主同期 GAS スクリプト（`gas/buyer-sync/BuyerSync.gs`）
- **property_number**: `property_listings` テーブルの upsert キー（例: `B-001`）
- **COLUMN_MAPPING**: スプレッドシートのカラム名 → DB カラム名の変換定義（`property-listing-column-mapping.json` と同期）

---

## Bug Details

### Bug Condition

バグは `EnhancedAutoSyncService.runFullSync()` が Phase 4.5（物件リスト更新同期）または Phase 4.6（新規物件追加同期）を実行したとき、あるいは GAS 経由で物件リストを同期しようとしたときに発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SyncTrigger
  OUTPUT: boolean

  RETURN (
    input.phase IN ['phase_4_5', 'phase_4_6']
    AND PropertyListingSyncService が Google Sheets API 経由で実行される
  )
  OR (
    input.type = 'gas_sync'
    AND gas/property-listing-sync/PropertyListingSync.gs が存在しない
  )
END FUNCTION
```

### Examples

- **Phase 4.5 実行時**: `syncUpdatedPropertyListings()` がエラーになり、物件リストの更新がDBに反映されない
- **Phase 4.6 実行時**: `syncNewProperties()` がエラーになり、新規物件がDBに追加されない
- **GAS 同期試行時**: `gas/property-listing-sync/PropertyListingSync.gs` が存在しないため、GAS 経由の同期が不可能
- **正常ケース（買主）**: `BuyerSync.gs` は同じスプレッドシートに対して GAS 方式で正常動作している

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 買主リストの GAS 同期（`BuyerSync.gs`）は変更せず、引き続き正常に動作する
- `EnhancedAutoSyncService.runFullSync()` の他フェーズ（売主同期など）は Phase 4.5 / 4.6 のエラーに関わらず継続実行される
- バックエンドの `/api/property-listing-sync/manual` エンドポイントは `PropertyListingRestSyncService` を使った手動同期として引き続き動作する

**Scope:**
GAS スクリプトの新規作成のみが変更範囲。既存の `BuyerSync.gs`、`EnhancedAutoSyncService`、`PropertyListingRestSyncService` のコードは変更しない。

---

## Hypothesized Root Cause

バグ説明の分析に基づく根本原因の仮説：

1. **Google Sheets API 認証エラー**: サービスアカウントの認証情報が無効または期限切れになっており、`PropertyListingSyncService` が API 呼び出しに失敗している

2. **GAS スクリプト不在**: `gas/` ディレクトリに物件リスト用の GAS スクリプトが存在しないため、GAS 方式への移行が完了していない

3. **スプレッドシート取得範囲の問題**: `PropertyListingSyncService` が物件シートの正しい範囲を取得できていない可能性がある

4. **型変換・マッピングの不整合**: `property-listing-column-mapping.json` のマッピングと実際のスプレッドシートのカラム名が一致していない可能性がある

---

## Correctness Properties

Property 1: Bug Condition - GAS による物件リスト upsert

_For any_ スプレッドシートの「物件」シートの行で `property_number` が存在する場合、修正後の `PropertyListingSync.gs` は `property_listings` テーブルに `property_number` をキーとして upsert し、既存レコードは更新・新規レコードは挿入される。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存同期への影響なし

_For any_ 買主同期・売主同期・手動同期エンドポイントへの入力に対して、修正後のコードは修正前と同じ動作を維持し、`BuyerSync.gs`・`EnhancedAutoSyncService`・`PropertyListingRestSyncService` の動作は変化しない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

## Fix Implementation

### Changes Required

修正は GAS スクリプトの新規作成のみ。既存ファイルへの変更は最小限。

**File**: `gas/property-listing-sync/PropertyListingSync.gs`（新規作成）

**Specific Changes:**

1. **CONFIG 定義**: `BuyerSync.gs` と同じ構造で、`SHEET_NAME` を「物件」、`TABLE_NAME` を `property_listings` に設定

2. **COLUMN_MAPPING 定義**: `property-listing-column-mapping.json` の `spreadsheetToDatabase` セクションをそのまま GAS スクリプト内の変数として定義

3. **TYPE_CONVERSIONS 定義**: `property-listing-column-mapping.json` の `typeConversions` セクションをそのまま GAS スクリプト内の変数として定義

4. **syncPropertyListings() 関数**: `BuyerSync.gs` の `syncBuyers()` と同じ構造で、`property_number` が空の行をスキップし、バッチ単位で upsert する

5. **upsert キー**: `Prefer: resolution=merge-duplicates` ヘッダーを使用し、`property_number` をキーとして重複時は更新

6. **setupTrigger() / testSync()**: `BuyerSync.gs` と同じパターンで実装

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズ：まず未修正コードでバグを確認し、次に修正後の GAS スクリプトが正しく動作することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前に `PropertyListingSyncService` のエラーを確認し、根本原因を特定する。

**Test Plan**: バックエンドのログを確認して Phase 4.5 / 4.6 のエラーメッセージを取得し、根本原因を特定する。

**Test Cases:**
1. **Phase 4.5 エラー確認**: `runFullSync()` を実行して Phase 4.5 のエラーログを確認（未修正コードで失敗することを確認）
2. **Phase 4.6 エラー確認**: 同様に Phase 4.6 のエラーログを確認
3. **GAS スクリプト不在確認**: `gas/property-listing-sync/` ディレクトリが存在しないことを確認
4. **BuyerSync.gs 正常動作確認**: 買主同期が正常に動作していることを確認（比較基準）

**Expected Counterexamples:**
- `PropertyListingSyncService` が Google Sheets API 認証エラーまたはネットワークエラーを返す
- `gas/property-listing-sync/PropertyListingSync.gs` が存在しない

### Fix Checking

**Goal**: 修正後の GAS スクリプトが全ての `property_number` 付き行を正しく upsert することを検証する。

**Pseudocode:**
```
FOR ALL row WHERE isBugCondition(row) DO
  result := PropertyListingSync_fixed(row)
  ASSERT result.property_number IN property_listings
  ASSERT property_listings[result.property_number] = expectedRecord(row)
END FOR
```

### Preservation Checking

**Goal**: 修正によって既存の買主同期・売主同期・手動同期が影響を受けないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT BuyerSync_original(input) = BuyerSync_fixed(input)
  ASSERT PropertyListingRestSyncService_original(input) = PropertyListingRestSyncService_fixed(input)
END FOR
```

**Testing Approach**: 既存ファイルを変更しないため、保存テストは「ファイルが変更されていないこと」の確認が主体。GAS スクリプトの新規作成のみなので、既存動作への影響はゼロ。

**Test Cases:**
1. **BuyerSync.gs 変更なし確認**: `BuyerSync.gs` のファイルハッシュが変更前後で同一であることを確認
2. **EnhancedAutoSyncService 変更なし確認**: Phase 4.5 / 4.6 のエラーが他フェーズに影響しないことを確認
3. **手動同期エンドポイント確認**: `/api/property-listing-sync/manual` が引き続き動作することを確認
4. **upsert 重複防止確認**: 同じ `property_number` で2回 upsert しても1レコードになることを確認

### Unit Tests

- `mapRowToRecord()` 関数が `COLUMN_MAPPING` に従って正しく変換することをテスト
- `convertValue()` 関数が日付・数値・文字列を正しく変換することをテスト
- `property_number` が空の行がスキップされることをテスト

### Property-Based Tests

- 任意のスプレッドシート行に対して、`COLUMN_MAPPING` に定義されたカラムが全て正しく変換されることを検証
- 任意の `property_number` 付きレコードを2回 upsert しても `property_listings` テーブルのレコード数が増えないことを検証
- 日付フィールドに対して様々な形式（`Date` オブジェクト、シリアル値、文字列）を入力しても `YYYY-MM-DD` 形式で出力されることを検証

### Integration Tests

- GAS スクリプトを手動実行（`testSync()`）して、スプレッドシートの「物件」シートから `property_listings` テーブルへの同期が完了することを確認
- 同期後に `property_listings` テーブルのレコード数がスプレッドシートの有効行数と一致することを確認
- 10分トリガー設定後、自動実行されることを確認
