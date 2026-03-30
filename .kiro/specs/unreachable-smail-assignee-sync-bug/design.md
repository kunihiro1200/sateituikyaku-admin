# 不通時Sメール担当同期バグ Bugfix Design

## Overview

`EnhancedAutoSyncService.ts` の `updateSingleSeller` および `syncSingleSeller` メソッドに、スプレッドシートの「不通時Sメール担当」列（DBカラム: `unreachable_sms_assignee`）の同期処理が実装されていない。

`column-mapping.json` と `SellerService.decryptSeller` は正しく設定済みであるため、修正箇所は `EnhancedAutoSyncService.ts` の2メソッドのみ。

## Glossary

- **Bug_Condition (C)**: `EnhancedAutoSyncService` の同期処理において `unreachable_sms_assignee` フィールドが `updateData` / `encryptedData` に含まれない状態
- **Property (P)**: スプレッドシートの「不通時Sメール担当」列の値が `unreachable_sms_assignee` カラムとしてDBに保存されること
- **Preservation**: `unreachable_sms_assignee` 以外の全フィールドの同期処理が変更前と同一の動作を維持すること
- **updateSingleSeller**: `EnhancedAutoSyncService.ts` の既存売主更新メソッド（Line 1152付近）
- **syncSingleSeller**: `EnhancedAutoSyncService.ts` の売主UPSERT（新規追加・更新）メソッド（Line 1427付近）
- **encryptedData**: `syncSingleSeller` 内でDBへのUPSERT用データを組み立てるオブジェクト
- **updateData**: `updateSingleSeller` 内でDBへのUPDATE用データを組み立てるオブジェクト

## Bug Details

### Bug Condition

`updateSingleSeller` および `syncSingleSeller` の両メソッドにおいて、コミュニケーションフィールドのブロック（`phone_contact_person`, `preferred_contact_time`, `contact_method` 等）の処理は実装されているが、`unreachable_sms_assignee` の読み取り・設定処理が完全に欠落している。

**Formal Specification:**
```
FUNCTION isBugCondition(row)
  INPUT: row of type SpreadsheetRow
  OUTPUT: boolean

  RETURN row['不通時Sメール担当'] !== undefined
         AND (updateData.unreachable_sms_assignee is NOT set
              OR encryptedData.unreachable_sms_assignee is NOT set)
END FUNCTION
```

### Examples

- **例1（バグあり）**: AA13284 のスプレッドシート「不通時Sメール担当」列に "Y" が入力されている → GAS定期同期後も DB の `unreachable_sms_assignee` は `null` のまま
- **例2（バグあり）**: 新規売主がスプレッドシートに追加され「不通時Sメール担当」に値がある → `syncSingleSeller` 実行後も DB に保存されない
- **例3（正常）**: 「不通時Sメール担当」列が空欄の売主 → DB の既存値は変更されない（`undefined` の場合は設定しない）
- **例4（正常）**: 「不通時Sメール担当」列が空文字の売主 → `null` でクリアされる

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `phone_contact_person`, `preferred_contact_time`, `contact_method` 等の既存コミュニケーションフィールドの同期処理は変更しない
- `unreachable_sms_assignee` 以外の全フィールド（`status`, `next_call_date`, `comments`, `visit_assignee` 等）の同期処理は変更しない
- `SellerService.decryptSeller` の処理は変更しない（既に `unreachableSmsAssignee: seller.unreachable_sms_assignee` が含まれている）
- `column-mapping.json` は変更しない（既に正しく設定済み）
- 空欄（`undefined`）の場合はDBの既存値を変更しない

**Scope:**
`unreachable_sms_assignee` フィールドの追加のみが変更対象。他の全フィールドの処理は完全に影響を受けない。

## Hypothesized Root Cause

1. **実装漏れ**: `phone_contact_person` 等のコミュニケーションフィールドが追加された際に、`unreachable_sms_assignee` が同時に追加されなかった
2. **フィールド名の見落とし**: 「不通」（`unreachable_status`）と「不通時Sメール担当」（`unreachable_sms_assignee`）は別フィールドであり、前者は実装済みだが後者が漏れた
3. **`column-mapping.json` への依存不足**: マッピング定義はあるが、`EnhancedAutoSyncService` は `columnMapper.mapToDatabase()` の結果を直接使わず個別に処理しているため、マッピング追加だけでは同期されない

## Correctness Properties

Property 1: Bug Condition - 不通時Sメール担当の同期

_For any_ スプレッドシート行において `row['不通時Sメール担当']` が `undefined` でない場合、修正後の `updateSingleSeller` および `syncSingleSeller` は `unreachable_sms_assignee` をDBに保存する。値が存在する場合は文字列として保存し、空文字の場合は `null` で保存する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存フィールドの同期処理維持

_For any_ スプレッドシート行において `row['不通時Sメール担当']` が `undefined` である場合、または `unreachable_sms_assignee` 以外のフィールドに関しては、修正後のコードは修正前のコードと完全に同一の動作をする。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

