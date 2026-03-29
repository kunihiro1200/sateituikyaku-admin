#!/usr/bin/env python3
# 表示モードの「訪問日」行（visitDateの重複表示）を削除
# 「訪問予定日時」と同じデータを表示しているため不要

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 訪問情報グリッドの「訪問日 | 営担」の1行目から「訪問日」列を削除
# 「営担」だけを残す（xs=6 → xs=12に変更）
old_grid = """                        {/* 1行目: 訪問日 | 営担 */}
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                              訪問日
                            </Typography>
                            <Typography variant="body1" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                              {seller?.visitDate ? (
                                new Date(seller.visitDate).toLocaleString('ja-JP', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  weekday: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              ) : '未設定'}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                              営担
                            </Typography>
                            <Typography variant="body1" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                              {seller?.visitAssignee || seller?.assignedTo ? (
                                employees.find(e => (e.initials || e.name || e.email) === (seller.visitAssignee || seller.assignedTo))?.name || (seller.visitAssignee || seller.assignedTo)
                              ) : '未設定'}
                            </Typography>
                          </Grid>
                        </Grid>"""

new_grid = """                        {/* 1行目: 営担 */}
                        <Grid container spacing={2} sx={{ mb: 2 }}>
                          <Grid item xs={12}>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem', mb: 0.5 }}>
                              営担
                            </Typography>
                            <Typography variant="body1" sx={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                              {seller?.visitAssignee || seller?.assignedTo ? (
                                employees.find(e => (e.initials || e.name || e.email) === (seller.visitAssignee || seller.assignedTo))?.name || (seller.visitAssignee || seller.assignedTo)
                              ) : '未設定'}
                            </Typography>
                          </Grid>
                        </Grid>"""

if old_grid in text:
    text = text.replace(old_grid, new_grid)
    print('✅ 訪問日行を削除しました')
else:
    print('❌ 対象テキストが見つかりません')

with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
