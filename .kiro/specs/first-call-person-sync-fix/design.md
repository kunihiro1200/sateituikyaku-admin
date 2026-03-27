# first-call-person-sync-fix バグ修正設計

## Overview

売主の「1番電話」フィールド（`first_call_person`）がスプレッドシート ↔ データベース間で正しく同期されていないバグを修正する。

バグの本質は**カラム名の不一致**1点に集約される。`syncSingleSeller` / `updateSingleSeller` / `detectUpdatedSellers` の全メソッド、および `column-mapping.json` の `spreadsheetToDatabase` セクションが `"一番TEL"` というキーでスプレッドシート行を参照しているが、実際のスプレッドシートカラム名は `"1番電話"` である。このため、常に `undefined` が返り、`first_call_person` の同期が機能しない。

修正は最小限：`"一番TEL"` という文字列を `"1番電話"` に変更する2箇所のみ。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — スプレッドシートの `"1番電話"` カラムに値が存在するが、コードが `"一番TEL"` というキーで参照するため `undefined` になる状態
- **Property (P)**: 期待される正しい動作 — `row['1番電話']` の値が `first_call_person` としてDBに保存・更新される
- **Preservation**: 修正によって変更してはならない既存の動作 — 他のフィールドの同期処理、DB→スプシ方向のマッピング（`databaseToSpreadsheet` の `"一番TEL"` は変更しない）
- **`syncSingleSeller`**: `EnhancedAutoSyncService.ts` 内のメソッド。スプレッドシートにあってDBにない売主を新規追加する
- **`updateSingleSeller`**: `EnhancedAutoSyncService.ts` 内のメソッド。既存売主のデータをスプレッドシートの値で更新する
- **`detectUpdatedSellers`**: `EnhancedAutoSyncService.ts` 内のメソッド。更新が必要な売主を検出するためにスプシとDBを比較する
- **`spreadsheetToDatabase`**: `column-mapping.json` のセクション。スプシカラム名 → DBカラム名のマッピング定義

## Bug Details

### Bug Condition

バグは、スプレッドシートの `"1番電話"` カラムに値が存在する全ての売主に対して発動する。コードが `"一番TEL"` というキーでスプレッドシート行オブジェクトを参照するため、常に `undefined` が返り、`first_call_person` の同期が行われない。

**Formal Specification:**
```
FUNCTION isBugCondition(row)
  INPUT: row of type SpreadsheetRow (スプレッドシートの1行)
  OUTPUT: boolean

  RETURN row['1番電話'] IS NOT undefined
         AND row['1番電話'] IS NOT null
         AND row['1番電話'] !== ''
         AND row['一番TEL'] IS undefined  // 実際のカラム名と参照キーが不一致
END FUNCTION
```

### Examples

- **例1（新規追加）**: スプレッドシートの「1番電話」に `"Y"` が入力されている売主を `syncSingleSeller` で同期 → `row['一番TEL']` が `undefined` のため `first_call_person` がDBに保存されない（期待: `"Y"` が保存される）
- **例2（更新）**: スプレッドシートの「1番電話」を `"I"` に変更後、`updateSingleSeller` で更新 → `row['一番TEL']` が `undefined` のため DBが更新されない（期待: `"I"` に更新される）
- **例3（変更検出）**: `detectUpdatedSellers` で `sheetRow['一番TEL']` を参照 → 常に `""` と評価され、DBの `first_call_person` と比較しても差分が検出されない（期待: 差分が正しく検出される）
- **エッジケース**: 「1番電話」が空欄の場合 → バグ条件を満たさない（`isBugCondition` が false）。修正後も `null` がセットされる動作は変わらない

## Expected Behavior

### Preservation Requirements

**変更してはならない動作:**
- `databaseToSpreadsheet` セクションの `"first_call_person": "一番TEL"` マッピングは変更しない（DB→スプシ方向は既存のまま）
- `phone_contact_person`、`preferred_contact_time`、`contact_method` など他のコミュニケーションフィールドの同期処理は変更しない
- `syncSingleSeller` / `updateSingleSeller` の他のフィールド処理ロジックは変更しない
- `detectUpdatedSellers` の他のフィールド比較ロジックは変更しない

**スコープ:**
「1番電話」カラム以外のフィールドは、この修正によって一切影響を受けない。

## Hypothesized Root Cause

コード全体で `"一番TEL"` というキーを使用しているが、実際のスプレッドシートカラム名は `"1番電話"` である。

具体的な不一致箇所：

1. **`column-mapping.json` の `spreadsheetToDatabase` セクション**:
   ```json
   "一番TEL": "first_call_person"  // ❌ 実際のカラム名は "1番電話"
   ```
   このマッピングは `ColumnMapper.mapToDatabase()` で使用されるが、`syncSingleSeller` / `updateSingleSeller` では `mappedData` 経由ではなく直接 `row['一番TEL']` で参照しているため、マッピング修正だけでは不十分。

2. **`EnhancedAutoSyncService.ts` の3箇所**:
   - `syncSingleSeller`: `const firstCallPerson = row['一番TEL'];`
   - `updateSingleSeller`: `const firstCallPerson = row['一番TEL'];`
   - `detectUpdatedSellers`: `const sheetFirstCallPerson = sheetRow['一番TEL'] || '';`

## Correctness Properties

Property 1: Bug Condition - 1番電話フィールドの同期

