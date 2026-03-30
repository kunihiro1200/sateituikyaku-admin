#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx のスマホ表示修正
1. ヘッダーの高さを低くする（名前フォントサイズ縮小、flexWrap追加）
2. スマホ時のヘッダーをコンパクトに
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: ヘッダーBoxのスタイルをスマホ対応に
# 現在: p: 1.5, display: flex, alignItems: center, justifyContent: space-between
# 修正後: スマホ時はpyを小さく、flexWrapを追加
old_header_box = """      {/* ヘッダー */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.paper',
        }}
      >"""

new_header_box = """      {/* ヘッダー */}
      <Box
        sx={{
          px: 1,
          py: isMobile ? 0.5 : 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          bgcolor: 'background.paper',
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          gap: isMobile ? 0.5 : 0,
          minHeight: isMobile ? 0 : undefined,
        }}
      >"""

if old_header_box in text:
    text = text.replace(old_header_box, new_header_box)
    print("✅ ヘッダーBoxのスタイルを修正しました")
else:
    print("❌ ヘッダーBoxが見つかりませんでした")

# 修正2: 名前のTypographyをスマホ時に小さく
old_name_typography = """            <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.seller.main }}>{seller?.name || '読み込み中...'}</Typography>"""

new_name_typography = """            <Typography
                variant={isMobile ? 'body1' : 'h5'}
                fontWeight="bold"
                sx={{ color: SECTION_COLORS.seller.main, fontSize: isMobile ? '0.95rem' : undefined }}
              >{seller?.name || '読み込み中...'}</Typography>"""

if old_name_typography in text:
    text = text.replace(old_name_typography, new_name_typography)
    print("✅ 名前のTypographyを修正しました")
else:
    print("❌ 名前のTypographyが見つかりませんでした")

# 修正3: ヘッダー内の左側Boxをスマホ時にコンパクトに
old_left_box = """        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button startIcon={<ArrowBack />} onClick={() => {"""

new_left_box = """        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 2, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          <Button startIcon={<ArrowBack />} size={isMobile ? 'small' : 'medium'} onClick={() => {"""

if old_left_box in text:
    text = text.replace(old_left_box, new_left_box)
    print("✅ 左側Boxのスタイルを修正しました")
else:
    print("❌ 左側Boxが見つかりませんでした")

# 修正4: 査定額エリアをスマホ時に非表示
old_valuation_box = """        {/* 査定額表示（中央） */}
        {/* 優先順位: 1. valuationText（I列テキスト）がある場合はそれを表示 */}
        {/*          2. 手入力または自動計算の数値査定額がある場合はそれを表示 */}
        {/*          3. どちらもない場合は「査定額未設定」 */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mx: 2 }}>"""

new_valuation_box = """        {/* 査定額表示（中央）- スマホ時は非表示 */}
        {/* 優先順位: 1. valuationText（I列テキスト）がある場合はそれを表示 */}
        {/*          2. 手入力または自動計算の数値査定額がある場合はそれを表示 */}
        {/*          3. どちらもない場合は「査定額未設定」 */}
        <Box sx={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', alignItems: 'center', mx: 2 }}>"""

if old_valuation_box in text:
    text = text.replace(old_valuation_box, new_valuation_box)
    print("✅ 査定額エリアをスマホ時に非表示にしました")
else:
    print("❌ 査定額エリアが見つかりませんでした")

# 修正5: 訪問ボタンをスマホ時にコンパクトに
old_visit_button = """          <Button
            startIcon={<CalendarToday />}
            onClick={scrollToAppointmentSection}
            variant="outlined"
            sx={{ 
              ml: 2,
              borderColor: SECTION_COLORS.seller.main,
              color: SECTION_COLORS.seller.main,
              '&:hover': {
                borderColor: SECTION_COLORS.seller.dark,
                backgroundColor: `${SECTION_COLORS.seller.main}15`,
              }
            }}
            title="訪問セクションへ"
          >
            訪問
          </Button>"""

new_visit_button = """          <Button
            startIcon={<CalendarToday />}
            onClick={scrollToAppointmentSection}
            variant="outlined"
            size={isMobile ? 'small' : 'medium'}
            sx={{ 
              ml: isMobile ? 0 : 2,
              borderColor: SECTION_COLORS.seller.main,
              color: SECTION_COLORS.seller.main,
              '&:hover': {
                borderColor: SECTION_COLORS.seller.dark,
                backgroundColor: `${SECTION_COLORS.seller.main}15`,
              }
            }}
            title="訪問セクションへ"
          >
            訪問
          </Button>"""

if old_visit_button in text:
    text = text.replace(old_visit_button, new_visit_button)
    print("✅ 訪問ボタンをスマホ時にコンパクトにしました")
else:
    print("❌ 訪問ボタンが見つかりませんでした")

# 修正6: 近隣買主ボタンをスマホ時にコンパクトに
old_nearby_button = """              sx={{ ml: 1, fontWeight: 'bold' }}
              title="近隣買主を別ページで表示"
            >
              近隣買主
            </Button>"""

new_nearby_button = """              size={isMobile ? 'small' : 'medium'}
              sx={{ ml: isMobile ? 0 : 1, fontWeight: 'bold' }}
              title="近隣買主を別ページで表示"
            >
              近隣買主
            </Button>"""

if old_nearby_button in text:
    text = text.replace(old_nearby_button, new_nearby_button)
    print("✅ 近隣買主ボタンをスマホ時にコンパクトにしました")
else:
    print("❌ 近隣買主ボタンが見つかりませんでした")

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ 全修正完了")
