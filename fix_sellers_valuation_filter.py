#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SellersPage.tsx に「査定不要のみ表示」フィルターを追加するスクリプト
"""

with open('frontend/frontend/src/pages/SellersPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. showUnreachableOnly の state 宣言の後に showValuationNotRequiredOnly を追加
old_state = "  const [showUnreachableOnly, setShowUnreachableOnly] = useState(false);\n  const [showFilters, setShowFilters] = useState(false);"
new_state = "  const [showUnreachableOnly, setShowUnreachableOnly] = useState(false);\n  const [showValuationNotRequiredOnly, setShowValuationNotRequiredOnly] = useState(false);\n  const [showFilters, setShowFilters] = useState(false);"

if old_state in text:
    text = text.replace(old_state, new_state)
    print("✅ state 宣言を追加しました")
else:
    print("❌ state 宣言の挿入箇所が見つかりません")

# 2. useEffect の依存配列に showValuationNotRequiredOnly を追加
old_deps = "  }, [page, rowsPerPage, inquirySourceFilter, confidenceLevelFilter, showUnreachableOnly, selectedCategory]);"
new_deps = "  }, [page, rowsPerPage, inquirySourceFilter, confidenceLevelFilter, showUnreachableOnly, showValuationNotRequiredOnly, selectedCategory]);"

if old_deps in text:
    text = text.replace(old_deps, new_deps)
    print("✅ useEffect 依存配列を更新しました")
else:
    print("❌ useEffect 依存配列の箇所が見つかりません")

# 3. fetchSellers 内で showUnreachableOnly の後に showValuationNotRequiredOnly を追加
old_fetch = "      if (showUnreachableOnly) {\n        params.isUnreachable = true;\n      }"
new_fetch = "      if (showUnreachableOnly) {\n        params.isUnreachable = true;\n      }\n      if (showValuationNotRequiredOnly) {\n        params.valuationNotRequired = true;\n      }"

if old_fetch in text:
    text = text.replace(old_fetch, new_fetch)
    print("✅ fetchSellers にフィルター条件を追加しました")
else:
    print("❌ fetchSellers の挿入箇所が見つかりません")

# 4. フィルターエリアの「不通のみ表示」チェックボックスの後に「査定不要のみ表示」を追加
old_checkbox = """              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={showUnreachableOnly}
                    onChange={(e) => setShowUnreachableOnly(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  不通のみ表示
                </label>
              </Box>
              
              <Button
                variant="text"
                onClick={() => {
                  setInquirySourceFilter('');
                  setConfidenceLevelFilter('');
                  setShowUnreachableOnly(false);
                }}"""

new_checkbox = """              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={showUnreachableOnly}
                    onChange={(e) => setShowUnreachableOnly(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  不通のみ表示
                </label>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={showValuationNotRequiredOnly}
                    onChange={(e) => setShowValuationNotRequiredOnly(e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  査定不要のみ表示
                </label>
              </Box>
              
              <Button
                variant="text"
                onClick={() => {
                  setInquirySourceFilter('');
                  setConfidenceLevelFilter('');
                  setShowUnreachableOnly(false);
                  setShowValuationNotRequiredOnly(false);
                }}"""

if old_checkbox in text:
    text = text.replace(old_checkbox, new_checkbox)
    print("✅ チェックボックス UI を追加しました")
else:
    print("❌ チェックボックスの挿入箇所が見つかりません")

# UTF-8 で書き込み（BOMなし）
with open('frontend/frontend/src/pages/SellersPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("\n✅ SellersPage.tsx の修正が完了しました")
