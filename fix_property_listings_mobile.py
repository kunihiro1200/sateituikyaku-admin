#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingsPage.tsx のスマホ表示修正
1. ヘッダーをコンパクトに
2. スマホ時にサイドバーステータスをアコーディオンで表示
3. スマホ時に担当者フィルターもアコーディオンで表示
"""

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 修正1: stateにアコーディオン開閉状態を追加
old_state = """  const [selectedPropertyNumber, setSelectedPropertyNumber] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);"""

new_state = """  const [selectedPropertyNumber, setSelectedPropertyNumber] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // スマホ時のアコーディオン開閉状態
  const [mobileStatusOpen, setMobileStatusOpen] = useState(false);
  const [mobileAssigneeOpen, setMobileAssigneeOpen] = useState(false);"""

if old_state in text:
    text = text.replace(old_state, new_state)
    print("✅ アコーディオン用stateを追加しました")
else:
    print("❌ state追加箇所が見つかりませんでした")

# 修正2: ヘッダーをコンパクトに
old_header = """      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexDirection: { xs: 'column', sm: 'row' }, gap: 2 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>物件リスト</Typography>
      </Box>"""

new_header = """      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: isMobile ? 1 : 2, flexDirection: { xs: 'row', sm: 'row' }, gap: 1 }}>
        <Typography variant={isMobile ? 'subtitle1' : 'h5'} fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>物件リスト</Typography>
        {/* スマホ時：ステータス・担当者フィルターボタン */}
        {isMobile && (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button
              size="small"
              variant={sidebarStatus && sidebarStatus !== 'all' ? 'contained' : 'outlined'}
              onClick={() => setMobileStatusOpen(!mobileStatusOpen)}
              sx={{ fontSize: '0.75rem', py: 0.5, color: sidebarStatus && sidebarStatus !== 'all' ? '#fff' : SECTION_COLORS.property.main, borderColor: SECTION_COLORS.property.main, bgcolor: sidebarStatus && sidebarStatus !== 'all' ? SECTION_COLORS.property.main : undefined }}
            >
              ステータス {mobileStatusOpen ? '▲' : '▼'}
            </Button>
            <Button
              size="small"
              variant={selectedAssignee ? 'contained' : 'outlined'}
              onClick={() => setMobileAssigneeOpen(!mobileAssigneeOpen)}
              sx={{ fontSize: '0.75rem', py: 0.5, color: selectedAssignee ? '#fff' : SECTION_COLORS.property.main, borderColor: SECTION_COLORS.property.main, bgcolor: selectedAssignee ? SECTION_COLORS.property.main : undefined }}
            >
              担当者 {mobileAssigneeOpen ? '▲' : '▼'}
            </Button>
          </Box>
        )}
      </Box>"""

if old_header in text:
    text = text.replace(old_header, new_header)
    print("✅ ヘッダーをコンパクトにしました")
else:
    print("❌ ヘッダーが見つかりませんでした")

# 修正3: サイドバーをスマホ時もアコーディオンで表示
old_sidebar = """        {/* 左サイドバー - サイドバーステータス（デスクトップのみ） */}
        <Box sx={{ display: isMobile ? 'none' : 'flex', flexDirection: 'column', gap: 2 }}>
          <PropertySidebarStatus
            listings={allListings}
            selectedStatus={sidebarStatus}
            onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); }}
          />

          {/* 担当者フィルター */}
          <Paper sx={{ width: 220, flexShrink: 0 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">担当者</Typography>
            </Box>
            <List dense sx={{ maxHeight: 'calc(50vh - 100px)', overflow: 'auto' }}>
              {assigneeList.map((item) => (
                <ListItemButton
                  key={item.key}
                  selected={selectedAssignee === item.key || (!selectedAssignee && item.key === 'all')}
                  onClick={() => { setSelectedAssignee(item.key === 'all' ? null : item.key); setPage(0); }}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
                  <Badge
                    badgeContent={item.count}
                    max={9999}
                    sx={{
                      ml: 1,
                      '& .MuiBadge-badge': {
                        backgroundColor: SECTION_COLORS.property.main,
                        color: SECTION_COLORS.property.contrastText,
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>"""

new_sidebar = """        {/* 左サイドバー - サイドバーステータス */}
        {/* スマホ時はアコーディオンで表示 */}
        {isMobile ? (
          <Box sx={{ width: '100%', mb: 1 }}>
            {mobileStatusOpen && (
              <Paper sx={{ mb: 1, p: 1 }}>
                <PropertySidebarStatus
                  listings={allListings}
                  selectedStatus={sidebarStatus}
                  onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); setMobileStatusOpen(false); }}
                />
              </Paper>
            )}
            {mobileAssigneeOpen && (
              <Paper sx={{ mb: 1 }}>
                <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {assigneeList.map((item) => (
                    <ListItemButton
                      key={item.key}
                      selected={selectedAssignee === item.key || (!selectedAssignee && item.key === 'all')}
                      onClick={() => { setSelectedAssignee(item.key === 'all' ? null : item.key); setPage(0); setMobileAssigneeOpen(false); }}
                      sx={{ py: 0.5 }}
                    >
                      <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
                      <Badge badgeContent={item.count} max={9999} sx={{ ml: 1, '& .MuiBadge-badge': { backgroundColor: SECTION_COLORS.property.main, color: SECTION_COLORS.property.contrastText } }} />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
        ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PropertySidebarStatus
            listings={allListings}
            selectedStatus={sidebarStatus}
            onStatusChange={(status) => { setSidebarStatus(status); setSearchQuery(''); setLastFilter('sidebar'); setPage(0); }}
          />

          {/* 担当者フィルター */}
          <Paper sx={{ width: 220, flexShrink: 0 }}>
            <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
              <Typography variant="subtitle1" fontWeight="bold">担当者</Typography>
            </Box>
            <List dense sx={{ maxHeight: 'calc(50vh - 100px)', overflow: 'auto' }}>
              {assigneeList.map((item) => (
                <ListItemButton
                  key={item.key}
                  selected={selectedAssignee === item.key || (!selectedAssignee && item.key === 'all')}
                  onClick={() => { setSelectedAssignee(item.key === 'all' ? null : item.key); setPage(0); }}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
                  <Badge
                    badgeContent={item.count}
                    max={9999}
                    sx={{
                      ml: 1,
                      '& .MuiBadge-badge': {
                        backgroundColor: SECTION_COLORS.property.main,
                        color: SECTION_COLORS.property.contrastText,
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>
        )}"""

if old_sidebar in text:
    text = text.replace(old_sidebar, new_sidebar)
    print("✅ サイドバーをスマホ時にアコーディオン表示にしました")
else:
    print("❌ サイドバーが見つかりませんでした")

# 修正4: メインコンテンツBoxのflexをスマホ時に縦積みに
old_main_box = """      <Box sx={{ display: 'flex', gap: 2 }}>"""

new_main_box = """      <Box sx={{ display: 'flex', gap: 2, flexDirection: isMobile ? 'column' : 'row' }}>"""

if old_main_box in text:
    text = text.replace(old_main_box, new_main_box)
    print("✅ メインBoxをスマホ時に縦積みにしました")
else:
    print("❌ メインBoxが見つかりませんでした")

with open('frontend/frontend/src/pages/PropertyListingsPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n完了")
