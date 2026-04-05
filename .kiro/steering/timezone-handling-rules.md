# タイムゾーン処理ルール（絶対に間違えないルール）

## ⚠️ 重要：日本時間（JST）での日付比較

このプロジェクトでは、**日本時間（JST）での日付比較**が必須です。
**UTCタイムゾーンで日付を比較すると、前日と判定される問題が発生します。**

---

## 🚨 過去の問題（2026年4月5日-6日）

### 問題1: `setHours(0, 0, 0, 0)`によるタイムゾーン問題

**日付**: 2026年4月5日

**症状**: 買主4153の次電日を今日（2026-04-05）に設定したが、サイドバーに「当日TEL」として表示されない

**根本原因**: `setHours(0, 0, 0, 0)`を使用すると、UTCタイムゾーンで0時になるため、日本時間（JST）では前日（2026-04-04）と判定されていた

**間違っていたコード**:
```typescript
// ❌ 間違い（UTCタイムゾーンで0時になる）
const today = new Date();
today.setHours(0, 0, 0, 0);  // UTC 2026-04-05 00:00:00 = JST 2026-04-05 09:00:00

const nextCallDate = new Date(buyer.next_call_date);
nextCallDate.setHours(0, 0, 0, 0);  // UTC 2026-04-05 00:00:00 = JST 2026-04-05 09:00:00

// 比較時にタイムゾーンのずれが発生
if (nextCallDate.getTime() <= today.getTime()) {
  // 2026-04-05 00:00:00 UTC <= 2026-04-04 15:00:00 UTC（JST 2026-04-05 00:00:00）
  // → false（今日以前ではないと判定される）
}
```

**修正後のコード**:
```typescript
// ✅ 正しい（YYYY-MM-DD形式の文字列比較、タイムゾーン非依存）
const todayStr = getTodayJST();  // '2026-04-05'
const nextCallDateStr = buyer.next_call_date?.substring(0, 10);  // '2026-04-05'

if (nextCallDateStr && nextCallDateStr <= todayStr) {
  // '2026-04-05' <= '2026-04-05' → true
}
```

**修正コミット**: **commit 1f0c0115** ("fix: タイムゾーン問題によるサイドバーカウント即時更新の不具合を修正")

---

### 問題2: `parseDateLocal()`関数のタイムゾーン計算ロジック

**日付**: 2026年4月6日

**症状**: 買主6404の次電日が2026-04-06だが、「当日TEL(Y)」の一覧に表示されない

**根本原因**: `parseDateLocal()`関数が`Date.UTC(year, month, day) - JST_OFFSET_MS`というロジックを使用していたため、「UTC日付の00:00 - 9時間」を計算し、**前日の15:00**になっていた

**間違っていたコード**:
```typescript
// ❌ 間違い（UTC日付の00:00 - 9時間 = 前日の15:00）
export function parseDateLocal(dateStr: string): Date {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  // Date.UTC(2026, 3, 6) = 2026-04-06 00:00:00 UTC
  // 2026-04-06 00:00:00 UTC - 9時間 = 2026-04-05 15:00:00 UTC
  return new Date(Date.UTC(year, month, day) - JST_OFFSET_MS);
}
```

**デバッグログ**:
```
[parseDateLocal] ISO date input: 2026-04-06T00:00:00+00:00
[parseDateLocal] Parsed as UTC: 2026-04-06T00:00:00.000Z
[parseDateLocal] JST time: 2026-04-06T09:00:00.000Z
[parseDateLocal] JST date parts: 2026 3 6  ← 正しい（4月6日）
[parseDateLocal] Result: 2026-04-05T15:00:00.000Z  ← 間違い（4月5日）
```

**修正後のコード**:
```typescript
// ✅ 正しい（JST日付の00:00を正しく表現）
export function parseDateLocal(dateStr: string): Date {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  // Date.UTC(2026, 3, 6) = 2026-04-06 00:00:00 UTC
  // これがJST日付の00:00を表す
  return new Date(Date.UTC(year, month, day));
}
```

**修正コミット**: **commit 64096c0a** ("fix: parseDateLocal()のタイムゾーン計算ロジックを修正（JST日付の00:00を正しく表現）")

---

## ✅ 正しいタイムゾーン処理

### ルール1: 日付比較はYYYY-MM-DD形式の文字列で行う

**❌ 間違い**:
```typescript
const today = new Date();
today.setHours(0, 0, 0, 0);

const nextCallDate = new Date(buyer.next_call_date);
nextCallDate.setHours(0, 0, 0, 0);

if (nextCallDate.getTime() <= today.getTime()) {
  // タイムゾーンのずれが発生
}
```

