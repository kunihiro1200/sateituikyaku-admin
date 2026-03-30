#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx - スマホ時のoverflowとflexを修正
外側Boxのoverflowをスマホはvisibleに、全体をスクロール可能にする
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: メインコンテンツ外側Boxのoverflowをスマホはvisibleに
old_outer = """      {/* メインコンテンツ（サイドバー + 追客ログ + 左右2分割） */}
      <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>"""

new_outer = """      {/* メインコンテンツ（サイドバー + 追客ログ + 左右2分割） */}
      <Box sx={{ flex: 1, overflow: isMobile ? 'auto' : 'hidden', display: 'flex', flexDirection: isMobile ? 'column' : 'row' }}>"""

if old_outer in text:
    text = text.replace(old_outer, new_outer)
    print("✅ 外側Boxのoverflowをスマホはautoにしました")
else:
    print("❌ 外側Boxが見つかりませんでした")

# 修正2: メインコンテンツエリアBoxのoverflowをスマホはvisibleに（二重スクロール防止）
old_inner = """        {/* メインコンテンツエリア */}
        <Box sx={{ flex: 1, overflow: isMobile ? 'auto' : 'hidden' }}>"""

new_inner = """        {/* メインコンテンツエリア */}
        <Box sx={{ flex: isMobile ? 'none' : 1, overflow: isMobile ? 'visible' : 'hidden' }}>"""

if old_inner in text:
    text = text.replace(old_inner, new_inner)
    print("✅ 内側Boxのoverflowをスマホはvisibleにしました")
else:
    print("❌ 内側Boxが見つかりませんでした")

# 修正3: サイドバーBoxのoverflowをスマホはvisibleに
old_sidebar = """        <Box sx={{ flexShrink: 0, overflow: 'auto', borderRight: isMobile ? 0 : 1, borderBottom: isMobile ? 1 : 0, borderColor: 'divider', order: isMobile ? 2 : 0 }}>"""

new_sidebar = """        <Box sx={{ flexShrink: 0, overflow: isMobile ? 'visible' : 'auto', borderRight: isMobile ? 0 : 1, borderTop: isMobile ? 1 : 0, borderColor: 'divider', order: isMobile ? 2 : 0 }}>"""

if old_sidebar in text:
    text = text.replace(old_sidebar, new_sidebar)
    print("✅ サイドバーBoxのoverflowをスマホはvisibleにしました")
else:
    print("❌ サイドバーBoxが見つかりませんでした")

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
