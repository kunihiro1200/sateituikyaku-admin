# buyer-accidental-deletion-fix バグ修正デザイン

## Overview

`EnhancedAutoSyncService.syncBuyers()` が、スプレッドシートに存在する買主を誤って一括ソフトデリートするバグを修正する。

根本原因は2つある：
1. `initializeBuyer()` の危険なフォールバックロジック（`GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が無効な場合に `PROPERTY_LISTING_SPREADSHEET_ID` を使用）
2. `.env.local` の `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` に末尾 `\r\n` が含まれており、Google Sheets API 認証が失敗する

修正方針は「フォールバックを削除して明示的なエラーにする」＋「削除処理に多段階の安全ガードを追加する」の2本立て。

## Glossary

- **Bug_Condition (C)**: バグが発動する条件 — `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が無効（未設定または不正な文字を含む）かつ `detectDeletedBuyers()` がスプレッドシートから0件または極端に少ない件数を返す状態
- **Property (P)**: 期待される正しい動作 — 無効な環境変数の場合はエラーをスローして処理を中断し、安全閾値を超える削除は実行しない
- **Preservation**: 修正によって変更されてはならない既存の動作 — 正常な環境変数設定下での買主追加・更新・削除の通常フロー
- **initializeBuyer**: `backend/src/services/EnhancedAutoSyncService.ts` 内の買主スプレッドシートクライアントを初期化するメソッド
- **detectDeletedBuyers**: DBにあってスプレッドシートにない買主番号を検出するメソッド
- **syncBuyers**: 買主の追加・更新・削除を一括実行するメインメソッド
- **sheetBuyerNumbers**: スプレッドシートから取得した買主番号のセット
- **dbBuyerNumbers**: DBのアクティブ買主番号のセット（`deleted_at IS NULL`）
- **安全閾値**: 削除処理を自動スキップするための比率・件数の基準値

## Bug Details

### Bug Condition

バグは以下の条件が重なったときに発動する：
1. `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` に末尾 `\r\n` などの不正な文字が含まれている
2. Google Sheets API 認証が失敗する
3. `initializeBuyer()` が `PROPERTY_LISTING_SPREADSHEET_ID`（業務リスト）にフォールバックする
4. 業務リストには「買主番号」列が存在しないため `sheetBuyerNumbers.size === 0` になる
5. `detectDeletedBuyers()` がDB上の全アクティブ買主を削除対象として返す
6. `syncBuyers()` が安全チェックなしに全買主をソフトデリートする

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { buyerSpreadsheetId: string, sheetBuyerCount: number, dbActiveBuyerCount: number }
  OUTPUT: boolean

  hasInvalidSpreadsheetId := input.buyerSpreadsheetId が空、または末尾に \r\n などの不正な文字を含む
  hasZeroSheetBuyers     := input.sheetBuyerCount === 0
  hasMassiveDeletion     := input.sheetBuyerCount / input.dbActiveBuyerCount < 0.5

  RETURN hasInvalidSpreadsheetId
         OR hasZeroSheetBuyers
         OR hasMassiveDeletion
END FUNCTION
```

### Examples

- **例1（最悪ケース）**: `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID=abc123\r\n` → API認証失敗 → 業務リストにフォールバック → 買主番号0件 → DB上の全買主（例: 200件）が削除対象 → 200件全員ソフトデリート
- **例2（部分的な誤読み込み）**: 業務リストに「買主番号」列が偶然存在するが件数が少ない（例: 5件）→ DB上の195件が削除対象 → 195件ソフトデリート
- **例3（正常ケース）**: `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID=abc123`（正常値）→ 買主リストを正常読み込み → 200件中1件だけスプレッドシートにない → 1件のみソフトデリート（正常動作）
- **例4（エッジケース）**: `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が未設定 → 修正後はエラーをスローして処理中断（フォールバックなし）

## Expected Behavior

### Preservation Requirements