**Function 1**: `updateSingleSeller`

**挿入位置**: コミュニケーションフィールドブロック（`visitReminderAssignee` の処理の直後）

**追加コード**:
```typescript
// 不通時Sメール担当を追加
const unreachableSmsAssignee = row['不通時Sメール担当'];
if (unreachableSmsAssignee !== undefined) {
  updateData.unreachable_sms_assignee = unreachableSmsAssignee ? String(unreachableSmsAssignee) : null;
}
```

**Function 2**: `syncSingleSeller`

**挿入位置**: コミュニケーションフィールドブロック（`visitReminderAssigneeNew` の処理の直後）

**追加コード**:
```typescript
// 不通時Sメール担当を追加
const unreachableSmsAssigneeNew = row['不通時Sメール担当'];
if (unreachableSmsAssigneeNew !== undefined) {
  encryptedData.unreachable_sms_assignee = unreachableSmsAssigneeNew ? String(unreachableSmsAssigneeNew) : null;
}
```

**変更の最小性**: 2箇所のみの追加。既存コードへの変更なし。

## Testing Strategy

### Validation Approach

2フェーズアプローチ：まず未修正コードでバグを確認し、次に修正後の動作とリグレッションがないことを検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードで `unreachable_sms_assignee` が同期されないことを確認し、根本原因を裏付ける。

**Test Plan**: `updateSingleSeller` および `syncSingleSeller` に「不通時Sメール担当」を含む行データを渡し、DBへの保存内容を検証する。未修正コードではテストが失敗することを確認する。

**Test Cases**:
1. **updateSingleSeller バグ確認**: `row['不通時Sメール担当'] = 'Y'` を渡した場合、`updateData` に `unreachable_sms_assignee` が含まれないことを確認（未修正コードで失敗）
2. **syncSingleSeller バグ確認**: `row['不通時Sメール担当'] = 'Y'` を渡した場合、`encryptedData` に `unreachable_sms_assignee` が含まれないことを確認（未修正コードで失敗）
3. **AA13284 実データ確認**: AA13284 のスプレッドシートデータで同期を実行し、DB の `unreachable_sms_assignee` が `null` のままであることを確認

**Expected Counterexamples**:
- `updateData.unreachable_sms_assignee` が `undefined`（設定されていない）
- `encryptedData.unreachable_sms_assignee` が `undefined`（設定されていない）

### Fix Checking

**Goal**: 修正後、バグ条件が成立する全入力に対して期待動作が実現されることを検証する。

**Pseudocode:**
```
FOR ALL row WHERE isBugCondition(row) DO
  result := updateSingleSeller_fixed(sellerNumber, row)
  ASSERT result.unreachable_sms_assignee === String(row['不通時Sメール担当'])
         OR (row['不通時Sメール担当'] === '' AND result.unreachable_sms_assignee === null)
END FOR
```

### Preservation Checking

**Goal**: `unreachable_sms_assignee` 以外のフィールドの処理が変更前後で同一であることを検証する。

**Pseudocode:**
```
FOR ALL row WHERE NOT isBugCondition(row) DO
  ASSERT updateSingleSeller_original(row) === updateSingleSeller_fixed(row)
END FOR
```

**Testing Approach**: プロパティベーステストにより、多様な入力パターンで既存フィールドの処理が変わらないことを確認する。

**Test Cases**:
1. **既存フィールド保持**: `phone_contact_person`, `preferred_contact_time`, `contact_method` の処理が変わらないことを確認
2. **空欄時の非更新**: `row['不通時Sメール担当'] = undefined` の場合、`updateData` に `unreachable_sms_assignee` が含まれないことを確認
3. **空文字時のnullクリア**: `row['不通時Sメール担当'] = ''` の場合、`unreachable_sms_assignee = null` になることを確認

### Unit Tests

- `updateSingleSeller` に `row['不通時Sメール担当'] = 'Y'` を渡した場合、`unreachable_sms_assignee = 'Y'` でDBが更新されること
- `syncSingleSeller` に `row['不通時Sメール担当'] = 'Y'` を渡した場合、`unreachable_sms_assignee = 'Y'` でUPSERTされること
- `row['不通時Sメール担当'] = undefined` の場合、`unreachable_sms_assignee` がDBに書き込まれないこと
- `row['不通時Sメール担当'] = ''` の場合、`unreachable_sms_assignee = null` でDBが更新されること

### Property-Based Tests

- ランダムな売主データで `updateSingleSeller` を実行し、`unreachable_sms_assignee` 以外のフィールドが変更前後で同一であることを確認
- `row['不通時Sメール担当']` に任意の文字列を渡した場合、常に `String(value)` として保存されることを確認

### Integration Tests

- AA13284 のスプレッドシートデータで GAS 定期同期を実行し、DB の `unreachable_sms_assignee` に正しい値が保存されることを確認
- `SellerService.decryptSeller` が `unreachableSmsAssignee` を正しく返すことを確認（既存実装の動作確認）
