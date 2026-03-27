# 確度フィールドをInlineEditableFieldからSelectに変更
# ステータスを更新ボタンで保存するように統一

with open('frontend/frontend/src/pages/CallModePage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

old = '''                {/* 確度 - 1行全幅 */}
                <Grid item xs={12}>
                  <InlineEditableField
                    label="確度"
                    value={seller?.confidence || 'B'}
                    fieldName="confidence"
                    fieldType="dropdown"
                    options={CONFIDENCE_OPTIONS}
                    onSave={async (newValue) => {
                      await api.put(`/api/sellers/${id}`, {
                        confidence: newValue,
                      });
                      // ローカル状態を更新
                      setSeller(prev => prev ? { ...prev, confidence: newValue } : prev);
                      setEditedConfidence(newValue as ConfidenceLevel);
                      // 確度は即時保存のためstatusChangedは変更しない
                    }}
                    buyerId={id}
                    enableConflictDetection={true}
                    showEditIndicator={true}
                    oneClickDropdown={true}
                  />
                </Grid>'''

new = '''                {/* 確度 - 1行全幅 */}
                <Grid item xs={12}>
                  <FormControl fullWidth size="small">
                    <InputLabel>確度</InputLabel>
                    <Select
                      value={editedConfidence}
                      label="確度"
                      onChange={(e) => { setEditedConfidence(e.target.value as ConfidenceLevel); setStatusChanged(true); }}
                    >
                      {CONFIDENCE_OPTIONS.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>'''

if old in text:
    text = text.replace(old, new)
    with open('frontend/frontend/src/pages/CallModePage.tsx', 'wb') as f:
        f.write(text.encode('utf-8'))
    print('Done!')
else:
    print('ERROR: target not found')
    idx = text.find('確度 - 1行全幅')
    if idx >= 0:
        print(repr(text[idx:idx+200]))
