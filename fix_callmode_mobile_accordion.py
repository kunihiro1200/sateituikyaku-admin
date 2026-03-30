#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CallModePage.tsx のスマホ表示修正
スマホ時のメインコンテンツ全体をアコーディオン3つに置き換え:
  1. 📝 コメント（デフォルト展開）
  2. 📍 物件情報
  3. 📞 追客ログ
"""

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: サイドバーBoxをスマホ時にアコーディオンでラップ
# サイドバー全体（追客ログ・SMS履歴・活動ログ）をスマホ時はAccordionに
old_sidebar_start = """        {/* サイドバー（追客ログ）- スマホ時はorder:2（最後）で表示 */}
        <Box sx={{ flexShrink: 0, overflow: 'auto', borderRight: isMobile ? 0 : 1, borderBottom: isMobile ? 1 : 0, borderColor: 'divider', order: isMobile ? 2 : 0 }}>
          {/* 売主追客ログ（一番上） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <CallLogDisplay ref={callLogRef} sellerId={id!} />
          </Box>"""

new_sidebar_start = """        {/* サイドバー（追客ログ）- スマホ時はアコーディオン、PCは固定サイドバー */}
        {isMobile ? (
          <Box sx={{ order: 2, borderTop: 1, borderColor: 'divider' }}>
            <Accordion defaultExpanded={false} disableGutters>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f5f5f5', minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                <Typography variant="subtitle2" fontWeight="bold">📞 追客ログ</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 1 }}>
                <CallLogDisplay ref={callLogRef} sellerId={id!} />
              </AccordionDetails>
            </Accordion>
          </Box>
        ) : (
        <Box sx={{ flexShrink: 0, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>
          {/* 売主追客ログ（一番上） */}
          <Box sx={{ width: 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>
            <CallLogDisplay ref={callLogRef} sellerId={id!} />
          </Box>"""

if old_sidebar_start in text:
    text = text.replace(old_sidebar_start, new_sidebar_start)
    print("✅ サイドバー開始部分をアコーディオンに修正しました")
else:
    print("❌ サイドバー開始部分が見つかりませんでした")

# 修正2: サイドバーBoxの閉じタグの前にPC用の閉じタグを追加
# カテゴリー（SellerStatusSidebar）の後の閉じタグを修正
old_sidebar_end = """          {/* カテゴリー（一番下） */}
          {!isMobile && (
            <Box data-testid="seller-status-sidebar">
              <SellerStatusSidebar
                currentSeller={seller}
                isCallMode={true}
                sellers={sidebarSellers}
                loading={sidebarLoading}
                categoryCounts={{
                  all: sidebarSellers.length,
                  ...sidebarCounts,
                }}
                selectedCategory={selectedCategory}
                selectedVisitAssignee={selectedVisitAssignee}
                onCategorySelect={handleCategorySelect}
              />
            </Box>
          )}
        </Box>"""

new_sidebar_end = """          {/* カテゴリー（一番下） */}
          <Box data-testid="seller-status-sidebar">
            <SellerStatusSidebar
              currentSeller={seller}
              isCallMode={true}
              sellers={sidebarSellers}
              loading={sidebarLoading}
              categoryCounts={{
                all: sidebarSellers.length,
                ...sidebarCounts,
              }}
              selectedCategory={selectedCategory}
              selectedVisitAssignee={selectedVisitAssignee}
              onCategorySelect={handleCategorySelect}
            />
          </Box>
        </Box>
        )}"""

if old_sidebar_end in text:
    text = text.replace(old_sidebar_end, new_sidebar_end)
    print("✅ サイドバー終了部分を修正しました")
else:
    print("❌ サイドバー終了部分が見つかりませんでした")

# 修正3: SMS履歴のwidthをPC時のみ280に戻す
old_sms_width = """          {/* メール・SMS履歴（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

new_sms_width = """          {/* メール・SMS履歴（追客ログの直下） */}
          <Box sx={{ width: 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

if old_sms_width in text:
    text = text.replace(old_sms_width, new_sms_width)
    print("✅ SMS履歴のwidthをPC用に戻しました")
else:
    print("❌ SMS履歴Boxが見つかりませんでした")

# 修正4: 活動ログのwidthをPC時のみ280に戻す
old_activity_width = """          {/* 過去の活動ログ（追客ログの直下） */}
          <Box sx={{ width: isMobile ? '100%' : 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

new_activity_width = """          {/* 過去の活動ログ（追客ログの直下） */}
          <Box sx={{ width: 280, p: 2, borderBottom: 1, borderColor: 'divider' }}>"""

if old_activity_width in text:
    text = text.replace(old_activity_width, new_activity_width)
    print("✅ 活動ログのwidthをPC用に戻しました")
else:
    print("❌ 活動ログBoxが見つかりませんでした")

# 修正5: 右側コメント欄をスマホ時はアコーディオンでラップ
old_right_grid = """          {/* 右側：統一コメント欄エリア（50%）- スマホ時は最初に全幅表示（order:0） */}
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

new_right_grid = """          {/* 右側：統一コメント欄エリア（50%）- スマホ時はアコーディオン（order:0） */}
          {isMobile ? (
            <Box sx={{ order: 0, borderBottom: 1, borderColor: 'divider' }}>
              <Accordion defaultExpanded={true} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f5f5f5', minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                  <Typography variant="subtitle2" fontWeight="bold">📝 コメント</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 1 }}>
          <Grid
            item
            xs={12}
            sx={{
              p: 0,
            }}
          >"""

if old_right_grid in text:
    text = text.replace(old_right_grid, new_right_grid)
    print("✅ 右側コメント欄をアコーディオンでラップしました")
else:
    print("❌ 右側コメント欄が見つかりませんでした")

# 修正6: 右側コメント欄のGridの閉じタグの後にアコーディオンの閉じタグを追加
# 右側Gridの終わりを探す（左側Gridの前）
old_right_grid_end = """          </Grid>

          {/* 左側：情報表示エリア（50%）- スマホ時はコメントの後（order:1） */}"""

new_right_grid_end = """          </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
          ) : (
          <Grid
            item
            md={6}
            sx={{
              height: '100%',
              overflow: 'auto',
              p: 3,
              order: 1,
            }}
          >"""

if old_right_grid_end in text:
    text = text.replace(old_right_grid_end, new_right_grid_end)
    print("✅ 右側コメント欄の閉じタグを修正しました")
else:
    print("❌ 右側コメント欄の閉じタグが見つかりませんでした")

# 修正7: 左側カラム（物件情報）をスマホ時はアコーディオンでラップ
old_left_grid = """          {/* 左側：情報表示エリア（50%）- スマホ時はコメントの後（order:1） */}
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

new_left_grid = """          {/* 左側：情報表示エリア（50%）- スマホ時はアコーディオン（order:1） */}
          {isMobile ? (
            <Box sx={{ order: 1, borderBottom: 1, borderColor: 'divider' }}>
              <Accordion defaultExpanded={false} disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f5f5f5', minHeight: 44, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
                  <Typography variant="subtitle2" fontWeight="bold">📍 物件情報・売主情報</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 1, pb: '80px' }}>
          <Grid
            item
            xs={12}
            sx={{
              p: 0,
            }}
          >"""

if old_left_grid in text:
    text = text.replace(old_left_grid, new_left_grid)
    print("✅ 左側カラムをアコーディオンでラップしました")
else:
    print("❌ 左側カラムが見つかりませんでした")

# 修正8: 左側カラムのGridの閉じタグの後にアコーディオンの閉じタグを追加
# 左側Gridの終わり（右側Gridの前）を探す
old_left_grid_end = """          </Grid>

          {/* 右側：統一コメント欄エリア（50%）- スマホ時はアコーディオン（order:0） */}"""

new_left_grid_end = """          </Grid>
                </AccordionDetails>
              </Accordion>
            </Box>
          ) : (
          <Grid
            item
            md={6}
            sx={{
              height: '100%',
              overflow: 'auto',
              borderRight: 1,
              borderColor: 'divider',
              p: 3,
              order: 0,
            }}
          >"""

if old_left_grid_end in text:
    text = text.replace(old_left_grid_end, new_left_grid_end)
    print("✅ 左側カラムの閉じタグを修正しました")
else:
    print("❌ 左側カラムの閉じタグが見つかりませんでした")

# 修正9: Grid containerの最後の閉じタグを修正（PC用の閉じタグを追加）
old_grid_container_end = """        </Grid>
        </Box>

      {/* 削除確認ダイアログ */}"""

new_grid_container_end = """          </Grid>
          </Grid>
        </Box>

      {/* 削除確認ダイアログ */}"""

if old_grid_container_end in text:
    text = text.replace(old_grid_container_end, new_grid_container_end)
    print("✅ Grid containerの閉じタグを修正しました")
else:
    print("❌ Grid containerの閉じタグが見つかりませんでした")

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
