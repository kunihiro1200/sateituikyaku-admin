# seller-visit-reminder-email-date-bug バグ修正デザイン

## Overview

`CallModePage` の `replaceEmailPlaceholders` 関数が、訪問日時プレースホルダー（`<<訪問日>>`・`<<時間>>`）の解決に `seller.appointmentDate` のみを参照している。
実際の訪問日時は `seller.visitDate`（`visit_date` カラム）と `seller.visitTime`（`visit_time` カラム）に保存されているため、`appointmentDate` が null の場合にプレースホルダーが空文字になる。

修正方針：`appointmentDate` が null/undefined の場合は `visitDate` にフォールバックし、`visitDate` の時刻が 00:00 の場合はさらに `visitTime` を参照する。

## Glossary

- **Bug_Condition (C)**: `seller.appointmentDate` が null/undefined かつ `seller.visitDate` に有効な訪問日時が設定されている状態
- **Property (P)**: `<<訪問日>>` と `<<時間>>` が `visitDate`（または `visitTime`）から正しく生成された文字列に置換されること
- **Preservation**: `appointmentDate` が有効な場合の既存の置換ロジック、およびその他すべてのプレースホルダー置換ロジックが変更されないこと
- **replaceEmailPlaceholders**: `frontend/frontend/src/pages/CallModePage.tsx` 内の関数。メールテンプレートのプレースホルダーを実データに置換する
- **appointmentDate**: `seller.appointmentDate` — 商談予約日時（`appointment_date` カラム）
- **visitDate**: `seller.visitDate` — 実際の訪問日時（`visit_date` カラム）。型は `Date | string | undefined`
- **visitTime**: `seller.visitTime` — 訪問時刻文字列（`visit_time` カラム）。型は `string | undefined`（`HH:mm:ss` 形式）

## Bug Details

### Bug Condition

`replaceEmailPlaceholders` は訪問日時ブロックで `seller.appointmentDate` の有無のみを判定している。
`appointmentDate` が null/undefined の場合、`visitDate` に有効な値があっても `else` ブランチで空文字に置換してしまう。

**Formal Specification:**
```
FUNCTION isBugCondition(seller)
  INPUT: seller of type Seller
  OUTPUT: boolean

  RETURN seller.appointmentDate IS NULL OR seller.appointmentDate IS UNDEFINED
         AND (seller.visitDate IS NOT NULL AND seller.visitDate IS NOT UNDEFINED)
END FUNCTION
```

### Examples

- `appointmentDate = null`, `visitDate = "2025-07-15T10:00:00"` → `<<訪問日>>` が `""` になる（バグ）。期待値: `"7月15日"`
- `appointmentDate = null`, `visitDate = "2025-07-15T00:00:00"`, `visitTime = "10:30:00"` → `<<時間>>` が `""` になる（バグ）。期待値: `"10:30"`
- `appointmentDate = null`, `visitDate = null` → `<<訪問日>>` と `<<時間>>` が `""` になる（正常動作）
- `appointmentDate = "2025-07-20T14:00:00"` → `<<訪問日>>` が `"7月20日"` になる（正常動作・変更なし）

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- `seller.appointmentDate` が有効な場合は引き続き `appointmentDate` から日付・時刻を生成して置換する
- `seller.appointmentDate` が優先され、`visitDate` は参照しない（`appointmentDate` が有効な場合）
- `<<名前（漢字のみ）>>`、`<<物件所在地>>`、`<<査定額1>>` 等、その他すべてのプレースホルダー置換ロジックは変更しない

**Scope:**
訪問日時ブロック（`<<訪問日>>`・`<<時間>>`）以外のプレースホルダー処理はすべて影響を受けない。
また `appointmentDate` が有効な場合の動作も変更しない。

## Hypothesized Root Cause

1. **フォールバックロジックの欠如**: `appointmentDate` が null の場合に `visitDate` を参照するフォールバックが実装されていない。`visitDate` カラムが後から追加されたため、既存の `appointmentDate` ロジックが更新されなかった可能性がある。

2. **時刻フィールドの分離**: `visitDate` の時刻部分が 00:00 の場合に `visitTime` を参照する二段階フォールバックが必要だが、その仕様が `replaceEmailPlaceholders` に反映されていない。

3. **型の多様性への未対応**: `visitDate` は `Date | string | undefined` 型であり、文字列の場合も `new Date()` でパースする必要があるが、その処理が存在しない。

## Correctness Properties

Property 1: Bug Condition - visitDate フォールバックによる訪問日時置換

_For any_ seller において `appointmentDate` が null/undefined かつ `visitDate` が有効な値を持つ場合、修正後の `replaceEmailPlaceholders` は `visitDate`（または `visitTime`）から生成した日付・時刻文字列で `<<訪問日>>` と `<<時間>>` を置換 SHALL する。

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - appointmentDate 優先ロジックの維持

_For any_ seller において `appointmentDate` が有効な値を持つ場合（isBugCondition が false）、修正後の `replaceEmailPlaceholders` は修正前と同一の結果を生成 SHALL する。`visitDate` は参照されない。

**Validates: Requirements 3.1, 3.2, 3.3**

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: `replaceEmailPlaceholders`（2829行付近）

**Specific Changes**:

1. **フォールバックロジックの追加**: `appointmentDate` が null/undefined の場合に `visitDate` を参照するブランチを追加する

2. **visitDate のパース**: `visitDate` は `Date | string | undefined` 型のため、`new Date(seller.visitDate)` でパースする

3. **visitTime フォールバック**: `visitDate` の時刻部分（`getHours()` と `getMinutes()`）が両方 0 の場合、`visitTime`（`HH:mm:ss` 形式）から時刻文字列を生成する

