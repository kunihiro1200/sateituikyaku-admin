#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx のスマホ表示修正
スマホ時に完全1列縦積みにする:
  1. コメント列（右側）
  2. 物件情報列（左側）
  3. 追客ログ列（サイドバー）
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: メインコンテンツエリアのBoxとGridをスマホ時に縦積みに
old_main_area = """        {/* メインコンテンツエリア */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
        <Grid container sx={{ height: '100%' }}>"""

new_main_area = """        {/* メインコンテンツエリア */}
        <Box sx={{ flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>
        <Grid container sx={{ height: isMobile ? 'auto' : '100%', flexDirection: isMobile ? 'column' : 'row' }}>"""

if old_main_area in text:
    text = text.replace(old_main_area, new_main_area)
    print("✅ メインコンテンツエリアをスマホ時に縦積みに修正しました")
else:
    print("❌ メインコンテンツエリアが見つかりませんでした")

# 修正2: 左側カラム（物件情報）をスマホ時にorder:1（コメントの後）
old_left_grid = """          {/* 左側：情報表示エリア（50%） */}
          <Grid
            item
            xs={isMobile ? 12 : 6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: 'auto',
              borderRight: isMobile ? 0 : 1,
              borderColor: 'divider',
              p: isMobile ? 1 : 3,
              pb: isMobile ? '80px' : 3,
            }}
          >"""

new_left_grid = """          {/* 左側：情報表示エリア（50%）- スマホ時はコメントの後（order:1） */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: isMobile ? 'visible' : 'auto',
              borderRight: isMobile ? 0 : 1,
              borderColor: 'divider',
              p: isMobile ? 1 : 3,
              pb: isMobile ? '80px' : 3,
              order: isMobile ? 1 : 0,
            }}
          >"""

if old_left_grid in text:
    text = text.replace(old_left_grid, new_left_grid)
    print("✅ 左側カラムをスマホ時にorder:1に修正しました")
else:
    print("❌ 左側カラムが見つかりませんでした")

# 修正3: 右側コメント欄をスマホ時にorder:0（最初）
old_right_grid = """          {/* 右側：統一コメント欄エリア（50%）- スマホ時は先頭に全幅表示 */}
          <Grid
            item
            xs={isMobile ? 12 : 6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: 'auto',
              p: isMobile ? 1 : 3,
              order: isMobile ? -1 : 0,
            }}
          >"""

new_right_grid = """          {/* 右側：統一コメント欄エリア（50%）- スマホ時は最初に全幅表示（order:0） */}
          <Grid
            item
            xs={12}
            md={6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: isMobile ? 'visible' : 'auto',
              p: isMobile ? 1 : 3,
              order: isMobile ? 0 : 1,
            }}
          >"""

if old_right_grid in text:
    text = text.replace(old_right_grid, new_right_grid)
    print("✅ 右側コメント欄をスマホ時にorder:0（最初）に修正しました")
else:
    print("❌ 右側コメント欄が見つかりませんでした")

# 修正4: サイドバー（追客ログ）をスマホ時にorder:2（最後）で表示
# 現在はisMobileの場合にSellerStatusSidebarのみ非表示で、追客ログ自体は非表示になっていない
# サイドバーBoxをスマホ時も表示し、order:2にする
old_sidebar_box = """      {/* メインコンテンツ（サイドバー + 追客ログ + 左右2分割） */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {/* サイドバー */}
        <Box sx={{ flexShrink: 0, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>"""

new_sidebar_box = """      {/* メインコンテンツ（サイドバー + 追客ログ + 左右2分割） */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>
        {/* サイドバー（追客ログ）- スマホ時はorder:2（最後）で表示 */}
        <Box sx={{ flexShrink: 0, overflow: 'auto', borderRight: isMobile ? 0 : 1, borderBottom: isMobile ? 1 : 0, borderColor: 'divider', order: isMobile ? 2 : 0 }}>"""

if old_sidebar_box in text:
    text = text.replace(old_sidebar_box, new_sidebar_box)
    print("✅ サイドバーをスマホ時にorder:2（最後）に修正しました")
else:
    print("❌ サイドバーBoxが見つかりませんでした")

# 修正5: サイドバー内のwidth:280をスマホ時は100%に
old_sidebar_calllog = """          {/* 売主追客ログ（一番上） */}
          <Box sx={{ width: 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <CallLogDisplay ref={callLogRef} sellerId={id!} />
          </Box>"""

new_sidebar_calllog = """          {/* 売主追客ログ（一番上） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <CallLogDisplay ref={callLogRef} sellerId={id!} />
          </Box>"""

if old_sidebar_calllog in text:
    text = text.replace(old_sidebar_calllog, new_sidebar_calllog)
    print("✅ 追客ログのwidthをスマホ時に100%に修正しました")
else:
    print("❌ 追客ログBoxが見つかりませんでした")

# 修正6: メール・SMS履歴のwidth:280をスマホ時は100%に
old_sms_history = """          {/* メール・SMS履歴（追客ログの直下） */}
          <Box sx={{ width: 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

new_sms_history = """          {/* メール・SMS履歴（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

if old_sms_history in text:
    text = text.replace(old_sms_history, new_sms_history)
    print("✅ SMS履歴のwidthをスマホ時に100%に修正しました")
else:
    print("❌ SMS履歴Boxが見つかりませんでした")

# 修正7: 過去の活動ログのwidth:280をスマホ時は100%に
old_activity_log = """          {/* 過去の活動ログ（追客ログの直下） */}
          <Box sx={{ width: 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

new_activity_log = """          {/* 過去の活動ログ（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

if old_activity_log in text:
    text = text.replace(old_activity_log, new_activity_log)
    print("✅ 活動ログのwidthをスマホ時に100%に修正しました")
else:
    print("❌ 活動ログBoxが見つかりませんでした")

# 修正8: スマホ時の固定ヘッダー（売主基本情報）を非表示に（ヘッダーに既に名前があるため）
old_mobile_sticky = """            {/* モバイル：売主基本情報固定ヘッダー */}
            {isMobile && seller && (
              <Box
                sx={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 100,
                  bgcolor: 'background.paper',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                  mb: 1,
                }}
              >"""

new_mobile_sticky = """            {/* モバイル：売主基本情報固定ヘッダー（非表示 - ヘッダーに名前があるため） */}
            {false && isMobile && seller && (
              <Box
                sx={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 100,
                  bgcolor: 'background.paper',
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                  mb: 1,
                }}
              >"""

if old_mobile_sticky in text:
    text = text.replace(old_mobile_sticky, new_mobile_sticky)
    print("✅ スマホ時の固定ヘッダーを非表示にしました")
else:
    print("❌ スマホ時の固定ヘッダーが見つかりませんでした")

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ 全修正完了")
