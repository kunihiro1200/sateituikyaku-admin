"""
desired_area を MUI Select multiple (ドロップダウン複数選択) に変更する
"""

filepath = 'frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx'

with open(filepath, 'rb') as f:
    text = f.read().decode('utf-8')

# 1. import を更新: FormControlLabel, FormGroup を削除し Select, MenuItem, OutlinedInput, Chip を追加
old_imports = """import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  IconButton,
  Alert,
  Snackbar,
  Tooltip,
  Checkbox,
  FormControlLabel,
  FormGroup,
} from '@mui/material';"""

new_imports = """import {
  Container,
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  IconButton,
  Alert,
  Snackbar,
  Tooltip,
  Checkbox,
  Select,
  MenuItem,
  OutlinedInput,
  Chip,
  FormControl,
} from '@mui/material';"""

if old_imports in text:
    text = text.replace(old_imports, new_imports, 1)
    print('✅ importを更新しました')
else:
    print('❌ importパターンが見つかりませんでした')

# 2. desired_area の Grid 幅を通常サイズに戻す（ドロップダウンなら全幅不要）
old_grid = """            <Grid item xs={12} sm={field.key === 'desired_area' ? 12 : 6} md={field.key === 'desired_area' ? 12 : 4} key={field.key}>"""
new_grid = """            <Grid item xs={12} sm={6} md={4} key={field.key}>"""

if old_grid in text:
    text = text.replace(old_grid, new_grid, 1)
    print('✅ Gridサイズを通常に戻しました')
else:
    print('❌ Gridパターンが見つかりませんでした')

# 3. desired_area の UI をドロップダウン複数選択に置き換え
old_area_ui = """                {field.key === 'desired_area' ? (
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

new_area_ui = """                {field.key === 'desired_area' ? (
                  <FormControl fullWidth size="small">
                    <Select
                      multiple
                      value={
                        buyer[field.key]
                          ? buyer[field.key].split(/[,、]/).map((v: string) => v.trim()).filter(Boolean)
                          : []
                      }
                      onChange={async (e) => {
                        const selected = e.target.value as string[];
                        await handleInlineFieldSave(field.key, selected.join('、'));
                      }}
                      input={<OutlinedInput />}
                      renderValue={(selected) => (
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
                      )}
                      MenuProps={{ PaperProps: { style: { maxHeight: 400 } } }}
                    >
                      {(field.options || []).map((opt) => {
                        const currentValues: string[] = buyer[field.key]
                          ? buyer[field.key].split(/[,、]/).map((v: string) => v.trim()).filter(Boolean)
                          : [];
                        return (
                          <MenuItem key={opt.value} value={opt.value} dense>
                            <Checkbox size="small" checked={currentValues.includes(opt.value)} sx={{ p: 0, mr: 1 }} />
                            <Typography variant="body2">{opt.label}</Typography>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>"""

if old_area_ui in text:
    text = text.replace(old_area_ui, new_area_ui, 1)
    print('✅ エリアUIをドロップダウン複数選択に変更しました')
else:
    print('❌ エリアUIパターンが見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

with open(filepath, 'rb') as f:
    first3 = f.read(3)
print(f'BOM check: {repr(first3)}')
