#!/usr/bin/env python3
# -*- coding: utf-8 -*-
with open('frontend/frontend/src/components/BuyerFilterSummaryModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. handleToggle の後に handleSelectAll / handleDeselectAll を追加
old_handle = """  const handleConfirm = () => {
    onConfirm(Array.from(selectedEmails));
  };"""

new_handle = """  const handleSelectAll = () => {
    const qualifiedEmails = qualifiedBuyers
      .filter(b => b.email)
      .map(b => b.email);
    setSelectedEmails(new Set(qualifiedEmails));
  };

  const handleDeselectAll = () => {
    setSelectedEmails(new Set());
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedEmails));
  };"""

if old_handle in text:
    text = text.replace(old_handle, new_handle)
    print("OK: handleSelectAll/handleDeselectAll added")
else:
    print("NOT FOUND: handleConfirm block")

# 2. 「適格買主 (N件)」の見出しの横に「全て選択」「全て外す」ボタンを追加
old_heading = """              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                適格買主 ({qualifiedBuyers.length}件)
              </Typography>"""

new_heading = """              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 2, mb: 1 }}>
                <Typography variant="h6">
                  適格買主 ({qualifiedBuyers.length}件)
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" variant="outlined" onClick={handleSelectAll}>
                    全て選択
                  </Button>
                  <Button size="small" variant="outlined" color="warning" onClick={handleDeselectAll}>
                    全て外す
                  </Button>
                </Box>
              </Box>"""

if old_heading in text:
    text = text.replace(old_heading, new_heading)
    print("OK: select/deselect all buttons added")
else:
    print("NOT FOUND: heading block")

with open('frontend/frontend/src/components/BuyerFilterSummaryModal.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Done")
