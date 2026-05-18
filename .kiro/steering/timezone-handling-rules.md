---
inclusion: fileMatch
fileMatchPattern: "**/*{date,time,Date,Time}*.{ts,tsx,js}"
---

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

## 🚨 最重要：メールからDBへの反響詳細日時転記ルール（2026年5月追加）

### ルール：メール本文の日時はそのままDBに保存する

イエウール・HOME4U等の査定依頼メールには以下の形式で日時が記載されています：

```
依頼日時　　　　: 2026-05-18 13:28:55
```

**この値はイエウールのサーバーが日本時間（JST）で出力したものです。**

### ✅ 正しい保存方法

```typescript
// メール本文から抽出した値をそのままDBに保存する
inquiry_detailed_datetime: requestDate || null
// 例: "2026-05-18 13:28:55" → DBにそのまま "2026-05-18 13:28:55" で保存
```

### ❌ 絶対にやってはいけないこと

```typescript
// ❌ +09:00 を付けてはいけない
inquiry_detailed_datetime: requestDate ? `${requestDate}+09:00` : null
// 理由: +09:00を付けるとSupabaseがUTCに変換して表示がずれる

// ❌ UTCに変換してはいけない
inquiry_detailed_datetime: new Date(requestDate).toISOString()
// 理由: 日本時間が9時間引かれてUTCになる
```

### 理由

- メール本文の時刻はイエウール・HOME4Uサーバーが**日本時間で出力**している
- `2026-05-18 13:28:55` と書いてあれば、それは日本時間の13:28:55
- この値をそのまま文字列としてDBに保存すれば、管理画面でも13:28:55と表示される
- **何も変換しない** のが正しい

### 適用対象エンドポイント

- `POST /api/sellers/ieul-transfer`
- `POST /api/sellers/home4u-transfer`
- 今後追加する全ての査定サイト転記エンドポイント

**最終更新日**: 2026年5月19日

---

## 🚨 最重要：反響詳細日時の表示で+9時間になる問題（2026年5月19日追加）

### 問題の根本原因

`inquiry_detailed_datetime` はDBに `"2026-05-19 01:34:33"` という**タイムゾーン情報なしの文字列**で保存されている。

この文字列を `new Date()` に渡すと、**VercelサーバーがUTC環境のため「UTC時間」として解釈**され、フロントエンドでJST（+9時間）で表示される。

### ❌ やってはいけないこと（全ての経路）

```typescript
// ❌ バックエンドのSellerService（decryptSeller）でDateオブジェクトに変換
inquiryDetailedDatetime: new Date(seller.inquiry_detailed_datetime)
// 理由: UTCとして解釈され、JSON化すると "2026-05-18T16:34:33.000Z" になる
//       フロントエンドで表示すると JST +9時間 = 01:34:33 ではなく 10:34:33 になる

// ❌ フロントエンドのSellerServiceでDateオブジェクトに変換
inquiryDetailedDatetime: seller.inquiry_detailed_datetime ? new Date(seller.inquiry_detailed_datetime) : undefined
// 理由: 同上

// ❌ inquiryDateFormatter.tsでnew Date()変換
const date = new Date(seller.inquiryDetailedDatetime);
return date.toLocaleString('ja-JP', {...});
// 理由: 同上
```

### ✅ 正しい処理（2026年5月19日修正済み）

**1. バックエンド `decryptSeller`（`backend/src/services/SellerService.supabase.ts`）**:
```typescript
// ✅ 文字列のまま返す（new Date()変換しない）
inquiryDatetime: (seller.inquiry_detailed_datetime || seller.inquiry_datetime) || undefined,
inquiryDetailedDatetime: (seller.inquiry_detailed_datetime || seller.inquiry_datetime) || undefined,
```

**2. フロントエンド `SellerService.supabase.ts`**:
```typescript
// ✅ 文字列のまま返す
inquiryDatetime: seller.inquiry_detailed_datetime || undefined,
inquiryDetailedDatetime: seller.inquiry_detailed_datetime || undefined,
```

**3. `inquiryDateFormatter.ts`（表示フォーマット）**:
```typescript
// ✅ 正規表現で文字列から直接パース（new Date()を使わない）
const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
if (match) {
  return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}`;
}
```

### 鉄則

**`inquiry_detailed_datetime` は絶対に `new Date()` に変換しない。文字列のまま扱う。**

- DBに `"2026-05-19 01:34:33"` と保存 → 表示も `"2026/05/19 01:34:33"` にする
- 変換すると必ず+9時間のずれが生じる
