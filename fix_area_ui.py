"""
BuyerDesiredConditionsPage.tsx のエリアチェックボックスUIを
コンパクトな複数列グリッドに整える
"""

filepath = 'frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx'

with open(filepath, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = """                {field.key === 'desired_area' ? (
                  <FormGroup>
                    {(field.options || []).map((opt) => {
                      const currentValues: string[] = buyer[field.key]
                        ? buyer[field.key].split(/[,、]/).map((v: string) => v.trim()).filter(Boolean)
                        : [];
                      const checked = currentValues.includes(opt.value);
                      return (
                        <FormControlLabel
                          key={opt.value}
                          control={
                            <Checkbox
                              size="small"
                              checked={checked}
                              onChange={async () => {
                                const next = checked
                                  ? currentValues.filter((v) => v !== opt.value)
                                  : [...currentValues, opt.value];
                                await handleInlineFieldSave(field.key, next.join('、'));
                              }}
                              sx={{ py: 0.3 }}
                            />
                          }
                          label={<Typography variant="body2">{opt.label}</Typography>}
                          sx={{ ml: 0 }}
                        />
                      );
                    })}
                  </FormGroup>"""

new = """                {field.key === 'desired_area' ? (
                  <Box>
                    {/* 選択済みエリアの表示 */}
                    {buyer[field.key] && (
                      <Typography variant="caption" sx={{ color: 'primary.main', display: 'block', mb: 1, fontWeight: 'bold' }}>
                        選択中: {buyer[field.key].split(/[,、]/).map((v: string) => v.trim()).filter(Boolean).length}件
                      </Typography>
                    )}
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, 1fr)',
                      gap: 0,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                    }}>
                      {(field.options || []).map((opt, idx) => {
                        const currentValues: string[] = buyer[field.key]
                          ? buyer[field.key].split(/[,、]/).map((v: string) => v.trim()).filter(Boolean)
                          : [];
                        const checked = currentValues.includes(opt.value);
                        return (
                          <Box
                            key={opt.value}
                            onClick={async () => {
                              const next = checked
                                ? currentValues.filter((v) => v !== opt.value)
                                : [...currentValues, opt.value];
                              await handleInlineFieldSave(field.key, next.join('、'));
                            }}
                            sx={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 0.5,
                              px: 1,
                              py: 0.5,
                              cursor: 'pointer',
                              bgcolor: checked ? 'primary.50' : 'transparent',
                              borderBottom: idx < (field.options || []).length - 2 ? '1px solid' : 'none',
                              borderRight: idx % 2 === 0 ? '1px solid' : 'none',
                              borderColor: 'divider',
                              '&:hover': { bgcolor: checked ? 'primary.100' : 'action.hover' },
                              transition: 'background-color 0.15s',
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={checked}
                              onChange={() => {}}
                              sx={{ p: 0, mt: 0.2, flexShrink: 0, pointerEvents: 'none' }}
                            />
                            <Typography variant="caption" sx={{ lineHeight: 1.4, color: checked ? 'primary.main' : 'text.primary', fontWeight: checked ? 'bold' : 'normal' }}>
                              {opt.label}
                            </Typography>
                          </Box>
                        );
                      })}
                    </Box>
                  </Box>"""

if old in text:
    text = text.replace(old, new, 1)
    print('✅ エリアUIを修正しました')
else:
    print('❌ パターンが見つかりませんでした')

# エリアフィールドのGrid幅をxs=12（全幅）に変更
# desired_areaはチェックボックスが多いので全幅で表示
old_grid = """          {DESIRED_CONDITIONS_FIELDS.map((field) => (
            <Grid item xs={12} sm={6} md={4} key={field.key}>"""

new_grid = """          {DESIRED_CONDITIONS_FIELDS.map((field) => (
            <Grid item xs={12} sm={field.key === 'desired_area' ? 12 : 6} md={field.key === 'desired_area' ? 12 : 4} key={field.key}>"""

if old_grid in text:
    text = text.replace(old_grid, new_grid, 1)
    print('✅ Gridサイズを修正しました')
else:
    print('❌ Gridパターンが見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

with open(filepath, 'rb') as f:
    first3 = f.read(3)
print(f'BOM check: {repr(first3)}')
