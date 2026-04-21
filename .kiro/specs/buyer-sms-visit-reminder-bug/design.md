# buyer-sms-visit-reminder-bug バグ修正デザイン

## Overview

買主リストの内覧ページ（`BuyerViewingResultPage`）から「内覧前日SMS」を送信すると、2つの問題が発生している。

1. **時刻フォーマットバグ**: SMS本文の内覧時間が `Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)` のような生のDateオブジェクト文字列になる。正しくは `16:00` のような `HH:MM` 形式で表示されるべき。

2. **住所英語化バグ**: SMS本文の物件住所が `Oita, Beppu, Akibacho, 7−24` のような英語表記になる。正しくは `大分県別府市秋葉町7-24` のような日本語住所で表示されるべき。

**修正方針**:
- Fix 1: `generatePreDaySmsBody` 関数内で `viewing_time` を `HH:MM` 形式に正規化する処理を追加
- Fix 2: SMS生成箇所の住所取得優先順位を `display_address` → `property_address` → `address` に変更

---

## Glossary

- **Bug_Condition (C)**: バグが発生する条件 — `viewing_time` が `HH:MM` 形式でない場合、または `display_address` が存在するのに `address`（英語）を使用している場合
- **Property (P)**: 修正後の期待動作 — SMS本文の時刻が `HH:MM` 形式、住所が日本語表記であること
- **Preservation**: 既存の正常動作（木曜判定、SMS送信履歴記録、SMSアプリ起動など）が変わらないこと
- **generatePreDaySmsBody**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx` 内の関数（約97行目）。内覧前日SMS本文を生成する
- **viewing_time**: 買主の内覧時刻フィールド。Dateオブジェクト文字列または `HH:MM` 形式の文字列が格納される
- **display_address**: `property_listings` テーブルの日本語住所カラム（例: `大分県別府市秋葉町7-24`）
- **address**: `property_listings` テーブルの英語住所カラム（例: `Oita, Beppu, Akibacho, 7−24`）
- **linkedProperties**: `BuyerViewingResultPage` で取得する紐づき物件の配列

---

## Bug Details

### Bug Condition

#### 問題1: 時刻フォーマットバグ

`viewing_time` フィールドに `HH:MM` 形式以外の値（Dateオブジェクト文字列など）が格納されている場合、`generatePreDaySmsBody` 関数がそのままSMS本文に埋め込む。

**Formal Specification:**
```
FUNCTION isBugCondition_Time(viewing_time)
  INPUT: viewing_time of type any
  OUTPUT: boolean

  RETURN NOT (typeof viewing_time = 'string' AND viewing_time MATCHES /^\d{1,2}:\d{2}$/)
END FUNCTION
```

#### 問題2: 住所英語化バグ

`property_listings` テーブルの `address` が英語表記であり、`display_address` に日本語住所が格納されているにもかかわらず、`address` を優先して使用している。

**Formal Specification:**
```
FUNCTION isBugCondition_Address(property)
  INPUT: property of type PropertyListing
  OUTPUT: boolean

  RETURN property.display_address IS NOT NULL
         AND property.display_address IS_JAPANESE
         AND property.address IS_ENGLISH
         AND SMS uses property.address instead of property.display_address
