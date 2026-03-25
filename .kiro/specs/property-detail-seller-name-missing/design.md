# 物件詳細画面 売主氏名未表示バグ 修正デザイン

## Overview

`property_listings.seller_name` カラムに、過去の `PropertyListingSyncService.mapSellerToPropertyListing()` が復号処理なしで `sellers.name`（暗号化済み）をそのままコピーしたため、暗号文が保存されている。

修正方針：一括修正スクリプト `backend/fix-seller-name-in-property-listings.ts` を作成し、暗号化文字列を検出して `sellers.name` を復号した値で上書きする。現在のコード（`decrypt(seller.name)`）は既に修正済みのため、コード変更は不要。

## Glossary

- **Bug_Condition (C)**: `property_listings.seller_name` に暗号化文字列（Base64エンコードされた暗号文）が保存されている状態
- **Property (P)**: `seller_name` が対応する `sellers.name` を復号した平文の売主氏名であること
- **Preservation**: 既に平文が保存されているレコード、NULL/空文字のレコードは変更しない
- **isEncrypted(value)**: 値が暗号化文字列かどうかを判定する関数（Base64デコード後のバイト長が96バイト以上かつAES-GCM構造を持つ）
- **decrypt(encryptedData)**: `backend/src/utils/encryption.ts` の復号関数（AES-256-GCM）

## Bug Details

### Bug Condition

`property_listings.seller_name` に暗号化文字列が保存されているレコードが多数存在する。`PropertyListingSyncService.mapSellerToPropertyListing()` が過去に `decrypt()` を呼ばずに `sellers.name` をそのままコピーしたことが原因。

**Formal Specification:**
```
FUNCTION isBugCondition(record)
  INPUT: record of type property_listings row
  OUTPUT: boolean

  IF record.seller_name IS NULL OR record.seller_name = '' THEN
    RETURN false
  END IF

  decoded := base64Decode(record.seller_name)
  // AES-256-GCM: IV(16) + SALT(64) + TAG(16) + encrypted = 最小96バイト
  RETURN decoded.length >= 96
END FUNCTION
```

### Examples

- `seller_name = "acLCZeMGRDaf/DM8rFZBircz+..."` → バグ条件あり（暗号化文字列）→ 復号して「山田 太郎」に更新
- `seller_name = "田中 花子"` → バグ条件なし（平文）→ 変更しない
- `seller_name = NULL` → バグ条件なし → 変更しない
- `seller_name = ""` → バグ条件なし → 変更しない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `seller_name` に平文の売主氏名が保存されているレコードは変更しない
- `seller_name` が NULL または空文字のレコードは変更しない
- 物件詳細画面で正しく売主氏名が表示されているレコードは影響を受けない
- `sellers.name` が NULL の場合、`property_listings.seller_name` は NULL のまま

**Scope:**
バグ条件（`isBugCondition` が true）を満たさない全レコードは、修正スクリプト実行後も完全に変更されない。

## Hypothesized Root Cause

1. **復号処理の欠落**: 過去の `mapSellerToPropertyListing()` が `seller.name` を `decrypt()` せずにそのままコピーした
   - 現在のコードは `seller.name ? decrypt(seller.name) : null` で修正済み
   - 既存レコードは修正されていない

2. **スプレッドシートのO列が空の可能性**: GASが `sellers.name`（暗号化文字列）をO列にコピーしていた可能性があり、スプレッドシート経由の同期でも暗号文が入った可能性がある

3. **既存レコードの未修正**: コード修正後も既存レコードは自動的に修正されないため、一括修正スクリプトが必要

## Correctness Properties

Property 1: Bug Condition - 暗号化seller_nameの復号更新

_For any_ `property_listings` レコードで `isBugCondition` が true（`seller_name` が暗号化文字列）の場合、修正スクリプトは対応する `sellers.name` を `decrypt()` した平文の売主氏名で `seller_name` を上書きする SHALL。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 非暗号化レコードの保持

