with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 削除対象ブロック
old = """      {/* 統合問合せ履歴 */}
      {buyer_number && (
        <Box sx={{ mt: 3 }}>
          <UnifiedInquiryHistoryTable buyerNumber={buyer_number} />
        </Box>
      )}"""

if old in text:
    text = text.replace(old, '')
    print('✅ 統合問合せ履歴ブロックを削除しました')
else:
    print('❌ 対象ブロックが見つかりません')
    # 周辺を確認
    idx = text.find('統合問合せ履歴')
    if idx >= 0:
        print('周辺テキスト:')
        print(repr(text[idx-10:idx+200]))

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