END FUNCTION
```

### Examples

**時刻フォーマットバグ:**
- **例1（バグ発生）**: `viewing_time = "Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)"` → SMS本文に `Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)` が埋め込まれる
- **例2（正常）**: `viewing_time = "16:00"` → SMS本文に `16:00` が埋め込まれる（影響なし）
- **例3（正常）**: `viewing_time = null` → SMS本文の時刻部分が空文字列になる（影響なし）

**住所英語化バグ:**
- **例1（バグ発生）**: `address = "Oita, Beppu, Akibacho, 7−24"`, `display_address = "大分県別府市秋葉町7-24"` → SMS本文に `Oita, Beppu, Akibacho, 7−24` が埋め込まれる
- **例2（正常）**: `display_address = null`, `address = "大分県別府市秋葉町7-24"` → SMS本文に `大分県別府市秋葉町7-24` が埋め込まれる（影響なし）

---

## Expected Behavior

### Preservation Requirements

**変更しない動作:**
- 内覧日が木曜日の場合、SMS本文の冒頭が「明後日の〇月〇日」と表記される
- 内覧日が木曜日以外の場合、SMS本文の冒頭が「明日の〇月〇日」と表記される
- `viewing_time` が既に `HH:MM` 形式の場合、その値がそのままSMS本文に使用される
- `viewing_time` が空またはnullの場合、時刻部分が空文字列としてSMS本文が生成される
- `display_address` が空またはnullで `address` に日本語住所がある場合、`address` の値が使用される
- SMS送信ボタンクリック時に `activity_logs` へのSMS送信履歴記録が行われる
- SMS送信ボタンクリック時にSMSアプリが開き、生成した本文が自動入力される

**Scope:**
`generatePreDaySmsBody` 関数の時刻フォーマット処理と、SMS生成箇所の住所取得ロジック以外のすべての動作は、このバグ修正によって影響を受けてはならない。

---

## Hypothesized Root Cause

### 問題1: 時刻フォーマットバグ

`generatePreDaySmsBody` 関数（約120行目）の以下のコードが原因：

```typescript
const timeStr = buyer.viewing_time || '';
```

`viewing_time` フィールドにDateオブジェクト文字列（`Sat Dec 30 1899 16:00:00 GMT+0900...`）が格納されている場合、`HH:MM` 形式への変換処理がなく、そのままSMS本文に埋め込まれる。

**考えられる原因:**
1. **フォーマット変換処理の欠如**: `viewing_time` の値を `HH:MM` 形式に正規化する処理が実装されていない
2. **データ入力時の非標準化**: `viewing_time` カラムへの保存時にDateオブジェクトが文字列化されてそのまま保存されている
3. **型チェックの欠如**: `viewing_time` が `HH:MM` 形式かどうかを検証する処理がない

### 問題2: 住所英語化バグ

SMS生成箇所（約903行目）の以下のコードが原因：

```typescript
const address = property?.property_address || property?.address || '';
```

`property_listings.address` が英語表記（`Oita, Beppu...`）であり、日本語住所が格納されている `display_address` を参照していない。

**考えられる原因:**
1. **`display_address` カラムの見落とし**: SMS生成時に `display_address` カラムの存在を考慮していない
2. **優先順位の誤り**: `address` より `display_address` を優先すべきところ、`address` が先に参照されている
3. **カラム追加後の未対応**: `display_address` カラムが後から追加されたため、既存のSMS生成コードが更新されていない

---

## Correctness Properties

Property 1: Bug Condition - 時刻フォーマット正規化

_For any_ `viewing_time` において、`isBugCondition_Time(viewing_time)` が true を返す場合（`HH:MM` 形式でない場合）、修正後の `generatePreDaySmsBody` 関数は `viewing_time` から時・分を抽出して `HH:MM` 形式（例: `16:00`）に正規化した文字列をSMS本文に埋め込むこと。SMS本文に `GMT` や `Standard Time` などの文字列が含まれてはならない。

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition - 住所日本語化

_For any_ 物件において、`isBugCondition_Address(property)` が true を返す場合（`display_address` が日本語で `address` が英語の場合）、修正後のSMS生成コードは `display_address` の値をSMS本文の物件住所として使用すること。SMS本文に英語住所（`Oita`, `Beppu` など）が含まれてはならない。

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation - 既存動作の保持

_For any_ 入力において、`isBugCondition_Time(viewing_time)` が false を返す場合（既に `HH:MM` 形式の場合）、修正後の `generatePreDaySmsBody` 関数は修正前と同じSMS本文を生成すること。また、`isBugCondition_Address(property)` が false を返す場合（`display_address` が空または `address` が日本語の場合）、修正後のSMS生成コードは修正前と同じ住所を使用すること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

---

## Fix Implementation

### Changes Required

**File**: `frontend/frontend/src/pages/BuyerViewingResultPage.tsx`

---

#### Fix 1: 時刻フォーマット正規化（`generatePreDaySmsBody` 関数内）

**Function**: `generatePreDaySmsBody`（約120行目）

**Specific Changes**:

1. **`viewing_time` を `HH:MM` 形式に正規化するヘルパーロジックを追加**:

   ```typescript
   // 修正前
   const timeStr = buyer.viewing_time || '';

   // 修正後
   const rawTime = buyer.viewing_time || '';
   let timeStr = '';
   if (rawTime) {
     // 既に HH:MM 形式かチェック
     if (/^\d{1,2}:\d{2}$/.test(rawTime)) {
       timeStr = rawTime;
     } else {
       // Dateオブジェクト文字列などから時・分を抽出
       const dateObj = new Date(rawTime);
       if (!isNaN(dateObj.getTime())) {
         const hours = dateObj.getHours().toString().padStart(2, '0');
         const minutes = dateObj.getMinutes().toString().padStart(2, '0');
         timeStr = `${hours}:${minutes}`;
       }
     }
   }
   ```

---

#### Fix 2: 住所優先順位変更（SMS生成箇所）

**Location**: SMS生成箇所（約903行目）

**Specific Changes**:

2. **`display_address` を優先する住所取得ロジックに変更**:

   ```typescript
   // 修正前
   const address = property?.property_address || property?.address || '';

   // 修正後
   const address = property?.display_address || property?.property_address || property?.address || '';
   ```

---

### 修正の優先順位

1. **Fix 1**: `generatePreDaySmsBody` 関数の `viewing_time` 正規化処理を追加
2. **Fix 2**: SMS生成箇所の住所取得優先順位を `display_address` 優先に変更
3. **確認**: 既存の正常ケース（`HH:MM` 形式の時刻、日本語住所）が影響を受けないことを確認

---

## Testing Strategy

### Validation Approach

2フェーズのアプローチ：まず未修正コードでバグを再現するテストを書き、次に修正後の動作を検証する。

---

### Exploratory Bug Condition Checking

**Goal**: 未修正コードでバグを再現し、根本原因を確認する。

**Test Plan**: `generatePreDaySmsBody` 関数にDateオブジェクト文字列の `viewing_time` と英語住所の `property` を渡し、SMS本文に不正な値が含まれることを確認する。未修正コードでテストを実行して失敗を観察する。

**Test Cases**:
1. **Dateオブジェクト文字列テスト**: `viewing_time = "Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)"` を渡す → SMS本文に `GMT` が含まれることを確認（未修正コードで失敗）
2. **英語住所テスト**: `address = "Oita, Beppu, Akibacho, 7−24"`, `display_address = "大分県別府市秋葉町7-24"` を渡す → SMS本文に `Oita` が含まれることを確認（未修正コードで失敗）
3. **時刻抽出テスト**: Dateオブジェクト文字列から `16:00` が抽出されることを確認（未修正コードで失敗）
4. **住所優先順位テスト**: `display_address` が存在する場合に `address` が使われることを確認（未修正コードで失敗）

**Expected Counterexamples**:
- `viewing_time = "Sat Dec 30 1899 16:00:00 GMT+0900..."` → SMS本文に `Sat Dec 30 1899 16:00:00 GMT+0900...` が含まれる
- `address = "Oita, Beppu..."`, `display_address = "大分県別府市..."` → SMS本文に `Oita, Beppu...` が含まれる

---

### Fix Checking

**Goal**: 修正後、すべてのバグ条件に対して正しい動作を確認する。

**Pseudocode:**
```
// 時刻フォーマット Fix Checking
FOR ALL buyer WHERE isBugCondition_Time(buyer.viewing_time) DO
  smsBody := generatePreDaySmsBody_fixed(buyer, address, googleMapUrl)
  ASSERT smsBody CONTAINS time IN FORMAT /\d{1,2}:\d{2}/
  ASSERT smsBody NOT CONTAINS 'GMT'
  ASSERT smsBody NOT CONTAINS 'Standard Time'
