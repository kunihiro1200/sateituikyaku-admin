with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 物件所在地の下に種別を追加（スマホ版カード）
old = """                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        fontSize: '14px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        mb: 0.5,
                      }}
                    >
                      {seller.propertyAddress || '-'}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '14px' }}
                    >
                      次電:{' '}"""

new = """                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.5 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontSize: '14px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {seller.propertyAddress || '-'}
                      </Typography>
                      {seller.propertyType && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ fontSize: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}
                        >
                          {seller.propertyType}
                        </Typography>
                      )}
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: '14px' }}
                    >
                      次電:{' '}"""

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done! 種別を追加しました。')
else:
    print('ERROR: 対象の文字列が見つかりませんでした。')
