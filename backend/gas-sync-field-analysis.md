# GAS同期フィールド分析（2026年4月3日）

## 問題の概要

**症状**: AA4504の`valuation_text`フィールドがスプレッドシートで10時間以上前に削除されたが、データベースには"不要"が残り続けていた

**根本原因**: GASコードの`syncUpdatesToSupabase_`関数に`valuation_text`フィールドの同期処理が含まれていない

**ユーザーの要求**: 「毎回　スプシとの同期が上手く行っていないことだけが問題なので、それはさいしょっから全フィールドで問題解決しておきたい」

## 現在GASで同期されているフィールド（syncUpdatesToSupabase_関数）

1. `status` - 状況（当社）
2. `next_call_date` - 次電日
3. `visit_assignee` - 営担
4. `unreachable_status` - 不通
5. `comments` - コメント
6. `phone_contact_person` - 電話担当（任意）
7. `preferred_contact_time` - 連絡取りやすい日、時間帯
8. `contact_method` - 連絡方法
9. `contract_year_month` - 契約年月 他決は分かった時点
10. `current_status` - 状況（売主）
11. `pinrich_status` - Pinrich
12. `visit_reminder_assignee` - 訪問事前通知メール担当
13. `property_address` - 物件所在地
14. `land_area` - 土（㎡）
15. `building_area` - 建（㎡）
16. `build_year` - 築年
17. `structure` - 構造
18. `floor_plan` - 間取り
19. `inquiry_date` - 反響日付
20. `valuation_method` - 査定方法
21. `valuation_amount_1` - 査定額1
22. `valuation_amount_2` - 査定額2
23. `valuation_amount_3` - 査定額3
24. `visit_acquisition_date` - 訪問取得日
25. `visit_date` - 訪問日
26. `visit_time` - 訪問時間
27. `visit_valuation_acquirer` - 訪問査定取得者
28. `valuation_assignee` - 査定担当
29. `confidence_level` - 確度
30. `competitor_name` - 競合名
31. `competitor_name_and_reason` - 競合名、理由（他決、専任）
32. `exclusive_other_decision_factor` - 専任・他決要因
33. `visit_notes` - 訪問メモ
34. `first_call_person` - 一番TEL
35. `inquiry_detailed_datetime` - 反響詳細日時
36. `exclusion_action` - 除外日にすること

## データベースに存在するが同期されていないフィールド

### 1. valuation_text（査定額テキスト）
- **スプレッドシートカラム**: `査定額`（I列）
- **データベースカラム**: `valuation_text`
- **型**: TEXT
- **説明**: テキストベースの査定額（例: "1900～2200万円", "2000万円前後"）
- **追加日**: 2026年1月31日
- **問題**: AA4504で"不要"が削除されてもDBに残り続けた

### 2. inquiry_id（問い合わせID）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `inquiry_id`
- **型**: TEXT
- **追加日**: 2026年3月21日

### 3. site_url（サイトURL）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `site_url`
- **型**: TEXT
- **追加日**: 2026年3月21日

### 4. unreachable_sms_assignee（不通SMS担当）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `unreachable_sms_assignee`
- **型**: TEXT
- **追加日**: 2026年3月22日

### 5. valuation_sms_assignee（査定SMS担当）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `valuation_sms_assignee`
- **型**: TEXT
- **追加日**: 2026年3月22日

### 6. valuation_reason_email_assignee（査定理由メール担当）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `valuation_reason_email_assignee`
- **型**: TEXT
- **追加日**: 2026年3月22日

### 7. cancel_notice_assignee（キャンセル通知担当）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `cancel_notice_assignee`
- **型**: TEXT
- **追加日**: 2026年3月22日

### 8. long_term_email_assignee（長期メール担当）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `long_term_email_assignee`
- **型**: TEXT
- **追加日**: 2026年3月22日

### 9. call_reminder_email_assignee（電話リマインダーメール担当）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `call_reminder_email_assignee`
- **型**: TEXT
- **追加日**: 2026年3月22日

### 10. fixed_asset_tax_road_price（固定資産税路線価）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `fixed_asset_tax_road_price`
- **型**: NUMERIC
- **追加日**: 2026年3月18日

### 11. other_decision_countermeasure（他決対策）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `other_decision_countermeasure`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 12. exclusive_other_decision_meeting（専任他決打合せ）
- **スプレッドシートカラム**: `専任他決打合せ`
- **データベースカラム**: `exclusive_other_decision_meeting`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 13. mailing_status（郵送ステータス）
- **スプレッドシートカラム**: `郵送`
- **データベースカラム**: `mailing_status`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 14. mail_sent_date（郵送日）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `mail_sent_date`
- **型**: DATE
- **追加日**: 2026年3月27日

### 15. land_area_verified（土地面積確認済み）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `land_area_verified`
- **型**: BOOLEAN
- **追加日**: 2026年3月27日

### 16. building_area_verified（建物面積確認済み）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `building_area_verified`
- **型**: BOOLEAN
- **追加日**: 2026年3月27日

### 17. valuation_assigned_by（査定割当者）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `valuation_assigned_by`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 18. appointment_notes（アポイントメモ）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `appointment_notes`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 19. exclusion_date（除外日）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `exclusion_date`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 20. latest_status（最新ステータス）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `latest_status`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 21. viewing_notes（内覧メモ）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `viewing_notes`
- **型**: TEXT
- **追加日**: 2026年3月27日

### 22. valuation_reason（査定理由）
- **スプレッドシートカラム**: 不明（要確認）
- **データベースカラム**: `valuation_reason`
- **型**: TEXT
- **追加日**: 2026年3月27日

## 修正方針

### 優先度1: 確実にスプレッドシートに存在するフィールド

以下のフィールドは確実にスプレッドシートに存在し、即座に追加すべき：

1. **valuation_text** - 査定額（I列）
2. **exclusive_other_decision_meeting** - 専任他決打合せ
3. **mailing_status** - 郵送

### 優先度2: スプレッドシートカラム名の確認が必要なフィールド

以下のフィールドはスプレッドシートカラム名を確認してから追加：

- inquiry_id
- site_url
- unreachable_sms_assignee
- valuation_sms_assignee
- valuation_reason_email_assignee
- cancel_notice_assignee
- long_term_email_assignee
- call_reminder_email_assignee
- fixed_asset_tax_road_price
- other_decision_countermeasure
- mail_sent_date
- land_area_verified
- building_area_verified
- valuation_assigned_by
- appointment_notes
- exclusion_date
- latest_status
- viewing_notes
- valuation_reason

## 次のステップ

1. ✅ AA4504の即時修正（`valuation_text`をnullに更新、キャッシュクリア）- 完了
2. ⏳ スプレッドシートを開いて、優先度2のフィールドのカラム名を確認
3. ⏳ GASコードの`syncUpdatesToSupabase_`関数に不足しているフィールドを追加
4. ⏳ `fetchAllSellersFromSupabase_`関数のフィールドリストを更新
5. ⏳ GASエディタにコピー＆ペースト
6. ⏳ テスト実行
7. ⏳ 検証

## 空セル処理の重要性

**絶対に守るべきルール**:
```javascript
var sheetFieldName = row['スプレッドシートカラム名'] ? String(row['スプレッドシートカラム名']) : null;
if (sheetFieldName !== (dbSeller.db_field_name || null)) { 
  updateData.db_field_name = sheetFieldName; 
  needsUpdate = true; 
}
```

**重要**: 
- スプレッドシートのセルが空の場合、`null`を設定する
- `? String(...) : null`のパターンを必ず使用する
- これにより、スプレッドシートで削除された値がデータベースでも`null`になる
