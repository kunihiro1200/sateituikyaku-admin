#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
査定フィールドのUI改善スクリプト
- 各フィールドをボタン選択・数値入力・ドロップダウンに変更
- 種別=マ → 土地面積を非表示
- 種別=土 → 建物面積・リフォーム履歴・間取り・築年を非表示
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. VALUATION_FIELDS定数を削除（新しいロジックに置き換えるため不要）
old_valuation_fields = """const VALUATION_FIELDS = [
  { key: 'property_type', label: '種別' },
  { key: 'location', label: '所在地' },
  { key: 'current_status', label: '現況' },
  { key: 'land_area', label: '土地面積（不明の場合は空欄）' },
  { key: 'building_area', label: '建物面積（不明の場合は空欄）' },
  { key: 'floor_plan', label: '間取り' },
  { key: 'build_year', label: '築年（西暦）' },
  { key: 'renovation_history', label: 'リフォーム履歴（その他太陽光等も）' },
  { key: 'other_valuation_done', label: '他に査定したことある？' },
  { key: 'owner_name', label: '名義人' },
  { key: 'loan_balance', label: 'ローン残' },
  { key: 'visit_desk', label: '訪問/机上' },
  { key: 'seller_list_copy', label: '売主リストコピー' },
];"""

new_valuation_fields = """// 査定フィールドの選択肢定義
const PROPERTY_TYPE_OPTIONS = ['戸', 'マ', '土', '収益物件', '他'];
const CURRENT_STATUS_OPTIONS = ['居', '空', '賃', '他'];
const FLOOR_PLAN_OPTIONS = ['1R', '1K', '1DK', '1LDK', '2K', '2DK', '2LDK', '3K', '3DK', '3LDK', '4LDK以上'];
const VISIT_DESK_OPTIONS = ['机上査定', '訪問査定', '机上査定後訪問査定', '他'];
const SELLER_LIST_COPY_OPTIONS = ['済', '未'];"""

text = text.replace(old_valuation_fields, new_valuation_fields)

# 2. valuation_required=要の場合の13フィールドレンダリング部分を置き換え
old_render = """                          {buyer.valuation_required === '要' && VALUATION_FIELDS.map((vField) => (
                            <Grid item xs={12} key={`valuation-field-${vField.key}`}>
                              <InlineEditableField
                                label={vField.label}
                                value={buyer[vField.key] || ''}
                                fieldName={vField.key}
                                onSave={async (newValue: any) => {
                                  const result = await handleInlineFieldSave(vField.key, newValue);
                                  if (result && !result.success && result.error) {
                                    throw new Error(result.error);
                                  }
                                }}
                                onChange={(fieldName: string, newValue: any) => handleFieldChange(section.title, fieldName, newValue)}
                                buyerId={buyer_number}
                              />
                            </Grid>
                          ))}"""

