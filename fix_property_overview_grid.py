with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()
text = content.decode('utf-8')

# 物件概要セクションのGridをコンパクトに
# spacing={2} → spacing={1}、各Gridアイテムを md={2} に変更して1行6列
# また p: 2 → p: 1.5 でPaperの余白も少し詰める

# Paper の余白を少し詰める
old1 = """      <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold">物件概要</Typography>"""
new1 = """      <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#f5f5f5' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="bold">物件概要</Typography>"""

if old1 in text:
    text = text.replace(old1, new1)
    print('✅ Paper余白を調整')
else:
    print('❌ Paper余白の対象が見つかりません')

# Grid container spacing={2} → spacing={1}
old2 = """        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">所在地</Typography>"""
new2 = """        <Grid container spacing={1}>
          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">所在地</Typography>"""

if old2 in text:
    text = text.replace(old2, new2)
    print('✅ 所在地Grid修正')
else:
    print('❌ 所在地Gridが見つかりません')

# 売主氏名
old3 = """          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">売主氏名</Typography>"""
new3 = """          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">売主氏名</Typography>"""

if old3 in text:
    text = text.replace(old3, new3)
    print('✅ 売主氏名Grid修正')
else:
    print('❌ 売主氏名Gridが見つかりません')

# ATBB状況
old4 = """          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">ATBB状況</Typography>"""
new4 = """          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">ATBB状況</Typography>"""

if old4 in text:
    text = text.replace(old4, new4)
    print('✅ ATBB状況Grid修正')
else:
    print('❌ ATBB状況Gridが見つかりません')

# 種別
old5 = """          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>"""
new5 = """          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">種別</Typography>"""

if old5 in text:
    text = text.replace(old5, new5)
    print('✅ 種別Grid修正')
else:
    print('❌ 種別Gridが見つかりません')

# 現況
old6 = """          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">現況</Typography>"""
new6 = """          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">現況</Typography>"""

if old6 in text:
    text = text.replace(old6, new6)
    print('✅ 現況Grid修正')
else:
    print('❌ 現況Gridが見つかりません')

# 担当
old7 = """          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">担当</Typography>"""
new7 = """          <Grid item xs={6} sm={4} md={2}>
            <Typography variant="body2" color="text.secondary" fontWeight="bold">担当</Typography>"""

if old7 in text:
    text = text.replace(old7, new7)
    print('✅ 担当Grid修正')
else:
    print('❌ 担当Gridが見つかりません')

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
