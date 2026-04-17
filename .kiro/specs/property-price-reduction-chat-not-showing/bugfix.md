# Bugfix Requirements Document

## Introduction

物件リスト詳細画面（例：物件番号AA18）の価格情報セクションで、「値下げ予約日」フィールドに値が入っている状態から空欄に変更して保存した後、「物件担当へCHAT送信」ボタンが表示されないバグ。

`property-price-reduction-chat-control` specで実装された仕様では、値下げ予約日が空（null または空文字列）の場合、非編集モードで「物件担当へCHAT送信」ボタンが表示されるべきである。

**根本原因の概要**:  
`PriceSection.tsx` のボタン表示制御ロジック `const showChatButton = !isEditMode && !displayScheduledDate;` は正しく実装されている。しかし、値下げ予約日を空欄にして保存した後、`fetchPropertyData()` でDBから再取得したデータの `price_reduction_scheduled_date` が `null` ではなく空文字列 `""` として返される可能性がある。空文字列は falsy なので `!""` は `true` となりボタンは表示されるはずだが、実際には表示されない。

より可能性の高い原因として、`PropertyListingDetailPage.tsx` の `PriceSection` への props 渡しにおいて `priceReductionScheduledDate={data.price_reduction_scheduled_date}` と渡しているが、保存後の `fetchPropertyData()` が完了する前に `editedData` がクリアされるタイミング問題、またはバックエンドが空文字列 `""` を `null` に変換せずDBに保存し、再取得時に空文字列として返すことで `displayScheduledDate` が `""` となり、`!""` は `true` のはずなのに何らかの理由でボタンが表示されない状態が発生している可能性がある。

また、`PriceSection` に `onChatSend` prop が定義されているが、`PropertyListingDetailPage.tsx` の JSX でこの prop が渡されていないため、TypeScript エラーが発生している可能性もある。

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 値下げ予約日フィールドに値（例：2026/04/18）が入っている物件で、編集モードで値下げ予約日を空欄に変更して保存ボタンを押す THEN システムは保存成功後も非編集モードで「物件担当へCHAT送信」ボタンを表示しない

1.2 WHEN 値下げ予約日を空欄にして保存した後、ページをリロードせずに非編集モードで価格情報セクションを表示する THEN システムは「物件担当へCHAT送信」ボタンを表示しない

1.3 WHEN `fetchPropertyData()` が完了して `data.price_reduction_scheduled_date` が null または空文字列に更新された後、`PriceSection` の `displayScheduledDate` が正しく空として評価されない THEN システムはボタン表示条件 `!displayScheduledDate` を `false` と評価してボタンを非表示にする

### Expected Behavior (Correct)

2.1 WHEN 値下げ予約日フィールドに値が入っている物件で、編集モードで値下げ予約日を空欄に変更して保存ボタンを押す THEN システムは SHALL 保存成功後の非編集モードで「物件担当へCHAT送信」ボタンを表示する

2.2 WHEN 値下げ予約日を空欄にして保存した後、ページをリロードせずに非編集モードで価格情報セクションを表示する THEN システムは SHALL 「物件担当へCHAT送信」ボタンを表示する

2.3 WHEN `data.price_reduction_scheduled_date` が null または空文字列（`""`）の場合 THEN システムは SHALL `displayScheduledDate` を falsy として評価し、非編集モードでボタンを表示する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 値下げ予約日フィールドに値（例：2026/05/01）が入っている物件を非編集モードで表示する THEN システムは SHALL CONTINUE TO 「物件担当へCHAT送信」ボタンを非表示にする

3.2 WHEN 編集モードで価格情報セクションを表示している THEN システムは SHALL CONTINUE TO 値下げ予約日の有無に関わらず「物件担当へCHAT送信」ボタンを非表示にする

3.3 WHEN 値下げ予約日が最初から空欄（null）の物件を非編集モードで表示する THEN システムは SHALL CONTINUE TO 「物件担当へCHAT送信」ボタンを表示する

3.4 WHEN 値下げ予約日が空欄の物件で「物件担当へCHAT送信」ボタンをクリックする THEN システムは SHALL CONTINUE TO 送信確認ダイアログを表示する
