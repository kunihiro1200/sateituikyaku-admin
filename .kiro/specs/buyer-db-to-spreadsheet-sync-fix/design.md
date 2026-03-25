# buyer-db-to-spreadsheet-sync-fix Bugfix Design

## Overview

買主詳細画面（BuyerDetailPage.tsx）でフィールドを編集・保存すると、DBには正しく保存されるが、スプレッドシートに反映されないバグの修正設計。

根本原因は4つあり、それぞれ独立した修正が必要：
1. `handleInlineFieldSave` が `sync: false` でAPIを呼び出しているため、インライン編集がスプシに同期されない
2. `GoogleSheetsClient.findRowByColumn` が `===` で型を区別して比較するため、買主番号が文字列と数値で不一致になる場合がある
3. 同期失敗時にフロントエンドへ通知されないため、ユーザーが失敗に気づかない（サイレント失敗）
4. `readRange` がデフォルトの `FORMATTED_VALUE` で読み取るため、日付等の値が書き戻し時に変化する可能性がある

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — インライン編集フィールドを保存した際にスプシへの同期が行われない、または同期が失敗する状態
- **Property (P)**: 期待される正しい動作 — フィールド保存時にDBとスプシの両方が更新され、失敗時はユーザーに通知される
- **Preservation**: 修正によって変更してはならない既存の動作 — DBへの保存、セクション保存ボタン経由の同期、マッピング済みフィールドの書き込み
- **handleInlineFieldSave**: `BuyerDetailPage.tsx` 内の関数。インライン編集フィールドの即時保存を担当
- **findRowByColumn**: `GoogleSheetsClient.ts` 内のメソッド。スプシから買主番号で行番号を検索する
- **readRange**: `GoogleSheetsClient.ts` 内のメソッド。指定範囲の行データを読み取る
- **syncStatus**: バックエンドAPIが返す同期結果のステータス（`'success'` | `'pending'` | `'failed'`）

## Bug Details

### Bug Condition

バグは以下の4つの条件のいずれかが成立するときに発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { fieldName: string, value: any, saveMethod: 'inline' | 'section' }
  OUTPUT: boolean

  // 条件1: インライン編集フィールドの保存（sync: false）
  IF input.saveMethod === 'inline'
    RETURN true  // 常にスプシ同期がスキップされる

  // 条件2: 買主番号の型不一致による行検索失敗
  IF input.saveMethod === 'section'
     AND typeof(spreadsheetBuyerNumber) !== typeof(searchValue)
    RETURN true  // === 比較で一致しない

  // 条件3: readRange が FORMATTED_VALUE で日付を取得
  IF input.saveMethod === 'section'
     AND fieldType === 'date'
     AND readRange uses FORMATTED_VALUE
    RETURN true  // 書き戻し時に値が変化する

  RETURN false
