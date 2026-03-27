# Seller Spreadsheet Encoding Fix - Bugfix Design

## Overview

売主リストでフィールドを編集・保存すると、`SpreadsheetSyncService` が Supabase から
暗号化済みの `name`・`phone_number`・`email` を取得し、復号せずにそのままスプレッドシートに
書き込んでしまう。

修正方針は最小限：`SpreadsheetSyncService.syncToSpreadsheet()` および
`syncBatchToSpreadsheet()` 内で `ColumnMapper.mapToSheet()` に渡す前に
`decrypt()` を呼び出す。

---

## Glossary

- **Bug_Condition (C)**: スプレッドシートへの書き込み対象売主データに、復号されていない
  暗号化フィールド（`name`・`phone_number`・`email`）が含まれている状態
- **Property (P)**: スプレッドシートに書き込まれる `name`・`phone_number`・`email` が
  平文（人間が読める文字列）であること
- **Preservation**: 非暗号化フィールド（`status`・`next_call_date` 等）の書き込み動作、
  行の検索・部分更新ロジック、新規行追加ロジックが変更前と同一であること
- **`decrypt()`**: `backend/src/utils/encryption.ts` の復号関数。
  AES-256-GCM で暗号化された Base64 文字列を平文に戻す。
  空文字・null の場合は空文字を返す。暗号化キーが未設定の場合は入力をそのまま返す。
- **`decryptSeller()`**: `SellerService.supabase.ts` の既存メソッド。
  売主オブジェクト全体を復号して返す。今回の修正の参考実装。
- **`ColumnMapper.mapToSheet()`**: `SellerData` オブジェクトをスプレッドシート行形式に変換する関数。
  この関数は復号処理を持たない。
- **`syncToSpreadsheet()`**: 単一売主を同期する `SpreadsheetSyncService` のメソッド（修正対象）
- **`syncBatchToSpreadsheet()`**: 複数売主を一括同期する `SpreadsheetSyncService` のメソッド（修正対象）

---

## Bug Details

### Bug Condition

`SpreadsheetSyncService` が Supabase から売主データを取得した後、
`name`・`phone_number`・`email` を復号せずに `ColumnMapper.mapToSheet()` に渡している。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller - Supabase から取得した生の売主レコード
  OUTPUT: boolean

  RETURN (seller.name が AES-256-GCM Base64 暗号文である)
      OR (seller.phone_number が AES-256-GCM Base64 暗号文である)
      OR (seller.email が null でなく AES-256-GCM Base64 暗号文である)
END FUNCTION

// 判定補助: 暗号文の最小長は IV(16) + SALT(64) + TAG(16) = 96 バイト → Base64 で 128 文字以上
FUNCTION isEncryptedValue(value)
  RETURN value != null
     AND value != ''
     AND Buffer.from(value, 'base64').length >= 96
END FUNCTION
```

### Examples

- **name**: `acLCZeMGRDaf/DM8rFZBircz+...`（128文字以上の Base64）→ スプシに暗号文が書き込まれる
- **phone_number**: `xK3mP9qR2...`（同上）→ スプシの「電話番号」列に暗号文が書き込まれる
- **email が null**: `null` → `decrypt()` を呼ばず空文字のまま書き込む（クラッシュしない）
- **email が空文字**: `''` → `decrypt('')` は `''` を返す（クラッシュしない）

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 非暗号化フィールド（`status`・`next_call_date`・`visit_date`・`seller_number` 等）は
  変更なくスプレッドシートに書き込まれる
- `seller_number` による既存行の検索・部分更新ロジックは変更されない
- 該当売主がスプレッドシートに存在しない場合の新規行追加ロジックは変更されない
- `email` が `null` または空文字の場合、スプレッドシートの「メールアドレス」列は空のまま書き込まれる（クラッシュしない）
- `SellerService.updateSeller()` が返す復号済みレスポンスは変更されない
- `syncBatchToSpreadsheet()` の成功/失敗カウント・エラー集約ロジックは変更されない

**Scope:**
暗号化フィールド（`name`・`phone_number`・`email`）の復号処理を追加するのみ。
`SpreadsheetSyncService` の他のメソッド（`deleteFromSpreadsheet`・`getUnsyncedSellers` 等）は変更しない。

---

## Hypothesized Root Cause

`SpreadsheetSyncService` は `SellerService` を経由せず、Supabase クライアントを直接使って
売主データを取得している。`SellerService.getSeller()` や `SellerService.updateSeller()` は
`decryptSeller()` を呼び出して復号済みデータを返すが、`SpreadsheetSyncService` はその
パイプラインを通らないため、暗号化されたままのデータが `ColumnMapper.mapToSheet()` に渡される。

```typescript
// SpreadsheetSyncService.syncToSpreadsheet() の問題箇所（現状）
const { data: seller } = await this.supabase
  .from('sellers')
  .select('*')
  .eq('id', sellerId)
  .single();

