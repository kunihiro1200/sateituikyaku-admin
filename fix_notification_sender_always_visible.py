#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
通知送信者ボタン群を isViewingPreDay 条件の外に移動する
メール送信後も通知送信者ボタンが消えないようにする
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 変更前: 通知送信者ボタン群が isViewingPreDay ブロック内の末尾にある
old = '''            {/* 通知送信者ボタン群（内覧前日ボタンの下に表示） */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                通知送信者:
              </Typography>
              {normalInitials.map((initial) => {
                const isSelected = buyer.notification_sender === initial;
                return (
                  <Button
                    key={initial}
                    size="small"
                    variant={isSelected ? 'contained' : 'outlined'}
                    color="primary"
                    onClick={async () => {
                      const newValue = isSelected ? '' : initial;
                      await handleInlineFieldSave('notification_sender', newValue);
                    }}
                    sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                  >
                    {initial}
                  </Button>
                );
              })}
              {/* 現在の値がリストにない場合も表示 */}
              {buyer.notification_sender && !normalInitials.includes(buyer.notification_sender) && (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: 'bold', borderRadius: 1 }}
                >
                  {buyer.notification_sender}
                </Button>
              )}
            </Box>
          </Box>
        )}
      </Box>

      {/* 内覧結果・後続対応セクション */}'''

# 変更後: isViewingPreDay ブロックを閉じた後に通知送信者ボタン群を配置
new = '''          </Box>
        )}
        {/* 通知送信者ボタン群（内覧前日かどうかに関わらず常に表示） */}
        {(isViewingPreDay(buyer) || buyer.notification_sender) && (
          <Box sx={{ ml: isViewingPreDay(buyer) ? 0 : 'auto', display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
              通知送信者:
            </Typography>
            {normalInitials.map((initial) => {
              const isSelected = buyer.notification_sender === initial;
              return (
                <Button
                  key={initial}
                  size="small"
                  variant={isSelected ? 'contained' : 'outlined'}
                  color="primary"
                  onClick={async () => {
                    const newValue = isSelected ? '' : initial;
                    await handleInlineFieldSave('notification_sender', newValue);
                  }}
                  sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                >
                  {initial}
                </Button>
              );
            })}
            {/* 現在の値がリストにない場合も表示 */}
            {buyer.notification_sender && !normalInitials.includes(buyer.notification_sender) && (
              <Button
                size="small"
                variant="contained"
                color="primary"
                sx={{ minWidth: 36, px: 1, py: 0.3, fontSize: '0.75rem', fontWeight: 'bold', borderRadius: 1 }}
              >
                {buyer.notification_sender}
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* 内覧結果・後続対応セクション */}'''

if old in text:
    text = text.replace(old, new)
    print('✅ 置換成功')
else:
    print('❌ 置換対象が見つかりません')
    # デバッグ用に前後を確認
    idx = text.find('通知送信者ボタン群')
    if idx >= 0:
        print(f'「通知送信者ボタン群」は {idx} 文字目に存在します')
    else:
        print('「通知送信者ボタン群」が見つかりません')

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
