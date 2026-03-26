#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
特記・備忘録セクションに handleSaveNotes ハンドラーと保存ボタンを追加するスクリプト
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== タスク1: handleSaveNotes を handleSaveSellerBuyer の後に追加 =====
old_cancel_seller_buyer = """  const handleCancelSellerBuyer = () => {
    setEditedData({});
    setIsSellerBuyerEditMode(false);
  };

  // 物件番号コピー機能"""

new_cancel_seller_buyer = """  const handleCancelSellerBuyer = () => {
    setEditedData({});
    setIsSellerBuyerEditMode(false);
  };

  const handleSaveNotes = async () => {
    if (!propertyNumber) return;
    const notesData: Record<string, any> = {};
    if (editedData.special_notes !== undefined) notesData.special_notes = editedData.special_notes;
    if (editedData.memo !== undefined) notesData.memo = editedData.memo;
    if (Object.keys(notesData).length === 0) return;
    try {
      await api.put(`/api/property-listings/${propertyNumber}`, notesData);
      setSnackbar({ open: true, message: '特記・備忘録を保存しました', severity: 'success' });
      await fetchPropertyData();
      setEditedData({});
    } catch (error) {
      setSnackbar({ open: true, message: '保存に失敗しました', severity: 'error' });
    }
  };

  // 物件番号コピー機能"""

if old_cancel_seller_buyer in text:
    text = text.replace(old_cancel_seller_buyer, new_cancel_seller_buyer)
    print('✅ タスク1: handleSaveNotes を追加しました')
else:
    print('❌ タスク1: 挿入位置が見つかりませんでした')

# ===== タスク2: 特記・備忘録セクションに保存ボタンを追加 =====
old_notes_section = """                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '1rem' }}>備忘録</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={editedData.memo !== undefined ? editedData.memo : (data.memo || '')}
                    onChange={(e) => handleFieldChange('memo', e.target.value)}
                    placeholder="備忘録を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '18px', lineHeight: 1.8 } }}
                  />
                </Box>
              </Paper>
            </Box>"""

new_notes_section = """                <Box>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '1rem' }}>備忘録</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={editedData.memo !== undefined ? editedData.memo : (data.memo || '')}
                    onChange={(e) => handleFieldChange('memo', e.target.value)}
                    placeholder="備忘録を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '18px', lineHeight: 1.8 } }}
                  />
                </Box>
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveNotes}
                    disabled={editedData.special_notes === undefined && editedData.memo === undefined}
                    sx={{ bgcolor: SECTION_COLORS.property.main }}
                  >
                    保存
                  </Button>
                </Box>
              </Paper>
            </Box>"""

if old_notes_section in text:
    text = text.replace(old_notes_section, new_notes_section)
    print('✅ タスク2: 保存ボタンを追加しました')
else:
    print('❌ タスク2: 挿入位置が見つかりませんでした')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ ファイルを保存しました')

# BOMチェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOM check: {repr(first_bytes[:3])} (b"imp" などであればOK)')
