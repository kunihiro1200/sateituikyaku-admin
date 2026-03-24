#!/usr/bin/env python3
# SectionSaveButton の配置を修正する（UTF-8安全）
# 「問合せ内容」セクションのみ：ヘッダーから外し、initial_assignee の右横に配置
# 「基本情報」「その他」：ヘッダー右上のまま

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. セクションヘッダーを変更：
#    「問合せ内容」以外のセクションのみ SectionSaveButton を表示するよう条件追加
old_section_header = """              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography 
                  variant="h6" 
                  sx={{
                    // 内覧結果グループのタイトルを強調
                    ...(section.isViewingResultGroup && {
                      color: 'success.main',
                      fontWeight: 'bold',
                    }),
                  }}
                >
                  {section.title}
                </Typography>
                <SectionSaveButton
                  isDirty={sectionDirtyStates[section.title] || false}
                  isSaving={sectionSavingStates[section.title] || false}
                  onSave={() => handleSectionSave(section.title)}
                />
              </Box>"""

new_section_header = """              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography 
                  variant="h6" 
                  sx={{
                    // 内覧結果グループのタイトルを強調
                    ...(section.isViewingResultGroup && {
                      color: 'success.main',
                      fontWeight: 'bold',
                    }),
                  }}
                >
                  {section.title}
                </Typography>
                {/* 「問合せ内容」以外のセクションはヘッダー右上に保存ボタンを表示 */}
                {section.title !== '問合せ内容' && (
                  <SectionSaveButton
                    isDirty={sectionDirtyStates[section.title] || false}
                    isSaving={sectionSavingStates[section.title] || false}
                    onSave={() => handleSectionSave(section.title)}
                  />
                )}
              </Box>"""

text = text.replace(old_section_header, new_section_header)

# 2. initial_assignee フィールドの右横に保存ボタンを追加
#    ラベル行を Box で囲み、右端に SectionSaveButton を配置
old_initial_assignee = """                    // initial_assigneeフィールドは特別処理（ボックス選択）
                    if (field.key === 'initial_assignee') {
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            {field.label}
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>"""

new_initial_assignee = """                    // initial_assigneeフィールドは特別処理（ボックス選択）
                    if (field.key === 'initial_assignee') {
                      return (
                        <Grid item xs={12} key={`${section.title}-${field.key}`}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                            <Typography variant="caption" color="text.secondary">
                              {field.label}
                            </Typography>
                            {/* 「問合せ内容」セクションの保存ボタンは初動担当の右横に配置 */}
                            {section.title === '問合せ内容' && (
                              <SectionSaveButton
                                isDirty={sectionDirtyStates[section.title] || false}
                                isSaving={sectionSavingStates[section.title] || false}
                                onSave={() => handleSectionSave(section.title)}
                              />
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>"""

text = text.replace(old_initial_assignee, new_initial_assignee)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# 検証
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    result = f.read().decode('utf-8')

checks = [
    ('問合せ内容 条件分岐', "section.title !== '問合せ内容'"),
    ('initial_assignee 右横の保存ボタン', "section.title === '問合せ内容'"),
    ('SectionSaveButton 使用数', None),
]

for name, pattern in checks:
    if pattern is None:
        count = result.count('<SectionSaveButton')
        print(f'  SectionSaveButton 使用数: {count}件（期待値: 3件）')
    elif pattern in result:
        print(f'  OK {name}')
    else:
        print(f'  NG {name} - NOT FOUND')