**変更されない動作:**
- `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が正しく設定されている場合の買主スプレッドシート初期化
- スプレッドシートから正常に買主番号が取得できた場合の買主追加同期（`detectMissingBuyers` → `syncMissingBuyers`）
- スプレッドシートから正常に買主番号が取得できた場合の買主更新同期（`detectUpdatedBuyers` → `syncUpdatedBuyers`）
- 削除対象がアクティブ買主数の10%未満の場合の通常削除同期（`detectDeletedBuyers` → `syncDeletedBuyers`）
- `recoverDeletedBuyer()` による買主復元機能

**Scope:**
安全ガードが発動しない通常ケース（スプレッドシートが正常に読み込まれ、削除対象が安全閾値以内）は、修正前と完全に同じ動作をする。

## Hypothesized Root Cause

1. **危険なフォールバックロジック**: `initializeBuyer()` の `||` 演算子によるフォールバック
   - `process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID || process.env.PROPERTY_LISTING_SPREADSHEET_ID!`
   - 空文字列や `undefined` だけでなく、末尾 `\r\n` を含む文字列も API 認証失敗を引き起こす
   - 認証失敗後に `PROPERTY_LISTING_SPREADSHEET_ID` を使用してしまう

2. **環境変数の不正な文字**: `.env.local` の `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` に末尾 `\r\n` が含まれている
   - Windows の改行コード（CRLF）が `.env` ファイルに混入した可能性
   - `.trim()` を呼ばずに使用しているため、不正な文字がそのまま API に渡される

3. **安全ガードの欠如**: `detectDeletedBuyers()` と `syncBuyers()` に削除件数の妥当性チェックがない
   - スプレッドシートから0件取得した場合でも削除処理が続行される
   - 削除対象がDB全体の大部分を占める場合でも自動実行される

4. **監査ログはあるが事前防止がない**: `buyer_deletion_audit` テーブルへの記録はあるが、異常な削除パターンを事前に検知して止める仕組みがない

## Correctness Properties

Property 1: Bug Condition - 無効な環境変数での処理中断

_For any_ 入力において `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が未設定または空文字列（trim後）の場合、修正後の `initializeBuyer()` は SHALL エラーをスローして処理を中断し、`PROPERTY_LISTING_SPREADSHEET_ID` へのフォールバックを行わない。

**Validates: Requirements 2.1**

Property 2: Bug Condition - スプレッドシート0件での削除スキップ

_For any_ 入力において `detectDeletedBuyers()` がスプレッドシートから取得した買主番号が0件の場合、修正後の `detectDeletedBuyers()` は SHALL 削除処理をスキップして空配列を返し、警告ログを出力する。

**Validates: Requirements 2.2**

Property 3: Bug Condition - 50%未満での削除スキップ

_For any_ 入力においてスプレッドシートの買主数がDBのアクティブ買主数の50%未満の場合、修正後の `detectDeletedBuyers()` は SHALL 削除処理をスキップして空配列を返し、異常検知アラートを出力する。

**Validates: Requirements 2.3**

Property 4: Bug Condition - 10%以上での削除スキップ

_For any_ 入力において `syncBuyers()` が検出した削除対象がアクティブ買主数の10%以上の場合、修正後の `syncBuyers()` は SHALL 削除処理をスキップして管理者向けアラートを出力する。

**Validates: Requirements 2.4**

Property 5: Preservation - 正常ケースでの削除同期継続

_For any_ 入力においてスプレッドシートが正常に読み込まれ（買主数がDB比50%以上）かつ削除対象がアクティブ買主数の10%未満の場合、修正後の `syncBuyers()` は SHALL 修正前と同じ削除同期処理を実行する。

**Validates: Requirements 3.1, 3.3**

Property 6: Preservation - 正常な環境変数での初期化継続

