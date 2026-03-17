with open('backend/src/services/BuyerCandidateService.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old_str = '''    if (brokerInquiry && brokerInquiry !== '' && brokerInquiry !== '0' && brokerInquiry.toLowerCase() !== 'false') {
      return true;
    }'''

new_str = '''    if (brokerInquiry && brokerInquiry !== '' && brokerInquiry !== '0' && brokerInquiry.toLowerCase() !== 'false' && brokerInquiry.toLowerCase() !== 'null') {
      return true;
    }'''

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ broker_inquiryの"null"文字列チェックを追加しました')
else:
    print('❌ 対象文字列が見つかりませんでした')

with open('backend/src/services/BuyerCandidateService.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
