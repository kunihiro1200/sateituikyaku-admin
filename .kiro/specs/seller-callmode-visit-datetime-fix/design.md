# 訪問予約日時が00:00にリセットされるバグ 修正設計

## Overview

通話モードページ（CallModePage）の訪問予約フォームで日時を入力・保存すると、時間部分が `00:00` にリセットされるバグが再発している。

このバグはコミット `2f47187b`（`appointmentDate` 経由の `visit_date` 変換処理を削除）で一度修正されたが、コミット `5d93fe8b`（`combineVisitDateAndTime` の導入）によって再発した。

**バグの発生経路は2つ存在する：**

1. **スプレッドシート同期経路**：`EnhancedAutoSyncService.combineVisitDateAndTime()` が「訪問時間」列が空欄の場合に `YYYY-MM-DD`（時刻なし）形式で `visit_date` を保存してしまう
2. **フロントエンド表示経路**：`CallModePage` 内の `new Date(sellerData.visitDate)` パース処理でタイムゾーン変換が発生し、時間部分が `00:00` になる

**修正方針：**
- バックエンド：`combineVisitDateAndTime` が時刻なしの場合に `YYYY-MM-DD 00:00:00` 形式で保存するよう修正（既存の時刻を上書きしない）
- フロントエンド：`new Date()` を使わず、文字列を直接パースしてタイムゾーン変換を回避する

---

## Glossary

- **Bug_Condition (C)**：バグが発生する条件 — 訪問時間が消えて `00:00` になる状況
- **Property (P)**：期待される正しい動作 — 入力した時間がそのまま保持・表示される
- **Preservation**：修正によって変更してはいけない既存の動作（時刻あり同期、マウス操作、null クリアなど）
- **combineVisitDateAndTime**：`backend/src/services/EnhancedAutoSyncService.ts` 内の関数。訪問日と訪問時間を組み合わせて `YYYY-MM-DD HH:mm:ss` 形式にフォーマットする
- **visit_date**：DB の `sellers` テーブルの TIMESTAMP 型カラム。訪問予約の日時を保存する
- **visitDate**：フロントエンドの `Seller` 型のプロパティ。`visit_date` をそのまま文字列として返す（`decryptSeller` 内で `seller.visit_date || undefined` として設定）
- **datetime-local**：HTML の `<input type="datetime-local">` 形式（`YYYY-MM-DDTHH:mm`）

---

## Bug Details

### Bug Condition

バグは以下の2つの経路で発生する。

**経路A（フロントエンド表示経路）**：
`sellerData.visitDate` が `"2026-05-10"` または `"2026-05-10T00:00:00.000Z"` のような形式の場合、`new Date(sellerData.visitDate)` がタイムゾーン変換を行い、JST（UTC+9）環境では時間が `00:00` または誤った値になる。

具体的には：
- `"2026-05-10"` → `new Date("2026-05-10")` → UTC 00:00 → JST では前日の 09:00 になる（日付もずれる）
- `"2026-05-10T14:30:00"` → `new Date("2026-05-10T14:30:00")` → ローカル時刻として解釈されるため正常
- `"2026-05-10T00:00:00.000Z"` → `new Date(...)` → UTC 00:00 → JST 09:00 になる（時間がずれる）

**経路B（スプレッドシート同期経路）**：
`combineVisitDateAndTime(visitDate, visitTime)` で `visitTime` が空欄の場合、`formattedDate`（`YYYY-MM-DD` 形式）をそのまま返す。これが `visit_date` に保存されると、DB は TIMESTAMP 型なので `2026-05-10 00:00:00` として解釈される。その後フロントエンドが `new Date()` でパースすると経路Aのバグが発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(X)
  INPUT: X of type VisitDateInput
  OUTPUT: boolean

  // 経路A: フロントエンドがvisitDateをnew Date()でパースしてタイムゾーン変換が発生
  CONDITION_A = (
    X.source = 'frontend_display'
    AND X.visitDate is string
    AND (
      X.visitDate does NOT contain 'T'  // 日付のみ形式 "YYYY-MM-DD"
      OR X.visitDate ends with 'Z'      // UTC形式 "YYYY-MM-DDTHH:mm:ss.sssZ"
    )
  )

  // 経路B: スプレッドシート同期でvisitTimeが空欄のときcombineVisitDateAndTimeが日付のみを返す
  CONDITION_B = (
    X.source = 'spreadsheet_sync'
    AND X.visitTime is empty
    AND combineVisitDateAndTime(X.visitDate, X.visitTime) returns 'YYYY-MM-DD' format
  )

  RETURN CONDITION_A OR CONDITION_B
