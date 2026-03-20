import re

filepath = 'frontend/frontend/src/pages/SellersPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

# 1. ヘッダーの「反響年」列を削除
text = text.replace(
    '                <TableCell>反響年</TableCell>\n                <TableCell>反響日付</TableCell>',
    '                <TableCell>反響日付</TableCell>'
)

# 2. データ行の「反響年」セルを削除
text = text.replace(
    '                    <TableCell>{seller.inquiryYear || \'-\'}</TableCell>\n                    <TableCell>\n                      {formatInquiryDate(seller)}\n                    </TableCell>',
    '                    <TableCell>\n                      {formatInquiryDate(seller)}\n                    </TableCell>'
)

# 3. colSpanを14→13に変更（反響年列削除分）
text = text.replace(
    '<TableCell colSpan={14} align="center">\n                    読み込み中...',
    '<TableCell colSpan={13} align="center">\n                    読み込み中...'
)
text = text.replace(
    '<TableCell colSpan={14} align="center">\n                    売主が見つかりませんでした',
    '<TableCell colSpan={13} align="center">\n                    売主が見つかりませんでした'
)

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
