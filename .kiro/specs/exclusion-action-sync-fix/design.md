# exclusion-action-sync-fix バグ修正設計

## Overview

売主の「除外日にすること」フィールド（DBカラム: `exclusion_action`、スプレッドシートカラム: `除外日にすること`）が、データベースとスプレッドシート間で双方向に同期されていないバグを修正する。

**バグの影響範囲**:
- **DB → スプシ（即時同期）**: `column-mapping.json` の `databaseToSpreadsheet` セクションに `exclusion_action` のマッピングが存在しないため、ブラウザで保存した値がスプレッドシートに反映されない
- **スプシ → DB（GAS定期同期）**: `gas_complete_code.js` の `syncSellerList` 関数に `除外日にすること` の同期処理が存在しないため、スプレッドシートの変更がDBに反映されない

**修正方針**: 最小限の変更で双方向同期を追加する。`SellerService.supabase.ts` の `updateSeller`（line 567-569）および APIレスポンス（line 1552）は既に `exclusion_action` を正しく扱っているため、修正不要。

---

## Glossary

- **Bug_Condition (C)**: 「除外日にすること」フィールドが同期対象から除外されている状態（`column-mapping.json` の `databaseToSpreadsheet` マッピング欠落 + GAS同期処理欠落）
- **Property (P)**: 「除外日にすること」の値がブラウザ保存時にスプシへ即時反映され、かつGAS定期同期でスプシ→DBへも反映される動作
- **Preservation**: 他の全フィールドの同期動作が変更前と同一であること
- **exclusion_action**: `sellers` テーブルの `TEXT` 型カラム。次電日の自動除外設定（「次電日に不通であれば除外」「次電日になにもせずに除外」等）を格納
- **SpreadsheetSyncService**: `backend/src/services/SpreadsheetSyncService.ts`。`ColumnMapper.mapToSheet()` を使って DB → スプシ変換を行うサービス
- **syncSellerList**: `gas_complete_code.js` 内のGAS関数。10分ごとにスプシ→DBの定期同期を実行する
- **column-mapping.json**: `backend/src/config/column-mapping.json`。スプシカラム名 ↔ DBカラム名のマッピング定義ファイル

---

## Bug Details

### Bug Condition

バグは「除外日にすること」フィールドに関する操作が発生したとき（ブラウザでの保存、またはスプレッドシートでの変更）に顕在化する。`column-mapping.json` の `databaseToSpreadsheet` にマッピングが存在せず、GASの `syncSellerList` にも処理が含まれていないため、値が双方向とも同期されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SyncOperation
  OUTPUT: boolean

  RETURN input.fieldName = '除外日にすること'
         AND (
           NOT 'exclusion_action' IN databaseToSpreadsheet.keys
           OR NOT '除外日にすること' IN syncSellerList.processedFields
         )