END FUNCTION
```

### Examples

- **例1（経路B → 経路A の連鎖）**：スプレッドシートの「訪問時間」列が空欄 → `combineVisitDateAndTime("2026-05-10", "")` が `"2026-05-10"` を返す → DB に `2026-05-10 00:00:00` として保存 → フロントエンドが `new Date("2026-05-10")` でパース → JST では `2026-05-09T15:00:00` になり日付もずれる
- **例2（経路A のみ）**：DB に `"2026-05-10T14:30:00.000Z"` が保存されている → フロントエンドが `new Date("2026-05-10T14:30:00.000Z")` でパース → JST では `2026-05-10T23:30:00` になり時間が9時間ずれる
- **例3（正常ケース）**：フロントエンドから `"2026-05-10 14:30:00"` を保存 → DB に `2026-05-10 14:30:00` として保存 → フロントエンドが `new Date("2026-05-10 14:30:00")` でパース → ローカル時刻として解釈されるため `14:30` が正しく表示される（ただし環境依存）
- **エッジケース**：訪問時間が `"00:00"` の場合は経路Bのバグと区別できないため、`combineVisitDateAndTime` は時刻なしの場合に `"YYYY-MM-DD 00:00:00"` を明示的に返すべき

---

## Expected Behavior

### Preservation Requirements

**変更してはいけない動作：**
- フロントエンドから訪問日時（例: `2026-05-10T14:30`）を入力して保存した場合、時間部分（`14:30`）がそのまま保持・表示される
- スプレッドシートの「訪問時間」列に値（例: `14:30`）が入力されている場合、日付と時間を正しく組み合わせて `visit_date` に保存する動作は変わらない
- 訪問予約フォームで日時を削除（空欄）にして保存すると、`visit_date` が `null` にクリアされる
- 訪問予約フォームで営担（visitAssignee）を設定して保存すると、営担が正しく保存される
- ページをリロードしても保存した日時が正しく表示される

**影響を受けないスコープ：**
訪問日時の入力・表示・同期以外の全ての機能（電話メモ、査定情報、SMS/メール送信など）はこの修正の影響を受けない。

---

## Hypothesized Root Cause

コードの確認から、以下の根本原因が特定された：

1. **`combineVisitDateAndTime` の不完全な実装（経路B）**
   - `visitTime` が空欄の場合、`formattedDate`（`YYYY-MM-DD` 形式）をそのまま返す
   - DB の TIMESTAMP 型は `YYYY-MM-DD` を `YYYY-MM-DD 00:00:00` として解釈するため、時刻情報が失われる
   - コミット `5d93fe8b` で導入されたが、時刻なしの場合の処理が不完全だった

2. **フロントエンドの `new Date()` によるタイムゾーン変換（経路A）**
   - `new Date("2026-05-10")` は UTC 00:00 として解釈され、JST では前日の 15:00 になる
   - `new Date("2026-05-10T00:00:00.000Z")` は UTC 00:00 として解釈され、JST では 09:00 になる
   - コミット `2f47187b` で `appointmentDate` 経由の変換は修正されたが、`visitDate` の `new Date()` パースは残っている
   - `decryptSeller` が `visitDate: seller.visit_date || undefined` として文字列のまま返すため、フロントエンドで `new Date()` を使うとタイムゾーン変換が発生する

3. **文字列フォーマットの不統一**
   - DB から返される `visit_date` の形式が `"2026-05-10T14:30:00.000Z"`（ISO 8601 UTC）や `"2026-05-10 14:30:00"`（ローカル時刻）など不統一
   - フロントエンドは `new Date()` で統一的にパースしようとするが、形式によって挙動が異なる

---

## Correctness Properties

Property 1: Bug Condition - 訪問日時の時間部分が保持される

_For any_ 入力において、バグ条件が成立する（`isBugCondition` が true を返す）場合、修正後の処理は入力した時間部分（時・分）をそのまま保持し、`00:00` にリセットしない。

具体的には：
- スプレッドシート同期で訪問時間が空欄の場合、既存の `visit_date` の時刻部分を上書きしない（または `00:00:00` を明示的に保存する）
- フロントエンドが `visit_date` を表示する際、タイムゾーン変換を行わずローカル時刻をそのまま表示する

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - 既存の正常動作が維持される

_For any_ 入力において、バグ条件が成立しない（`isBugCondition` が false を返す）場合、修正後の処理は修正前の処理と同じ結果を返し、既存の動作を変更しない。

具体的には：
- 訪問時間あり同期（`visitTime` が空でない場合）の動作は変わらない
- フロントエンドからの保存・表示の動作は変わらない
- 訪問日時の削除（null クリア）は変わらない

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

---

## Fix Implementation

### Changes Required

根本原因の分析に基づき、以下の変更が必要：

**ファイル1**: `backend/src/services/EnhancedAutoSyncService.ts`

**関数**: `combineVisitDateAndTime`

**変更内容**:
1. **時刻なしの場合の処理を修正**：`visitTime` が空欄の場合、`YYYY-MM-DD` ではなく `YYYY-MM-DD 00:00:00` を返すよう修正する
   ```typescript
   // 修正前
   return formattedDate; // "2026-05-10" → DBが "2026-05-10 00:00:00" として解釈

   // 修正後
   return `${formattedDate} 00:00:00`; // 明示的に時刻を付与
   ```
   ただし、これだけでは「既存の時刻を上書きしてしまう」問題が残る。スプレッドシートに訪問時間が入力されていない場合は、DBの既存の時刻を保持すべきかどうかを検討する必要がある。

2. **既存時刻の保持ロジック**：スプレッドシート同期時に `visitTime` が空欄の場合、`visit_date` の更新をスキップする（または既存の時刻を取得して保持する）

**ファイル2**: `frontend/frontend/src/pages/CallModePage.tsx`

**変更箇所**（3箇所）:
1. **初期化処理**（行1754-1763）：`new Date(sellerData.visitDate)` を文字列直接パースに変更
2. **キャンセル時処理**（行5217-5222）：`new Date(seller.visitDate)` を文字列直接パースに変更
3. **編集モード開始時処理**（行5244付近）：`new Date(seller.visitDate)` を文字列直接パースに変更

**修正パターン（フロントエンド共通）**：
```typescript
// 修正前（タイムゾーン変換が発生）
const visitDateTime = new Date(sellerData.visitDate);
const year = visitDateTime.getFullYear();
const month = String(visitDateTime.getMonth() + 1).padStart(2, '0');
const day = String(visitDateTime.getDate()).padStart(2, '0');
const hours = String(visitDateTime.getHours()).padStart(2, '0');
const minutes = String(visitDateTime.getMinutes()).padStart(2, '0');
return `${year}-${month}-${day}T${hours}:${minutes}`;

