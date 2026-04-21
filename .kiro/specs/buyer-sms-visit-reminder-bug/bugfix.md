# Bugfix Requirements Document

## Introduction

買主リストの内覧ページ（`BuyerViewingResultPage`）から「内覧前日SMS」を送信すると、2つの問題が発生している。

1. **時刻フォーマットバグ**: SMSの本文中の内覧時間が `Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)` のような生のDateオブジェクト文字列になる。正しくは `16:00` のような `HH:MM` 形式で表示されるべき。

2. **住所英語化バグ**: SMSの本文中の物件住所が `Oita, Beppu, Akibacho, 7−24` のような英語表記になる。正しくは `大分県別府市秋葉町7-24` のような日本語住所で表示されるべき。

これらのバグにより、買主に送信されるSMSの内容が不正確・不自然になり、業務に支障をきたしている。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `viewing_time` フィールドにDateオブジェクトまたはDateオブジェクトに変換可能な値が格納されており、内覧前日SMSを送信する THEN システムは `Sat Dec 30 1899 16:00:00 GMT+0900 (Japan Standard Time)` のような生のDateオブジェクト文字列をSMS本文の時刻部分に埋め込む

1.2 WHEN `viewing_time` フィールドの値が `HH:MM` 形式の文字列ではなく、Dateオブジェクトや非標準フォーマットの値である THEN システムはフォーマット変換を行わずにそのままSMS本文に使用する

1.3 WHEN 紐づき物件の `address` フィールドに英語表記の住所（例: `Oita, Beppu, Akibacho, 7−24`）が格納されており、内覧前日SMSを送信する THEN システムは英語住所をSMS本文の物件住所部分に埋め込む

1.4 WHEN `property_listings` テーブルの `address` フィールドが英語表記であり、`display_address` フィールドに日本語住所が格納されている THEN システムは `address` を優先して使用し、日本語住所（`display_address`）を使用しない

### Expected Behavior (Correct)

2.1 WHEN `viewing_time` フィールドにDateオブジェクトまたは任意のフォーマットの時刻値が格納されており、内覧前日SMSを送信する THEN システムは `HH:MM` 形式（例: `16:00`）にフォーマットした時刻文字列をSMS本文に埋め込む SHALL

2.2 WHEN `viewing_time` フィールドの値がDateオブジェクトや非標準フォーマットである THEN システムは時・分を抽出して `HH:MM` 形式に正規化してからSMS本文に使用する SHALL

2.3 WHEN 紐づき物件の住所を内覧前日SMSに埋め込む THEN システムは日本語住所（`display_address` または日本語の `address`）を優先してSMS本文の物件住所部分に使用する SHALL

2.4 WHEN `property_listings` テーブルの `display_address` フィールドに日本語住所が格納されている THEN システムは `address` より `display_address` を優先して内覧前日SMSの物件住所として使用する SHALL

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `viewing_time` フィールドが既に `HH:MM` 形式の文字列（例: `14:30`）である THEN システムは SHALL CONTINUE TO その値をそのままSMS本文の時刻部分に使用する

3.2 WHEN `viewing_time` フィールドが空またはnullである THEN システムは SHALL CONTINUE TO 時刻部分を空文字列としてSMS本文を生成する

3.3 WHEN 内覧日が木曜日である THEN システムは SHALL CONTINUE TO SMS本文の冒頭を「明後日の〇月〇日」と表記する

3.4 WHEN 内覧日が木曜日以外である THEN システムは SHALL CONTINUE TO SMS本文の冒頭を「明日の〇月〇日」と表記する

3.5 WHEN `display_address` が空またはnullであり、`address` フィールドに日本語住所が格納されている THEN システムは SHALL CONTINUE TO `address` フィールドの値をSMS本文の物件住所として使用する

3.6 WHEN SMS送信ボタンをクリックする THEN システムは SHALL CONTINUE TO SMS送信履歴を `activity_logs` に記録する

3.7 WHEN SMS送信ボタンをクリックする THEN システムは SHALL CONTINUE TO SMSアプリを開き、生成した本文を自動入力する

---

## Bug Condition (Pseudocode)

### 問題1: 時刻フォーマットバグ

```pascal
FUNCTION isBugCondition_Time(viewing_time)
  INPUT: viewing_time of type any
  OUTPUT: boolean

  // viewing_timeがHH:MM形式の文字列でない場合にバグが発生する
  RETURN NOT (typeof viewing_time = 'string' AND viewing_time MATCHES /^\d{1,2}:\d{2}$/)
END FUNCTION

// Property: Fix Checking - 時刻フォーマット
FOR ALL buyer WHERE isBugCondition_Time(buyer.viewing_time) DO
  smsBody ← generatePreDaySmsBody'(buyer, address, googleMapUrl)
  ASSERT smsBody CONTAINS time IN FORMAT /\d{1,2}:\d{2}/
  ASSERT smsBody NOT CONTAINS 'GMT'
  ASSERT smsBody NOT CONTAINS 'Standard Time'
END FOR

// Property: Preservation Checking
FOR ALL buyer WHERE NOT isBugCondition_Time(buyer.viewing_time) DO
  ASSERT generatePreDaySmsBody(buyer, ...) = generatePreDaySmsBody'(buyer, ...)
END FOR
```

### 問題2: 住所英語化バグ

```pascal
FUNCTION isBugCondition_Address(property)
  INPUT: property of type PropertyListing
  OUTPUT: boolean

  // addressが英語表記でdisplay_addressに日本語住所がある場合にバグが発生する
  RETURN property.address IS_ENGLISH AND property.display_address IS_JAPANESE
END FUNCTION

// Property: Fix Checking - 住所日本語化
FOR ALL property WHERE isBugCondition_Address(property) DO
  smsBody ← generatePreDaySmsBody'(buyer, getAddress'(property), googleMapUrl)
  ASSERT smsBody CONTAINS property.display_address
  ASSERT smsBody NOT CONTAINS 'Oita'
  ASSERT smsBody NOT CONTAINS 'Beppu'
END FOR

// Property: Preservation Checking
FOR ALL property WHERE NOT isBugCondition_Address(property) DO
  ASSERT getAddress(property) = getAddress'(property)
END FOR
```
