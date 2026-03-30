# 売主「営担」同期バグ修正 Design

## Overview

スプレッドシートの「営担」列に担当者名が入力されているにもかかわらず、GASの `syncUpdatesToSupabase_` 関数による定期同期（10分トリガー）でDBに反映されないバグを修正する。

根本原因は2つ：
1. `rowToObject` 関数がヘッダー名を正規化（trim処理）していないため、「営担」列のヘッダーに余分な空白・改行が含まれている場合、`row['営担']` が `undefined` になる
2. `syncUpdatesToSupabase_` 内の比較ロジックで、`rawVisitAssignee === undefined` の条件が `null` を捕捉しないため、スプレッドシートのセルが `null` として読み込まれた場合も誤判定が発生する

修正方針：
- `rowToObject` 関数でヘッダー名を正規化（trim処理）
- `syncUpdatesToSupabase_` 関数で `visit_assignee` の比較ロジックを修正（`undefined` と `null` の両方を正しく処理）

## Glossary

- **Bug_Condition (C)**: スプレッドシートの「営担」列に担当者名が入力されており、かつDBの `visit_assignee` が `null` の売主が存在する条件
- **Property (P)**: `syncUpdatesToSupabase_` がその売主の `visit_assignee` をDBに正しく反映する
- **Preservation**: 「営担」列が空欄または「外す」の場合は引き続き `visit_assignee` を `null` としてDBに保存する。他のフィールド（`status`, `next_call_date`, `comments` など）の同期処理は引き続き正常に動作する
- **rowToObject**: `gas_complete_code.js` の関数。スプレッドシートの1行をオブジェクトに変換する
- **syncUpdatesToSupabase_**: `gas_complete_code.js` の関数。スプレッドシートの売主データをDBに同期する（Phase 2）
- **visit_assignee**: DBの `sellers` テーブルのカラム。営業担当者のイニシャル（例: "Y"）

## Bug Details

### Bug Condition

バグは、スプレッドシートの「営担」列に担当者名が入力されているにもかかわらず、`syncUpdatesToSupabase_` がその値をDBに反映しない場合に発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { spreadsheetRow, dbSeller }
  OUTPUT: boolean
  
  RETURN input.spreadsheetRow['営担'] IS NOT EMPTY
         AND input.spreadsheetRow['営担'] != '外す'
         AND input.dbSeller.visit_assignee IS NULL
         AND syncUpdatesToSupabase_ DOES NOT update visit_assignee
