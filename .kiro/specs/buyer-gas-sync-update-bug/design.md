# 買主リストGAS同期・既存レコード更新不具合 バグ修正設計

## Overview

買主リストのGAS（`gas/buyer-sync/BuyerSync.gs`）において、スプレッドシートからSupabaseへのupsert処理で、既存レコードのカラム値が正しく更新されない不具合を修正する。

調査の結果、以下の2つの根本原因が特定された：

1. **カラムマッピングの不一致**: `BuyerSync.gs`では`'●内覧日(最新）'`を`latest_viewing_date`にマッピングしているが、`buyer-column-mapping.json`では`viewing_date`にマッピングされており、後から追加された`viewing_date`カラム（Migration 106）への書き込みが行われていない。

2. **`inquiry_email_reply`の欠落**: `BuyerSync.gs`の`BUYER_COLUMN_MAPPING`には`'【問合メール】メール返信': 'inquiry_email_reply'`が定義されているが、`gas_buyer_complete_code.js`の`syncUpdatesToSupabase_`関数（差分更新フェーズ）では`inquiry_email_reply`の比較・更新処理が実装されていない。`BuyerSync.gs`のupsertフェーズは全カラムを送信するが、`gas_buyer_complete_code.js`の差分更新フェーズが`inquiry_email_reply`をスキップしている。

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — 既存買主レコードのカラム値（`viewing_date`または`inquiry_email_reply`）がスプレッドシートで変更されたとき
- **Property (P)**: 期待される正しい動作 — GASの次回同期実行時にDBの該当カラムが最新値に更新される
- **Preservation**: 修正によって変更してはいけない既存の動作 — 新規追加（INSERT）、変更なしレコードの保持、売主リスト同期
- **BuyerSync.gs**: `gas/buyer-sync/BuyerSync.gs` — 買主リストのメイン同期スクリプト（upsert方式）
- **gas_buyer_complete_code.js**: GASプロジェクト内の完全コード — `syncUpdatesToSupabase_`関数による差分更新フェーズを含む
- **viewing_date**: Migration 106で後から追加されたカラム（`buyers`テーブル）。`buyer-column-mapping.json`では`'●内覧日(最新）'`にマッピング
- **latest_viewing_date**: 元々存在するカラム（`buyers`テーブル）。`BuyerSync.gs`では`'●内覧日(最新）'`にマッピング（不一致）
- **inquiry_email_reply**: `'【問合メール】メール返信'`フィールドのDBカラム名。サイドバーの「問合メール未対応」判定に使用
- **upsertフェーズ**: `BuyerSync.gs`の`syncBuyers()`が実行するSupabase upsert（全カラム送信）
- **差分更新フェーズ**: `gas_buyer_complete_code.js`の`syncUpdatesToSupabase_`が実行する差分比較による更新

## Bug Details

### Bug Condition

バグは以下の2つの独立した条件で発生する：

**条件A（内覧日）**: スプレッドシートの`'●内覧日(最新）'`列が変更されたとき、`BuyerSync.gs`は`latest_viewing_date`を更新するが、`viewing_date`カラムは更新されない。サイドバーカウントや表示は`viewing_date`を参照しているため、変更が反映されない。

**条件B（メール返信）**: スプレッドシートの`'【問合メール】メール返信'`列が変更されたとき、`gas_buyer_complete_code.js`の`syncUpdatesToSupabase_`関数は`inquiry_email_reply`の差分チェックを行わないため、DBが更新されない。