END FUNCTION
```

### Examples

- **例1（条件1）**: `distribution_type`（配信メール）をインライン編集で変更 → DBは更新されるがスプシは変わらない
- **例2（条件1）**: `pinrich`（Pinrich）をインライン編集で変更 → DBは更新されるがスプシは変わらない
- **例3（条件2）**: スプシの買主番号列が数値 `4370` として格納されている場合、文字列 `"4370"` との `===` 比較が `false` になり行が見つからない
- **例4（条件3）**: `next_call_date` を保存する際、`readRange` が `"2026/03/25"` という文字列で取得し、`RAW` で書き戻すと日付として認識されない可能性がある
- **例5（条件3）**: 同期失敗時に `syncStatus: 'pending'` が返るが、フロントエンドは成功として扱い、ユーザーに通知されない

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- DBへの保存は常に正常に完了する（同期失敗でもDBへの保存は成功扱い）
- セクション保存ボタン経由（`sync: true`）の保存フローは変更しない
- `buyer-column-mapping.json` にマッピングが定義されているフィールドは対応するスプシ列に書き込まれる
- 買主番号が正しく存在する場合、スプシの該当行を特定して更新する
- `last_synced_at` の更新ロジックは変更しない

**Scope:**
インライン編集以外の保存フロー（セクション保存ボタン）、スプシからDBへの定期同期（GAS）、新規買主登録のスプシ追加処理は、この修正の影響を受けない。

## Hypothesized Root Cause

1. **handleInlineFieldSave の sync: false**
   - `BuyerDetailPage.tsx` の `handleInlineFieldSave` が `buyerApi.update()` を `{ sync: false }` で呼び出している
   - コメントに「UIは楽観的更新済み。DBのみ保存（スプシ同期は保存ボタン押下時）」と明記されており、意図的な設計だったが、スプシとの不整合を引き起こしている

2. **findRowByColumn の型不一致**
   - `GoogleSheetsClient.findRowByColumn` が `values[i][0] === value` で厳密等価比較している
   - スプシの買主番号列が数値として格納されている場合、文字列の買主番号と一致しない
   - `String()` 変換を挟めば解決できる

3. **readRange の FORMATTED_VALUE**
   - `readRange` が `spreadsheets.values.get` を呼ぶ際に `valueRenderOption` を指定していない
   - デフォルトは `FORMATTED_VALUE` のため、日付セルが `"2026/03/25"` のような表示文字列で返る
   - `updateRow` は `valueInputOption: 'RAW'` で書き戻すため、値が変化する可能性がある

4. **サイレント失敗**
   - バックエンドは同期失敗時に `syncStatus: 'pending'` を返すが、フロントエンドの `handleInlineFieldSave` はこの値を確認していない
   - `handleSectionSave` も `result.syncStatus` を確認していない

## Correctness Properties

Property 1: Bug Condition - インライン編集フィールドのスプシ同期

_For any_ インライン編集フィールドの保存操作（`handleInlineFieldSave` が呼ばれる場合）において、バグ条件が成立する（`sync: false` で呼ばれる）入力に対して、修正後の関数は DBへの保存と同時にスプシへの同期も実行し、`syncStatus` が `'success'` または `'pending'`（スプシ側の問題）を返すこと。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存の保存フローの維持

_For any_ バグ条件が成立しない入力（セクション保存ボタン経由の保存、スプシ→DB同期、新規登録）に対して、修正後のコードは修正前と同じ動作を維持し、DBへの保存・`last_synced_at` の更新・マッピング済みフィールドの書き込みが変わらず機能すること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

**File 1**: `frontend/frontend/src/pages/BuyerDetailPage.tsx`

**Function**: `handleInlineFieldSave`

**Specific Changes**:
1. **sync: false → sync: true に変更**: `buyerApi.update()` の第3引数を `{ sync: true }` に変更し、インライン編集でもスプシ同期を実行する
2. **syncStatus の確認**: APIレスポンスの `syncStatus` が `'pending'` または `'failed'` の場合、警告スナックバーを表示する

```typescript
// 変更前
await buyerApi.update(
  buyer_number!,
  { [fieldName]: sanitizedValue },
  { sync: false }
);

// 変更後
const result = await buyerApi.update(
  buyer_number!,
  { [fieldName]: sanitizedValue },
  { sync: true }
);

