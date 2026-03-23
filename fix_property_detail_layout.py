import re

# ===== 1. PropertyListingDetailPage.tsx の zoom を修正 =====
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# zoom: '0.6' を削除し、px/py も調整
old = """    <Box sx={{ py: 2, px: 2, zoom: '0.6' }}>"""
new = """    <Box sx={{ py: 1, px: 1 }}>"""

if old in text:
    text = text.replace(old, new)
    print('✅ zoom削除・余白調整')
else:
    print('❌ zoom行が見つかりません')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

# ===== 2. PropertySidebarStatus.tsx の見出しと文字サイズを修正 =====
with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'rb') as f:
    content2 = f.read()
text2 = content2.decode('utf-8')

# 見出し「サイドバーステータス」→「カテゴリー」、文字を大きく
old2 = """      <Paper sx={{ width: 220, flexShrink: 0 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
          <Typography variant="subtitle1" fontWeight="bold">
            サイドバーステータス
          </Typography>
        </Box>
        <List dense sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>"""

new2 = """      <Paper sx={{ width: 200, flexShrink: 0 }}>
        <Box sx={{ p: 1.5, borderBottom: '1px solid #eee' }}>
          <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1rem' }}>
            カテゴリー
          </Typography>
        </Box>
        <List dense sx={{ maxHeight: 'calc(100vh - 200px)', overflow: 'auto' }}>"""

if old2 in text2:
    text2 = text2.replace(old2, new2)
    print('✅ サイドバー見出し・幅を修正')
else:
    print('❌ サイドバーPaperブロックが見つかりません')

# リストアイテムの文字サイズを大きく（body2 → body1相当）
old3 = """                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,"""
new3 = """                  primaryTypographyProps={{
                    variant: 'body2',
                    noWrap: true,
                    sx: { fontSize: '0.875rem', ...("""

# 既存のsxと競合するので別アプローチ：py を増やしてクリックしやすく
old4 = """                sx={{
                  py: 0.5,"""
new4 = """                sx={{
                  py: 0.75,"""

if old4 in text2:
    text2 = text2.replace(old4, new4)
    print('✅ リストアイテムの縦余白を調整')
else:
    print('❌ py: 0.5 が見つかりません')

with open('frontend/frontend/src/components/PropertySidebarStatus.tsx', 'wb') as f:
    f.write(text2.encode('utf-8'))

print('完了')
