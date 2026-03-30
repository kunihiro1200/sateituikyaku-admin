# -*- coding: utf-8 -*-
"""
物件詳細画面のヘッダー構文エラー修正スクリプト
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 問題箇所：買主コンテキスト部分の閉じタグが不足している
# 1120行目付近から1130行目付近までを修正

old_code = """          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                買主から遷移:
              </Typography>
<EditableSection"""

new_code = """          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                買主から遷移:
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => navigate(`/buyers/${buyerContext.buyerId}`)}
                startIcon={<PersonIcon fontSize="small" />}
                sx={{ borderColor: SECTION_COLORS.buyer.main, color: SECTION_COLORS.buyer.main }}
              >
                {buyerContext.buyerName || buyerContext.buyerId}
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* メインコンテンツエリア */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* 1. 価格情報 + 買主リスト */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', md: 'row' }, 
          gap: 1, 
          mb: 1 
        }}>
          {/* 価格情報 */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 33%' } }}>
            <EditableSection"""

text = text.replace(old_code, new_code)

# UTF-8で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
