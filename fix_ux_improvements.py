#!/usr/bin/env python3
# 2点のUX改善:
# 1. InlineEditableField の「編集中」テキストを削除（適用済み）
# 2. BuyerDetailPage のセクション Paper に isDirty 時の背景色を追加

# ===== 2. BuyerDetailPage のセクション Paper に isDirty 背景色を追加 =====
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

old_paper = """          {BUYER_FIELD_SECTIONS.map((section) => (
            <Paper 
              key={section.title} 
              sx={{ 
                p: 2, 
                mb: 2,
                // 内覧結果グループには特別なスタイルを適用
                ...(section.isViewingResultGroup && {
                  bgcolor: 'rgba(33, 150, 243, 0.08)',  // 薄い青色の背景
                  border: '1px solid',
                  borderColor: 'rgba(46, 125, 50, 0.3)',
                }),
              }}
            >"""

new_paper = """          {BUYER_FIELD_SECTIONS.map((section) => (
            <Paper 
              key={section.title} 
              sx={{ 
                p: 2, 
                mb: 2,
                transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
                // 変更あり（未保存）のセクションは背景色で強調
                ...(sectionDirtyStates[section.title] && {
                  bgcolor: 'rgba(255, 152, 0, 0.08)',
                  boxShadow: '0 0 0 2px rgba(255, 152, 0, 0.4)',
                }),
                // 内覧結果グループには特別なスタイルを適用
                ...(section.isViewingResultGroup && {
                  bgcolor: 'rgba(33, 150, 243, 0.08)',  // 薄い青色の背景
                  border: '1px solid',
                  borderColor: 'rgba(46, 125, 50, 0.3)',
                }),
              }}
            >"""

if old_paper in text:
    text = text.replace(old_paper, new_paper)
    print('OK: セクション背景色を追加')
else:
    print('NG: パターンが見つかりません')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
