# seller-phone1-disappearing-bug Bugfix Design

## Overview

売主リストの「1番電話」フィールド（DB: `first_call_person`、スプレッドシート: Y列「1番電話」）が、通話モードページで保存後にしばらく経つと消えてしまうバグの修正設計。

根本原因は2点：
1. **主因**: `EnhancedAutoSyncService.ts` が `row['一番TEL']`（誤ったキー名）を参照しているため、定期同期のたびに `first_call_person` が `null` で上書きされる
2. **副因**: `SellerService.supabase.ts` の `createSeller` がスプレッドシートの `'1番電話'` 列に `data.assignedTo`（営業担当）を書き込んでいる

加えて、通話モードページで1番電話を保存（`PUT /api/sellers/:id`）した際に、スプレッドシートのY列（1番電話）へ即時同期する処理が欠落している。

## Glossary

- **Bug_Condition (C)**: `EnhancedAutoSyncService` の同期処理が実行され、スプレッドシート行に `'1番電話'` キーで値が存在する状況
- **Property (P)**: 同期後も `first_call_person` がスプレッドシートの `'1番電話'` 列の値と一致していること
- **Preservation**: 1番電話以外のフィールド（`status`、`next_call_date`、`comments` 等）の同期動作が変わらないこと
- **EnhancedAutoSyncService**: `backend/src/services/EnhancedAutoSyncService.ts` — スプレッドシート→DB の定期自動同期を担うサービス
- **SpreadsheetSyncService**: `backend/src/services/SpreadsheetSyncService.ts` — DB→スプレッドシート の即時同期を担うサービス
- **first_call_person**: DBカラム名。スプレッドシートのY列「1番電話」に対応
- **syncSingleSeller**: `EnhancedAutoSyncService` の新規売主作成メソッド
- **updateSingleSeller**: `EnhancedAutoSyncService` の既存売主更新メソッド
- **detectUpdatedSellers**: `EnhancedAutoSyncService` の差分検出メソッド

## Bug Details

### Bug Condition

バグは `EnhancedAutoSyncService` の同期処理が実行されるたびに発生する。`detectUpdatedSellers`・`syncSingleSeller`・`updateSingleSeller` の3箇所で `row['一番TEL']` という誤ったキー名を使用しているため、常に `undefined` / `''` を取得し、DBの `first_call_person` を `null` で上書きしてしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type SyncEvent
  OUTPUT: boolean

  RETURN X.source = "EnhancedAutoSyncService"
    AND X.sheetRow["1番電話"] IS NOT NULL
    AND X.sheetRow["1番電話"] != ""