**Formal Specification:**
```
FUNCTION isBugCondition(row)
  INPUT: row — スプレッドシートの1行データ（買主番号、カラム値を含む）
  OUTPUT: boolean

  existingRecord := fetchFromDB(row['買主番号'])
  IF existingRecord IS NULL THEN RETURN false  // 新規追加はバグ対象外

  // 条件A: 内覧日の変更
  sheetViewingDate := parseDate(row['●内覧日(最新）'])
  dbViewingDate    := existingRecord.viewing_date
  IF sheetViewingDate != dbViewingDate THEN RETURN true

  // 条件B: メール返信の変更
  sheetEmailReply := row['【問合メール】メール返信']
  dbEmailReply    := existingRecord.inquiry_email_reply
  IF sheetEmailReply != dbEmailReply THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **買主7243**: スプレッドシートの内覧日 = `2026-04-XX`、DB `viewing_date` = `2026-06-XX`（古い値のまま）→ バグ条件成立
- **買主7246**: スプレッドシートの内覧日 = `2026-04-XX`、DB `viewing_date` = `2026-06-XX`（古い値のまま）→ バグ条件成立
- **買主7312**: スプレッドシートの`'【問合メール】メール返信'` = `"済"`、DB `inquiry_email_reply` = `null`（空欄のまま）→ バグ条件成立
- **新規買主**: スプレッドシートに新規追加 → バグ条件不成立（INSERTは正常動作）

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- スプレッドシートに新規買主が追加された場合、DBへのINSERT処理は引き続き正常に動作する
- 既存買主レコードの値が変更されていない場合、DBの値は変更されない
- `BUYER_COLUMN_MAPPING`に定義された全カラムが引き続き同期対象となる
- 売主リストのスプレッドシート同期（`gas/seller-sync-clean.gs`）は影響を受けない
- `buyer_sidebar_counts`テーブルの更新処理は引き続き正常に動作する

**スコープ:**
`'●内覧日(最新）'`と`'【問合メール】メール返信'`以外のカラムの同期動作は変更しない。修正は最小限の変更に留める。

## Hypothesized Root Cause

調査により、以下の根本原因が特定された：

1. **カラムマッピングの不一致（主因A）**:
   - `BuyerSync.gs`の`BUYER_COLUMN_MAPPING`では`'●内覧日(最新）': 'latest_viewing_date'`
   - `buyer-column-mapping.json`では`'●内覧日(最新）': 'viewing_date'`
   - Migration 106で`viewing_date`カラムが後から追加されたが、`BuyerSync.gs`のマッピングが更新されなかった
   - `BuyerSync.gs`は`latest_viewing_date`を更新するが、サイドバー判定が参照する`viewing_date`は更新されない

2. **差分更新フェーズでの`inquiry_email_reply`欠落（主因B）**:
   - `gas_buyer_complete_code.js`の`syncUpdatesToSupabase_`関数は特定カラムのみを差分チェックする
   - `inquiry_email_reply`（`'【問合メール】メール返信'`）がその対象リストに含まれていない
   - `BuyerSync.gs`のupsertフェーズでは`BUYER_COLUMN_MAPPING`経由で送信されるが、差分更新フェーズでスキップされる

3. **`BuyerSync.gs`のPreferヘッダー不完全（副因）**:
   - `BuyerSync.gs`のupsertは`'Prefer': 'resolution=merge-duplicates'`のみ
   - 他のGAS（`PropertyListingSync.gs`、`GyomuWorkTaskSync.gs`）は`'resolution=merge-duplicates,return=minimal'`を使用
   - `return=minimal`がないとSupabaseがレスポンスボディを返し、GASの実行時間・メモリに影響する可能性がある（直接的なバグ原因ではないが修正推奨）

## Correctness Properties

Property 1: Bug Condition - 内覧日・メール返信の変更がDBに反映される

_For any_ スプレッドシート行において、バグ条件が成立する（`isBugCondition`が`true`を返す）場合、修正後のGAS同期処理はDBの`viewing_date`または`inquiry_email_reply`カラムをスプレッドシートの最新値に更新しなければならない。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - バグ条件が成立しない入力の動作は変更されない

_For any_ スプレッドシート行において、バグ条件が成立しない（`isBugCondition`が`false`を返す）場合、修正後のGAS同期処理は修正前と同じ結果を生成しなければならない。具体的には、新規追加のINSERT動作、変更なしレコードの保持、その他カラムの同期動作が維持される。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

根本原因分析に基づき、以下の変更を行う：

**File 1**: `gas/buyer-sync/BuyerSync.gs`

**変更1: カラムマッピングの修正**

`BUYER_COLUMN_MAPPING`の`'●内覧日(最新）'`のマッピング先を`latest_viewing_date`から`viewing_date`に変更する。

```javascript
// 修正前
'●内覧日(最新）': 'latest_viewing_date',

// 修正後
'●内覧日(最新）': 'viewing_date',
```

**変更2: `BUYER_TYPE_CONVERSIONS`の修正**

型変換ルールも合わせて修正する。

```javascript
// 修正前
'latest_viewing_date': 'date',

// 修正後
'viewing_date': 'date',
```

**変更3: Preferヘッダーの修正（推奨）**

```javascript
// 修正前
'Prefer': 'resolution=merge-duplicates'

// 修正後
'Prefer': 'resolution=merge-duplicates,return=minimal'
```

---

**File 2**: `gas_buyer_complete_code.js`（GASプロジェクト内）

**変更4: `syncUpdatesToSupabase_`関数に`inquiry_email_reply`の差分チェックを追加**

`syncUpdatesToSupabase_`関数内の差分チェックループに、`inquiry_email_reply`の比較・更新処理を追加する。既存の`inquiry_email_phone`の処理パターンに倣う：

```javascript
// 【問合メール】メール返信（inquiry_email_reply）
var sheetInquiryEmailReply = row['【問合メール】メール返信'] ? String(row['【問合メール】メール返信']) : null;
var normalizedSheetInquiryEmailReply = normalizeValue(sheetInquiryEmailReply);
var normalizedDbInquiryEmailReply = normalizeValue(dbBuyer.inquiry_email_reply);
if (normalizedSheetInquiryEmailReply !== normalizedDbInquiryEmailReply) {
  updateData.inquiry_email_reply = normalizedSheetInquiryEmailReply;
  needsUpdate = true;
  if (normalizedSheetInquiryEmailReply === null && normalizedDbInquiryEmailReply !== null) {
    Logger.log('  🗑️ ' + buyerNumber + ': 問合メール返信を削除 (旧値: ' + normalizedDbInquiryEmailReply + ')');
  }
}
```

また、`fetchAllBuyersFromSupabase_`関数の`fields`変数に`inquiry_email_reply`を追加する：

```javascript
// 修正前
var fields = 'buyer_number,latest_status,next_call_date,...,building_name_price';