// ← ここで decrypt() を呼ばずに mapToSheet() に渡している
const sheetRow = this.columnMapper.mapToSheet(seller as SellerData);
```

---

## Correctness Properties

Property 1: Bug Condition - 暗号化フィールドが復号されてスプレッドシートに書き込まれる

_For any_ 売主レコードで `isBugCondition(seller)` が true（`name`・`phone_number`・`email`
のいずれかが暗号文）の場合、修正後の `syncToSpreadsheet()` および `syncBatchToSpreadsheet()`
は `decrypt()` を適用した平文をスプレッドシートに書き込む SHALL。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 非暗号化フィールドの書き込み動作が変わらない

_For any_ 売主レコードで `isBugCondition(seller)` が false（暗号化フィールドが既に平文、
または対象外フィールドのみ更新）の場合、修正後の関数は修正前と同一の結果を
スプレッドシートに書き込む SHALL。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

**File**: `backend/src/services/SpreadsheetSyncService.ts`

**Import 追加**:
```typescript
import { decrypt } from '../utils/encryption';
```

**Helper 関数追加**（クラス内 private メソッド、または同ファイルのモジュールレベル関数）:
```typescript
/**
 * 売主の暗号化フィールドを復号する
 * email は null の場合があるため null-safe に処理する
 */
private decryptSellerFields(seller: any): any {
  return {
    ...seller,
    name: decrypt(seller.name || ''),
    phone_number: decrypt(seller.phone_number || ''),
    email: seller.email ? decrypt(seller.email) : seller.email,
  };
}
```

**`syncToSpreadsheet()` の修正箇所**:
```typescript
// 修正前
const sheetRow = this.columnMapper.mapToSheet(seller as SellerData);

// 修正後
const decryptedSeller = this.decryptSellerFields(seller);
const sheetRow = this.columnMapper.mapToSheet(decryptedSeller as SellerData);
```

**`syncBatchToSpreadsheet()` の修正箇所**:
```typescript
// 修正前（for ループ内）
const sheetRow = this.columnMapper.mapToSheet(seller as SellerData);

