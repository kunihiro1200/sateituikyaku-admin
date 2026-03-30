#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx のスマホ表示修正
1. ヘッダーの名前フォントをスマホ時に縮小
2. ヘッダーBoxをスマホ時にコンパクトに
3. 3カラムにアコーディオンヘッダーを追加
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: stateにアコーディオン開閉状態を追加
# useState定義の末尾付近に追加
old_state_area = """  const [buyerNumberSearch, setBuyerNumberSearch] = useState('');"""

new_state_area = """  const [buyerNumberSearch, setBuyerNumberSearch] = useState('');
  // スマホ時のアコーディオン開閉状態
  const [mobileCallLogOpen, setMobileCallLogOpen] = useState(false);
  const [mobilePropertyCardOpen, setMobilePropertyCardOpen] = useState(false);
  const [mobileBuyerInfoOpen, setMobileBuyerInfoOpen] = useState(true); // 買主情報はデフォルト展開"""

if old_state_area in text:
    text = text.replace(old_state_area, new_state_area)
    print("✅ アコーディオン用stateを追加しました")
else:
    print("❌ state追加箇所が見つかりませんでした")

# 修正2: ヘッダーの名前フォントをスマホ時に縮小
old_name = """          <Typography variant="h5" fontWeight="bold">
            {buyer.name ? buyer.name + '様' : buyer.buyer_number}
          </Typography>"""

new_name = """          <Typography
            variant={isMobile ? 'body1' : 'h5'}
            fontWeight="bold"
            sx={{ fontSize: isMobile ? '0.95rem' : undefined }}
          >
            {buyer.name ? buyer.name + '様' : buyer.buyer_number}
          </Typography>"""

if old_name in text:
    text = text.replace(old_name, new_name)
    print("✅ 名前フォントをスマホ時に縮小しました")
else:
    print("❌ 名前Typographyが見つかりませんでした")

# 修正3: ヘッダーBoxをスマホ時にコンパクトに（flexWrap追加）
old_header_box = """      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>"""

new_header_box = """      <Box sx={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 0.5 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 2, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>"""

if old_header_box in text:
    text = text.replace(old_header_box, new_header_box)
    print("✅ ヘッダーBoxをスマホ時にコンパクトにしました")
else:
    print("❌ ヘッダーBoxが見つかりませんでした")

# 修正4: 外側3カラムBoxのoverflowをスマホ時にautoに
old_3col_box = """      <Box
        sx={{
          display: 'flex',
          gap: 0,
          flex: 1,
          overflow: 'hidden',
          flexDirection: isMobile ? 'column' : 'row',
          '@media (max-width: 900px)': {
            flexDirection: 'column',
          },
        }}
        role="region"
        aria-label="買主詳細情報の3カラムレイアウト"
      >"""

new_3col_box = """      <Box
        sx={{
          display: 'flex',
          gap: 0,
          flex: 1,
          overflow: isMobile ? 'auto' : 'hidden',
          flexDirection: isMobile ? 'column' : 'row',
          '@media (max-width: 900px)': {
            flexDirection: 'column',
          },
        }}
        role="region"
        aria-label="買主詳細情報の3カラムレイアウト"
      >"""

if old_3col_box in text:
    text = text.replace(old_3col_box, new_3col_box)
    print("✅ 3カラムBoxのoverflowをスマホ時にautoにしました")
else:
    print("❌ 3カラムBoxが見つかりませんでした")

# 修正5: 左列（通話履歴）にアコーディオンヘッダーを追加
old_left_col = """        {/* 左列: 通話履歴 + メール・SMS送信履歴 - 独立スクロール */}
        <Box
          sx={{
            flex: '0 0 18%',
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none', borderBottom: '1px solid', borderColor: 'divider' },
          }}
          role="complementary"
          aria-label="通話・メール履歴"
          tabIndex={0}
        >
          {/* 通話履歴セクション */}"""