END FOR

// 住所 Fix Checking
FOR ALL property WHERE isBugCondition_Address(property) DO
  address := getAddress_fixed(property)
  ASSERT address = property.display_address
  ASSERT address NOT CONTAINS 'Oita'
  ASSERT address NOT CONTAINS 'Beppu'
END FOR
```

---

### Preservation Checking

**Goal**: 修正後、バグ条件に該当しない入力に対して既存動作が変わらないことを確認する。

**Pseudocode:**
```
// 時刻フォーマット Preservation Checking
FOR ALL buyer WHERE NOT isBugCondition_Time(buyer.viewing_time) DO
  ASSERT generatePreDaySmsBody_original(buyer, ...) = generatePreDaySmsBody_fixed(buyer, ...)
END FOR

// 住所 Preservation Checking
FOR ALL property WHERE NOT isBugCondition_Address(property) DO
  ASSERT getAddress_original(property) = getAddress_fixed(property)
END FOR
```

**Testing Approach**: プロパティベーステストを推奨。多様な入力パターンで既存動作が保持されることを確認する。

**Test Cases**:
1. **HH:MM形式の保持**: `viewing_time = "14:30"` → SMS本文に `14:30` が含まれることを確認（修正前後で同じ）
2. **null時刻の保持**: `viewing_time = null` → SMS本文の時刻部分が空文字列になることを確認（修正前後で同じ）
3. **日本語住所の保持**: `display_address = null`, `address = "大分県別府市秋葉町7-24"` → `address` の値が使用されることを確認（修正前後で同じ）
4. **木曜判定の保持**: 内覧日が木曜日 → SMS本文が「明後日の〇月〇日」で始まることを確認（修正前後で同じ）
5. **SMS送信履歴の保持**: SMS送信ボタンクリック → `activity_logs` に記録されることを確認（修正前後で同じ）

---

### Unit Tests

- `generatePreDaySmsBody` に `viewing_time = "Sat Dec 30 1899 16:00:00 GMT+0900..."` を渡したとき、SMS本文に `16:00` が含まれることを確認
- `generatePreDaySmsBody` に `viewing_time = "14:30"` を渡したとき、SMS本文に `14:30` が含まれることを確認（既存動作の保持）
- `generatePreDaySmsBody` に `viewing_time = null` を渡したとき、SMS本文の時刻部分が空文字列になることを確認
- `display_address = "大分県別府市秋葉町7-24"`, `address = "Oita, Beppu, Akibacho, 7−24"` の場合、`display_address` が使用されることを確認
- `display_address = null`, `address = "大分県別府市秋葉町7-24"` の場合、`address` が使用されることを確認

### Property-Based Tests

- ランダムなDateオブジェクト文字列を生成し、`generatePreDaySmsBody` がSMS本文に `HH:MM` 形式の時刻を埋め込むことを確認
- ランダムな `HH:MM` 形式の時刻文字列を生成し、修正前後で同じSMS本文が生成されることを確認（Preservation）
- `display_address` が存在する場合は常に `display_address` が使用されることを確認（多様な物件データで検証）
- `display_address` が空またはnullの場合は `address` が使用されることを確認（Preservation）

### Integration Tests

- 内覧ページで `viewing_time` がDateオブジェクト文字列の買主に対してSMSボタンをクリック → SMS本文に `HH:MM` 形式の時刻が含まれることを確認
- 内覧ページで `display_address` が日本語の物件に紐づく買主に対してSMSボタンをクリック → SMS本文に日本語住所が含まれることを確認
- SMS送信後、`activity_logs` に送信履歴が記録されることを確認
- 木曜日内覧の買主に対してSMSボタンをクリック → SMS本文が「明後日の〇月〇日」で始まることを確認