// 修正後（文字列を直接パース、タイムゾーン変換なし）
// visit_date は "YYYY-MM-DD HH:mm:ss" または "YYYY-MM-DDTHH:mm:ss" 形式
const visitDateStr = String(sellerData.visitDate);
// "T" または " " で分割して日付と時刻を取得
const normalized = visitDateStr.replace('T', ' ').replace(/\.\d+Z?$/, '');
const [datePart, timePart = '00:00'] = normalized.split(' ');
const [hh, mm] = timePart.split(':');
return `${datePart}T${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
```

---

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで実施する：まず未修正コードでバグを再現するテストを書いてバグを確認し、次に修正後のコードでバグが解消され既存動作が保持されることを検証する。

### Exploratory Bug Condition Checking

**目標**：修正前のコードでバグを再現し、根本原因を確認する。

**テスト計画**：`combineVisitDateAndTime` と フロントエンドの `new Date()` パース処理に対してユニットテストを書き、未修正コードで失敗することを確認する。

**テストケース**：
1. **経路B テスト**：`combineVisitDateAndTime("2026-05-10", "")` が `"2026-05-10"` を返すことを確認（未修正コードで「成功」するが、これがバグの原因）
2. **経路A テスト**：`new Date("2026-05-10").getHours()` が JST 環境で `0` にならないことを確認（タイムゾーン変換の問題）
3. **連鎖テスト**：`combineVisitDateAndTime` の出力を `new Date()` でパースすると時間が `00:00` になることを確認
4. **エッジケース**：`combineVisitDateAndTime("2026-05-10", "14:30")` が正しく `"2026-05-10 14:30:00"` を返すことを確認（正常ケース）

