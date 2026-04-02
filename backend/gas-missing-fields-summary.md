# GAS同期で不足しているフィールド（確定版）

## 確実に追加すべきフィールド（column-mapping.jsonに存在）

以下のフィールドは`column-mapping.json`に定義されているが、GASの`syncUpdatesToSupabase_`関数で同期されていない：

### 1. unreachable_sms_assignee（不通時Sメール担当）
- **スプレッドシートカラム**: `不通時Sメール担当`
- **データベースカラム**: `unreachable_sms_assignee`
- **型**: TEXT

### 2. valuation_sms_assignee（査定Sメール担当）
- **スプレッドシートカラム**: `査定Sメール担当`
- **データベースカラム**: `valuation_sms_assignee`
- **型**: TEXT

### 3. valuation_reason_email_assignee（査定理由別３後Eメ担）
- **スプレッドシートカラム**: `査定理由別３後Eメ担`
- **データベースカラム**: `valuation_reason_email_assignee`
- **型**: TEXT

### 4. valuation_reason（査定理由）
- **スプレッドシートカラム**: `査定理由`
- **データベースカラム**: `valuation_reason`
- **型**: TEXT

### 5. cancel_notice_assignee（キャンセル案内担当）
- **スプレッドシートカラム**: `キャンセル案内担当`
- **データベースカラム**: `cancel_notice_assignee`
- **型**: TEXT

### 6. long_term_email_assignee（除外前、長期客メール担当）
- **スプレッドシートカラム**: `除外前、長期客メール担当`
- **データベースカラム**: `long_term_email_assignee`
- **型**: TEXT

### 7. call_reminder_email_assignee（当社が電話したというリマインドメール担当）
- **スプレッドシートカラム**: `当社が電話したというリマインドメール担当`
- **データベースカラム**: `call_reminder_email_assignee`
- **型**: TEXT

### 8. inquiry_id（ID）
- **スプレッドシートカラム**: `ID`
- **データベースカラム**: `inquiry_id`
- **型**: TEXT

### 9. site_url（サイトURL）
- **スプレッドシートカラム**: `サイトURL`
- **データベースカラム**: `site_url`
- **型**: TEXT

### 10. mailing_status（郵送）
- **スプレッドシートカラム**: `郵送`
- **データベースカラム**: `mailing_status`
- **型**: TEXT

### 11. fixed_asset_tax_road_price（固定資産税路線価）
- **スプレッドシートカラム**: `固定資産税路線価`
- **データベースカラム**: `fixed_asset_tax_road_price`
- **型**: NUMERIC

### 12. exclusive_other_decision_meeting（専任他決打合せ）
- **スプレッドシートカラム**: `専任他決打合せ`
- **データベースカラム**: `exclusive_other_decision_meeting`
- **型**: TEXT

### 13. land_area_verified（土地（当社調べ））
- **スプレッドシートカラム**: `土地（当社調べ）`
- **データベースカラム**: `land_area_verified`
- **型**: NUMERIC (boolean stored as 0/1)

### 14. building_area_verified（建物（当社調べ））
- **スプレッドシートカラム**: `建物（当社調べ）`
- **データベースカラム**: `building_area_verified`
- **型**: NUMERIC (boolean stored as 0/1)

## 追加が必要だがcolumn-mapping.jsonに未定義のフィールド

### 15. valuation_text（査定額）
- **スプレッドシートカラム**: `査定額`（I列）
- **データベースカラム**: `valuation_text`
- **型**: TEXT
- **説明**: テキストベースの査定額（例: "1900～2200万円", "2000万円前後"）
- **問題**: AA4504で"不要"が削除されてもDBに残り続けた
- **注意**: column-mapping.jsonに追加する必要がある

## 実装方針

### ステップ1: column-mapping.jsonにvaluation_textを追加

```json
{
  "spreadsheetToDatabase": {
    "査定額": "valuation_text",
    ...
  },
  "databaseToSpreadsheet": {
    "valuation_text": "査定額",
    ...
  }
}
```

### ステップ2: GASコードのfetchAllSellersFromSupabase_関数にフィールドを追加

現在のフィールドリスト:
```javascript
var fields = 'seller_number,status,next_call_date,visit_assignee,unreachable_status,comments,phone_contact_person,preferred_contact_time,contact_method,contract_year_month,current_status,pinrich_status,visit_reminder_assignee,property_address,land_area,building_area,build_year,structure,floor_plan,inquiry_date,inquiry_detailed_datetime,valuation_method,valuation_amount_1,valuation_amount_2,valuation_amount_3,visit_acquisition_date,visit_date,visit_time,visit_valuation_acquirer,valuation_assignee,confidence_level,competitor_name,competitor_name_and_reason,exclusive_other_decision_factor,visit_notes,first_call_person,exclusion_action';
```

追加するフィールド:
```
unreachable_sms_assignee,valuation_sms_assignee,valuation_reason_email_assignee,valuation_reason,cancel_notice_assignee,long_term_email_assignee,call_reminder_email_assignee,inquiry_id,site_url,mailing_status,fixed_asset_tax_road_price,exclusive_other_decision_meeting,land_area_verified,building_area_verified,valuation_text
```

### ステップ3: GASコードのsyncUpdatesToSupabase_関数に同期処理を追加

各フィールドに対して以下のパターンを追加:

```javascript
// TEXT型フィールドの例
var sheetFieldName = row['スプレッドシートカラム名'] ? String(row['スプレッドシートカラム名']) : null;
if (sheetFieldName !== (dbSeller.db_field_name || null)) { 
  updateData.db_field_name = sheetFieldName; 
  needsUpdate = true; 
}

// NUMERIC型フィールドの例
var sheetNumericField = (row['スプレッドシートカラム名'] !== '' && row['スプレッドシートカラム名'] !== undefined && row['スプレッドシートカラム名'] !== null) ? parseFloat(row['スプレッドシートカラム名']) : null;
var dbNumericField = (dbSeller.db_field_name !== null && dbSeller.db_field_name !== undefined) ? parseFloat(dbSeller.db_field_name) : null;
if (sheetNumericField !== dbNumericField) { 
  updateData.db_field_name = sheetNumericField; 
  needsUpdate = true; 
}
```

## 重要な注意事項

### 空セル処理

**絶対に守るべきルール**:
- スプレッドシートのセルが空の場合、`null`を設定する
- `? String(...) : null`のパターンを必ず使用する
- これにより、スプレッドシートで削除された値がデータベースでも`null`になる

### 型変換

- **TEXT型**: `String(value)`で変換
- **NUMERIC型**: `parseFloat(value)`で変換
- **BOOLEAN型**: `0`または`1`として扱う（GASでは数値として保存）

### 比較処理

- **TEXT型**: `sheetValue !== (dbValue || null)`
- **NUMERIC型**: `sheetValue !== dbValue`（両方nullの場合も考慮）
- **DATE型**: ISO形式の文字列で比較（`YYYY-MM-DD`）
