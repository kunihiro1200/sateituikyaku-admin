# 1. PurchaseStatusBadge のアニメーション確認・修正
with open('frontend/frontend/src/components/PurchaseStatusBadge.tsx', 'rb') as f:
    badge = f.read().decode('utf-8')

print('=== PurchaseStatusBadge animation check ===')
print('has purchasePulse:', 'purchasePulse' in badge)
print('has style inject:', 'document.createElement' in badge)

# 2. CompactBuyerListForProperty の最新状況を赤字太字に
with open('frontend/frontend/src/components/CompactBuyerListForProperty.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

old = "                  <TableCell>{buyer.latest_status || '-'}</TableCell>"
new = """                  <TableCell
                    sx={buyer.latest_status && buyer.latest_status.includes('\u8cb7') ? {
                      color: 'error.main',
                      fontWeight: 'bold',
                    } : {}}
                  >
                    {buyer.latest_status || '-'}
                  </TableCell>"""

if old in content:
    content = content.replace(old, new)
    with open('frontend/frontend/src/components/CompactBuyerListForProperty.tsx', 'wb') as f:
        f.write(content.encode('utf-8'))
    print('CompactBuyerListForProperty: Done')
else:
    print('CompactBuyerListForProperty: Pattern not found')
