# -*- coding: utf-8 -*-
"""
買主GASコードに7つのフィールドを追加するスクリプト
"""

# 7つの追加フィールド
FIELDS_TO_ADD = [
    ('通知送信者', 'notification_sender'),
    ('内覧前伝達事項', 'pre_viewing_notes'),
    ('内覧の時の伝達事項', 'viewing_notes'),
    ('内覧前ヒアリング', 'pre_viewing_hearing'),
    ('買付コメント（任意）', 'offer_comment'),
    ('法人名', 'company_name'),
    ('●メアド', 'email')
]

def update_gas_file():
    with open('gas_buyer_complete_code.js', 'rb') as f:
        content = f.read()
    
    text = content.decode('utf-8')
    
    # 1. fetchAllBuyersFromSupabase_() の fields 変数に追加
    old_fields = "var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email';"
    new_fields = "var fields = 'buyer_number,latest_status,next_call_date,initial_assignee,follow_up_assignee,inquiry_email_phone,three_calls_confirmed,reception_date,distribution_type,desired_area,viewing_date,viewing_time,viewing_mobile,latest_viewing_date,post_viewing_seller_contact,viewing_promotion_email,notification_sender,pre_viewing_notes,viewing_notes,pre_viewing_hearing,offer_comment,company_name,email';"
    
    text = text.replace(old_fields, new_fields)
    
    # 2. syncUpdatesToSupabase_() に7つのフィールド同期ブロックを追加
    # viewing_promotion_email の後に追加
    insertion_point = """    if (normalizedSheetViewingPromotionEmail !== normalizedDbViewingPromotionEmail) {
      updateData.viewing_promotion_email = normalizedSheetViewingPromotionEmail;
      needsUpdate = true;
      if (normalizedSheetViewingPromotionEmail === null && normalizedDbViewingPromotionEmail !== null) {
        Logger.log('  🗑️ ' + buyerNumber + ': 内覧促進メールを削除 (旧値: ' + normalizedDbViewingPromotionEmail + ')');
      }
    }"""
    
    # 7つのフィールド同期ブロックを生成
    sync_blocks = []
    for sheet_col, db_col in FIELDS_TO_ADD:
        block = f"""
    
    // {sheet_col}
    var sheet{db_col.title().replace('_', '')} = row['{sheet_col}'] ? String(row['{sheet_col}']) : null;
    var normalizedSheet{db_col.title().replace('_', '')} = normalizeValue(sheet{db_col.title().replace('_', '')});
    var normalizedDb{db_col.title().replace('_', '')} = normalizeValue(dbBuyer.{db_col});
    if (normalizedSheet{db_col.title().replace('_', '')} !== normalizedDb{db_col.title().replace('_', '')}) {{
      updateData.{db_col} = normalizedSheet{db_col.title().replace('_', '')};
      needsUpdate = true;
      if (normalizedSheet{db_col.title().replace('_', '')} === null && normalizedDb{db_col.title().replace('_', '')} !== null) {{
        Logger.log('  🗑️ ' + buyerNumber + ': {sheet_col}を削除 (旧値: ' + normalizedDb{db_col.title().replace('_', '')} + ')');
      }}
    }}"""
        sync_blocks.append(block)
    
    new_insertion = insertion_point + ''.join(sync_blocks)
    text = text.replace(insertion_point, new_insertion)
    
    # UTF-8で書き込み
    with open('gas_buyer_complete_code.js', 'wb') as f:
        f.write(text.encode('utf-8'))
    
    print('✅ gas_buyer_complete_code.js を更新しました')
    print('追加したフィールド:')
    for sheet_col, db_col in FIELDS_TO_ADD:
        print(f'  - {sheet_col} ({db_col})')

if __name__ == '__main__':
    update_gas_file()