new_render = """                          {buyer.valuation_required === '要' && (() => {
                            const propertyType = buyer.property_type || '';
                            const isManshon = propertyType === 'マ';
                            const isTochi = propertyType === '土';

                            // ボタン選択ヘルパー
                            const renderButtonSelect = (fieldKey: string, label: string, options: string[]) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {label}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 0.5, flex: 1 }}>
                                    {options.map((option) => {
                                      const isSelected = buyer[fieldKey] === option;
                                      return (
                                        <Button
                                          key={option}
                                          size="small"
                                          variant={isSelected ? 'contained' : 'outlined'}
                                          color="primary"
                                          onClick={async () => {
                                            const newValue = isSelected ? '' : option;
                                            handleFieldChange(section.title, fieldKey, newValue);
                                            await handleInlineFieldSave(fieldKey, newValue);
                                          }}
                                          sx={{ flex: 1, py: 0.5, fontWeight: isSelected ? 'bold' : 'normal', borderRadius: 1 }}
                                        >
                                          {option}
                                        </Button>
                                      );
                                    })}
                                  </Box>
                                </Box>
                              </Grid>
                            );

                            // 数値入力ヘルパー（－＋ボタン付き）
                            const renderNumberInput = (fieldKey: string, label: string, step: number = 1) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {label}
                                  </Typography>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                                    <TextField
                                      size="small"
                                      type="number"
                                      value={buyer[fieldKey] || ''}
                                      onChange={(e) => handleFieldChange(section.title, fieldKey, e.target.value)}
                                      onBlur={async (e) => { await handleInlineFieldSave(fieldKey, e.target.value); }}
                                      sx={{ flex: 1 }}
                                      inputProps={{ step }}
                                    />
                                    <Button size="small" variant="outlined" onClick={async () => {
                                      const cur = parseFloat(buyer[fieldKey] || '0');
                                      const newVal = String(Math.max(0, cur - step));
                                      handleFieldChange(section.title, fieldKey, newVal);
                                      await handleInlineFieldSave(fieldKey, newVal);
                                    }} sx={{ minWidth: 32, px: 0.5 }}>－</Button>
                                    <Button size="small" variant="outlined" onClick={async () => {
                                      const cur = parseFloat(buyer[fieldKey] || '0');
                                      const newVal = String(cur + step);
                                      handleFieldChange(section.title, fieldKey, newVal);
                                      await handleInlineFieldSave(fieldKey, newVal);
                                    }} sx={{ minWidth: 32, px: 0.5 }}>＋</Button>
                                  </Box>
                                </Box>
                              </Grid>
                            );

                            // テキスト入力ヘルパー
                            const renderTextInput = (fieldKey: string, label: string) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <InlineEditableField
                                  label={label}
                                  value={buyer[fieldKey] || ''}
                                  fieldName={fieldKey}
                                  onSave={async (newValue: any) => {
                                    const result = await handleInlineFieldSave(fieldKey, newValue);
                                    if (result && !result.success && result.error) {
                                      throw new Error(result.error);
                                    }
                                  }}
                                  onChange={(fn: string, nv: any) => handleFieldChange(section.title, fn, nv)}
                                  buyerId={buyer_number}
                                />
                              </Grid>
                            );

                            // ドロップダウンヘルパー
                            const renderDropdown = (fieldKey: string, label: string, options: string[]) => (
                              <Grid item xs={12} key={`valuation-field-${fieldKey}`}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {label}
                                  </Typography>
                                  <FormControl size="small" sx={{ flex: 1 }}>
                                    <Select
                                      value={buyer[fieldKey] || ''}
                                      onChange={async (e) => {
                                        handleFieldChange(section.title, fieldKey, e.target.value);
                                        await handleInlineFieldSave(fieldKey, e.target.value);
                                      }}
                                      displayEmpty
                                    >
                                      <MenuItem value=""><em>-</em></MenuItem>
                                      {options.map((opt) => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
                                    </Select>
                                  </FormControl>
                                </Box>
                              </Grid>
                            );

                            return (
                              <>
                                {renderButtonSelect('property_type', '種別', PROPERTY_TYPE_OPTIONS)}
                                {renderTextInput('location', '所在地')}
                                {renderButtonSelect('current_status', '現況', CURRENT_STATUS_OPTIONS)}
                                {!isManshon && renderNumberInput('land_area', '土地面積（不明の場合は空欄）', 0.01)}
                                {!isTochi && renderNumberInput('building_area', '建物面積（不明の場合は空欄）', 0.01)}
                                {!isTochi && renderDropdown('floor_plan', '間取り', FLOOR_PLAN_OPTIONS)}
                                {!isTochi && renderNumberInput('build_year', '築年（西暦）', 1)}
                                {!isTochi && renderTextInput('renovation_history', 'リフォーム履歴（その他太陽光等も）')}
                                {renderTextInput('other_valuation_done', '他に査定したことある？')}
                                {renderTextInput('owner_name', '名義人')}
                                {renderTextInput('loan_balance', 'ローン残')}
                                {renderButtonSelect('visit_desk', '訪問/机上', VISIT_DESK_OPTIONS)}
                                {renderButtonSelect('seller_list_copy', '売主リストコピー', SELLER_LIST_COPY_OPTIONS)}
                              </>
                            );
                          })()}"""

text = text.replace(old_render, new_render)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')

# BOM確認
with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    head = f.read(3)
print('BOM check:', repr(head))
