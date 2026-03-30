with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 名前・売主番号のBoxの後に、モバイル時のみ物件所在地と種別を追加
old = """          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography
                variant={isMobile ? 'body1' : 'h5'}
                fontWeight="bold"
                sx={{ color: SECTION_COLORS.seller.main, fontSize: isMobile ? '0.95rem' : undefined }}
              >{seller?.name || '読み込み中...'}</Typography>
            {seller?.sellerNumber && (
              <>
                <Chip 
                  label={seller.sellerNumber} 
                  size="small" 
                  sx={{ 
                    backgroundColor: SECTION_COLORS.seller.main,
                    color: SECTION_COLORS.seller.contrastText,
                    cursor: 'pointer',
                    '&:hover': { 
                      backgroundColor: SECTION_COLORS.seller.dark,
                      opacity: 0.9
                    }
                  }}
                  onClick={() => {
                    navigator.clipboard.writeText(seller.sellerNumber || '');
                    setCopiedSellerNumber(true);
                    setTimeout(() => setCopiedSellerNumber(false), 1500);
                  }}
                  title="クリックでコピー"
                />
                {copiedSellerNumber && (
                  <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>✓</Typography>
                )}
              </>
            )}
          </Box>"""

new = """          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                  variant={isMobile ? 'body1' : 'h5'}
                  fontWeight="bold"
                  sx={{ color: SECTION_COLORS.seller.main, fontSize: isMobile ? '0.95rem' : undefined }}
                >{seller?.name || '読み込み中...'}</Typography>
              {seller?.sellerNumber && (
                <>
                  <Chip 
                    label={seller.sellerNumber} 
                    size="small" 
                    sx={{ 
                      backgroundColor: SECTION_COLORS.seller.main,
                      color: SECTION_COLORS.seller.contrastText,
                      cursor: 'pointer',
                      '&:hover': { 
                        backgroundColor: SECTION_COLORS.seller.dark,
                        opacity: 0.9
                      }
                    }}
                    onClick={() => {
                      navigator.clipboard.writeText(seller.sellerNumber || '');
                      setCopiedSellerNumber(true);
                      setTimeout(() => setCopiedSellerNumber(false), 1500);
                    }}
                    title="クリックでコピー"
                  />
                  {copiedSellerNumber && (
                    <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>✓</Typography>
                  )}
                </>
              )}
            </Box>
            {isMobile && (propInfo.address || propInfo.propertyType) && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {propInfo.address && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                    {propInfo.address}
                  </Typography>
                )}
                {propInfo.propertyType && (
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {getPropertyTypeLabel(propInfo.propertyType)}
                  </Typography>
                )}
              </Box>
            )}
          </Box>"""

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done! ヘッダーに物件所在地と種別を追加しました。')
else:
    print('ERROR: 対象の文字列が見つかりませんでした。')
