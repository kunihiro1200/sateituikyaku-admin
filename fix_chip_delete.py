"""
Chip に onDelete（×ボタン）を追加して選択済みエリアを削除できるようにする
"""

filepath = 'frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx'

with open(filepath, 'rb') as f:
    text = f.read().decode('utf-8')

old = """                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((val) => {
                            const opt = (field.options || []).find((o) => o.value === val);
                            return (
                              <Chip
                                key={val}
                                label={opt ? opt.label : val}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            );
                          })}
                        </Box>
                      )}"""

new = """                      renderValue={(selected) => (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {(selected as string[]).map((val) => {
                            const opt = (field.options || []).find((o) => o.value === val);
                            return (
                              <Chip
                                key={val}
                                label={opt ? opt.label : val}
                                size="small"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                                onDelete={(e) => {
                                  e.stopPropagation();
                                  const next = selectedAreas.filter((v) => v !== val);
                                  setSelectedAreas(next);
                                  handleInlineFieldSave(field.key, next.join('、'));
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                              />
                            );
                          })}
                        </Box>
                      )}"""

if old in text:
    text = text.replace(old, new, 1)
    print('✅ Chip に onDelete を追加しました')
else:
    print('❌ パターンが見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')
with open(filepath, 'rb') as f:
    print(f'BOM check: {repr(f.read(3))}')
