# seller-visit-time-zero-bug バグ修正デザイン

## Overview

通話モードページ（`/sellers/:id/call`）の訪問日時フィールドで、日時を入力して保存すると時刻が `0:00` にリセットされるバグ。

**バグの本質**: フロントエンドの表示時（読み込み）と保存時でタイムゾーン処理が非対称になっている。

- **読み込み時**: バックエンドから返される UTC ISO 8601 形式（`2026-05-10T01:00:00.000Z`）を `new Date()` でJST変換して表示
- **保存時**: `datetime-local` の値（JST）をタイムゾーン変換なしで `YYYY-MM-DD HH:mm:ss` 形式に変換して送信
- **バックエンド保存時**: `appointmentDate` 経由のパスでは `new Date(data.appointmentDate)` でUTC変換が発生し、時刻がずれる

**修正方針**: 保存時にタイムゾーン変換を行わず、ローカル時刻をそのまま保存する（表示と保存の一貫性を確保）。具体的には `appointmentDate` 経由のバックエンド変換処理を削除し、`visitDate` を直接使用する。

---

## Glossary

- **Bug_Condition (C)**: 訪問日時フィールドに時刻を含む日時を入力して保存する操作
- **Property (P)**: 保存後に再読み込みしても、入力した日時と同じ値が表示されること（ラウンドトリップ一貫性）
- **Preservation**: 訪問日時の保存・表示以外の既存動作（訪問取得日の自動設定、カレンダーイベント作成、スプレッドシート同期など）
- **visitDate**: フロントエンドの状態変数 `editedAppointmentDate`（`YYYY-MM-DDTHH:mm` 形式）
- **visit_date**: Supabase の `sellers` テーブルの TIMESTAMP 型カラム
- **appointmentDate**: カレンダーイベント作成用に送信される日時文字列（`YYYY-MM-DD HH:mm:ss` 形式）
- **JST**: 日本標準時（UTC+9）
- **ラウンドトリップ一貫性**: 保存 → 再読み込み後も同じ値が表示されること

---

## Bug Details

### Bug Condition

バグは、通話モードページで訪問日時フィールドに時刻を含む日時を入力して保存したとき、かつバックエンドの `appointmentDate` 処理パスを通るときに発生する。

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { editedAppointmentDate: string, visitAssignee: string }
  OUTPUT: boolean

  RETURN input.editedAppointmentDate IS NOT EMPTY
         AND input.editedAppointmentDate CONTAINS time component (HH:mm != "00:00")
         AND input.visitAssignee IS NOT EMPTY
         AND appointmentDate path is taken (visitDate + appointmentDate both sent)
         AND backend converts appointmentDate via new Date() causing UTC shift