4. **既存ロジックの維持**: `appointmentDate` が有効な場合の処理は一切変更しない

**修正前コード:**
```typescript
// 訪問日時
if (seller.appointmentDate) {
  const appointmentDate = new Date(seller.appointmentDate);
  const dateStr = `${appointmentDate.getMonth() + 1}月${appointmentDate.getDate()}日`;
  const timeStr = `${appointmentDate.getHours()}:${appointmentDate.getMinutes().toString().padStart(2, '0')}`;
  result = result.replace(/<<訪問日>>/g, dateStr);
  result = result.replace(/<<時間>>/g, timeStr);
} else {
  result = result.replace(/<<訪問日>>/g, '');
  result = result.replace(/<<時間>>/g, '');
}
```

**修正後コード（疑似コード）:**
```
IF seller.appointmentDate IS NOT NULL THEN
  // 既存ロジック（変更なし）
  dateStr = format(appointmentDate)
  timeStr = format(appointmentDate)
ELSE IF seller.visitDate IS NOT NULL THEN
  visitDateObj = new Date(seller.visitDate)
  dateStr = format(visitDateObj)
  // 時刻が 00:00 かつ visitTime が存在する場合はフォールバック
  IF visitDateObj.hours == 0 AND visitDateObj.minutes == 0 AND seller.visitTime THEN
    timeStr = seller.visitTime の HH:mm 部分
  ELSE
    timeStr = format(visitDateObj)
  END IF
ELSE
  dateStr = ''
  timeStr = ''
END IF
result.replace(<<訪問日>>, dateStr)
result.replace(<<時間>>, timeStr)
```

**注意**: 日本語を含むファイルのため、Pythonスクリプトを使用してUTF-8で編集すること（file-encoding-protection.md ルール）。

## Testing Strategy

### Validation Approach

二段階アプローチ：まず未修正コードでバグを再現するテストを書いて根本原因を確認し、次に修正後のコードでバグ修正と既存動作の保持を検証する。

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `replaceEmailPlaceholders` を直接呼び出し、`appointmentDate = null` かつ `visitDate` が有効な seller オブジェクトを渡して `<<訪問日>>` と `<<時間>>` が空文字になることを確認する。

**Test Cases**:
1. **visitDate のみ設定**: `appointmentDate = null`, `visitDate = "2025-07-15T10:00:00"` → `<<訪問日>>` が `""` になることを確認（未修正コードで失敗）
2. **visitTime フォールバック**: `appointmentDate = null`, `visitDate = "2025-07-15T00:00:00"`, `visitTime = "10:30:00"` → `<<時間>>` が `""` になることを確認（未修正コードで失敗）
3. **両方 null**: `appointmentDate = null`, `visitDate = null` → `<<訪問日>>` が `""` になることを確認（正常動作）

**Expected Counterexamples**:
- `visitDate` が有効でも `<<訪問日>>` が空文字になる
- 原因: `else` ブランチが `visitDate` を参照せずに空文字を返している

### Fix Checking

**Goal**: バグ条件が成立するすべての入力に対して、修正後の関数が正しい動作をすることを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE isBugCondition(seller) DO
  result := replaceEmailPlaceholders_fixed(template, seller)
  ASSERT result.contains(expectedDateStr(seller.visitDate))
  ASSERT result.contains(expectedTimeStr(seller.visitDate, seller.visitTime))
END FOR
```

### Preservation Checking

**Goal**: バグ条件が成立しないすべての入力に対して、修正後の関数が修正前と同一の結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL seller WHERE NOT isBugCondition(seller) DO
  ASSERT replaceEmailPlaceholders_original(template, seller)
       = replaceEmailPlaceholders_fixed(template, seller)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。`appointmentDate` が有効な seller を多数生成し、修正前後で結果が一致することを確認する。

**Test Cases**:
1. **appointmentDate 優先の維持**: `appointmentDate` が有効な場合、`visitDate` の値に関わらず `appointmentDate` から生成した文字列が使われることを確認
2. **その他プレースホルダーの不変性**: `<<名前（漢字のみ）>>`、`<<物件所在地>>` 等が修正前後で同一であることを確認
3. **visitDate も null の場合**: `appointmentDate = null`, `visitDate = null` → 空文字置換が維持されることを確認

### Unit Tests

- `appointmentDate = null`, `visitDate` が Date 型の場合の日付・時刻生成
- `appointmentDate = null`, `visitDate` が string 型の場合のパース
- `visitDate` の時刻が 00:00 かつ `visitTime` が存在する場合の時刻フォールバック
- `visitDate` の時刻が 00:00 かつ `visitTime` が存在しない場合（`"00:00"` を返す）
- `appointmentDate` が有効な場合の既存動作の維持

### Property-Based Tests

- ランダムな `visitDate`（Date 型・string 型）を生成し、`<<訪問日>>` が正しい `M月D日` 形式になることを検証
- ランダムな `appointmentDate` を持つ seller を生成し、修正前後で置換結果が一致することを検証（Preservation）
- `visitTime` の様々な形式（`"10:30:00"`, `"09:05:00"` 等）に対して `HH:mm` 形式が正しく抽出されることを検証

### Integration Tests

- CallModePage でメールテンプレート「★訪問前日通知メール」を選択し、`visitDate` が設定された seller で `<<訪問日>>` と `<<時間>>` が正しく表示されることを確認
- `appointmentDate` が設定された seller で既存動作が変わらないことを確認
- `visitDate` も `appointmentDate` も null の seller でプレースホルダーが空文字になることを確認
