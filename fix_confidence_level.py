# fix_confidence_level.py
# decryptSellerでseller.confidenceをseller.confidence_levelに修正

with open('backend/src/services/SellerService.supabase.ts', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# CRLF -> LF
text = text.replace('\r\n', '\n')

# confidence: seller.confidence -> confidence: seller.confidence_level
text = text.replace(
    '        confidence: seller.confidence,\n',
    '        confidence: seller.confidence_level,\n'
)

# confidenceLevel: seller.confidence -> confidenceLevel: seller.confidence_level
text = text.replace(
    '        confidenceLevel: seller.confidence,\n',
    '        confidenceLevel: seller.confidence_level,\n'
)

# LF -> CRLF
text = text.replace('\n', '\r\n')

with open('backend/src/services/SellerService.supabase.ts', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! confidence -> confidence_level に修正しました')
