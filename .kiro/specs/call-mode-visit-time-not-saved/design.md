# call-mode-visit-time-not-saved バグ修正設計

## Overview

通話モードページ（CallModePage）で訪問予約の日付と時間を登録しても、スプレッドシート自動同期（EnhancedAutoSyncService）が実行されると `visit_date` が日付のみ（`YYYY-MM-DD 00:00:00`）で上書きされ、時間情報が消えるバグを修正する。

**修正対象ファイル**: `backend/src/services/EnhancedAutoSyncService.ts`

**修正方針**:
1. `updateSingleSeller` / `syncSingleSeller` の `visit_date` 更新ロジックで、スプレッドシートの「訪問日 Y/M/D」列と「訪問時間」列を組み合わせて `YYYY-MM-DD HH:mm:ss` 形式で保存する
2. `detectUpdatedSellers` の比較ロジックで、`visit_date` の日付部分だけでなく時間部分も含めて比較する

---

## Glossary

- **Bug_Condition (C)**: スプレッドシート同期時に `visit_date` が日付のみ（`YYYY-MM-DD 00:00:00`）で上書きされる条件
- **Property (P)**: 同期後も `visit_date` の時間部分が正しく保持されること
- **Preservation**: フロントエンドからの保存・日付のみの登録・削除など、バグ条件に該当しない既存動作が変わらないこと
- **formatVisitDate**: `EnhancedAutoSyncService` 内のプライベートメソッド。スプレッドシートの日付値を `YYYY-MM-DD` 形式に変換する
- **formatVisitTime**: `EnhancedAutoSyncService` 内のプライベートメソッド。スプレッドシートの時刻値を `HH:MM` 形式に変換する
- **updateSingleSeller**: 既存売主のDBレコードをスプレッドシートデータで更新するメソッド
- **syncSingleSeller**: 新規売主をスプレッドシートデータからDBに登録するメソッド
- **detectUpdatedSellers**: スプレッドシートとDBを比較して更新が必要な売主番号を検出するメソッド
- **visit_date**: `sellers` テーブルの TIMESTAMP 型カラム。訪問予約の日時を `YYYY-MM-DD HH:mm:ss` 形式で保存する
- **visit_time**: `sellers` テーブルの TEXT 型カラム。訪問時間を `HH:MM` 形式で保存する（`visit_date` の時間部分と整合させる）

---

## Bug Details

### Bug Condition

スプレッドシート自動同期が実行された際、`updateSingleSeller` および `syncSingleSeller` メソッドが `visit_date` を `formatVisitDate(visitDate)` の戻り値（`YYYY-MM-DD` 形式の文字列）のみで更新する。この値をDBに保存すると、PostgreSQL の TIMESTAMP 型が `YYYY-MM-DD 00:00:00` として解釈し、フロントエンドから登録した時間情報が消える。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type SpreadsheetSyncInput
  OUTPUT: boolean

  RETURN (X.visitDate が非null) AND
         (X.visitTime が空欄 OR 同期ロジックが visitDate のみで visit_date を上書きする)
