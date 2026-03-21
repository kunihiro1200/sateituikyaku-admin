# isUnvaluated の反響日付チェックを修正
# inquiryDetailedDatetime（inquiry_detailed_datetime）ではなく
# inquiryDate（inquiry_date）を優先するよう変更
# バックエンドのカウントロジックと一致させる

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """  // 反響日付が基準日以降かチェック（文字列比較）
  // inquiryDateまたはinquiryDetailedDatetimeを使用
  const inquiryDate = seller.inquiryDetailedDatetime || seller.inquiryDate || seller.inquiry_date;"""

new = """  // 反響日付が基準日以降かチェック（文字列比較）
  // inquiryDate（inquiry_date）を優先する（バックエンドのカウントロジックと一致）
  // inquiryDetailedDatetime は詳細日時のため、日付比較には inquiry_date を使用
  const inquiryDate = seller.inquiryDate || seller.inquiry_date || seller.inquiryDetailedDatetime;"""

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('✅ 修正完了')
else:
    print('❌ 対象文字列が見つかりません')
    print('--- 現在の内容 ---')
    idx = text.find('inquiryDetailedDatetime || seller.inquiryDate')
    if idx >= 0:
        print(repr(text[idx-100:idx+200]))