new_left_col = """        {/* 左列: 通話履歴 + メール・SMS送信履歴 - 独立スクロール */}
        <Box
          sx={{
            flex: '0 0 18%',
            minWidth: 0,
            height: isMobile ? 'auto' : '100%',
            overflowY: isMobile ? 'visible' : 'auto',
            overflowX: 'hidden',
            borderRight: isMobile ? 'none' : '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none' },
          }}
          role="complementary"
          aria-label="通話・メール履歴"
          tabIndex={0}
        >
          {isMobile && (
            <Box
              onClick={() => setMobileCallLogOpen(!mobileCallLogOpen)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#f5f5f5', cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider', borderTop: '1px solid', borderTopColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight="bold">📞 通話・メール履歴</Typography>
              <span style={{ transform: mobileCallLogOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'inline-block' }}>▼</span>
            </Box>
          )}
          <Box sx={{ display: isMobile && !mobileCallLogOpen ? 'none' : undefined }}>
          {/* 通話履歴セクション */}"""

if old_left_col in text:
    text = text.replace(old_left_col, new_left_col)
    print("✅ 左列にアコーディオンヘッダーを追加しました")
else:
    print("❌ 左列が見つかりませんでした")

# 修正6: 左列の閉じタグの前に </Box> を追加
old_left_col_end = """        </Box>

        {/* 中央列: 物件詳細カード - 独立スクロール */}"""

new_left_col_end = """          </Box>{/* スマホ時通話履歴開閉Box */}
        </Box>

        {/* 中央列: 物件詳細カード - 独立スクロール */}"""

if old_left_col_end in text:
    text = text.replace(old_left_col_end, new_left_col_end)
    print("✅ 左列の閉じBoxタグを追加しました")
else:
    print("❌ 左列の閉じタグが見つかりませんでした")

# 修正7: 中央列（物件詳細カード）にアコーディオンヘッダーを追加
old_mid_col = """        {/* 中央列: 物件詳細カード - 独立スクロール */}
        <Box
          sx={{
            flex: '0 0 36%',
            minWidth: 0,
            height: '100%',
            overflowY: 'auto',
            overflowX: 'hidden',
            borderRight: '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none', borderBottom: '1px solid', borderColor: 'divider' },
          }}
          role="complementary"
          aria-label="物件詳細カード"
          tabIndex={0}
        >
          <Box sx={{ p: 1 }}>"""

new_mid_col = """        {/* 中央列: 物件詳細カード - 独立スクロール */}
        <Box
          sx={{
            flex: '0 0 36%',
            minWidth: 0,
            height: isMobile ? 'auto' : '100%',
            overflowY: isMobile ? 'visible' : 'auto',
            overflowX: 'hidden',
            borderRight: isMobile ? 'none' : '1px solid',
            borderColor: 'divider',
            '&::-webkit-scrollbar': { width: '6px' },
            '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0, 0, 0, 0.05)' },
            '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '3px' },
            '@media (max-width: 900px)': { flex: '1 1 auto', width: '100%', height: 'auto', overflowY: 'visible', borderRight: 'none' },
          }}
          role="complementary"
          aria-label="物件詳細カード"
          tabIndex={0}
        >
          {isMobile && (
            <Box
              onClick={() => setMobilePropertyCardOpen(!mobilePropertyCardOpen)}
              sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, bgcolor: '#e8f5e9', cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider', borderTop: '1px solid', borderTopColor: 'divider' }}
            >
              <Typography variant="subtitle2" fontWeight="bold">🏠 物件詳細カード</Typography>
              <span style={{ transform: mobilePropertyCardOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: '0.2s', display: 'inline-block' }}>▼</span>
            </Box>
          )}
          <Box sx={{ display: isMobile && !mobilePropertyCardOpen ? 'none' : undefined }}>
          <Box sx={{ p: 1 }}>"""

if old_mid_col in text:
    text = text.replace(old_mid_col, new_mid_col)
    print("✅ 中央列にアコーディオンヘッダーを追加しました")
else:
    print("❌ 中央列が見つかりませんでした")

# 修正8: 中央列の閉じタグの前に </Box> を追加
old_mid_col_end = """        </Box>

        {/* 右列: 買主情報フィールド + 関連買主 - 独立スクロール */}"""

new_mid_col_end = """          </Box>{/* スマホ時物件カード開閉Box */}
        </Box>

        {/* 右列: 買主情報フィールド + 関連買主 - 独立スクロール */}"""

if old_mid_col_end in text:
    text = text.replace(old_mid_col_end, new_mid_col_end)
    print("✅ 中央列の閉じBoxタグを追加しました")
else:
    print("❌ 中央列の閉じタグが見つかりませんでした")

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