END FUNCTION
```

### Examples

- **例1（バグあり）**: スプレッドシートの「訪問日 Y/M/D」= `2026/05/10`、「訪問時間」= `14:00`。同期後の `visit_date` = `2026-05-10 00:00:00`（期待値: `2026-05-10 14:00:00`）
- **例2（バグあり）**: フロントエンドで `visit_date` = `2026-05-10 14:00:00` と保存後、同期実行。同期後の `visit_date` = `2026-05-10 00:00:00`
- **例3（バグなし）**: スプレッドシートの「訪問時間」が空欄。同期後の `visit_date` = `2026-05-10 00:00:00`（時間なしは正常）
- **例4（バグあり・比較ロジック）**: `visit_date` = `2026-05-10 14:00:00` のとき、`detectUpdatedSellers` が日付部分（`2026-05-10`）のみで比較するため、スプレッドシートの日付が同じなら「変更なし」と判定し、時間情報の消失を検出できない

---

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作:**
- フロントエンドからの訪問予約保存（CallModePage の保存処理）は変更しない
- スプレッドシートの「訪問時間」列が空欄の場合、`visit_date` の時間部分は `00:00:00` のまま（現行動作を維持）
- 訪問予約を削除（日付を空欄にして保存）した場合、`visit_date` を `null` にクリアする動作は変更しない
- 訪問予約の営担（`visit_assignee`）更新ロジックは変更しない
- スプレッドシートの「訪問日 Y/M/D」列が変更されていない場合、不要な上書きを行わない動作は維持する

**スコープ:**
`visit_date` / `visit_time` 以外のフィールド（`status`、`next_call_date`、`visit_assignee` 等）の同期ロジックは変更しない。

---

## Hypothesized Root Cause

コードを確認した結果、以下の2箇所に問題がある。

1. **`updateSingleSeller` / `syncSingleSeller` の visit_date 更新ロジック（主因）**
   - 現在のコード（1384行目付近）:
     ```typescript
     if (visitDate) {
       updateData.visit_date = this.formatVisitDate(visitDate);  // YYYY-MM-DD のみ
     }
     ```
   - `formatVisitDate` は `YYYY-MM-DD` 形式の文字列を返す。これをそのまま保存すると PostgreSQL が `YYYY-MM-DD 00:00:00` と解釈し、時間情報が失われる
   - `visitTime` は別途 `visit_time` カラムに保存されているが、`visit_date` の時間部分には反映されていない

2. **`detectUpdatedSellers` の visit_date 比較ロジック（副因）**
   - 現在のコード（856行目付近）:
     ```typescript
     const dbVisitDate = dbSeller.visit_date ? String(dbSeller.visit_date).substring(0, 10) : null;
     if (formattedSheetVisitDate !== dbVisitDate) {
       needsUpdate = true;
     }
     ```
   - DBの `visit_date` を `.substring(0, 10)` で日付部分のみ取り出して比較しているため、スプレッドシートの日付が同じなら「変更なし」と判定される
   - 結果として、フロントエンドで時間付きで保存した後に同期が走っても「変更なし」と判定され、時間が消えたことに気づかない（ただし、次回スプレッドシートの日付が変わったタイミングで時間が消える）

---

## Correctness Properties

Property 1: Bug Condition - 訪問時間が visit_date に反映される

_For any_ スプレッドシート同期入力 X において、`isBugCondition(X)` が true（訪問日が非null かつ訪問時間が存在する）の場合、修正後の同期処理は `visit_date` を `YYYY-MM-DD HH:mm:ss` 形式（訪問日 + 訪問時間を結合した値）で保存しなければならない。

**Validates: Requirements 2.2, 2.3**

Property 2: Preservation - 訪問時間なしの場合の動作が変わらない

_For any_ スプレッドシート同期入力 X において、`isBugCondition(X)` が false（訪問時間が空欄）の場合、修正後の同期処理は修正前と同じ結果（`visit_date` = `YYYY-MM-DD 00:00:00`）を返さなければならない。

**Validates: Requirements 3.1, 3.2**

---

## Fix Implementation

### Changes Required

**File**: `backend/src/services/EnhancedAutoSyncService.ts`

#### 変更1: `combineVisitDateAndTime` ヘルパーメソッドを追加

訪問日と訪問時間を組み合わせて `YYYY-MM-DD HH:mm:ss` 形式の文字列を返すプライベートメソッドを追加する。

```typescript
/**
 * 訪問日と訪問時間を組み合わせて YYYY-MM-DD HH:mm:ss 形式にフォーマット
 * 訪問時間が存在する場合は日時を結合し、存在しない場合は日付のみ（00:00:00）を返す
 */
private combineVisitDateAndTime(visitDate: any, visitTime: any): string | null {
  const formattedDate = this.formatVisitDate(visitDate);
  if (!formattedDate) return null;

  const formattedTime = this.formatVisitTime(visitTime);
  if (formattedTime) {
    return `${formattedDate} ${formattedTime}:00`;  // YYYY-MM-DD HH:MM:00
  }
  return formattedDate;  // 時間なしの場合は YYYY-MM-DD のみ（00:00:00 として保存される）
}
```

#### 変更2: `updateSingleSeller` の visit_date 更新ロジックを修正

```typescript
// 修正前
if (visitDate) {
  updateData.visit_date = this.formatVisitDate(visitDate);
}
if (visitTime) {
  updateData.visit_time = this.formatVisitTime(visitTime);
}

// 修正後
if (visitDate) {
  updateData.visit_date = this.combineVisitDateAndTime(visitDate, visitTime);
}
if (visitTime) {
  updateData.visit_time = this.formatVisitTime(visitTime);
}
```

#### 変更3: `syncSingleSeller` の visit_date 更新ロジックを修正（同様）

`updateSingleSeller` と同じ箇所（1692行目付近）を同様に修正する。

```typescript
// 修正前
if (visitDate) {
  encryptedData.visit_date = this.formatVisitDate(visitDate);
}

