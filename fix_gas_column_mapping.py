with open('gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# COLUMN_MAPPINGに新規フィールドを追加
old_str = "  'CWの方': 'cw_person'\r\n};"
new_str = """  'CWの方': 'cw_person',
  // 売主、買主詳細フィールド（2026年4月追加）
  '売主名前': 'seller_contact_name',
  '売主メアド': 'seller_contact_email',
  '売主TEL': 'seller_contact_tel',
  '買主名前': 'buyer_contact_name',
  '買主メアド': 'buyer_contact_email',
  '買主TEL': 'buyer_contact_tel',
  'ローン': 'loan',
  '金融機関名': 'financial_institution',
  '引き渡し予定': 'delivery_scheduled_date'
};"""

if old_str in text:
    text = text.replace(old_str, new_str)
    print("COLUMN_MAPPING: 追加成功")
else:
    print("COLUMN_MAPPING: 対象文字列が見つかりません")
    # デバッグ用に末尾付近を表示
    idx = text.find("'CWの方'")
    if idx >= 0:
        print("'CWの方' 周辺:", repr(text[idx:idx+50]))

# TYPE_CONVERSIONSに delivery_scheduled_date を追加
old_str2 = "  'review_count': 'number'\r\n};"
new_str2 = """  'review_count': 'number',
  'delivery_scheduled_date': 'date'
};"""

if old_str2 in text:
    text = text.replace(old_str2, new_str2)
    print("TYPE_CONVERSIONS: 追加成功")
else:
    print("TYPE_CONVERSIONS: 対象文字列が見つかりません")
    idx2 = text.find("'review_count'")
    if idx2 >= 0:
        print("'review_count' 周辺:", repr(text[idx2:idx2+50]))

with open('gas/gyomu-work-task-sync/GyomuWorkTaskSync.gs', 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了")