END FUNCTION
```

### Examples

- **例1（バグ発生）**: `2026-05-10T10:00` を入力して保存 → バックエンドで `new Date("2026-05-10 10:00:00")` が UTC として解釈 → `2026-05-10T01:00:00.000Z` として保存 → 再読み込みで `2026-05-10T10:00` と表示（一見正常）
- **例2（バグ発生）**: `2026-05-10T00:00` を入力して保存 → `2026-05-09T15:00:00.000Z` として保存 → 再読み込みで `2026-05-10T00:00` と表示（一見正常だが日付がずれている）
- **例3（バグ発生）**: `visitDate` が `null` で `appointmentDate` のみ送信するケース → `new Date(data.appointmentDate)` でUTC変換が発生し時刻がずれる
- **例4（正常）**: 訪問日が未設定の場合 → フィールドが空欄のまま表示される（影響なし）

---

## Expected Behavior

### Preservation Requirements

**変更しない動作:**
- 訪問日が設定されていない売主の通話モードページを開くと、訪問日フィールドは空欄のまま表示される
- 訪問日を保存すると、訪問取得日（`visitAcquisitionDate`）の自動設定ロジックが正しく動作する
- 訪問日を削除（空欄に）して保存すると、訪問取得日もクリアされる
- 訪問日と営担（`visitAssignee`）を保存すると、カレンダーイベントの作成・更新が正しく行われる
- スプレッドシートと同期する際、`EnhancedAutoSyncService` の `combineVisitDateAndTime` による訪問日時の結合ロジックに影響を与えない
- 訪問日前日のサイドバーステータス判定で、`visit_date` の日付部分が正しく参照される

**Scope:**
訪問日時フィールドの保存・表示処理以外のすべての動作は、このバグ修正によって影響を受けてはならない。

---

## Hypothesized Root Cause

コードの調査により、以下の2つの問題が確認された：

1. **バックエンドの `appointmentDate` 変換処理（主要原因）**:
   `backend/src/services/SellerService.supabase.ts` の `updateSeller` メソッド（行537-551）で、`appointmentDate` が指定され `visitDate` が未指定の場合に `new Date(data.appointmentDate)` を使って変換している。`data.appointmentDate` は `"YYYY-MM-DD HH:mm:ss"` 形式のローカル時刻文字列だが、`new Date()` はこれをUTCとして解釈するため、JST（UTC+9）環境では9時間のズレが生じる。

   ```typescript
   // 問題のコード（backend/src/services/SellerService.supabase.ts 行539-549）
   if (data.appointmentDate && (data as any).visitDate === undefined) {
     const appointmentDateObj = new Date(data.appointmentDate); // ← UTC解釈でズレ発生
     const year = appointmentDateObj.getFullYear();
     // ...
     updates.visit_date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
   }
   ```

2. **フロントエンドが `visitDate` と `appointmentDate` の両方を送信している**:
   `frontend/frontend/src/pages/CallModePage.tsx` の保存処理（行2547-2613）では、`visitDate`（`YYYY-MM-DD HH:mm:ss` 形式）と `appointmentDate`（同じ値）の両方を送信している。バックエンドでは `visitDate` が指定されている場合は `appointmentDate` の変換をスキップするため（行539の条件）、現在は `visitDate` が優先されている。しかし、`appointmentDate` 経由のパスが残っており、将来的なリグレッションリスクがある。

3. **フロントエンドの読み込み処理（副次的問題）**:
   `frontend/frontend/src/pages/CallModePage.tsx` の初期化処理（行1750-1760）で `new Date(sellerData.visitDate)` を使ってJST変換している。バックエンドが UTC ISO 8601 形式で返す場合、この変換は正しく動作する。ただし、バックエンドが `YYYY-MM-DD HH:mm:ss` 形式（タイムゾーン情報なし）で返す場合、ブラウザによって解釈が異なる可能性がある。

---

## Correctness Properties

Property 1: Bug Condition - 訪問日時のラウンドトリップ一貫性

_For any_ 入力において、訪問日時フィールドに時刻を含む日時（例: `2026-05-10T10:00`）を入力して保存した場合、修正後の保存処理は入力した日時をタイムゾーン変換なしでそのまま Supabase に保存し、再読み込み後も同じ日時（`2026-05-10T10:00`）が表示されること。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - 既存動作の保持

_For any_ 入力において、訪問日時フィールドの保存・表示処理以外の動作（訪問取得日の自動設定、カレンダーイベント作成、スプレッドシート同期、サイドバーステータス判定）は、修正前と同じ結果を返すこと。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

---

## Fix Implementation

### Changes Required

**根本原因の修正**: バックエンドの `appointmentDate` 変換処理を削除し、`visitDate` を直接使用する。

---

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `updateSeller`

**Specific Changes**:

1. **`appointmentDate` 経由の `visit_date` 変換処理を削除**:
   - 行537-551の `appointmentDate` → `visit_date` 変換ブロックを削除
   - `appointment_date` カラムへの保存（行538）は残す（カレンダーイベント作成に使用）
   - `visitDate` が直接指定された場合のみ `visit_date` を更新する（行527-529は維持）

   ```typescript
   // 修正前（削除する部分）
   if (data.appointmentDate !== undefined) {
     updates.appointment_date = data.appointmentDate;
     // appointmentDateをvisit_date（TIMESTAMP型）に変換して保存（visitDate未指定の場合のみ）
     if (data.appointmentDate && (data as any).visitDate === undefined) {
       const appointmentDateObj = new Date(data.appointmentDate);
       // ...
       updates.visit_date = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
     }
   }

   // 修正後
   if (data.appointmentDate !== undefined) {
     updates.appointment_date = data.appointmentDate;
     // appointmentDate経由のvisit_date変換は削除（visitDateを直接使用）
   }
   ```

---

**File**: `frontend/frontend/src/pages/CallModePage.tsx`

**Function**: 保存処理（`handleSaveAppointment` 相当）

**Specific Changes**:

2. **`visitDate` の送信形式を確認・維持**:
   - 行2547-2552の `visitDateTimeStr` 生成処理（`YYYY-MM-DD HH:mm:ss` 形式）は維持
   - `visitDate` として送信する処理（行2608）は維持
   - `appointmentDate` も同じ値で送信する処理（行2611）は維持（カレンダーイベント作成用）

3. **読み込み時の変換処理を確認**:
   - 行1750-1760の `new Date(sellerData.visitDate)` による変換処理を確認
   - バックエンドが UTC ISO 8601 形式で返す場合、JST変換は正しく動作する
   - バックエンドが `YYYY-MM-DD HH:mm:ss` 形式で返す場合、ブラウザによって解釈が異なるため、UTC形式で返すことを確認する

---

**File**: `backend/src/services/SellerService.supabase.ts`

**Function**: `decryptSeller`

**Specific Changes**:

4. **`visitDate` の返却形式を確認**:
   - 行2160の `visitDate: seller.visit_date || undefined` を確認
   - Supabase から返される `visit_date` は UTC ISO 8601 形式（`2026-05-10T01:00:00.000Z`）
   - フロントエンドで `new Date()` を使って正しくJST変換されることを確認

---

### 修正の優先順位

1. **最優先**: `backend/src/services/SellerService.supabase.ts` の `appointmentDate` 変換処理を削除
2. **確認**: フロントエンドの読み込み・保存処理が一貫していることを確認
3. **テスト**: ラウンドトリップ一貫性を検証

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後の動作を検証する。

---

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `updateSeller` メソッドに `appointmentDate` を渡し、`visit_date` が正しく保存されるかを検証する。未修正コードでは `new Date()` によるUTC変換でズレが発生することを確認する。

**Test Cases**:
1. **時刻あり保存テスト**: `visitDate: "2026-05-10 10:00:00"` を送信 → `visit_date` が `"2026-05-10 10:00:00"` で保存されることを確認（未修正では `appointmentDate` 経由でズレが発生）
2. **appointmentDate変換テスト**: `appointmentDate: "2026-05-10 10:00:00"` のみ送信 → `visit_date` が `"2026-05-10 01:00:00"` になることを確認（バグの再現）
3. **深夜0時テスト**: `visitDate: "2026-05-10 00:00:00"` を送信 → `visit_date` が `"2026-05-09 15:00:00"` になることを確認（バグの再現）
4. **フロントエンド表示テスト**: バックエンドから `"2026-05-10T01:00:00.000Z"` を受け取り → `new Date()` でJST変換 → `"2026-05-10T10:00"` が表示されることを確認

**Expected Counterexamples**:
- `appointmentDate: "2026-05-10 10:00:00"` を送信すると `visit_date` が `"2026-05-10 01:00:00"` になる（9時間のズレ）
- 原因: `new Date("2026-05-10 10:00:00")` がUTCとして解釈される

---

### Fix Checking

**Goal**: 修正後、すべてのバグ条件に対して正しい動作を確認する。

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := updateSeller_fixed(input)
  ASSERT result.visit_date == input.visitDate (タイムゾーン変換なし)
  
  // ラウンドトリップ確認
  displayedValue := convertToDatetimeLocal(getSeller(result.id).visitDate)
  ASSERT displayedValue == input.editedAppointmentDate
END FOR
```