// 修正後（inquiry_email_replyを追加）
var fields = 'buyer_number,latest_status,next_call_date,...,building_name_price,inquiry_email_reply';
```

### 注意事項

- `latest_viewing_date`カラムは引き続きDBに存在するが、`BuyerSync.gs`からの書き込み対象から外れる。`latest_viewing_date`を参照している他の処理（`EnhancedAutoSyncService.ts`等）への影響を確認すること。
- `gas_buyer_complete_code.js`はGASプロジェクト内のファイルであり、GASエディタから直接編集する必要がある。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現（探索的テスト）、次に修正後の動作を検証（修正確認テスト・保全テスト）。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: 買主7243・7246・7312のスプレッドシートデータを使用して、GAS同期後のDB値を確認する。

**Test Cases**:
1. **内覧日テスト（買主7243）**: スプレッドシートの`'●内覧日(最新）'`が`2026-04-XX`の状態でGAS同期を実行し、DB `viewing_date`が更新されないことを確認（未修正コードでFAIL）
2. **内覧日テスト（買主7246）**: 同上（未修正コードでFAIL）
3. **メール返信テスト（買主7312）**: スプレッドシートの`'【問合メール】メール返信'`が`"済"`の状態でGAS同期を実行し、DB `inquiry_email_reply`が更新されないことを確認（未修正コードでFAIL）
4. **マッピング確認テスト**: `BuyerSync.gs`のupsert後、`latest_viewing_date`は更新されるが`viewing_date`は更新されないことを確認

**Expected Counterexamples**:
- DB `viewing_date`がスプレッドシートの内覧日と一致しない（`latest_viewing_date`は更新されている）
- DB `inquiry_email_reply`がスプレッドシートの値と一致しない

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待される動作を生成することを検証する。

**Pseudocode:**
```
FOR ALL row WHERE isBugCondition(row) DO
  syncBuyers_fixed(row)
  result := fetchFromDB(row['買主番号'])
  ASSERT result.viewing_date = parseDate(row['●内覧日(最新）'])
         OR result.inquiry_email_reply = row['【問合メール】メール返信']
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL row WHERE NOT isBugCondition(row) DO
  result_original := syncBuyers_original(row)
  result_fixed    := syncBuyers_fixed(row)
  ASSERT result_original = result_fixed
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多数のテストケースを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 全非バグ入力に対して動作が変わらないことを強く保証できる

**Test Plan**: 未修正コードで新規追加・変更なしレコードの動作を観察し、修正後も同じ動作が維持されることを確認する。

**Test Cases**:
1. **新規追加保全テスト**: 新規買主のINSERT動作が修正前後で同じであることを確認
2. **変更なし保全テスト**: 変更のないレコードがDBで変更されないことを確認
3. **他カラム保全テスト**: `latest_status`、`next_call_date`等の他カラムの同期動作が変わらないことを確認
4. **売主リスト非影響テスト**: `gas/seller-sync-clean.gs`の動作が影響を受けないことを確認

### Unit Tests

- `BuyerSync.gs`の`buyerMapRowToRecord`関数が`'●内覧日(最新）'`を`viewing_date`にマッピングすることを確認
- `BuyerSync.gs`の`buyerConvertValue`関数が`viewing_date`を日付型に変換することを確認
- `syncUpdatesToSupabase_`関数が`inquiry_email_reply`の差分チェックを行うことを確認
- `fetchAllBuyersFromSupabase_`関数が`inquiry_email_reply`フィールドを取得することを確認

### Property-Based Tests

- ランダムな内覧日を持つ買主データを生成し、修正後のGASが`viewing_date`を正しく更新することを確認
- ランダムな`inquiry_email_reply`値（`"済"`、`"未"`、`"不要"`、`null`）を持つ買主データを生成し、修正後のGASが正しく更新することを確認
- バグ条件が成立しない入力（新規追加、変更なし）に対して、修正前後の動作が同一であることを確認

### Integration Tests

- 買主7243・7246の内覧日がGAS同期後にDBで正しく更新されることを確認
- 買主7312の`inquiry_email_reply`がGAS同期後にDBで`"済"`に更新されることを確認
- 修正後、「問合メール未対応」サイドバーカウントから買主7312が除外されることを確認
- 売主リスト同期が引き続き正常に動作することを確認