END FUNCTION
```

### Examples

- **例1（主因）**: ユーザーが通話モードで「1番電話」に "Y" を入力して保存 → 数分後に定期同期が実行 → `row['一番TEL']` が `undefined` のため `first_call_person = null` で上書き → 値が消える
- **例2（主因）**: スプレッドシートのY列に "I" が入力されている売主 → `detectUpdatedSellers` が `sheetRow['一番TEL']`（常に `''`）と比較するため差分を検出できず → DBに反映されない
- **例3（副因）**: 新規売主登録時 → `createSeller` がスプレッドシートの `'1番電話'` 列に `data.assignedTo`（営業担当イニシャル）を書き込む → 1番電話担当者ではなく営業担当者の値が記録される
- **例4（追加修正）**: 通話モードで「1番電話」を保存 → `PUT /api/sellers/:id` でDBは更新されるが、スプレッドシートのY列は即時更新されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `PUT /api/sellers/:id` による `first_call_person` のDB保存フローは変更しない
- スプレッドシートの「1番電話」列が空欄の場合、`first_call_person` を `null` として扱い続ける
- `EnhancedAutoSyncService` が他のフィールド（`status`、`next_call_date`、`comments`、`contact_method`、`preferred_contact_time` 等）を同期する動作は変更しない
- `SellerService.createSeller` が `first_call_person` 以外のスプレッドシート書き込みフィールドを従来通り書き込み続ける
- `column-mapping.json` の `databaseToSpreadsheet` セクションで `first_call_person` が `"一番TEL"` にマッピングされている場合、DB→スプレッドシート方向の同期（`SpreadsheetSyncService`）は変更しない

**Scope:**
1番電話フィールド以外の全フィールドの同期動作は完全に影響を受けない。

## Hypothesized Root Cause

1. **誤ったキー名（主因）**: `EnhancedAutoSyncService.ts` の3箇所で `row['一番TEL']` を使用。スプレッドシートの実際のカラム名は `'1番電話'`（Y列）であるため、常に `undefined` を取得する。
   - `detectUpdatedSellers`: 差分比較で `sheetRow['一番TEL']`（常に `''`）を使用
   - `syncSingleSeller`: 新規作成時に `row['一番TEL']` を参照
   - `updateSingleSeller`: 既存更新時に `row['一番TEL']` を参照

2. **createSeller の誤マッピング（副因）**: `SellerService.supabase.ts` の `createSeller` がスプレッドシートに新規行を追加する際、`'1番電話'` 列に `data.assignedTo`（営業担当）を書き込んでいる。正しくは `data.firstCallPerson` を書き込むべき。

3. **即時同期の欠落（追加修正）**: `PUT /api/sellers/:id` で `first_call_person` を更新した際、`SpreadsheetSyncService.syncToSpreadsheet()` が呼ばれていないか、呼ばれていても `first_call_person` がスプレッドシートのY列（`'1番電話'`）に書き込まれていない。

## Correctness Properties

Property 1: Bug Condition - 1番電話同期の正確性

_For any_ 同期イベント X において、バグ条件が成立する（`isBugCondition(X)` が true を返す）場合、修正後の同期関数は `first_call_person` をスプレッドシートの `'1番電話'` 列の値と一致させなければならない。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - 非バグ入力の動作保持

_For any_ 同期イベント X において、バグ条件が成立しない（`isBugCondition(X)` が false を返す）場合、修正後の同期関数は修正前と同一の結果を生成し、他の全フィールドの同期動作を保持しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合の修正内容：

**File 1**: `backend/src/services/EnhancedAutoSyncService.ts`

**Specific Changes**:
1. **`detectUpdatedSellers` のキー名修正**: `sheetRow['一番TEL']` → `sheetRow['1番電話']`
2. **`syncSingleSeller` のキー名修正**: `row['一番TEL']` → `row['1番電話']`
3. **`updateSingleSeller` のキー名修正**: `row['一番TEL']` → `row['1番電話']`

---

**File 2**: `backend/src/services/SellerService.supabase.ts`

**Specific Changes**:
4. **`createSeller` の誤マッピング修正**: スプレッドシート追加時の `'1番電話'` 列の値を `(data as any).assignedTo` → `(data as any).firstCallPerson` に変更

---

**File 3**: `backend/src/routes/sellers.ts`

**Specific Changes**:
5. **`PUT /api/sellers/:id` での即時スプレッドシート同期追加**: `first_call_person` が更新された場合（`data.firstCallPerson !== undefined`）、`SpreadsheetSyncService.syncToSpreadsheet(sellerId)` を呼び出してY列を即時更新する

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後の正確性と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `EnhancedAutoSyncService` の各メソッドに対して、`'1番電話'` 列に値を持つスプレッドシート行をモックし、DBへの書き込み内容を検証する。未修正コードでは `first_call_person` が `null` になることを確認する。

**Test Cases**:
1. **detectUpdatedSellers テスト**: `sheetRow['1番電話'] = 'Y'`、`dbSeller.first_call_person = 'Y'` の場合、差分なしと判定されるべきだが、未修正コードでは差分ありと誤判定される（will fail on unfixed code）
2. **syncSingleSeller テスト**: `row['1番電話'] = 'Y'` の行を新規作成した場合、`first_call_person = 'Y'` でDBに保存されるべきだが、未修正コードでは `null` になる（will fail on unfixed code）
3. **updateSingleSeller テスト**: `row['1番電話'] = 'I'` の行を更新した場合、`first_call_person = 'I'` でDBに反映されるべきだが、未修正コードでは `null` で上書きされる（will fail on unfixed code）
4. **createSeller スプレッドシート書き込みテスト**: `firstCallPerson = 'Y'`、`assignedTo = 'I'` で新規登録した場合、スプレッドシートの `'1番電話'` 列に `'Y'` が書き込まれるべきだが、未修正コードでは `'I'` が書き込まれる（will fail on unfixed code）

**Expected Counterexamples**:
- `first_call_person` が `null` で上書きされる
- 原因: `row['一番TEL']` が常に `undefined` を返すため

### Fix Checking

**Goal**: バグ条件が成立する全入力に対して、修正後の関数が期待動作を示すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := syncFixed(X)
  ASSERT result.first_call_person = X.sheetRow["1番電話"]
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない全入力に対して、修正後の関数が修正前と同一の結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT syncOriginal(X) = syncFixed(X)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。理由：
- 多様な入力パターンを自動生成できる
- 手動テストでは見落としがちなエッジケースを検出できる
- 全非バグ入力に対して動作が変わらないことを強く保証できる

**Test Plan**: 未修正コードで `status`、`next_call_date`、`comments` 等の他フィールドの動作を観察し、修正後も同一動作であることをプロパティベーステストで検証する。

**Test Cases**:
1. **他フィールド保持テスト**: `status`、`next_call_date`、`comments`、`contact_method`、`preferred_contact_time` の同期動作が修正前後で変わらないことを確認
2. **空欄保持テスト**: `'1番電話'` 列が空欄の場合、`first_call_person` が `null` のままであることを確認
3. **即時同期テスト**: `PUT /api/sellers/:id` で `firstCallPerson` を更新後、スプレッドシートのY列が即時更新されることを確認

### Unit Tests

- `detectUpdatedSellers` が `sheetRow['1番電話']` を正しく参照することを確認
- `syncSingleSeller` が `row['1番電話']` を `first_call_person` に正しくマッピングすることを確認
- `updateSingleSeller` が `row['1番電話']` を `first_call_person` に正しく反映することを確認
- `createSeller` がスプレッドシートの `'1番電話'` 列に `firstCallPerson` を書き込むことを確認
- `PUT /api/sellers/:id` で `firstCallPerson` 更新時にスプレッドシート同期が呼ばれることを確認

### Property-Based Tests

- ランダムなスプレッドシート行データを生成し、`'1番電話'` 列の値が `first_call_person` に正しく同期されることを検証
- ランダムな売主データを生成し、`'1番電話'` 以外のフィールドの同期動作が変わらないことを検証
- 多様な `firstCallPerson` 値（イニシャル、空文字、null）に対して `createSeller` のスプレッドシート書き込みが正しいことを検証

### Integration Tests

- 通話モードページで「1番電話」を保存後、スプレッドシートのY列が即時更新されることを確認
- 定期同期実行後も `first_call_person` が保持されることを確認
- 新規売主登録後、スプレッドシートのY列に正しい値が書き込まれることを確認