_For any_ 入力において `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が正しく設定されている場合、修正後の `initializeBuyer()` は SHALL 修正前と同じ初期化処理を実行する。

**Validates: Requirements 3.2**

## Fix Implementation

### Changes Required

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

#### 修正1: `initializeBuyer()` のフォールバックロジック削除

**Function**: `initializeBuyer`

**Specific Changes**:
1. `process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim()` で末尾の不正な文字を除去
2. 空文字列・未設定の場合は `Error` をスローしてフォールバックを完全に排除

```typescript
// 修正前（危険）
const buyerSpreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID 
  || process.env.PROPERTY_LISTING_SPREADSHEET_ID!;

// 修正後（安全）
const buyerSpreadsheetId = process.env.GOOGLE_SHEETS_BUYER_SPREADSHEET_ID?.trim();
if (!buyerSpreadsheetId) {
  throw new Error('GOOGLE_SHEETS_BUYER_SPREADSHEET_ID is not set. Cannot initialize buyer sync service.');
}
```

#### 修正2: `detectDeletedBuyers()` に安全ガードを追加

**Function**: `detectDeletedBuyers`

**Specific Changes**:
1. スプレッドシートから0件の場合は空配列を返して警告ログを出力（安全ガード1）
2. スプレッドシートの買主数がDBの50%未満の場合は空配列を返してアラートを出力（安全ガード2）

```typescript
// 安全ガード1: スプレッドシートから0件の場合はスキップ
if (sheetBuyerNumbers.size === 0) {
  console.warn('⚠️ SAFETY GUARD: No buyer numbers found in spreadsheet. Skipping deletion to prevent accidental mass deletion.');
  return [];
}

// 安全ガード2: スプレッドシートの買主数がDBの50%未満の場合はスキップ
const dbBuyerNumbers = await this.getAllActiveBuyerNumbers();
const ratio = sheetBuyerNumbers.size / dbBuyerNumbers.size;
if (dbBuyerNumbers.size > 0 && ratio < 0.5) {
  console.warn(`⚠️ SAFETY GUARD: Spreadsheet has only ${sheetBuyerNumbers.size} buyers but DB has ${dbBuyerNumbers.size} active buyers (ratio: ${(ratio * 100).toFixed(1)}%). Skipping deletion to prevent accidental mass deletion.`);
  return [];
}
```

#### 修正3: `syncBuyers()` に安全ガードを追加

**Function**: `syncBuyers`

**Specific Changes**:
1. 削除対象がアクティブ買主数の10%以上の場合は削除処理をスキップしてアラートを出力（安全ガード3）

```typescript
// 安全ガード3: 削除対象がアクティブ買主の10%以上の場合はスキップ
let deletionSyncResult: DeletionSyncResult | null = null;
if (deletedBuyers.length > 0) {
  const activeBuyerCount = (await this.getAllActiveBuyerNumbers()).size;
  const deletionRatio = activeBuyerCount > 0 ? deletedBuyers.length / activeBuyerCount : 0;
  if (deletionRatio >= 0.1) {
    console.error(`🚨 SAFETY GUARD: ${deletedBuyers.length} buyers marked for deletion (${(deletionRatio * 100).toFixed(1)}% of ${activeBuyerCount} active buyers). This exceeds the 10% safety threshold. Skipping deletion. Manual review required.`);
  } else {
    deletionSyncResult = await this.syncDeletedBuyers(deletedBuyers);
  }
}
```

**File**: `backend/restore-accidentally-deleted-buyers.ts`（新規作成）

スプレッドシートに存在するが `deleted_at` が設定されている買主を一括復元するスクリプト。`recoverDeletedBuyer()` を使用して `deleted_at` を NULL に戻す。

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成する：
1. **探索フェーズ**: 修正前のコードでバグを再現し、根本原因を確認する
2. **検証フェーズ**: 修正後のコードでバグが修正されていること、および既存動作が保持されていることを確認する

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。

**Test Plan**: `initializeBuyer()` に無効な `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` を渡し、フォールバックが発動することを確認する。また `detectDeletedBuyers()` にスプレッドシート0件のシナリオを与え、全買主が削除対象になることを確認する。

**Test Cases**:
1. **フォールバック発動テスト**: `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` を空文字列に設定して `initializeBuyer()` を呼び出す（修正前は `PROPERTY_LISTING_SPREADSHEET_ID` にフォールバックする）
2. **0件削除テスト**: スプレッドシートから0件を返すモックで `detectDeletedBuyers()` を呼び出す（修正前は全アクティブ買主が削除対象になる）
3. **50%未満削除テスト**: DBに100件、スプレッドシートに40件のシナリオで `detectDeletedBuyers()` を呼び出す（修正前は60件が削除対象になる）
4. **10%超過削除テスト**: DBに100件、削除対象が15件のシナリオで `syncBuyers()` を呼び出す（修正前は15件が削除される）

**Expected Counterexamples**:
- 修正前: `initializeBuyer()` が `PROPERTY_LISTING_SPREADSHEET_ID` を使用して初期化を完了してしまう
- 修正前: `detectDeletedBuyers()` がスプレッドシート0件でも全アクティブ買主を削除対象として返す
- 修正前: `syncBuyers()` が削除対象の割合に関係なく削除処理を実行する

### Fix Checking

**Goal**: 修正後のコードで、バグ条件が成立する全入力に対して期待される動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedFunction(input)
  ASSERT expectedBehavior(result)
END FOR
```

