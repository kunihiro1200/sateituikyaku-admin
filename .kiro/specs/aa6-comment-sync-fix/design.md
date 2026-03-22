# AA6コメント同期バグ修正 設計ドキュメント

## Overview

管理画面でAA6の `comments` フィールドを更新しても、DB→スプレッドシートへの即時同期でコメントが書き込まれないバグを修正する。

コードベース調査の結果、`column-mapping.json` の `databaseToSpreadsheet` セクションには `"comments": "コメント"` が**既に定義されている**。`ColumnMapper.mapToSheet()` は `this.dbToSpreadsheet`（= `column-mapping.json` の `databaseToSpreadsheet`）を動的にループするため、設定ファイルに含まれていれば自動的にマッピングされるはずである。

しかし、`SpreadsheetSyncService.syncToSpreadsheet()` は `select('*')` でDBから全フィールドを取得しており、`mapToSheet()` に渡している。`GoogleSheetsClient.updateRowPartial()` はヘッダー行と照合して列インデックスを特定し、該当列のみ更新する。

したがって、根本原因は `column-mapping.json` の設定漏れではなく、**`ColumnMapper.mapToSheet()` が `comments` フィールドを `SellerData` から読み取れていない**か、または **`GoogleSheetsClient.updateRowPartial()` がスプレッドシートのヘッダーで「コメント」列を見つけられていない**可能性が高い。

修正は最小限の変更で行い、他のフィールドの同期に影響を与えないようにする。

## Glossary

- **Bug_Condition (C)**: `ColumnMapper.mapToSheet()` が `comments` フィールドをスプレッドシート行に含めない条件
- **Property (P)**: `mapToSheet()` が `comments` フィールドを `コメント` 列にマッピングしてスプレッドシート行に含めること
- **Preservation**: コメント以外のフィールドの同期、スプレッドシート→DB方向の同期、`SyncQueue.enqueue()` の呼び出しが引き続き正常に動作すること
- **ColumnMapper**: `backend/src/services/ColumnMapper.ts` に実装されたクラス。DBカラム名とスプレッドシートカラム名の相互変換を担う
- **mapToSheet()**: `ColumnMapper` のメソッド。`SellerData`（DBデータ）を `SheetRow`（スプレッドシート行）に変換する
- **SyncQueue**: `backend/src/services/SyncQueue.ts` に実装されたキュー。`SellerService.updateSeller()` から呼び出され、`SpreadsheetSyncService.syncToSpreadsheet()` を非同期で実行する
- **databaseToSpreadsheet**: `column-mapping.json` のセクション。DBカラム名→スプレッドシートカラム名のマッピングを定義する

## Bug Details

### Bug Condition

`ColumnMapper.mapToSheet()` が `SellerData` の `comments` フィールドを `SheetRow` の `コメント` 列に変換しない。その結果、`SpreadsheetSyncService.syncToSpreadsheet()` → `GoogleSheetsClient.updateRowPartial()` の呼び出し時に「コメント」列が更新されない。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SellerData
  OUTPUT: boolean

  sheetRow := ColumnMapper.mapToSheet(input)

  RETURN input.comments IS NOT NULL
         AND input.comments IS NOT EMPTY
         AND sheetRow['コメント'] IS NULL OR sheetRow['コメント'] = ''