// 同期失敗の通知
if (result?.syncStatus === 'pending' || result?.syncStatus === 'failed') {
  setSnackbar({
    open: true,
    message: 'DBへの保存は完了しましたが、スプレッドシートへの同期に失敗しました',
    severity: 'warning',
  });
}
```

---

**File 2**: `backend/src/services/GoogleSheetsClient.ts`

**Function**: `findRowByColumn`

**Specific Changes**:
1. **型変換による比較**: `values[i][0] === value` を `String(values[i][0]) === String(value)` に変更し、文字列・数値の型に関わらず一致比較する

```typescript
// 変更前
if (values[i][0] === value) {

// 変更後
if (String(values[i][0]) === String(value)) {
```

---

**File 3**: `backend/src/services/GoogleSheetsClient.ts`

**Function**: `readRange`

**Specific Changes**:
1. **UNFORMATTED_VALUE の使用**: `spreadsheets.values.get` に `valueRenderOption: 'UNFORMATTED_VALUE'` を追加し、日付等のセル値を生の値（シリアル値）で取得する

```typescript
// 変更前
const response = await this.sheets!.spreadsheets.values.get({
  spreadsheetId: this.config.spreadsheetId,
  range: `${this.config.sheetName}!${range}`,
});

// 変更後
const response = await this.sheets!.spreadsheets.values.get({
  spreadsheetId: this.config.spreadsheetId,
  range: `${this.config.sheetName}!${range}`,
  valueRenderOption: 'UNFORMATTED_VALUE',
});
```

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される：まず未修正コードでバグを再現するカウンターエグザンプルを確認し、次に修正後のコードで正しい動作と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因分析を確認・反証する。

**Test Plan**: 各バグ条件に対応するテストを作成し、未修正コードで実行して失敗を観察する。

**Test Cases**:
1. **インライン編集同期テスト**: `handleInlineFieldSave` を呼び出し、スプシAPIが呼ばれないことを確認（未修正コードで失敗）
2. **型不一致テスト**: `findRowByColumn` に文字列 `"4370"` を渡し、スプシに数値 `4370` が格納されている場合に `null` が返ることを確認（未修正コードで失敗）
3. **FORMATTED_VALUE テスト**: `readRange` で日付セルを取得し、`"2026/03/25"` のような文字列が返ることを確認（未修正コードで問題を確認）
4. **サイレント失敗テスト**: 同期失敗時にフロントエンドにエラーが表示されないことを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `handleInlineFieldSave` 呼び出し後、スプシAPIが呼ばれていない（`sync: false` のため）
- `findRowByColumn("買主番号", "4370")` が `null` を返す（スプシに数値 `4370` が格納されている場合）

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が期待通りの動作をすることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := handleInlineFieldSave_fixed(input)
  ASSERT result.success === true
  ASSERT spreadsheetSyncWasCalled === true
  ASSERT result.syncStatus IN ['success', 'pending']
END FOR

FOR ALL buyerNumber WHERE typeof(spreadsheetValue) !== typeof(buyerNumber) DO
  rowNumber := findRowByColumn_fixed(columnName, buyerNumber)
  ASSERT rowNumber !== null
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しない入力に対して、修正後の関数が修正前と同じ動作をすることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT handleSectionSave_original(input) = handleSectionSave_fixed(input)
  ASSERT dbSaveResult_original = dbSaveResult_fixed
  ASSERT lastSyncedAt_original = lastSyncedAt_fixed
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な買主番号（数値・文字列・混在）を自動生成してテストできる
- 手動テストでは見落としがちなエッジケースを検出できる
- 既存動作が変わっていないことを強く保証できる

**Test Cases**:
1. **セクション保存の保持**: セクション保存ボタン経由の保存が修正後も正常に動作することを確認
2. **DBへの保存の保持**: `sync: true` に変更後もDBへの保存が正常に完了することを確認
3. **last_synced_at の保持**: 同期成功時に `last_synced_at` が更新されることを確認
4. **マッピング済みフィールドの保持**: `buyer-column-mapping.json` に定義されたフィールドが正しくスプシに書き込まれることを確認

### Unit Tests

- `findRowByColumn` に文字列・数値・混在の買主番号を渡して正しく行番号を返すことをテスト
- `readRange` が `UNFORMATTED_VALUE` で日付シリアル値を返すことをテスト
- `handleInlineFieldSave` が `sync: true` でAPIを呼び出すことをテスト
- 同期失敗時（`syncStatus: 'pending'`）に警告スナックバーが表示されることをテスト

### Property-Based Tests

- ランダムな買主番号（文字列・数値）を生成し、`findRowByColumn` が型に関わらず正しく行を検索することを検証
- ランダムなフィールド値を生成し、`readRange` → `updateRow` のラウンドトリップで値が変化しないことを検証
- 多様な保存操作を生成し、DBへの保存が常に成功することを検証

### Integration Tests

- インライン編集フィールドを変更・保存し、スプシに反映されることをエンドツーエンドで確認
- 買主番号がスプシで数値として格納されている場合でも、行の特定・更新が成功することを確認
- 同期失敗時に警告メッセージが画面に表示されることを確認