// 修正後
const decryptedSeller = this.decryptSellerFields(seller);
const sheetRow = this.columnMapper.mapToSheet(decryptedSeller as SellerData);
```

### 修正の制約

- `ENCRYPTION_KEY` は変更しない（`encryption-key-protection.md` 参照）
- `backend/api/` は触らない（公開物件サイト用バックエンド）
- `email` が `null` の場合は `decrypt()` を呼ばず `null` のまま渡す

---

## Testing Strategy

### Validation Approach

2フェーズアプローチ：
1. **未修正コードで探索的テスト**を実行し、バグを再現・根本原因を確認する
2. **修正後に Fix Checking と Preservation Checking** を実行し、正しさを検証する

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因（`decrypt()` 未呼び出し）を確認する。

**Test Plan**: `SpreadsheetSyncService.syncToSpreadsheet()` に暗号化済みフィールドを持つ
モック売主データを渡し、`ColumnMapper.mapToSheet()` に渡される値が暗号文のままであることを確認する。

**Test Cases**:
1. **name 暗号文テスト**: `name` が Base64 暗号文の売主データで `syncToSpreadsheet()` を呼び出し、
   スプレッドシートに書き込まれる「名前」列の値が暗号文のままであることを確認（未修正コードで失敗）
2. **phone_number 暗号文テスト**: 同様に `phone_number` が暗号文のまま書き込まれることを確認
3. **email 暗号文テスト**: `email` が暗号文のまま書き込まれることを確認
4. **email null テスト**: `email` が `null` の場合にクラッシュしないことを確認（未修正でも通過する可能性あり）
5. **バッチ暗号文テスト**: `syncBatchToSpreadsheet()` で複数売主の暗号化フィールドが
   暗号文のまま書き込まれることを確認

**Expected Counterexamples**:
- スプレッドシートの「名前」列に `acLCZeMGRDaf/DM8rFZBircz+...` のような文字列が書き込まれる
- 原因: `mapToSheet()` 呼び出し前に `decrypt()` が呼ばれていない

### Fix Checking

**Goal**: 修正後、`isBugCondition` が true の全入力に対して平文が書き込まれることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := syncToSpreadsheet_fixed(seller.id)
  ASSERT sheetRow['名前(漢字のみ）'] は平文（Base64 暗号文でない）
  ASSERT sheetRow['電話番号\nハイフン不要'] は平文
  ASSERT sheetRow['メールアドレス'] は平文（email が null でない場合）
END FOR
```

### Preservation Checking

**Goal**: 修正後、`isBugCondition` が false の全入力（非暗号化フィールドのみ更新等）に対して
修正前と同一の結果が書き込まれることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT syncToSpreadsheet_original(seller) = syncToSpreadsheet_fixed(seller)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。
- ランダムな非暗号化フィールド値（`status`・`next_call_date` 等）を生成し、
  修正前後で `mapToSheet()` の出力が同一であることを検証する
- `email = null` のエッジケースを必ず含める

**Test Cases**:
1. **非暗号化フィールド保持テスト**: `status`・`next_call_date`・`seller_number` 等が
   修正前後で同一の値でスプレッドシートに書き込まれることを確認
2. **email null 保持テスト**: `email = null` の場合、修正前後でクラッシュせず
   「メールアドレス」列が空のまま書き込まれることを確認
3. **行検索ロジック保持テスト**: `seller_number` による既存行検索が修正前後で同一動作することを確認
4. **新規行追加保持テスト**: 既存行がない場合の新規追加ロジックが変更されていないことを確認

### Unit Tests

- `decryptSellerFields()` ヘルパーの単体テスト
  - 暗号化済み `name`・`phone_number`・`email` が正しく復号されること
  - `email = null` の場合に `null` が返ること（クラッシュしないこと）
  - `email = ''` の場合に `''` が返ること
- `syncToSpreadsheet()` の統合テスト（Supabase・GoogleSheetsClient をモック）
- `syncBatchToSpreadsheet()` の統合テスト

### Property-Based Tests

- ランダムな平文文字列（名前・電話番号・メール）を `encrypt()` で暗号化し、
  `decryptSellerFields()` で復号した結果が元の平文と一致することを検証
- ランダムな非暗号化フィールド値を持つ売主データで、修正前後の `mapToSheet()` 出力が
  暗号化フィールド以外で同一であることを検証

### Integration Tests

- 実際の `ENCRYPTION_KEY` を使用して暗号化した売主データを `syncToSpreadsheet()` に渡し、
  スプレッドシートに平文が書き込まれることを確認（ステージング環境）
- `SellerService.updateSeller()` → `SyncQueue` → `SpreadsheetSyncService` の
  エンドツーエンドフローで、スプレッドシートに平文が書き込まれることを確認