具体的には：
- `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` が空 → `initializeBuyer()` がエラーをスロー
- スプレッドシート0件 → `detectDeletedBuyers()` が空配列を返す
- スプレッドシート比率50%未満 → `detectDeletedBuyers()` が空配列を返す
- 削除対象10%以上 → `syncBuyers()` が削除処理をスキップ

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件が成立しない全入力に対して修正前と同じ動作が得られることを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalFunction(input) = fixedFunction(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨する。理由：
- 多様な入力パターン（買主数、削除比率）を自動生成できる
- 安全閾値の境界値（49%、50%、51%、9%、10%、11%）を網羅できる
- 手動テストでは見落としやすいエッジケースを検出できる

**Test Plan**: 修正前のコードで正常ケースの動作を観察し、修正後も同じ動作が保持されることをテストする。

**Test Cases**:
1. **正常削除の保持**: スプレッドシート比率80%、削除対象5%のシナリオで削除同期が正常に実行されることを確認
2. **買主追加の保持**: スプレッドシートにあってDBにない買主が正常に追加されることを確認
3. **買主更新の保持**: スプレッドシートで更新された買主データが正常にDBに反映されることを確認
4. **境界値テスト**: 削除比率が9.9%（スキップしない）と10.0%（スキップする）の境界を確認

### Unit Tests

- `initializeBuyer()` に空文字列・未設定・正常値を渡したときの動作テスト
- `detectDeletedBuyers()` にスプレッドシート0件・50%未満・50%以上のシナリオを渡したときの動作テスト
- `syncBuyers()` に削除対象10%未満・10%以上のシナリオを渡したときの動作テスト
- `.trim()` による末尾 `\r\n` 除去のテスト

### Property-Based Tests

- ランダムな買主数（1〜1000件）とスプレッドシート比率（0〜100%）を生成し、安全ガードが正しく発動することを確認
- 削除比率が0〜100%のランダム値で `syncBuyers()` の安全ガードが正しく機能することを確認
- 正常ケース（比率50%以上、削除10%未満）では修正前後で同じ削除対象リストが返されることを確認

### Integration Tests

- 正常な環境変数設定での完全な `syncBuyers()` フローのテスト
- 無効な `GOOGLE_SHEETS_BUYER_SPREADSHEET_ID` でのエラー伝播テスト
- 誤削除された買主の一括復元スクリプト（`restore-accidentally-deleted-buyers.ts`）の動作テスト