END FUNCTION
```

### Examples

- **AA12497**: スプレッドシートの「営担」列に "Y" が入力されているが、DBの `visit_assignee` が `null` のまま
- **AA12498**: スプレッドシートの「営担」列に "I" が入力されているが、DBの `visit_assignee` が `null` のまま
- **AA12499**: スプレッドシートの「営担」列が空欄 → DBの `visit_assignee` は `null` のまま（正常）
- **AA12500**: スプレッドシートの「営担」列が「外す」 → DBの `visit_assignee` は `null` に更新される（正常）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- 「営担」列が空欄または「外す」の場合、引き続き `visit_assignee` を `null` としてDBに保存する
- スプレッドシートとDBの `visit_assignee` が同じ値の場合、引き続き不要な更新リクエストを送信しない（差分なしはスキップ）
- `status`、`next_call_date`、`comments` など他のフィールドの同期処理は引き続き正常に動作する

**Scope:**
売主番号が `AA\d+` 形式でない行、`onEditTrigger` による即時同期、その他の同期処理は全て影響を受けない。

## Hypothesized Root Cause

バグ説明に基づき、最も可能性の高い原因は以下の通り：

1. **ヘッダー名の正規化不足**: `rowToObject` 関数がヘッダー名を正規化（trim処理）していないため、「営担」列のヘッダーに余分な空白・改行が含まれている場合、`row['営担']` が `undefined` になる
   - スプレッドシートのヘッダーが「営担 」（末尾に空白）や「営担\n」（改行付き）の場合、`row['営担']` は `undefined` になる
   - `rowToObject` 内で `if (headers[j] === '') continue;` のチェックはあるが、trim処理がないため空白・改行を含むヘッダーをスキップできない

2. **undefined と null の混同**: `syncUpdatesToSupabase_` 内の比較ロジックで、`rawVisitAssignee === undefined` の条件が `null` を捕捉しないため、スプレッドシートのセルが `null` として読み込まれた場合も誤判定が発生する
   - `rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined` の条件は `null` を捕捉しない
   - スプレッドシートの空セルが `null` として読み込まれた場合、`sheetVisitAssignee` が `null` ではなく `undefined` になる可能性がある

3. **比較ロジックの不備**: `sheetVisitAssignee !== (dbSeller.visit_assignee || null)` の比較で、`dbSeller.visit_assignee` が `null` の場合、`(dbSeller.visit_assignee || null)` は `null` になるが、`sheetVisitAssignee` が `undefined` の場合、`undefined !== null` は `true` になり、不要な更新が発生する可能性がある

## Correctness Properties

Property 1: Bug Condition - 営担の同期

_For any_ 売主において、スプレッドシートの「営担」列に担当者名が入力されている場合、修正後の `syncUpdatesToSupabase_` 関数 SHALL その値をDBの `visit_assignee` に正しく反映する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 空欄・「外す」の処理

_For any_ 売主において、スプレッドシートの「営担」列が空欄または「外す」の場合、修正後のシステム SHALL 引き続き `visit_assignee` を `null` としてDBに保存し、他のフィールドの同期処理は引き続き正常に動作する。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

根本原因分析が正しいと仮定した場合：

**File**: `gas_complete_code.js`

**Function**: `rowToObject`

**Specific Changes**:
1. **ヘッダー名の正規化**: ヘッダー名を取得する際に `.trim()` を適用し、余分な空白・改行を除去する
   - `var headerName = String(headers[j]).trim();` のように変更
   - `if (headerName === '') continue;` で空文字列をスキップ
   - `obj[headerName] = val;` でオブジェクトに格納

**Function**: `syncUpdatesToSupabase_`

**Specific Changes**:
2. **visit_assignee の比較ロジック修正**: `undefined` と `null` の両方を正しく処理する
   - `rawVisitAssignee === '外す' || rawVisitAssignee === '' || rawVisitAssignee === undefined || rawVisitAssignee === null` のように条件を拡張
   - または、`!rawVisitAssignee || rawVisitAssignee === '外す'` のように簡潔に記述（falsy値を全て捕捉）

3. **比較ロジックの統一**: `sheetVisitAssignee` と `dbSeller.visit_assignee` の比較を統一する
   - 両方を `null` に正規化してから比較する
   - `sheetVisitAssignee = sheetVisitAssignee || null;` のように正規化
   - `var dbVisitAssignee = dbSeller.visit_assignee || null;` のように正規化
   - `if (sheetVisitAssignee !== dbVisitAssignee)` で比較

4. **Pythonスクリプトでの編集**: GASコードは日本語を含むため、Pythonスクリプトで編集する
   - `strReplace` は使用しない（文字コード問題を回避）
   - UTF-8エンコーディングを保持する

## Testing Strategy

### Validation Approach

テスト戦略は2段階アプローチに従う：まず、未修正コードでバグを再現する探索的テストを実行し、次に修正後のコードで正しく動作することを検証する。

### Exploratory Bug Condition Checking

**Goal**: 修正前のコードでバグを再現し、根本原因分析を確認または反証する。反証された場合は再仮説を立てる。

**Test Plan**: スプレッドシートに「営担」列に担当者名が入力されている売主を作成し、`syncUpdatesToSupabase_` を実行して、DBに反映されないことを確認する。

**Test Cases**:
1. **ヘッダー名に空白が含まれる場合**: スプレッドシートのヘッダーを「営担 」（末尾に空白）に変更し、`rowToObject` が `undefined` を返すことを確認（未修正コードで失敗）
2. **ヘッダー名に改行が含まれる場合**: スプレッドシートのヘッダーを「営担\n」（改行付き）に変更し、`rowToObject` が `undefined` を返すことを確認（未修正コードで失敗）
3. **空セルが null として読み込まれる場合**: スプレッドシートの「営担」列を空欄にし、`rawVisitAssignee` が `null` になることを確認（未修正コードで失敗）
4. **正常なヘッダー名の場合**: スプレッドシートのヘッダーが「営担」（空白・改行なし）の場合、`rowToObject` が正しく値を返すことを確認（未修正コードで成功）

**Expected Counterexamples**:
- ヘッダー名に空白・改行が含まれる場合、`row['営担']` が `undefined` になる
- 空セルが `null` として読み込まれる場合、`rawVisitAssignee === undefined` の条件が `false` になり、`sheetVisitAssignee` が `null` ではなく `undefined` になる

### Fix Checking

**Goal**: 修正後のコードで、バグ条件を満たす全ての入力に対して、期待される動作を実現することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := syncUpdatesToSupabase_fixed(input.spreadsheetRow)
  ASSERT result.visit_assignee = input.spreadsheetRow['営担']
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、バグ条件を満たさない全ての入力に対して、元のコードと同じ結果を生成することを検証する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT syncUpdatesToSupabase_original(input) = syncUpdatesToSupabase_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストは保存チェックに推奨される。なぜなら：
- 入力ドメイン全体で多くのテストケースを自動生成する
- 手動ユニットテストが見逃す可能性のあるエッジケースを捕捉する
- 非バグ入力に対して動作が変更されていないことを強力に保証する

**Test Plan**: 未修正コードで「営担」列が空欄または「外す」の場合の動作を観察し、その動作を捕捉するプロパティベーステストを記述する。

**Test Cases**:
1. **空欄の保存**: スプレッドシートの「営担」列が空欄の場合、修正後も `visit_assignee` が `null` のままであることを確認
2. **「外す」の保存**: スプレッドシートの「営担」列が「外す」の場合、修正後も `visit_assignee` が `null` に更新されることを確認
3. **他のフィールドの保存**: `status`、`next_call_date`、`comments` など他のフィールドの同期処理が修正後も正常に動作することを確認
4. **差分なしのスキップ**: スプレッドシートとDBの `visit_assignee` が同じ値の場合、修正後も不要な更新リクエストを送信しないことを確認

### Unit Tests

- ヘッダー名に空白・改行が含まれる場合の `rowToObject` の動作をテスト
- 空セルが `null` として読み込まれる場合の `syncUpdatesToSupabase_` の動作をテスト
- 「営担」列が空欄または「外す」の場合の `syncUpdatesToSupabase_` の動作をテスト
- 「営担」列に担当者名が入力されている場合の `syncUpdatesToSupabase_` の動作をテスト

### Property-Based Tests

- ランダムな売主データを生成し、「営担」列に担当者名が入力されている場合、修正後のコードが正しく動作することを検証
- ランダムな売主データを生成し、「営担」列が空欄または「外す」の場合、修正後のコードが元のコードと同じ動作をすることを検証
- 多くのシナリオで、非バグ入力に対して動作が変更されていないことをテスト

### Integration Tests

- スプレッドシートに複数の売主を作成し、`syncUpdatesToSupabase_` を実行して、全ての売主が正しく同期されることを確認
- ヘッダー名に空白・改行が含まれるスプレッドシートで、`syncUpdatesToSupabase_` を実行して、正しく同期されることを確認
- 「営担」列が空欄または「外す」の売主が混在するスプレッドシートで、`syncUpdatesToSupabase_` を実行して、正しく同期されることを確認
