# 業務リスト 間取図CWカウントバグ 設計ドキュメント

## Overview

業務リストの間取図確認セクションで「間取図300円（CW）計」が153を表示するバグを修正する。

**バグの流れ:**
1. GAS (`GyomuWorkTaskSync.gs`) が「CWカウント」シートから値を取得
2. 取得した値を Supabase `cw_counts` テーブルに同期
3. フロントエンド (`WorkTaskDetailModal.tsx`) が `cw_counts` テーブルから値を取得して表示

**根本原因:** GASの `getCwCountValue` 関数がシートの2行目（「回数」= 153）を取得しているが、正しくは5行目（「現在計」= 3）を取得すべき。

## Glossary

- **Bug_Condition (C)**: `getCwCountValue` 関数がシートの2行目（「回数」行）を参照している状態
- **Property (P)**: `getCwCountValue` 関数がシートの5行目（「現在計」行）を参照し、正しい値を返す
- **Preservation**: フロントエンドの表示ロジック・バックエンドAPIは変更しない
- **getCwCountValue**: `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` 内の関数。CWカウントシートから指定項目の値を取得する
- **syncCwCounts**: 同GASファイル内の関数。`getCwCountValue` を呼び出して Supabase に同期する
- **cw_counts**: Supabase テーブル。`item_name` と `current_total` カラムを持つ
- **現在計**: CWカウントシートの5行目。支払済計を差し引いた現在の残件数（正しい値）
- **回数**: CWカウントシートの2行目。累計の総件数（誤って参照されている値）

## Bug Details

### Bug Condition

「CWカウント」シートの構造は以下の通り：

| 行 | A列（項目）         | C列（間取図300円） |
|----|--------------------|--------------------|
| 1  | 項目               | 間取図（300円）    |
| 2  | 回数               | **153**            |
| 3  | 支払日（最新）     | 4/13               |
| 4  | 支払済計（10回ずつ）| 150               |
| 5  | 現在計             | **3**              |
| 6  | 仮払い日（契約）   | 4/13               |
| 7  | 仮払い確認         | 0                  |

`getCwCountValue` 関数は1行目をヘッダーとして列インデックスを特定した後、**2行目の値を固定で取得**している。

**Formal Specification:**
```
FUNCTION isBugCondition(sheet, itemName)
  INPUT: sheet = CWカウントシート, itemName = 取得対象の項目名
  OUTPUT: boolean

  columnIndex := findColumnIndex(sheet.row(1), itemName)
  RETURN columnIndex >= 0
         AND sheet.getRange(2, columnIndex + 1).getValue() が参照されている
         AND 正しい参照行は 5 である（「現在計」行）
END FUNCTION
```

### Examples

- **バグあり**: `getCwCountValue(cwSheet, '間取図（300円）')` → `153`（2行目「回数」を返す）
- **期待値**: `getCwCountValue(cwSheet, '間取図（300円）')` → `3`（5行目「現在計」を返す）
- **サイト登録も同様**: `getCwCountValue(cwSheet, 'サイト登録')` も2行目を返しているため同じバグが存在する可能性がある

## Expected Behavior

### Preservation Requirements

**変更しない箇所:**
- フロントエンド `WorkTaskDetailModal.tsx` の表示ロジック（`cw_counts` テーブルから取得して表示する処理）
- バックエンドAPIの `cw_counts` テーブルへのアクセス方法
- `syncCwCounts` 関数の全体的な構造（Supabase upsert ロジック）
- `getCwCountValue` 関数のヘッダー行検索ロジック（列インデックス特定部分）
- 他の集計項目（「サイト登録」等）の取得ロジック（同じ修正を適用するが、既存の動作を壊さない）

**Scope:**
CWカウントシートの「現在計」行（5行目）以外の行を参照している処理は変更しない。

## Hypothesized Root Cause

GASの `getCwCountValue` 関数（`gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs` 698行目付近）に問題がある。

```javascript
// 現在のコード（バグあり）
// 2行目の値を取得（回数行）
var val = sheet.getRange(2, itemColIndex + 1).getValue();
```

**問題点:** 行番号が `2`（「回数」行）にハードコードされている。

**正しい実装:** 「現在計」というラベルをA列から検索して、その行の値を取得すべき。

**なぜこうなったか:**
- シートの構造を「1行目=ヘッダー、2行目=データ」と誤って想定した
- 実際のシートは「1行目=項目名ヘッダー、2〜7行目=各種集計行」という縦持ち構造

## Correctness Properties

Property 1: Bug Condition - 現在計の正確な取得

_For any_ CWカウントシートの項目（「間取図（300円）」「サイト登録」等）において、
`getCwCountValue` 関数は SHALL 「現在計」ラベルが存在するA列の行を検索し、
その行の対応列の値を返す（2行目固定ではなく）。

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - 既存の同期・表示処理の維持

