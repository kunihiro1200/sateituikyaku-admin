"""
「カレンダーで開く」ボタンを条件付きで目立たせる:
- 内覧日・時間・後続担当が全て入力済み かつ 内覧未確定が空 → contained + 緑 + pulse アニメーション
- それ以外 → 従来の outlined スタイル
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8').replace('\r\n', '\n')

old_btn = """              {buyer.latest_viewing_date && (
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

new_btn = """              {buyer.latest_viewing_date && (() => {
                // 全条件を満たす場合にボタンを目立たせる
                const shouldHighlight =
                  !!buyer.latest_viewing_date &&
                  !!buyer.viewing_time &&
                  !!buyer.follow_up_assignee &&
                  !buyer.viewing_unconfirmed;
                return (
                  <Button
                    size="small"
                    variant={shouldHighlight ? 'contained' : 'outlined'}
                    color={shouldHighlight ? 'success' : 'primary'}
                    fullWidth
                    sx={{
                      mt: 0.5,
                      fontSize: shouldHighlight ? '0.75rem' : '0.7rem',
                      padding: shouldHighlight ? '4px 8px' : '2px 4px',
                      fontWeight: shouldHighlight ? 'bold' : 'normal',
                      ...(shouldHighlight && {
                        animation: 'calendarPulse 1.5s ease-in-out infinite',
                        '@keyframes calendarPulse': {
                          '0%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0.5)' },
                          '70%': { boxShadow: '0 0 0 6px rgba(46, 125, 50, 0)' },
                          '100%': { boxShadow: '0 0 0 0 rgba(46, 125, 50, 0)' },
                        },
                      }),
                    }}
                    onClick={handleCalendarButtonClick}
                  >
                    📅 カレンダーで開く
                  </Button>
                );
              })()}"""

if old_btn in text:
    text = text.replace(old_btn, new_btn)
    print('✅ カレンダーボタンのハイライト条件を追加')
else:
    print('⚠️ 対象箇所が見つかりません')
    idx = text.find('カレンダーで開く')
    if idx >= 0:
        print('周辺:', repr(text[idx-300:idx+100]))

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 修正完了')