// 修正後
if (visitDate) {
  encryptedData.visit_date = this.combineVisitDateAndTime(visitDate, visitTime);
}
```

#### 変更4: `detectUpdatedSellers` の visit_date 比較ロジックを修正

スプレッドシートの「訪問時間」列も考慮して比較する。

```typescript
// 修正前
const sheetVisitDate = sheetRow['訪問日 Y/M/D'];
const formattedSheetVisitDate = sheetVisitDate ? this.formatVisitDate(sheetVisitDate) : null;
const dbVisitDate = dbSeller.visit_date ? String(dbSeller.visit_date).substring(0, 10) : null;
if (formattedSheetVisitDate !== dbVisitDate) {
  needsUpdate = true;
}

// 修正後
const sheetVisitDate = sheetRow['訪問日 Y/M/D'];
const sheetVisitTime = sheetRow['訪問時間'];
const formattedSheetVisitDateTime = sheetVisitDate
  ? this.combineVisitDateAndTime(sheetVisitDate, sheetVisitTime)
  : null;
// DB の visit_date を YYYY-MM-DD HH:mm 形式で比較（秒は無視）
const dbVisitDateTime = dbSeller.visit_date
  ? String(dbSeller.visit_date).substring(0, 16).replace('T', ' ')
  : null;
const sheetVisitDateTimeForCompare = formattedSheetVisitDateTime
  ? formattedSheetVisitDateTime.substring(0, 16)
  : null;
if (sheetVisitDateTimeForCompare !== dbVisitDateTime) {
  needsUpdate = true;
}
```

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチで検証する。まず未修正コードでバグを再現するテストを書いてバグを確認し、次に修正後のコードでバグが解消されていること・既存動作が壊れていないことを確認する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `updateSingleSeller` に「訪問日あり・訪問時間あり」のスプレッドシート行を渡し、DBに保存される `visit_date` の時間部分が `00:00:00` になることを確認する。

**Test Cases**:
1. **訪問日+訪問時間あり**: `visitDate = "2026/05/10"`, `visitTime = "14:00"` → `visit_date` が `2026-05-10 00:00:00` になる（バグ再現）
2. **Excelシリアル値の訪問時間**: `visitDate = 46151`（シリアル値）, `visitTime = 0.583333`（14:00のシリアル値）→ `visit_date` が `2026-05-10 00:00:00` になる（バグ再現）
3. **比較ロジックのバグ**: DB の `visit_date = "2026-05-10 14:00:00"`, スプレッドシートの `訪問日 Y/M/D = "2026/05/10"` → `detectUpdatedSellers` が「変更なし」と判定する（バグ再現）

**Expected Counterexamples**:
- `updateSingleSeller` が `visit_date` を `YYYY-MM-DD` のみで保存し、時間が `00:00:00` になる
- `detectUpdatedSellers` が日付部分のみで比較するため、時間の差異を検出できない

### Fix Checking

**Goal**: 修正後のコードで、バグ条件に該当する入力に対して正しい動作をすることを確認する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := updateSingleSeller_fixed(X)
  ASSERT result.visit_date の時間部分 = X.visitTime
END FOR
```

### Preservation Checking

**Goal**: バグ条件に該当しない入力に対して、修正前後で動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT updateSingleSeller_original(X) = updateSingleSeller_fixed(X)
END FOR
```

**Testing Approach**: 以下のケースで修正前後の動作が同じであることを確認する。

**Test Cases**:
1. **訪問時間なし**: `visitDate = "2026/05/10"`, `visitTime = ""` → `visit_date = "2026-05-10"` のまま（`00:00:00`）
2. **訪問日なし**: `visitDate = ""`, `visitTime = "14:00"` → `visit_date` は更新されない
3. **訪問日・時間ともになし**: `visitDate = ""`, `visitTime = ""` → `visit_date` は更新されない
4. **visit_assignee の更新**: `visitAssignee = "田中"` → `visit_assignee` が正しく更新される（`visit_date` は変わらない）

### Unit Tests

- `combineVisitDateAndTime` メソッドの単体テスト（日付+時間の結合、時間なし、日付なし、Excelシリアル値）
- `updateSingleSeller` に訪問日+訪問時間を渡したときの `visit_date` の値を確認
- `detectUpdatedSellers` の比較ロジックで時間差異が検出されることを確認

### Property-Based Tests

- ランダムな日付・時間の組み合わせで `combineVisitDateAndTime` が常に `YYYY-MM-DD HH:mm:ss` または `YYYY-MM-DD` を返すことを確認
- 訪問時間が空欄のランダム入力で、修正前後の `visit_date` が同じになることを確認（Preservation）

### Integration Tests

- スプレッドシートデータを模したモックで `updateSingleSeller` を実行し、DBの `visit_date` が正しく保存されることを確認
- フロントエンドで時間付きで保存後、同期を実行しても時間が消えないことを確認
