# Bugfix Requirements Document

## Introduction

買主リストのサイドバーカテゴリー「業者問合せあり」に、`broker_inquiry = '業者問合せ'` の買主が表示されないバグ。

`BuyerStatusCalculator.ts` の Priority 2 の条件に `!equals(buyer.broker_inquiry, '業者問合せ')` という除外条件が含まれているため、`broker_inquiry = '業者問合せ'` かつ `vendor_survey = '未'` の買主が「業者問合せあり」カテゴリーに分類されない。

正しい動作は、`vendor_survey = '未'` であれば `broker_inquiry` の値に関係なく「業者問合せあり」に表示することである。

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN `vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'` THEN the system 「業者問合せあり」カテゴリーに分類せず、Priority 2 の条件を満たさない

1.2 WHEN `vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'` THEN the system Priority 2 の除外条件 `!equals(buyer.broker_inquiry, '業者問合せ')` により、より低い優先度のカテゴリーに誤って分類する

### Expected Behavior (Correct)

2.1 WHEN `vendor_survey = '未'` かつ `broker_inquiry = '業者問合せ'` THEN the system SHALL ステータス「業者問合せあり」（priority: 2）を返す

2.2 WHEN `vendor_survey = '未'` かつ `broker_inquiry` が任意の値（null、空文字、'業者問合せ'、その他の値）THEN the system SHALL ステータス「業者問合せあり」（priority: 2）を返す

### Unchanged Behavior (Regression Prevention)

3.1 WHEN `vendor_survey = '未'` かつ `broker_inquiry` が '業者問合せ' 以外の値（null、空文字、'業者（両手）' など）THEN the system SHALL CONTINUE TO ステータス「業者問合せあり」（priority: 2）を返す

3.2 WHEN `valuation_survey` が入力済み かつ `valuation_survey_confirmed` が空欄 THEN the system SHALL CONTINUE TO ステータス「査定アンケート回答あり」（priority: 1）を返す（Priority 1 が Priority 2 より優先される）

3.3 WHEN `vendor_survey` が '未' 以外の値（null、空文字、'済' など）THEN the system SHALL CONTINUE TO 「業者問合せあり」カテゴリーに分類しない
