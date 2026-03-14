#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx の内覧日フィールドにクリアボタンを追加する
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正前：カレンダーボタンのみ
old_str = """              {/* カレンダーリンクボタン */}
              {buyer.latest_viewing_date && (
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 0.5, fontSize: '0.7rem', padding: '2px 4px' }}
                  onClick={handleCalendarButtonClick}
                >
                  📅 カレンダーで開く
                </Button>
              )}"""

# 修正後：クリアボタンとカレンダーボタンを並べる
new_str = """              {/* クリアボタン（常に表示） */}
              <Button
                size="small"
                variant="outlined"
                color="error"
                fullWidth
                sx={{ mt: 0.5, fontSize: '0.7rem', padding: '2px 4px' }}
                onClick={async () => {
                  await handleInlineFieldSave('latest_viewing_date', null);
                  await handleInlineFieldSave('viewing_time', null);
                }}
              >
                🗑️ 内覧日をクリア
              </Button>
              {/* カレンダーリンクボタン */}
              {buyer.latest_viewing_date && (
                <Button
                  size="small"
                  variant="outlined"
                  fullWidth
                  sx={{ mt: 0.5, fontSize: '0.7rem', padding: '2px 4px' }}
                  onClick={handleCalendarButtonClick}
                >
                  📅 カレンダーで開く
                </Button>
              )}"""

if old_str in text:
    text = text.replace(old_str, new_str)
    print('✅ クリアボタンを追加')
else:
    print('❌ 対象文字列が見つかりません')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