_For any_ `getCwCountValue` の呼び出しにおいて、関数のシグネチャ（引数・戻り値の型）は
変更されず、`syncCwCounts` および `WorkTaskDetailModal.tsx` の既存コードは
修正なしで正しく動作し続ける。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs`

**Function**: `getCwCountValue`

**Specific Changes:**

1. **行ラベル検索の追加**: A列から「現在計」ラベルを持つ行インデックスを検索する処理を追加
   - `sheet.getRange(1, 1, lastRow, 1).getValues()` でA列全体を取得
   - `'現在計'` に一致する行インデックスを特定

2. **固定行番号の削除**: `sheet.getRange(2, itemColIndex + 1)` の `2` を動的な行番号に変更
   - 「現在計」行が見つかった場合はその行番号を使用
   - 見つからない場合は `null` を返してスキップ

**修正前:**
```javascript
function getCwCountValue(sheet, itemName) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2 || lastCol < 1) return null;

  // 1行目から itemName の列インデックスを探す
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var itemColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === itemName) {
      itemColIndex = i;
      break;
    }
  }

  if (itemColIndex < 0) {
    Logger.log('CWカウント: 「' + itemName + '」列が見つかりません');
    return null;
  }

  // 2行目の値を取得（回数行）← バグ：「回数」行を取得している
  var val = sheet.getRange(2, itemColIndex + 1).getValue();
  var strVal = String(val).trim();
  return strVal === '' ? null : strVal;
}
```

**修正後:**
```javascript
function getCwCountValue(sheet, itemName) {
  var lastCol = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();

  if (lastRow < 2 || lastCol < 1) return null;

  // 1行目から itemName の列インデックスを探す
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var itemColIndex = -1;
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim() === itemName) {
      itemColIndex = i;
      break;
    }
  }

  if (itemColIndex < 0) {
    Logger.log('CWカウント: 「' + itemName + '」列が見つかりません');
    return null;
  }

  // A列から「現在計」ラベルの行インデックスを探す
  var rowLabels = sheet.getRange(1, 1, lastRow, 1).getValues();
  var currentTotalRowIndex = -1;
  for (var j = 0; j < rowLabels.length; j++) {
    if (String(rowLabels[j][0]).trim() === '現在計') {
      currentTotalRowIndex = j + 1; // 1-indexed
      break;
    }
  }

  if (currentTotalRowIndex < 0) {
    Logger.log('CWカウント: 「現在計」行が見つかりません（itemName: ' + itemName + '）');
    return null;
  }

  // 「現在計」行の値を取得
  var val = sheet.getRange(currentTotalRowIndex, itemColIndex + 1).getValue();
  var strVal = String(val).trim();
  return strVal === '' ? null : strVal;
}
```

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：
1. **探索フェーズ**: 修正前のコードでバグを確認（Supabase の `cw_counts` テーブルの値を確認）
2. **修正確認フェーズ**: GAS修正後に手動実行して `cw_counts` テーブルの値が正しくなることを確認

### Exploratory Bug Condition Checking

**Goal**: 修正前に `cw_counts` テーブルの現在値を確認し、バグを実証する。

**Test Plan**: Supabase の `cw_counts` テーブルを直接クエリして、`item_name = '間取図（300円）'` の `current_total` が 153 であることを確認する。

**Test Cases:**
1. **Supabase確認**: `cw_counts` テーブルで `item_name = '間取図（300円）'` の `current_total` が 153 であることを確認（バグの証拠）
2. **フロントエンド確認**: 業務リストの間取図確認セクションで「間取図300円（CW）計⇒ 153」が表示されることを確認

**Expected Counterexamples:**
- `cw_counts.current_total` が 153（「回数」行の値）になっている
- 正しい値は 3（「現在計」行の値）

### Fix Checking

**Goal**: 修正後に `getCwCountValue` が「現在計」行の値を返すことを確認する。

**Pseudocode:**
```
FOR ALL itemName IN ['間取図（300円）', 'サイト登録'] DO
  result := getCwCountValue_fixed(cwSheet, itemName)
  ASSERT result = cwSheet.getRange('現在計'行, itemName列).getValue()
END FOR
```

**手順:**
1. GASコードを修正
2. GASエディタで `syncCwCounts` を手動実行
3. Supabase の `cw_counts` テーブルを確認し、`current_total` が 3 になっていることを確認
4. フロントエンドで「間取図300円（CW）計⇒ 3」が表示されることを確認

### Preservation Checking

**Goal**: 修正後もフロントエンドの表示ロジックが正常に動作することを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT getCwCountValue_original(input) = getCwCountValue_fixed(input)
END FOR
```

**Test Cases:**
1. **フロントエンド表示の維持**: `WorkTaskDetailModal.tsx` の表示形式（`間取図300円（CW)計⇒ {値}`）が変わらないことを確認
2. **サイト登録の維持**: 「サイト登録（CW）計」の値も正しく表示されることを確認
3. **他セクションの維持**: 業務リストの他のセクション（間取図修正回数等）が影響を受けないことを確認

### Unit Tests

- `getCwCountValue` に「現在計」行が存在するシートを渡した場合、5行目の値を返すことを確認
- 「現在計」行が存在しないシートを渡した場合、`null` を返すことを確認
- 指定した `itemName` の列が存在しない場合、`null` を返すことを確認

### Property-Based Tests

- 任意の行数・列数のシートに対して、A列に「現在計」ラベルがある場合は必ずその行の値を返す
- 「現在計」ラベルが複数ある場合は最初に見つかった行の値を返す
- 空文字列の値は `null` として扱われる

### Integration Tests

- GASの `syncCwCounts` を実行後、Supabase の `cw_counts` テーブルの値が「現在計」行の値と一致することを確認
- フロントエンドで業務リストを開き、「間取図300円（CW）計」が正しい値（3）を表示することを確認
