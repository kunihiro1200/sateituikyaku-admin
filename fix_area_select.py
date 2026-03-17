"""
desired_area の Select multiple を正しく動作させる修正
- ローカル state (selectedAreas) で即時UI更新
- API保存は非同期で行う
"""

filepath = 'frontend/frontend/src/pages/BuyerDesiredConditionsPage.tsx'

with open(filepath, 'rb') as f:
    text = f.read().decode('utf-8')

# 1. useState に selectedAreas を追加
old_state = """  const [copiedBuyerNumber, setCopiedBuyerNumber] = useState(false);"""
new_state = """  const [copiedBuyerNumber, setCopiedBuyerNumber] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);"""

if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print('✅ selectedAreas state を追加しました')
else:
    print('❌ state パターンが見つかりませんでした')

# 2. fetchBuyer で buyer をセットした後に selectedAreas も初期化
old_fetch = """      const res = await api.get(`/api/buyers/${buyer_number}`);
      setBuyer(res.data);"""
new_fetch = """      const res = await api.get(`/api/buyers/${buyer_number}`);
      setBuyer(res.data);
      // desired_area の初期値をローカル state にセット
      const areaVal = res.data?.desired_area || '';
      setSelectedAreas(areaVal ? areaVal.split(/[,、]/).map((v: string) => v.trim()).filter(Boolean) : []);"""

if old_fetch in text:
    text = text.replace(old_fetch, new_fetch, 1)
    print('✅ fetchBuyer に selectedAreas 初期化を追加しました')
else:
    print('❌ fetchBuyer パターンが見つかりませんでした')

# 3. handleInlineFieldSave で desired_area の場合は selectedAreas も更新
old_save_result = """      setBuyer(result.buyer);
      
      if (result.syncStatus === 'pending') {"""
new_save_result = """      setBuyer(result.buyer);
      // desired_area が更新された場合はローカル state も同期
      if (fieldName === 'desired_area' && result.buyer?.desired_area !== undefined) {
        const areaVal = result.buyer.desired_area || '';
        setSelectedAreas(areaVal ? areaVal.split(/[,、]/).map((v: string) => v.trim()).filter(Boolean) : []);
      }
      
      if (result.syncStatus === 'pending') {"""

if old_save_result in text:
    text = text.replace(old_save_result, new_save_result, 1)
    print('✅ handleInlineFieldSave に selectedAreas 同期を追加しました')
else:
    print('❌ handleInlineFieldSave パターンが見つかりませんでした')

# 4. Select の value と onChange を selectedAreas ベースに変更
old_select = """                  <FormControl fullWidth size="small">
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

new_select = """                  <FormControl fullWidth size="small">
                    <Select
                      multiple
                      value={selectedAreas}
                      onChange={(e) => {
                        const selected = e.target.value as string[];
                        // UIを即時更新
                        setSelectedAreas(selected);
                        // APIに非同期保存
                        handleInlineFieldSave(field.key, selected.join('、'));
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
                      {(field.options || []).map((opt) => (
                        <MenuItem key={opt.value} value={opt.value} dense>
                          <Checkbox size="small" checked={selectedAreas.includes(opt.value)} sx={{ p: 0, mr: 1 }} />
                          <Typography variant="body2">{opt.label}</Typography>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>"""

if old_select in text:
    text = text.replace(old_select, new_select, 1)
    print('✅ Select を selectedAreas ベースに修正しました')
else:
    print('❌ Select パターンが見つかりませんでした')

with open(filepath, 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

with open(filepath, 'rb') as f:
    first3 = f.read(3)
print(f'BOM check: {repr(first3)}')
