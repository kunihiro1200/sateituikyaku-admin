#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
InlineEditableField.tsx に time 型を追加する
"""

with open('frontend/frontend/src/components/InlineEditableField.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. fieldType の型定義に 'time' を追加
old_type = "fieldType: 'text' | 'email' | 'phone' | 'date' | 'dropdown' | 'textarea' | 'number';"
new_type = "fieldType: 'text' | 'email' | 'phone' | 'date' | 'time' | 'dropdown' | 'textarea' | 'number';"

if old_type in text:
    text = text.replace(old_type, new_type)
    print('✅ fieldType型定義に time を追加')
else:
    print('❌ fieldType型定義が見つかりません')

# 2. switch文の case 'date': の前に case 'time': を追加
old_case = """      case 'date':
        return (
          <TextField
            {...commonProps}
            type="date"
            InputLabelProps={{ shrink: true }}
          />
        );"""

new_case = """      case 'time':
        return (
          <TextField
            {...commonProps}
            type="time"
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 300 }}
          />
        );

      case 'date':
        return (
          <TextField
            {...commonProps}
            type="date"
            InputLabelProps={{ shrink: true }}
          />
        );"""

if old_case in text:
    text = text.replace(old_case, new_case)
    print('✅ case time を追加')
else:
    print('❌ case date が見つかりません')

with open('frontend/frontend/src/components/InlineEditableField.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
