#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主詳細ページのヘッダー修正:
1. 名前に「様」を追加
2. 買主番号Chipを名前の直後に移動して目立つスタイルに変更
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前のヘッダー部分
old_header = '''          <Typography variant="h5" fontWeight="bold">
            {buyer.name || buyer.buyer_number}
          </Typography>
          {buyer.inquiry_confidence && (
            <Chip label={buyer.inquiry_confidence} color="info" sx={{ ml: 2 }} />
          )}
          {buyer.latest_status && (
            <Chip label={buyer.latest_status.substring(0, 30)} sx={{ ml: 1 }} />
          )}
          <RelatedBuyerNotificationBadge 
            count={relatedBuyersCount} 
            onClick={scrollToRelatedBuyers}
          />
          {/* 買主番号コピーChip */}
          <Tooltip title={copiedBuyerNumber ? 'コピーしました！' : '買主番号をコピー'} arrow>
            <Chip
              icon={<ContentCopyIcon fontSize="small" />}
              label={buyer_number}
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(buyer_number || '');
                setCopiedBuyerNumber(true);
                setTimeout(() => setCopiedBuyerNumber(false), 2000);
              }}
              color={copiedBuyerNumber ? 'success' : 'default'}
              variant="outlined"
              sx={{ cursor: 'pointer' }}
            />
          </Tooltip>'''

# 修正後: 買主番号を名前の直後に移動、名前に「様」追加
new_header = '''          <Typography variant="h5" fontWeight="bold">
            {buyer.name ? buyer.name + '様' : buyer.buyer_number}
          </Typography>
          {/* 買主番号コピーChip - 名前の直後に目立つように配置 */}
          <Tooltip title={copiedBuyerNumber ? 'コピーしました！' : '買主番号をコピー'} arrow>
            <Chip
              icon={<ContentCopyIcon fontSize="small" />}
              label={buyer_number}
              size="medium"
              onClick={() => {
                navigator.clipboard.writeText(buyer_number || '');
                setCopiedBuyerNumber(true);
                setTimeout(() => setCopiedBuyerNumber(false), 2000);
              }}
              color={copiedBuyerNumber ? 'success' : 'primary'}
              variant="filled"
              sx={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
            />
          </Tooltip>
          {buyer.inquiry_confidence && (
            <Chip label={buyer.inquiry_confidence} color="info" sx={{ ml: 1 }} />
          )}
          {buyer.latest_status && (
            <Chip label={buyer.latest_status.substring(0, 30)} sx={{ ml: 1 }} />
          )}
          <RelatedBuyerNotificationBadge 
            count={relatedBuyersCount} 
            onClick={scrollToRelatedBuyers}
          />'''

if old_header in text:
    text = text.replace(old_header, new_header)
    print('✅ ヘッダー修正成功')
else:
    print('❌ 対象文字列が見つかりません')
    # デバッグ用に一部を確認
    idx = text.find('buyer.name || buyer.buyer_number')
    if idx >= 0:
        print(f'  "buyer.name || buyer.buyer_number" は {idx} 行目付近に存在')
    else:
        print('  "buyer.name || buyer.buyer_number" も見つかりません')
    exit(1)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイル書き込み完了')
