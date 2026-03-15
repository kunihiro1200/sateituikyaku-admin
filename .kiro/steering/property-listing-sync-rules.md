---
inclusion: manual
---

# 物件リスト同期ルール（絶対に間違えないルール）

## ⚠️ 重要：物件リストの同期は2つの独立した仕組みで実装されている

**絶対に混同しないでください。**

---

## 📊 同期方向と実装

| 方向 | 実装 | タイミング | 変更箇所 |
|------|------|-----------|---------|
| **スプシ → DB** | **GAS**（Google Apps Script） | 10分ごと自動実行 | スプレッドシートのGASエディタ |
| **DB → スプシ** | **バックエンド**（Node.js） | 管理画面で更新時に即時 | `backend/src/services/PropertyListingService.ts` |

---

## 📋 スプシ → DB（GAS）

### 概要

- スプレッドシートID: `1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY`
- シート名: `物件`
- Supabaseテーブル: `property_listings`
- 同期方法: `property_number`をキーにupsert
- 実行間隔: 10分ごと（`setupTrigger()`で設定済み）

### GASの場所

スプレッドシート（物件リスト）の **ツール → Apps Script** から確認・編集できる。

### GASのメイン関数

- `syncPropertyListings()` - メイン同期関数（トリガーから自動実行）
- `setupTrigger()` - トリガー設定（一度だけ手動実行）
- `testSync()` - 動作確認用（手動実行）
- `syncSingleProperty(propertyNumber)` - 特定物件のみ同期（デバッグ用）

### カラムマッピング（GAS側）

GASの`COLUMN_MAPPING`変数でスプシ列名 → DBカラム名を定義している。
バックエンドの`backend/src/config/property-listing-column-mapping.json`と**必ず同期すること**。

### 型変換（GAS側）

GASの`TYPE_CONVERSIONS`変数で数値・日付の型変換を定義している。

---

## 📋 DB → スプシ（バックエンド）

### 概要

- 管理画面で物件データを更新すると即時にスプレッドシートに書き戻す
- `property_number`で行を特定してスプレッドシートを更新

### 実装ファイル

- **`backend/src/services/PropertyListingService.ts`**
  - `update()`メソッド内で`syncToSpreadsheet()`を呼び出す
  - `syncToSpreadsheet()`プライベートメソッドで実際の書き戻しを行う
  - `PROPERTY_LISTING_SPREADSHEET_ID`環境変数からスプレッドシートIDを取得

- **`backend/src/services/GoogleSheetsClient.ts`**
  - Google Sheets APIクライアント

- **`backend/src/services/PropertyListingColumnMapper.ts`**
  - DBカラム名 → スプシ列名のマッピング

- **`backend/src/config/property-listing-column-mapping.json`**
  - カラムマッピング定義（GASの`COLUMN_MAPPING`と同期が必要）

---

## 🚨 よくある問題と対処法

### 問題1: スプシ → DBが同期されない

**確認箇所**: GASエディタ（スプレッドシートのツール → Apps Script）
- トリガーが設定されているか確認（`setupTrigger()`を再実行）
- GASのログでエラーを確認
- `COLUMN_MAPPING`に新しいカラムが追加されているか確認

### 問題2: DB → スプシが同期されない

**確認箇所**: `backend/src/services/PropertyListingService.ts`
- `syncToSpreadsheet()`が呼ばれているか確認
- `PROPERTY_LISTING_SPREADSHEET_ID`環境変数が設定されているか確認
- Vercelのログでエラーを確認

### 問題3: 新しいカラムを追加した場合

**必ず両方を更新すること**:
1. GASの`COLUMN_MAPPING`を更新
2. `backend/src/config/property-listing-column-mapping.json`を更新
3. `backend/src/services/PropertyListingColumnMapper.ts`を更新
4. DBのマイグレーションを実行（カラムが存在しない場合）

---

## 🔍 売主リストとの違い

| 項目 | 売主リスト | 物件リスト |
|------|-----------|-----------|
| スプシ → DB | バックエンド（`EnhancedAutoSyncService.ts`）5分ごと | **GAS** 10分ごと |
| DB → スプシ | バックエンド（`SyncQueue`）即時 | バックエンド（`PropertyListingService.ts`）即時 |

**重要**: 物件リストのスプシ→DB同期はGASが担当しているため、バックエンドの`EnhancedAutoSyncService.ts`は物件リストのスプシ→DB同期には関与しない。

---

## 📝 環境変数

| 環境変数 | 説明 |
|---------|------|
| `PROPERTY_LISTING_SPREADSHEET_ID` | 物件リストスプレッドシートID（`1tI_iXaiLuWBggs5y0RH7qzkbHs9wnLLdRekAmjkhcLY`） |

---

**最終更新日**: 2026年3月15日
**作成理由**: 物件リストの同期がGAS（スプシ→DB）とバックエンド（DB→スプシ）の2つの仕組みで実装されていることを記録し、問題発生時にどこを変更すべきか明確にするため