_For any_ スプレッドシート行において `row['1番電話']` に値が存在する場合（isBugCondition が true）、修正後の `syncSingleSeller` および `updateSingleSeller` は `first_call_person` をその値でDBに保存・更新する SHALL。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 他フィールドの同期動作維持

_For any_ スプレッドシート行において `row['1番電話']` が空または存在しない場合（isBugCondition が false）、修正後の関数は `phone_contact_person`、`preferred_contact_time`、`contact_method` など他の全フィールドについて修正前と同一の動作を維持する SHALL。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

**修正は最小限の2ファイル・4箇所のみ。**

---

**File 1**: `backend/src/config/column-mapping.json`

**変更箇所**: `spreadsheetToDatabase` セクション

```json
// 修正前
"一番TEL": "first_call_person"

// 修正後
"1番電話": "first_call_person"
```

**注意**: `databaseToSpreadsheet` セクションの `"first_call_person": "一番TEL"` は変更しない（DB→スプシ方向は既存のまま）。

---

**File 2**: `backend/src/services/EnhancedAutoSyncService.ts`

**変更箇所1**: `syncSingleSeller` メソッド内（約1590行目付近）

```typescript
// 修正前
const firstCallPerson = row['一番TEL'];

// 修正後
const firstCallPerson = row['1番電話'];
```

**変更箇所2**: `updateSingleSeller` メソッド内（約1290行目付近）

```typescript
// 修正前
const firstCallPerson = row['一番TEL'];

// 修正後
const firstCallPerson = row['1番電話'];
```

**変更箇所3**: `detectUpdatedSellers` メソッド内（約850行目付近）

```typescript
// 修正前
const sheetFirstCallPerson = sheetRow['一番TEL'] || '';

// 修正後
const sheetFirstCallPerson = sheetRow['1番電話'] || '';
```

---

**重要**: 日本語を含むファイルの編集はPythonスクリプトを使用してUTF-8で書き込む（`file-encoding-protection.md` ルール準拠）。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `row['一番TEL']` が常に `undefined` を返すことを確認するテストを作成し、未修正コードで実行する。

**Test Cases**:
1. **syncSingleSeller バグ確認**: `row['1番電話'] = 'Y'` のスプレッドシート行で `syncSingleSeller` を呼び出し、DBの `first_call_person` が `null` のままであることを確認（未修正コードで失敗するはず）
2. **updateSingleSeller バグ確認**: `row['1番電話'] = 'I'` のスプレッドシート行で `updateSingleSeller` を呼び出し、DBの `first_call_person` が更新されないことを確認（未修正コードで失敗するはず）
3. **detectUpdatedSellers バグ確認**: DBに `first_call_person = 'Y'` が存在し、スプレッドシートの `'1番電話' = 'I'` に変更されても、差分が検出されないことを確認（未修正コードで失敗するはず）

**Expected Counterexamples**:
- `row['一番TEL']` が `undefined` を返すため、`firstCallPerson !== undefined` の条件が false になり、`first_call_person` がDBに設定されない

### Fix Checking

**Goal**: 修正後、バグ条件を満たす全入力に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL row WHERE isBugCondition(row) DO
  result_sync := syncSingleSeller_fixed(sellerNumber, row)
  ASSERT db.first_call_person = row['1番電話']

  result_update := updateSingleSeller_fixed(sellerNumber, row)
  ASSERT db.first_call_person = row['1番電話']
END FOR
```

### Preservation Checking

**Goal**: 修正後、バグ条件を満たさない入力（他フィールド）の動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL row WHERE NOT isBugCondition(row) DO
  ASSERT syncSingleSeller_original(row).phone_contact_person
       = syncSingleSeller_fixed(row).phone_contact_person
  ASSERT updateSingleSeller_original(row).contact_method
       = updateSingleSeller_fixed(row).contact_method
END FOR
```

**Testing Approach**: プロパティベーステストが推奨。様々な `row` データを自動生成し、`phone_contact_person`、`preferred_contact_time`、`contact_method` などの他フィールドが修正前後で同一の動作をすることを検証する。

**Test Cases**:
1. **他コミュニケーションフィールドの保持**: `phone_contact_person`、`preferred_contact_time`、`contact_method` が修正前後で同じ値でDBに保存されることを確認
2. **空欄の場合の保持**: `row['1番電話']` が空欄の場合、`first_call_person` が `null` になることを確認（修正前後で同じ動作）
3. **databaseToSpreadsheet マッピングの保持**: `column-mapping.json` の `databaseToSpreadsheet` セクションで `first_call_person` が引き続き `"一番TEL"` にマッピングされることを確認

### Unit Tests

- `row['1番電話']` に値がある場合、`first_call_person` がDBに保存されることをテスト
- `row['1番電話']` が空欄の場合、`first_call_person` が `null` になることをテスト
- `detectUpdatedSellers` が `'1番電話'` の変更を正しく検出することをテスト

### Property-Based Tests

- ランダムな `row['1番電話']` 値（文字列、空文字、null）を生成し、`first_call_person` の同期が常に正しく動作することを検証
- 他フィールド（`phone_contact_person` 等）がランダムな値でも修正前後で同一の動作をすることを検証

### Integration Tests

- スプレッドシートの「1番電話」カラムに値を設定し、同期後にDBの `first_call_person` に正しく反映されることを確認
- 通話モードページ（CallModePage）で `firstCallPerson` フィールドが正しく表示されることを確認
