# Bugfix Requirements Document

## Introduction

売主リストの通話モードページのサイドバーにある「当日TEL（内容）」カテゴリの表示ラベルに不具合があります。
電話担当（`phone_contact_person`）と連絡方法（`contact_method`）の両方が入力されている場合、現在の実装は優先順位に従って1つだけ表示しますが、正しくは全てのコミュニケーション情報を組み合わせて表示すべきです。

例：電話担当 `I`、連絡方法 `Eメール` の両方がある場合
- 現在（バグ）: `当日TEL(Eメール)`
- 期待値: `当日TEL(I・Eメール)`

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `phone_contact_person` と `contact_method` の両方に値が入力されている場合 THEN the system `contact_method` のみを使用して `当日TEL(Eメール)` と表示し、`phone_contact_person` の情報を無視する

1.2 WHEN `phone_contact_person` と `preferred_contact_time` の両方に値が入力されている場合 THEN the system `preferred_contact_time` のみを使用して `当日TEL(午前中)` と表示し、`phone_contact_person` の情報を無視する

1.3 WHEN `contact_method` と `preferred_contact_time` の両方に値が入力されている場合 THEN the system `contact_method` のみを使用して `当日TEL(Eメール)` と表示し、`preferred_contact_time` の情報を無視する

1.4 WHEN 3つのコミュニケーション情報フィールド全てに値が入力されている場合 THEN the system `contact_method` のみを使用して1つだけ表示し、残り2つの情報を無視する

### Expected Behavior (Correct)

2.1 WHEN `phone_contact_person` と `contact_method` の両方に値が入力されている場合 THEN the system SHALL 両方を `・` で結合して `当日TEL(I・Eメール)` のように表示する

2.2 WHEN `phone_contact_person` と `preferred_contact_time` の両方に値が入力されている場合 THEN the system SHALL 両方を `・` で結合して `当日TEL(I・午前中)` のように表示する

2.3 WHEN `contact_method` と `preferred_contact_time` の両方に値が入力されている場合 THEN the system SHALL 両方を `・` で結合して `当日TEL(Eメール・午前中)` のように表示する

2.4 WHEN 3つのコミュニケーション情報フィールド全てに値が入力されている場合 THEN the system SHALL 全てを `・` で結合して `当日TEL(I・午前中・Eメール)` のように表示する（表示順: 電話担当・連絡取りやすい時間・連絡方法）

2.5 WHEN コミュニケーション情報フィールドのうち1つだけに値が入力されている場合 THEN the system SHALL その1つの値のみを使用して `当日TEL(値)` と表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `contact_method` のみに値が入力されている場合 THEN the system SHALL CONTINUE TO `当日TEL(Eメール)` のように表示する

3.2 WHEN `preferred_contact_time` のみに値が入力されている場合 THEN the system SHALL CONTINUE TO `当日TEL(午前中)` のように表示する

3.3 WHEN `phone_contact_person` のみに値が入力されている場合 THEN the system SHALL CONTINUE TO `当日TEL(Y)` のように表示する

3.4 WHEN コミュニケーション情報フィールドが全て空の場合 THEN the system SHALL CONTINUE TO `当日TEL（内容）` をフォールバックとして表示する

3.5 WHEN `isTodayCallWithInfo()` の判定ロジック（コミュニケーション情報のいずれかに入力があるかどうか）THEN the system SHALL CONTINUE TO 変更なく動作する

3.6 WHEN サイドバーの「当日TEL（内容）」カテゴリへの売主の振り分けロジック THEN the system SHALL CONTINUE TO 変更なく動作する