END FUNCTION
```

### Examples

- **例1（DB→スプシ、ブラウザ保存）**: ブラウザで売主の「除外日にすること」を「次電日になにもせずに除外」に設定して保存 → DBには保存されるが、スプシの「除外日にすること」列が空欄のまま（期待値: 「次電日になにもせずに除外」が反映される）
- **例2（スプシ→DB、GAS定期同期）**: スプシの「除外日にすること」列を「次電日に不通であれば除外」に変更後、GASの `syncSellerList` が実行される → DBの `exclusion_action` が更新されない（期待値: 「次電日に不通であれば除外」に更新される）
- **例3（スプシ→DB、null値）**: スプシの「除外日にすること」列が空欄の売主を同期 → エラーなく処理され、DBの `exclusion_action` が `null` になる（期待値: 正常処理）
- **エッジケース（空欄→null）**: スプシの「除外日にすること」が空欄 → `null` としてDBに保存され、エラーは発生しない

---

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- `spreadsheetToDatabase` セクションの既存マッピング定義（追加のみ、変更・削除なし）
- `databaseToSpreadsheet` セクションの既存マッピング定義（追加のみ、変更・削除なし）
- `syncSellerList` 内の他フィールド（`first_call_person`、`status`、`next_call_date`、`comments` 等）の同期処理
- `SellerService.supabase.ts` の `updateSeller` および APIレスポンスの既存実装（修正不要）
- フロントエンドからの直接保存（`PUT /api/sellers/:id`）の動作

**スコープ:**
`exclusion_action` / `除外日にすること` 以外の全フィールドは、この修正によって一切影響を受けてはならない。

---

## Hypothesized Root Cause

コードベースの調査により、根本原因は以下の 2 点と特定された：

1. **`column-mapping.json` の `databaseToSpreadsheet` マッピング欠落**
   - `databaseToSpreadsheet` セクションに `"exclusion_action": "除外日にすること"` が存在しない
   - `SpreadsheetSyncService` は `ColumnMapper.mapToSheet()` を使ってDB→スプシ変換するため、このマッピングを追加するだけで即時同期が機能する
   - なお `spreadsheetToDatabase` セクションにも `"除外日にすること": "exclusion_action"` が存在しないため、こちらも追加が必要

2. **`gas_complete_code.js` の `syncSellerList` 関数に同期処理欠落**
   - `syncSellerList` 内に `row['除外日にすること']` を参照して `exclusion_action` を更新するブロックが存在しない
   - `first_call_person` の同期処理（直後）に倣って追加する必要がある

**確認済み事項（修正不要）:**
- `SellerService.supabase.ts` の `updateSeller` は既に `exclusionAction` → `exclusion_action` の保存処理あり（line 567-569）
- `SellerService.supabase.ts` の APIレスポンスも既に `exclusionAction: seller.exclusion_action` を返している（line 1552）
- DB カラム `sellers.exclusion_action` は `TEXT` 型で既に存在する

---

## Correctness Properties

Property 1: Bug Condition - 除外日にすることフィールドの双方向同期

_For any_ 同期操作において `exclusion_action` / `除外日にすること` フィールドが対象となる場合（isBugCondition が true）、修正後のシステムは DB → スプシ方向（`SpreadsheetSyncService` 経由）およびスプシ → DB 方向（GAS `syncSellerList` 経由）の両方で値を正しく同期しなければならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 他フィールドの同期動作維持

_For any_ 同期操作において `exclusion_action` / `除外日にすること` 以外のフィールドが対象となる場合（isBugCondition が false）、修正後のコードは `first_call_person`、`status`、`next_call_date`、`comments` 等の全フィールドについて修正前と完全に同一の動作を維持しなければならない。

**Validates: Requirements 3.1, 3.2, 3.3**

---

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の 2 ファイルのみを変更する。

---

**File 1**: `backend/src/config/column-mapping.json`

**変更内容**:

1. **`spreadsheetToDatabase` セクションに追加**（`"固定資産税路線価"` エントリの近傍）:
   ```json
   "除外日にすること": "exclusion_action"
   ```

2. **`databaseToSpreadsheet` セクションに追加**（`"fixed_asset_tax_road_price"` エントリの近傍）:
   ```json
   "exclusion_action": "除外日にすること"
   ```

---

**File 2**: `gas_complete_code.js`

**`syncSellerList` 関数への追加**（`first_call_person` の同期処理ブロックの直後に追加）:
```javascript
var sheetExclusionAction = row['除外日にすること'] ? String(row['除外日にすること']) : null;
var dbExclusionAction = dbSeller.exclusion_action || null;
if (sheetExclusionAction !== dbExclusionAction) {
  updateData.exclusion_action = sheetExclusionAction;
  needsUpdate = true;
}
```

---

**重要**: 日本語を含むファイルの編集はPythonスクリプトを使用してUTF-8で書き込む（`file-encoding-protection.md` ルール準拠）。

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを確認し、次に修正後の正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `column-mapping.json` と `gas_complete_code.js` を修正する前に、スプシの「除外日にすること」列に値が入っている売主を対象に同期を実行し、DBに反映されないことを確認する。

**Test Cases**:
1. **DB→スプシ同期テスト**: DBの `exclusion_action = '次電日になにもせずに除外'` がある売主を `SpreadsheetSyncService` で同期 → スプシの「除外日にすること」列が空欄のまま（未修正コードで失敗）
2. **GAS同期テスト**: スプシの「除外日にすること」列に `'次電日に不通であれば除外'` が入っている行を `syncSellerList` で処理 → DBの `exclusion_action` が更新されない（未修正コードで失敗）
3. **null値テスト**: スプシの「除外日にすること」列が空欄の売主を同期 → エラーが発生しないことを確認（未修正コードでも通過するはず）

**Expected Counterexamples**:
- `exclusion_action` が `null` のまま同期される
- 原因: `column-mapping.json` の `databaseToSpreadsheet` にマッピングがなく、GASの同期処理にも含まれていない

### Fix Checking

**Goal**: 修正後、バグ条件が成立する全入力で正しい動作を確認する。

**Pseudocode:**
```
FOR ALL operation WHERE isBugCondition(operation) DO
  // DB → スプシ方向
  result_db_to_sheet := SpreadsheetSyncService_fixed(seller)
  ASSERT spreadsheet['除外日にすること'] = seller.exclusion_action

  // スプシ → DB方向
  result_sheet_to_db := syncSellerList_fixed(row)
  ASSERT db.exclusion_action = row['除外日にすること'] OR null
END FOR
```

### Preservation Checking

**Goal**: 修正後、`exclusion_action` 以外の全フィールドの同期動作が変わっていないことを確認する。

**Pseudocode:**
```
FOR ALL operation WHERE NOT isBugCondition(operation) DO
  ASSERT syncSellerList_original(row)[field] = syncSellerList_fixed(row)[field]
  FOR ALL field IN [first_call_person, status, next_call_date, comments, ...]
END FOR
```

**Testing Approach**: プロパティベーステストが推奨される。多数のランダムな売主データを生成し、`exclusion_action` 以外の全フィールドが修正前後で同一であることを検証する。

**Test Cases**:
1. **first_call_person同期の保持**: `first_call_person` の同期処理が修正後も正しく動作することを確認
2. **status・next_call_date・commentsの保持**: これらのフィールドが修正後も正しく同期されることを確認
3. **null値の正常処理**: `exclusion_action` が `null` または空文字の場合、エラーなく処理されることを確認

### Unit Tests

- `column-mapping.json` に `除外日にすること` ↔ `exclusion_action` のマッピングが存在することを確認
- `SpreadsheetSyncService` が `exclusion_action` をスプシの「除外日にすること」列に正しく書き込むことを確認
- GASの `syncSellerList` が `row['除外日にすること']` を `exclusion_action` としてDBに保存することを確認
- `exclusion_action` が `null` の場合、エラーなく処理されることを確認

### Property-Based Tests

- ランダムな文字列値を `row['除外日にすること']` に設定し、DBに正しく保存されることを検証
- `exclusion_action` 以外のフィールドをランダムに変化させ、修正前後で同一の結果になることを検証
- 空欄・null・undefinedの各パターンで `null` 処理が正しく動作することを検証

### Integration Tests

- ブラウザで「除外日にすること」を設定して保存後、スプシの該当列に即時反映されることを確認
- スプシの「除外日にすること」列を変更後、GASの `syncSellerList` 実行でDBに反映されることを確認
- 他のフィールド（`first_call_person`、`status` 等）が引き続き正常に同期されることを確認