**✅ 正しい**:
```typescript
const todayStr = getTodayJST();  // '2026-04-05'
const nextCallDateStr = buyer.next_call_date?.substring(0, 10);  // '2026-04-05'

if (nextCallDateStr && nextCallDateStr <= todayStr) {
  // タイムゾーン非依存
}
```

---

### ルール2: `getTodayJST()`関数を使用する

**実装**:
```typescript
// backend/src/utils/dateHelpers.ts
export function getTodayJST(): string {
  const now = new Date();
  const jstTime = new Date(now.getTime() + JST_OFFSET_MS);
  const year = jstTime.getUTCFullYear();
  const month = String(jstTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(jstTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**使用例**:
```typescript
const todayStr = getTodayJST();  // '2026-04-05'
```

---

### ルール3: `parseDateLocal()`関数の正しい実装

**実装**:
```typescript
// backend/src/utils/dateHelpers.ts
export function parseDateLocal(dateStr: string): Date {
  const date = new Date(dateStr);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  
  // JST日付の00:00を表すUTC時刻を返す
  return new Date(Date.UTC(year, month, day));
}
```

**重要**: 
- `Date.UTC(year, month, day)`はUTC日付の00:00を返す
- これがJST日付の00:00を表す正しい表現
- `- JST_OFFSET_MS`を引いてはいけない（前日の15:00になる）

---

### ルール4: `isTodayOrPast()`関数を使用する

**実装**:
```typescript
// backend/src/utils/dateHelpers.ts
export function isTodayOrPast(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  const todayStr = getTodayJST();
  const targetDateStr = dateStr.substring(0, 10);
  return targetDateStr <= todayStr;
}
```

**使用例**:
```typescript
if (isTodayOrPast(buyer.next_call_date)) {
  // 次電日が今日以前
}
```

---

## 📋 タイムゾーン処理のチェックリスト

日付比較を実装する前に、以下を確認してください：

- [ ] `setHours(0, 0, 0, 0)`を使用していないか？
- [ ] `Date.getTime()`で日付を比較していないか？
- [ ] YYYY-MM-DD形式の文字列比較を使用しているか？
- [ ] `getTodayJST()`関数を使用しているか？
- [ ] `isTodayOrPast()`関数を使用しているか？
- [ ] `parseDateLocal()`関数で`- JST_OFFSET_MS`を引いていないか？

---

## 🔍 デバッグ方法

### 症状：日付比較が正しく動作しない

**確認手順**:

1. **デバッグログを追加**
   ```typescript
   console.log('[DEBUG] Today (JST):', getTodayJST());
   console.log('[DEBUG] Next call date:', buyer.next_call_date?.substring(0, 10));
   console.log('[DEBUG] Is today or past:', isTodayOrPast(buyer.next_call_date));
   ```

2. **タイムゾーンを確認**
   ```typescript
   const now = new Date();
   console.log('[DEBUG] Server time (UTC):', now.toISOString());
   console.log('[DEBUG] Server time (JST):', new Date(now.getTime() + JST_OFFSET_MS).toISOString());
   ```

3. **`parseDateLocal()`の結果を確認**
   ```typescript
   const parsed = parseDateLocal('2026-04-06T00:00:00+00:00');
   console.log('[DEBUG] Parsed date:', parsed.toISOString());
   console.log('[DEBUG] Expected:', '2026-04-06T00:00:00.000Z');
   ```

---

## 🎯 まとめ

**タイムゾーン処理の鉄則**:

1. **日付比較はYYYY-MM-DD形式の文字列で行う**
2. **`getTodayJST()`関数を使用する**
3. **`isTodayOrPast()`関数を使用する**
4. **`parseDateLocal()`関数で`- JST_OFFSET_MS`を引かない**
5. **`setHours(0, 0, 0, 0)`を使用しない**

**このルールを徹底することで、タイムゾーン問題を完全に防止できます。**

---

**最終更新日**: 2026年4月6日  
**作成理由**: タイムゾーン問題が2回発生したため、正しい処理方法を記録する  
**関連コミット**: 
- **commit 1f0c0115** ("fix: タイムゾーン問題によるサイドバーカウント即時更新の不具合を修正")
- **commit 64096c0a** ("fix: parseDateLocal()のタイムゾーン計算ロジックを修正（JST日付の00:00を正しく表現）")
