#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx のスマホ表示修正
- 右側コメント欄をスマホ時も表示（先頭に移動）
- 左側コンテンツはスマホ時にコメントの後に表示
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正: 右側コメント欄をスマホ時も表示し、スマホ時はfull widthで表示
# 現在: xs={6}, display: isMobile ? 'none' : undefined
# 修正後: xs={isMobile ? 12 : 6}, display: 常に表示, スマホ時はorderを先頭に
old_right_column = """          {/* 右側：統一コメント欄エリア（50%） */}
          <Grid
            item
            xs={6}
            sx={{
              height: '100%',
              overflow: 'auto',
              p: 3,
              display: isMobile ? 'none' : undefined,
            }}
          >"""

new_right_column = """          {/* 右側：統一コメント欄エリア（50%）- スマホ時は先頭に全幅表示 */}
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

if old_right_column in text:
    text = text.replace(old_right_column, new_right_column)
    print("✅ 右側コメント欄をスマホ時も表示するよう修正しました")
else:
    print("❌ 右側コメント欄が見つかりませんでした")

# 左側カラムもスマホ時はfull widthに（既にxs={isMobile ? 12 : 6}になっているはずだが確認）
# 左側のpb（ボトムパディング）をスマホ時に調整
old_left_column = """          <Grid
            item
            xs={isMobile ? 12 : 6}
            sx={{
              height: isMobile ? 'auto' : '100%',
              overflow: 'auto',
              borderRight: isMobile ? 0 : 1,
              borderColor: 'divider',
              p: isMobile ? 1 : 3,
              pb: isMobile ? '140px' : 3,
            }}
          >"""

new_left_column = """          <Grid
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

if old_left_column in text:
    text = text.replace(old_left_column, new_left_column)
    print("✅ 左側カラムのpbを調整しました")
else:
    print("❌ 左側カラムが見つかりませんでした（スキップ）")

# スマホ時のアコーディオンコメント入力を非表示にする（右側コメント欄が表示されるため重複を避ける）
old_mobile_comment_accordion = """            {/* モバイル：コメント入力エリア（fullWidth） */}
            {isMobile && (
              <Accordion defaultExpanded sx={{ mb: 1 }}>"""

new_mobile_comment_accordion = """            {/* モバイル：コメント入力エリア（右側コメント欄に統合したため非表示） */}
            {false && isMobile && (
              <Accordion defaultExpanded sx={{ mb: 1 }}>"""

if old_mobile_comment_accordion in text:
    text = text.replace(old_mobile_comment_accordion, new_mobile_comment_accordion)
    print("✅ スマホ時のアコーディオンコメントを非表示にしました（右側コメント欄に統合）")
else:
    print("❌ スマホ時のアコーディオンコメントが見つかりませんでした")

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ 全修正完了")