**期待されるカウンターサンプル**：
- `combineVisitDateAndTime("2026-05-10", "")` → `"2026-05-10"`（時刻なし）
- `new Date("2026-05-10").getHours()` → JST では `9`（UTC 00:00 → JST 09:00）または `0`（環境依存）

### Fix Checking

**目標**：バグ条件が成立する全ての入力に対して、修正後の処理が正しい動作をすることを検証する。

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition(X) DO
  result := fixedProcess(X)
  ASSERT result.hours = X.inputHours
  ASSERT result.minutes = X.inputMinutes
  ASSERT result.date = X.inputDate
END FOR
```

### Preservation Checking

**目標**：バグ条件が成立しない全ての入力に対して、修正後の処理が修正前と同じ結果を返すことを検証する。

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition(X) DO
  ASSERT originalProcess(X) = fixedProcess(X)
END FOR
```

**テスト計画**：未修正コードで正常動作するケース（訪問時間あり同期、フロントエンドからの保存）を観察し、修正後も同じ動作をすることをプロパティベーステストで検証する。

**テストケース**：
1. **訪問時間あり同期の保持**：`combineVisitDateAndTime("2026-05-10", "14:30")` が修正前後で同じ結果を返すことを確認
2. **フロントエンド保存の保持**：`"2026-05-10 14:30:00"` 形式の文字列が正しくパースされることを確認
3. **null クリアの保持**：`visitDate` が空欄の場合に `null` が保存されることを確認
4. **営担保存の保持**：`visitAssignee` の保存動作が変わらないことを確認

### Unit Tests

- `combineVisitDateAndTime` の各入力パターン（時刻あり・なし・null）に対するテスト
- フロントエンドの `visitDate` 文字列パース関数のテスト（タイムゾーン変換なし）
- `visit_date` の保存・取得の往復テスト（保存した値がそのまま返ってくること）

### Property-Based Tests

- ランダムな日付・時刻の組み合わせで `combineVisitDateAndTime` が常に `YYYY-MM-DD HH:mm:ss` 形式を返すことを検証
- ランダムな `visit_date` 文字列（`YYYY-MM-DD HH:mm:ss` 形式）に対して、フロントエンドのパース処理が時間部分を保持することを検証
- 訪問時間あり・なしの両方のケースで、修正前後の動作が一致することを検証（Preservation）

### Integration Tests

- フロントエンドから訪問日時を入力・保存・リロードして、時間部分が保持されることを確認
- スプレッドシート同期後に訪問日時が正しく保存されることを確認
- 訪問時間なしのスプレッドシート同期後に、フロントエンドで正しく表示されることを確認
