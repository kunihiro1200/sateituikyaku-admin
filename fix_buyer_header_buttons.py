#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BuyerDetailPageのヘッダーにGmail送信ボタンと電話番号ボタンを追加するスクリプト"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# Phone アイコンのインポートを追加（既にある場合はスキップ）
old_import_icons = '''import { 
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';'''

new_import_icons = '''import { 
  ArrowBack as ArrowBackIcon,
  Email as EmailIcon,
  ContentCopy as ContentCopyIcon,
  Phone as PhoneIcon,
} from '@mui/icons-material';'''

if 'Phone as PhoneIcon' not in text:
    text = text.replace(old_import_icons, new_import_icons)
    print('Added PhoneIcon import')
else:
    print('PhoneIcon import already exists')

# ヘッダー右側ボタングループを更新
# 現在の右側ボタングループ
old_buttons = '''        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問い合わせ履歴 ({inquiryHistoryTable.length}件)
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/desired-conditions`)}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            内覧
          </Button>
        </Box>'''

new_buttons = '''        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Gmail送信ボタン */}
          <BuyerGmailSendButton
            buyerId={buyer_number || ''}
            buyerEmail={buyer.email || ''}
            buyerName={buyer.name || ''}
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            size="small"
            variant="contained"
          />

          {/* 電話番号ボタン */}
          {buyer.phone_number && (
            <Button
              variant="contained"
              color="success"
              size="small"
              startIcon={<PhoneIcon />}
              href={`tel:${buyer.phone_number}`}
              sx={{ fontWeight: 'bold', whiteSpace: 'nowrap' }}
            >
              {buyer.phone_number}
            </Button>
          )}

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問い合わせ履歴 ({inquiryHistoryTable.length}件)
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/desired-conditions`)}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={() => navigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            内覧
          </Button>
        </Box>'''

if old_buttons in text:
    text = text.replace(old_buttons, new_buttons)
    print('Updated header buttons')
else:
    print('ERROR: Could not find header buttons to replace')
    exit(1)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! Header buttons updated in BuyerDetailPage.tsx')