_For any_ `property_listings` レコードで `isBugCondition` が false（`seller_name` が平文・NULL・空文字）の場合、修正スクリプトはそのレコードの `seller_name` を変更しない SHALL。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**新規作成**: `backend/fix-seller-name-in-property-listings.ts`

**処理フロー**:
1. `property_listings` テーブルから `seller_name` が NULL でない全レコードを取得
2. 各レコードに対して `isBugCondition` を評価
3. バグ条件を満たすレコードについて、`property_number` で `sellers` テーブルを検索
4. `sellers.name` を `decrypt()` して `property_listings.seller_name` を更新
5. `sellers` が見つからない場合はスキップ（ログ出力）
6. 実行結果（更新件数・スキップ件数・エラー件数）をコンソールに出力

**暗号化文字列の検出ロジック**:
```typescript
function isEncryptedValue(value: string): boolean {
  if (!value) return false;
  try {
    const buffer = Buffer.from(value, 'base64');
    // AES-256-GCM: IV(16) + SALT(64) + TAG(16) = 最小96バイト
    return buffer.length >= 96;
  } catch {
    return false;
  }
}
```

**実行コマンド**:
```bash
npx ts-node backend/fix-seller-name-in-property-listings.ts
```

**既存コードの変更**: なし（`PropertyListingSyncService.mapSellerToPropertyListing()` は既に修正済み）

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを確認し、スクリプト実行後に修正を検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正スクリプト実行前に、暗号化文字列が実際に存在することを確認する。

**Test Plan**: `property_listings` テーブルを直接クエリして暗号化文字列の存在を確認する。

**Test Cases**:
1. **暗号化文字列の存在確認**: `seller_name` が Base64 かつ 96バイト以上のレコードを検索（修正前に失敗するはず）
2. **物件詳細画面での表示確認**: 暗号化文字列が画面に表示されることを確認

**Expected Counterexamples**:
- `seller_name` に `acLCZeMGRDaf/...` のような文字列が含まれるレコードが存在する
- 物件詳細画面で売主氏名が意味不明な文字列または空欄として表示される

### Fix Checking

**Goal**: 修正スクリプト実行後、バグ条件を満たす全レコードが正しく更新されることを確認する。

**Pseudocode:**
```
FOR ALL record WHERE isBugCondition(record) DO
  result := fixScript.run(record)
  ASSERT isPlainText(result.seller_name)
  ASSERT result.seller_name = decrypt(sellers[record.property_number].name)
END FOR
```

### Preservation Checking

**Goal**: 修正スクリプト実行後、バグ条件を満たさないレコードが変更されていないことを確認する。

**Pseudocode:**
```
FOR ALL record WHERE NOT isBugCondition(record) DO
  ASSERT original.seller_name = fixed.seller_name
END FOR
```

**Testing Approach**: プロパティベーステストで `isEncryptedValue` 関数の正確性を検証する。

**Test Cases**:
1. **平文保持確認**: 平文が入っているレコードが変更されないことを確認
2. **NULL保持確認**: NULL のレコードが変更されないことを確認
3. **空文字保持確認**: 空文字のレコードが変更されないことを確認

### Unit Tests

- `isEncryptedValue()` 関数のユニットテスト（暗号化文字列・平文・NULL・空文字）
- `decrypt()` 関数が正しく復号できることの確認
- スクリプトのドライランモード（実際には更新しない）での動作確認

### Property-Based Tests

- 任意の平文文字列を `isEncryptedValue()` に渡すと false を返すことを検証
- 任意の暗号化文字列（`encrypt()` で生成）を `isEncryptedValue()` に渡すと true を返すことを検証
- `decrypt(encrypt(text)) === text` の恒等性を検証

### Integration Tests

- スクリプト実行後、`property_listings` テーブルに暗号化文字列が残っていないことを確認
- 物件詳細画面で売主氏名が正しく表示されることを確認
- 平文が入っていたレコードが変更されていないことを確認
