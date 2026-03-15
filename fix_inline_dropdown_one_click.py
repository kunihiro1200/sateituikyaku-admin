#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
InlineEditableField.tsx のドロップダウンをワンクリックで開くように修正
"""

with open('frontend/frontend/src/components/InlineEditableField.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. useState に selectOpen を追加
old_state = "  const [isHovered, setIsHovered] = useState(false);"
new_state = """  const [isHovered, setIsHovered] = useState(false);
  const [selectOpen, setSelectOpen] = useState(false);"""
text = text.replace(old_state, new_state)

# 2. handleClick でドロップダウン型の場合は selectOpen=true にする
old_click = """  // Handle click to activate edit mode
  const handleClick = () => {
    if (isEditable && !isEditing) {
      startEdit();
    }
  };"""
new_click = """  // Handle click to activate edit mode
  const handleClick = () => {
    if (isEditable && !isEditing) {
      startEdit();
      // ドロップダウン型はクリック即座にプルダウンを開く
      if (fieldType === 'dropdown') {
        setSelectOpen(true);
      }
    }
  };"""
text = text.replace(old_click, new_click)

# 3. Select コンポーネントに open/onClose を追加（カテゴリなしの場合）
old_select = """        return (
          <FormControl fullWidth size="small" sx={{ mt: 0.5 }} error={!!error}>
            <Select
              value={editValue ?? ''}
              onChange={(e) => updateValue(e.target.value)}
              onBlur={handleBlur}
              disabled={isSaving}
            >"""
new_select = """        return (
          <FormControl fullWidth size="small" sx={{ mt: 0.5 }} error={!!error}>
            <Select
              value={editValue ?? ''}
              onChange={(e) => { updateValue(e.target.value); setSelectOpen(false); }}
              onBlur={handleBlur}
              disabled={isSaving}
              open={selectOpen}
              onOpen={() => setSelectOpen(true)}
              onClose={() => setSelectOpen(false)}
            >"""
text = text.replace(old_select, new_select)

# 4. Autocomplete（カテゴリあり）にも autoFocus を追加
old_autocomplete = """          return (
            <Autocomplete
              fullWidth
              size="small"
              options={options}
              groupBy={(option) => option.category || ''}
              getOptionLabel={(option) => option.label}
              value={options.find(opt => opt.value === editValue) || null}
              onChange={(_, newValue) => updateValue(newValue?.value || '')}
              onBlur={handleBlur}
              disabled={isSaving}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={placeholder || '選択してください'}
                  error={!!error}
                  helperText={error}
                  sx={{ mt: 0.5 }}
                />
              )}"""
new_autocomplete = """          return (
            <Autocomplete
              fullWidth
              size="small"
              options={options}
              groupBy={(option) => option.category || ''}
              getOptionLabel={(option) => option.label}
              value={options.find(opt => opt.value === editValue) || null}
              onChange={(_, newValue) => updateValue(newValue?.value || '')}
              onBlur={handleBlur}
              disabled={isSaving}
              open={selectOpen}
              onOpen={() => setSelectOpen(true)}
              onClose={() => setSelectOpen(false)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={placeholder || '選択してください'}
                  error={!!error}
                  helperText={error}
                  sx={{ mt: 0.5 }}
                  autoFocus
                />
              )}"""
text = text.replace(old_autocomplete, new_autocomplete)

with open('frontend/frontend/src/components/InlineEditableField.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! InlineEditableField.tsx updated for one-click dropdown.')
