#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx のスマホ表示修正 v2
- 右列（買主情報）にアコーディオンヘッダーを追加
- 右列のoverflowをスマホ時にvisibleに
- 右列をスマホ時に先頭表示（order: -1）
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: 右列のBoxスタイルとアコーディオンヘッダーを追加
old_right_col = """        {/* 右列: 買主情報フィールド + 関連買主 - 独立スクロール */}
        <Box
          sx={{
            flex: '1 1 46%',
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible' },
            // isMobile 時: 入力フィールドの minHeight を 44px に設定
            ...(isMobile && {
              '& .MuiInputBase-root': { minHeight: 44 },
              '& .MuiOutlinedInput-root': { minHeight: 44 },
              '& .MuiSelect-select': { minHeight: 44, display: 'flex', alignItems: 'center' },
            }),
          }}
          role="main"
          aria-label="買主情報"
          tabIndex={0}
        >"""

new_right_col = """        {/* 右列: 買主情報フィールド + 関連買主 - 独立スクロール */}
        <Box
          sx={{
            flex: '1 1 46%',
            minWidth: 0,
            height: isMobile ? 'auto' : '100%',
            overflowY: isMobile ? 'visible' : 'auto',
            overflowX: 'hidden',
            order: isMobile ? -1 : 0,
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible' },
            ...(isMobile && {
              '& .MuiInputBase-root': { minHeight: 44 },
              '& .MuiOutlinedInput-root': { minHeight: 44 },
              '& .MuiSelect-select': { minHeight: 44, display: 'flex', alignItems: 'center' },
            }),
          }}
          role="main"
          aria-label="買主情報"
          tabIndex={0}
        >
          {isMobile && (
            <Box
              onClick={() => setMobileBuyerInfoOpen(!mobileBuyerInfoOpen)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#e3f2fd', cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight="bold">👤 買主情報</Typography>
              <span style={{ transform: mobileBuyerInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'inline-block' }}>▼</span>
            </Box>
          )}
          <Box sx={{ display: isMobile && !mobileBuyerInfoOpen ? 'none' : undefined }}>"""

if old_right_col in text:
    text = text.replace(old_right_col, new_right_col)
    print("✅ 右列にアコーディオンヘッダーを追加しました")
else:
    print("❌ 右列が見つかりませんでした")

# 修正2: 右列の閉じタグの前に </Box> を追加
# 2751行付近: "        </Box>\n      </Box>"
old_right_end = """            </Paper>
          ))}


        </Box>
      </Box>"""

new_right_end = """            </Paper>
          ))}

          </Box>{/* スマホ時買主情報開閉Box */}
        </Box>
      </Box>"""

if old_right_end in text:
    text = text.replace(old_right_end, new_right_end)
    print("✅ 右列の閉じBoxタグを追加しました")
else:
    print("❌ 右列の閉じタグが見つかりませんでした")

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
