import re

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# isTodayCallNotStarted の反響日付取得順序を修正
# inquiryDetailedDatetime 優先 → inquiryDate 優先
old = "  const inquiryDate = seller.inquiryDetailedDatetime || seller.inquiryDate || seller.inquiry_date;"
new = "  const inquiryDate = seller.inquiryDate || seller.inquiry_date || seller.inquiryDetailedDatetime;"

if old in text:
    text = text.replace(old, new)
    print("✅ isTodayCallNotStarted の反響日付取得順序を修正しました")
else:
    print("❌ 対象の文字列が見つかりませんでした")
    # 現在の状態を確認
    idx = text.find("isTodayCallNotStarted")
    if idx >= 0:
        snippet = text[idx:idx+500]
        print("現在の isTodayCallNotStarted 付近:")
        print(snippet)

with open('frontend/frontend/src/utils/sellerStatusFilters.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print("完了")
