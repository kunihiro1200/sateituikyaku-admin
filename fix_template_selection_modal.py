#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
TemplateSelectionModal.tsx に物件種別フィルタリングロジックを追加するスクリプト
file-encoding-protection.md のルールに従い、UTF-8で書き込む
"""

file_path = 'frontend/frontend/src/components/TemplateSelectionModal.tsx'

with open(file_path, 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# デバッグ: 改行コードを確認
has_crlf = '\r\n' in text
print(f'CRLF: {has_crlf}')

# 1. インターフェースに propertyType?: string を追加 + filterTemplatesByPropertyType 関数を追加
old_interface = "interface TemplateSelectionModalProps {\r\n  open: boolean;\r\n  onSelect: (template: EmailTemplate) => void;\r\n  onCancel: () => void;\r\n}"

new_interface = """interface TemplateSelectionModalProps {\r\n  open: boolean;\r\n  onSelect: (template: EmailTemplate) => void;\r\n  onCancel: () => void;\r\n  propertyType?: string;\r\n}\r\n\r\n/**\r\n * \u7269\u4ef6\u7a2e\u5225\u306b\u5fdc\u3058\u3066\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u30d5\u30a3\u30eb\u30bf\u30ea\u30f3\u30b0\u3059\u308b\r\n * \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u540d\u306e\u62ec\u5f27\uff08\u5168\u89d2\u30fb\u534a\u89d2\uff09\u5185\u306e\u6587\u5b57\u5217\u3067\u5224\u5b9a\u3059\u308b\r\n */\r\nfunction filterTemplatesByPropertyType(\r\n  templates: EmailTemplate[],\r\n  propertyType?: string\r\n): EmailTemplate[] {\r\n  if (!propertyType) return templates;\r\n\r\n  // \u62ec\u5f27\u5185\u306e\u6587\u5b57\u5217\u3092\u62bd\u51fa\u3059\u308b\r\n  function extractBracketContent(name: string): string[] {\r\n    const fullWidth = name.match(/\uff08[^\uff09]*\uff09/g) || [];\r\n    const halfWidth = name.match(/\\([^)]*\\)/g) || [];\r\n    return [...fullWidth, ...halfWidth].map(m => m.slice(1, -1));\r\n  }\r\n\r\n  return templates.filter(template => {\r\n    const bracketContents = extractBracketContent(template.name);\r\n    if (bracketContents.length === 0) return true; // \u62ec\u5f27\u306a\u3057 \u2192 \u5e38\u306b\u8868\u793a\r\n\r\n    const allContent = bracketContents.join('');\r\n\r\n    // \u6238\u5efa\u3066\r\n    if (propertyType === '\u6238' || propertyType === '\u6238\u5efa\u3066') {\r\n      return !allContent.includes('\u571f');\r\n    }\r\n    // \u571f\u5730\r\n    if (propertyType === '\u571f') {\r\n      return !allContent.includes('\u6238') && !allContent.includes('\u30de');\r\n    }\r\n    // \u30de\u30f3\u30b7\u30e7\u30f3\r\n    if (propertyType === '\u30de' || propertyType === '\u30de\u30f3\u30b7\u30e7\u30f3') {\r\n      return !allContent.includes('\u571f');\r\n    }\r\n\r\n    return true; // \u4e0a\u8a18\u4ee5\u5916\u306e\u7a2e\u5225 \u2192 \u5168\u8868\u793a\r\n  });\r\n}"""

if old_interface in text:
    text = text.replace(old_interface, new_interface)
    print('Interface replacement: SUCCESS')
else:
    print('Interface replacement: FAILED - pattern not found')
    # デバッグ用に実際のテキストを表示
    idx = text.find('interface TemplateSelectionModalProps')
    print(repr(text[idx:idx+300]))

# 2. コンポーネント関数の引数に propertyType を追加
old_args = "export default function TemplateSelectionModal({\r\n  open,\r\n  onSelect,\r\n  onCancel\r\n}: TemplateSelectionModalProps) {"

new_args = "export default function TemplateSelectionModal({\r\n  open,\r\n  onSelect,\r\n  onCancel,\r\n  propertyType\r\n}: TemplateSelectionModalProps) {"

if old_args in text:
    text = text.replace(old_args, new_args)
    print('Args replacement: SUCCESS')
else:
    print('Args replacement: FAILED - pattern not found')

# 3. filteredTemplates の定義を追加
old_handle = "  // \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u30af\u30ea\u30c3\u30af\u3057\u305f\u3089\u5373\u5ea7\u306b\u30e1\u30fc\u30eb\u7de8\u96c6\u753b\u9762\u3078\r\n  const handleTemplateClick = (template: EmailTemplate) => {\r\n    onSelect(template);\r\n  };"

new_handle = "  // \u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u3092\u30af\u30ea\u30c3\u30af\u3057\u305f\u3089\u5373\u5ea7\u306b\u30e1\u30fc\u30eb\u7de8\u96c6\u753b\u9762\u3078\r\n  const handleTemplateClick = (template: EmailTemplate) => {\r\n    onSelect(template);\r\n  };\r\n\r\n  // \u7269\u4ef6\u7a2e\u5225\u3067\u30d5\u30a3\u30eb\u30bf\u30ea\u30f3\u30b0\u3057\u305f\u30c6\u30f3\u30d7\u30ec\u30fc\u30c8\u4e00\u89a7\r\n  const filteredTemplates = filterTemplatesByPropertyType(templates, propertyType);"

if old_handle in text:
    text = text.replace(old_handle, new_handle)
    print('Handle replacement: SUCCESS')
else:
    print('Handle replacement: FAILED - pattern not found')
    idx = text.find('handleTemplateClick')
    print(repr(text[max(0,idx-50):idx+200]))

# UTF-8で書き込む（BOMなし）
with open(file_path, 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! TemplateSelectionModal.tsx updated successfully.')

# BOMチェック
with open(file_path, 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (should NOT be b"\\xef\\xbb\\xbf")')
