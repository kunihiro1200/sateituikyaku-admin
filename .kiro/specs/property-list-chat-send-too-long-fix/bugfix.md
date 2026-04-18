# Bugfix Requirements Document

## Introduction

物件リスト画面（`PropertyListingDetailPage`）の「物件担当へCHAT送信（画像添付可能）」ボタンを押すと、Google Chat APIの文字数制限（4096文字）を超えたメッセージが送信され、HTTP 400エラーが発生する。

対象コンポーネント：`frontend/frontend/src/components/PriceSection.tsx`

送信メッセージは以下の要素で構成される：
- 物件番号
- 【値下げ通知】ラベル
- 値下げ履歴（`price_reduction_history`）
- 住所（`address`）
- 物件詳細ページURL
- 画像URL（任意）

値下げ履歴フィールドが長い場合、またはユーザーがダイアログ内でメッセージを編集して長くした場合に、Google Chat APIの4096文字制限を超えてしまう。

最新コミット（`a50d38ad`）で4000文字切り捨てを試みているが、`chatMessageBody` 自体が既に4000文字を超えている場合や、画像URLを追加した後に4096文字を超える場合は依然としてエラーが発生する可能性がある。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 値下げ履歴（`price_reduction_history`）が長く、物件番号・住所・URLと組み合わせたメッセージが4096文字を超える THEN the system はGoogle Chat APIにそのままPOSTし、HTTP 400エラー（"Message content is too long."）が発生する

1.2 WHEN ユーザーが送信確認ダイアログ内でメッセージを編集して4096文字を超える内容にした THEN the system はバリデーションなしにそのままPOSTし、HTTP 400エラーが発生する

1.3 WHEN メッセージ本文が4000文字以内でも画像URLを追加した結果4096文字を超える THEN the system はHTTP 400エラーが発生する

### Expected Behavior (Correct)

2.1 WHEN 値下げ履歴が長く、組み合わせたメッセージが4096文字を超える THEN the system SHALL 送信前にメッセージ全体（本文＋画像URL）を4096文字以内に切り捨て、エラーなく送信する

2.2 WHEN ユーザーがダイアログ内でメッセージを編集して4096文字を超える内容にした THEN the system SHALL 送信前にメッセージ全体を4096文字以内に切り捨て、エラーなく送信する

2.3 WHEN メッセージ本文と画像URLを合わせた文字数が4096文字を超える THEN the system SHALL 合計が4096文字以内になるよう本文を切り捨て、画像URLは可能な限り保持して送信する

### Unchanged Behavior (Regression Prevention)

3.1 WHEN メッセージ全体（本文＋画像URL）が4096文字以内の場合 THEN the system SHALL CONTINUE TO メッセージを切り捨てなしにそのまま送信する

3.2 WHEN 値下げ履歴が存在しない場合 THEN the system SHALL CONTINUE TO 「値下げ履歴が見つかりません」エラーを表示し送信しない

3.3 WHEN 画像が添付されていない場合 THEN the system SHALL CONTINUE TO テキストのみのメッセージを送信する

3.4 WHEN 送信が成功した場合 THEN the system SHALL CONTINUE TO 「値下げ通知を送信しました」の成功メッセージを表示する
