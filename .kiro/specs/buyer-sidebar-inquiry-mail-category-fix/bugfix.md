# Bugfix Requirements Document

## Introduction

買主リストのサイドバーカテゴリーにおいて、「問合メール未対応」の分類条件が誤っている。
現在の実装では `inquiry_email_phone = "未"` **かつ** `inquiry_email_reply = "未"` の両方が揃った場合のみ分類されるが、
スプレッドシートのIFS式では **どちらか一方が "未"** であれば分類されるべきである。

その結果、買主番号7192のように `inquiry_email_phone = "未"` のみの場合（メール返信は未入力または別の値）は
「問合メール未対応」カテゴリーに表示されないというバグが発生している。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `inquiry_email_phone`（【問合メール】電話対応）が "未" かつ `inquiry_email_reply`（【問合メール】メール返信）が "未" **以外** の値である THEN the system は「問合メール未対応」カテゴリーに分類しない

1.2 WHEN `inquiry_email_phone` が "未" 以外 かつ `inquiry_email_reply` が "未" である THEN the system は「問合メール未対応」カテゴリーに分類しない

1.3 WHEN `inquiry_email_phone` が "未" かつ `inquiry_email_reply` が空欄であり、かつ `latest_viewing_date`（内覧日）が空欄である THEN the system は「問合メール未対応」カテゴリーに分類しない

### Expected Behavior (Correct)

2.1 WHEN `inquiry_email_phone` が "未" である THEN the system SHALL 「問合メール未対応」カテゴリーに分類する（`inquiry_email_reply` の値に関わらず）

2.2 WHEN `inquiry_email_reply` が "未" である THEN the system SHALL 「問合メール未対応」カテゴリーに分類する（`inquiry_email_phone` の値に関わらず）

2.3 WHEN `latest_viewing_date` が空欄 かつ `inquiry_email_phone` が "不要" かつ `inquiry_email_reply` が "未" または空欄 である THEN the system SHALL 「問合メール未対応」カテゴリーに分類する

2.4 WHEN `latest_viewing_date` が空欄 かつ `inquiry_email_phone` が "不要" かつ `inquiry_email_reply` が "未" または空欄 である THEN the system SHALL 「問合メール未対応」カテゴリーに分類する（IFS式の3番目の条件）

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `inquiry_email_phone` が "未" でも "不要" でもなく、かつ `inquiry_email_reply` が "未" でも空欄でもない THEN the system SHALL CONTINUE TO 「問合メール未対応」カテゴリーに分類しない

3.2 WHEN 「問合メール未対応」より優先度の高いカテゴリー（査定アンケート回答あり、業者問合せあり、内覧日前日、内覧未確定、一般媒介_内覧後売主連絡未、⑯当日TEL）の条件を満たす THEN the system SHALL CONTINUE TO それらの優先度の高いカテゴリーに分類する

3.3 WHEN 「問合メール未対応」より優先度の低いカテゴリー（3回架電未、担当別カテゴリー等）の条件のみを満たす THEN the system SHALL CONTINUE TO それらの優先度の低いカテゴリーに分類する

3.4 WHEN `inquiry_email_phone` が "不通" である THEN the system SHALL CONTINUE TO 「問合メール未対応」カテゴリーに分類しない（"不通" は "未" とは異なる）