---

### Preservation Checking

**Goal**: 修正後、バグ条件に該当しない入力に対して既存動作が変わらないことを確認する。

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT updateSeller_original(input) == updateSeller_fixed(input)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様な入力パターンで既存動作が保持されることを確認する。

**Test Cases**:
1. **訪問日なし保存**: `visitDate: null` を送信 → `visit_date` が `null` になることを確認
2. **訪問取得日自動設定**: 訪問日を新規設定 → `visit_acquisition_date` が今日の日付に自動設定されることを確認
3. **カレンダーイベント作成**: `appointmentDate` と `visitAssignee` を送信 → カレンダーイベントが作成されることを確認
4. **サイドバーステータス**: `visit_date` の日付部分が正しく参照されることを確認

---

### Unit Tests

- `updateSeller` に `visitDate: "2026-05-10 10:00:00"` を渡したとき、`visit_date` が `"2026-05-10 10:00:00"` で保存されることを確認
- `updateSeller` に `appointmentDate: "2026-05-10 10:00:00"` のみ渡したとき、`visit_date` が変換されないことを確認（修正後）
- フロントエンドの `editedAppointmentDate` → `visitDateTimeStr` 変換が正しく動作することを確認
- フロントエンドの `sellerData.visitDate` → `appointmentDateLocal` 変換が正しく動作することを確認

### Property-Based Tests

- ランダムな日時文字列（`YYYY-MM-DDTHH:mm` 形式）を生成し、保存 → 再読み込みで同じ値が返ることを確認（ラウンドトリップ一貫性）
- ランダムな売主データを生成し、訪問日以外のフィールドが修正前後で変わらないことを確認（Preservation）
- 様々な時刻（00:00, 09:00, 12:00, 23:59）で保存 → 再読み込みで同じ値が返ることを確認

### Integration Tests

- 通話モードページで訪問日時を入力して保存 → ページを再読み込み → 同じ日時が表示されることを確認
- 訪問日時を保存後、カレンダーイベントが正しく作成されることを確認
- 訪問日時を削除して保存 → 訪問取得日もクリアされることを確認
- スプレッドシート同期後、`visit_date` の値が正しく反映されることを確認
