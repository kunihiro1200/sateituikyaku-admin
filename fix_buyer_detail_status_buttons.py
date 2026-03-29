#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
買主詳細ページのヘッダーに「問合メール未対応一覧」「当日TEL一覧」「業者問合せ一覧」ボタンを追加
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 内覧ボタンの後に3つのボタンを追加
old = '''          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => handleNavigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            内覧
          </Button>
        </Box>
      </Box>'''

new = '''          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => handleNavigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            内覧
          </Button>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* 問合メール未対応一覧ボタン */}
          {(buyer.inquiry_email_phone === '未' || buyer.inquiry_email_reply === '未' ||
            (!buyer.latest_viewing_date && buyer.inquiry_email_phone === '不要' &&
              (!buyer.inquiry_email_reply || buyer.inquiry_email_reply === '未'))) && (
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={() => navigate('/buyers?status=問合メール未対応')}
            >
              問合メール未対応一覧
            </Button>
          )}

          {/* 当日TEL一覧ボタン */}
          {buyer.next_call_date && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const callDate = new Date(buyer.next_call_date);
            callDate.setHours(0, 0, 0, 0);
            return callDate <= today;
          })() && (
            <Button
              variant="outlined"
              color="error"
              size="small"
              onClick={() => navigate('/buyers?status=当日TEL')}
            >
              当日TEL一覧
            </Button>
          )}

          {/* 業者問合せ一覧ボタン */}
          {buyer.broker_inquiry === '業者問合せ' && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => navigate('/buyers?status=業者問合せあり')}
              sx={{ color: '#7b1fa2', borderColor: '#7b1fa2', '&:hover': { borderColor: '#4a148c', color: '#4a148c' } }}
            >
              業者問合せ一覧
            </Button>
          )}
        </Box>
      </Box>'''

if old in text:
    text = text.replace(old, new)
    print('✅ ボタン追加成功')
else:
    print('❌ 対象箇所が見つかりません')
    # デバッグ用に周辺テキストを確認
    idx = text.find('内覧\n          </Button>')
    print(f'内覧ボタン位置: {idx}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