END FUNCTION
```

### Examples

- **例1（バグあり）**: `comments = "訪問希望あり"` の売主を更新 → スプレッドシートの「コメント」列が空のまま
- **例2（バグあり）**: `comments = "再電話不要"` の売主を更新 → スプレッドシートの「コメント」列が更新されない
- **例3（正常）**: `comments = null` の売主を更新 → スプレッドシートの「コメント」列は空（これは正しい動作）
- **例4（エッジケース）**: `comments = ""` の売主を更新 → スプレッドシートの「コメント」列は空（これは正しい動作）

## Expected Behavior

### Preservation Requirements

**変更されない動作:**
- `status`、`next_call_date`、`visit_assignee` などコメント以外のフィールドの同期は引き続き正常に動作する
- スプレッドシート→DB方向の同期（GASの `syncSellerList`）は引き続き `comments` フィールドをDBに正しく反映する（`column-mapping.json` の `spreadsheetToDatabase` は変更しない）
- `SellerService.updateSeller()` は引き続き `SyncQueue.enqueue()` を呼び出す

**スコープ:**
`comments` フィールド以外の全フィールドの同期動作は、この修正によって一切影響を受けない。具体的には：
- `mapToSheet()` の他フィールドのマッピングロジック
- `mapToDatabase()` の全フィールドのマッピングロジック
- `SyncQueue` のキュー処理ロジック
- `SpreadsheetSyncService` の行検索・更新ロジック

## Hypothesized Root Cause

コードベース調査の結果、以下の根本原因が考えられる：

1. **`column-mapping.json` の `databaseToSpreadsheet` に `comments` が含まれていない**
   - 調査では `"comments": "コメント"` が含まれていることを確認済み
   - ただし、ファイルの読み込みタイミングやキャッシュの問題で反映されていない可能性がある

2. **`ColumnMapper` の `SellerData` インターフェースに `comments` が定義されているが、`mapToSheet()` 内で `[key: string]: any` のインデックスシグネチャ経由でアクセスされており、TypeScriptの型チェックが機能していない**
   - `SellerData` には `comments?: string` が定義されている
   - `mapToSheet()` は `sellerData[dbColumn]` でアクセスするため、`dbColumn = 'comments'` の場合に正しく値が取得できるはず

3. **`GoogleSheetsClient.updateRowPartial()` がスプレッドシートのヘッダー行で「コメント」列を見つけられない**
   - `headers.indexOf(columnName)` で `-1` が返る場合、その列はスキップされる
   - スプレッドシートの実際のヘッダー名と `column-mapping.json` の値が一致していない可能性がある（例：全角スペースの違い、改行コードの違いなど）

4. **`SpreadsheetSyncService.syncToSpreadsheet()` が `select('*')` でDBから取得したデータを `SellerData` にキャストする際に `comments` フィールドが欠落している**
   - `seller as SellerData` のキャストは型安全ではなく、実際のDBレスポンスに `comments` が含まれていない可能性は低いが、確認が必要

## Correctness Properties

Property 1: Bug Condition - commentsフィールドのmapToSheetマッピング

_For any_ `SellerData` において `comments` フィールドに非空の値が設定されている場合、修正後の `ColumnMapper.mapToSheet()` は `SheetRow` の `コメント` キーに同じ値を含める。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - コメント以外のフィールドのmapToSheetマッピング

_For any_ `SellerData` において、`comments` フィールドの値に関わらず、修正後の `ColumnMapper.mapToSheet()` は `comments` 以外の全フィールドについて修正前と同じ `SheetRow` を返す。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

根本原因の仮説3（ヘッダー名の不一致）が最も可能性が高いが、探索的テストで確認してから修正する。

**調査対象ファイル:**
- `backend/src/config/column-mapping.json`
- `backend/src/services/ColumnMapper.ts`
- `backend/src/services/SpreadsheetSyncService.ts`

**想定される修正箇所:**

**ケース A: `column-mapping.json` の `databaseToSpreadsheet` に `comments` が欠落している場合**

ファイル: `backend/src/config/column-mapping.json`

```json
// databaseToSpreadsheet セクションに追加
"comments": "コメント"
```

**ケース B: `ColumnMapper.mapToSheet()` が `comments` を除外するロジックがある場合**

ファイル: `backend/src/services/ColumnMapper.ts`

`mapToSheet()` メソッド内の除外ロジックを確認し、`comments` が意図せず除外されていれば修正する。

**ケース C: スプレッドシートのヘッダー名と `column-mapping.json` の値が一致していない場合**

ファイル: `backend/src/config/column-mapping.json`

スプレッドシートの実際のヘッダー名（全角スペース、改行コードなど）に合わせて `databaseToSpreadsheet` の値を修正する。

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書いて根本原因を特定し、次に修正後のコードで正しい動作を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を特定する。

**Test Plan**: `ColumnMapper.mapToSheet()` に `comments` フィールドを含む `SellerData` を渡し、返された `SheetRow` に `コメント` キーが含まれているかアサートする。未修正コードでこのテストが失敗することを確認する。

**Test Cases**:
1. **commentsあり**: `{ comments: "テストコメント", status: "追客中", ... }` を `mapToSheet()` に渡し、`sheetRow['コメント'] === "テストコメント"` をアサート（未修正コードで失敗するはず）
2. **commentsなし**: `{ comments: null, status: "追客中", ... }` を `mapToSheet()` に渡し、`sheetRow['コメント'] === ''` をアサート（未修正コードでも成功する可能性あり）
3. **空文字**: `{ comments: "", status: "追客中", ... }` を `mapToSheet()` に渡し、`sheetRow['コメント'] === ''` をアサート

**Expected Counterexamples**:
- `sheetRow['コメント']` が `undefined` または存在しない
- 考えられる原因: `column-mapping.json` の `databaseToSpreadsheet` に `comments` が欠落、またはヘッダー名の不一致

### Fix Checking

**Goal**: 修正後のコードで、`comments` フィールドが正しくマッピングされることを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  sheetRow := ColumnMapper_fixed.mapToSheet(input)
  ASSERT sheetRow['コメント'] = input.comments
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、`comments` 以外のフィールドのマッピングが変わらないことを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT ColumnMapper_original.mapToSheet(input) = ColumnMapper_fixed.mapToSheet(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。ランダムな `SellerData` を生成し、`comments` フィールドの有無に関わらず他フィールドのマッピング結果が変わらないことを確認する。

**Test Cases**:
1. **他フィールドの保持**: `status`、`next_call_date`、`visit_assignee` などのフィールドが修正前後で同じ値にマッピングされることを確認
2. **mapToDatabase()の保持**: `mapToDatabase()` の動作が修正前後で変わらないことを確認（スプレッドシート→DB方向の同期への影響なし）
3. **SyncQueue呼び出しの保持**: `SellerService.updateSeller()` が `SyncQueue.enqueue()` を呼び出すことをモックで確認

### Unit Tests

- `ColumnMapper.mapToSheet()` に `comments` フィールドを含む `SellerData` を渡し、`コメント` 列が正しくマッピングされることを確認
- `ColumnMapper.mapToSheet()` に `comments = null` の `SellerData` を渡し、`コメント` 列が空文字になることを確認
- `ColumnMapper.mapToDatabase()` に `コメント` 列を含む `SheetRow` を渡し、`comments` フィールドが正しくマッピングされることを確認（リグレッション防止）

### Property-Based Tests

- ランダムな非空文字列を `comments` に設定した `SellerData` を生成し、`mapToSheet()` の結果に `コメント` キーが含まれることを検証（Property 1）
- ランダムな `SellerData` を生成し、`comments` フィールドの値に関わらず他フィールドのマッピング結果が変わらないことを検証（Property 2）

### Integration Tests

- `SellerService.updateSeller()` でコメントを更新し、`SyncQueue` 経由で `SpreadsheetSyncService.syncToSpreadsheet()` が呼び出され、スプレッドシートの「コメント」列が更新されることをエンドツーエンドで確認
- コメント以外のフィールド（`status` など）を更新した場合に、スプレッドシートの対応列が正しく更新されることを確認（リグレッション防止）
