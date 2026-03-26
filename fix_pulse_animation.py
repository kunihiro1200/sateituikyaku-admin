# PropertyListingDetailPage.tsx に hasChanges と パルスアニメーションを追加するスクリプト

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# ===== 1. よく聞かれる項目 に hasChanges を追加 =====
old1 = '''title="よく聞かれる項目"
                isEditMode={isFrequentlyAskedEditMode}
                onEditToggle={() => setIsFrequentlyAskedEditMode(!isFrequentlyAskedEditMode)}
                onSave={handleSaveFrequentlyAsked}
                onCancel={handleCancelFrequentlyAsked}
              >'''

new1 = '''title="よく聞かれる項目"
                isEditMode={isFrequentlyAskedEditMode}
                onEditToggle={() => setIsFrequentlyAskedEditMode(!isFrequentlyAskedEditMode)}
                onSave={handleSaveFrequentlyAsked}
                onCancel={handleCancelFrequentlyAsked}
                hasChanges={Object.keys(editedData).length > 0}
              >'''

if old1 in text:
    text = text.replace(old1, new1, 1)
    print('✅ よく聞かれる項目: hasChanges 追加完了')
else:
    print('❌ よく聞かれる項目: 対象文字列が見つかりません')

# ===== 2. 内覧情報 に hasChanges を追加 =====
old2 = '''title="内覧情報"
                isEditMode={isViewingInfoEditMode}
                onEditToggle={() => setIsViewingInfoEditMode(!isViewingInfoEditMode)}
                onSave={handleSaveViewingInfo}
                onCancel={handleCancelViewingInfo}
              >'''

new2 = '''title="内覧情報"
                isEditMode={isViewingInfoEditMode}
                onEditToggle={() => setIsViewingInfoEditMode(!isViewingInfoEditMode)}
                onSave={handleSaveViewingInfo}
                onCancel={handleCancelViewingInfo}
                hasChanges={Object.keys(editedData).length > 0}
              >'''

if old2 in text:
    text = text.replace(old2, new2, 1)
    print('✅ 内覧情報: hasChanges 追加完了')
else:
    print('❌ 内覧情報: 対象文字列が見つかりません')

# ===== 3. 基本情報 に hasChanges を追加 =====
old3 = '''title="基本情報"
                isEditMode={isBasicInfoEditMode}
                onEditToggle={() => setIsBasicInfoEditMode(!isBasicInfoEditMode)}
                onSave={handleSaveBasicInfo}
                onCancel={handleCancelBasicInfo}
              >'''

new3 = '''title="基本情報"
                isEditMode={isBasicInfoEditMode}
                onEditToggle={() => setIsBasicInfoEditMode(!isBasicInfoEditMode)}
                onSave={handleSaveBasicInfo}
                onCancel={handleCancelBasicInfo}
                hasChanges={Object.keys(editedData).length > 0}
              >'''

if old3 in text:
    text = text.replace(old3, new3, 1)
    print('✅ 基本情報: hasChanges 追加完了')
else:
    print('❌ 基本情報: 対象文字列が見つかりません')

# ===== 4. 物件詳細情報 に hasChanges を追加 =====
old4 = '''title="物件詳細情報" isEditMode={isPropertyDetailsEditMode}
                onEditToggle={() => setIsPropertyDetailsEditMode(!isPropertyDetailsEditMode)}
                onSave={handleSavePropertyDetails} onCancel={handleCancelPropertyDetails}>'''

new4 = '''title="物件詳細情報" isEditMode={isPropertyDetailsEditMode}
                onEditToggle={() => setIsPropertyDetailsEditMode(!isPropertyDetailsEditMode)}
                onSave={handleSavePropertyDetails} onCancel={handleCancelPropertyDetails}
                hasChanges={Object.keys(editedData).length > 0}>'''

if old4 in text:
    text = text.replace(old4, new4, 1)
    print('✅ 物件詳細情報: hasChanges 追加完了')
else:
    print('❌ 物件詳細情報: 対象文字列が見つかりません')

# ===== 5. 売主・買主情報 に hasChanges を追加 =====
old5 = '''title="売主・買主情報" isEditMode={isSellerBuyerEditMode}
                onEditToggle={() => setIsSellerBuyerEditMode(!isSellerBuyerEditMode)}
                onSave={handleSaveSellerBuyer} onCancel={handleCancelSellerBuyer}>'''

new5 = '''title="売主・買主情報" isEditMode={isSellerBuyerEditMode}
                onEditToggle={() => setIsSellerBuyerEditMode(!isSellerBuyerEditMode)}
                onSave={handleSaveSellerBuyer} onCancel={handleCancelSellerBuyer}
                hasChanges={Object.keys(editedData).length > 0}>'''

if old5 in text:
    text = text.replace(old5, new5, 1)
    print('✅ 売主・買主情報: hasChanges 追加完了')
else:
    print('❌ 売主・買主情報: 対象文字列が見つかりません')

# ===== 6. 特記・備忘録の保存ボタンにパルスアニメーションを追加 =====
old6 = '''                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveNotes}
                    disabled={editedData.special_notes === undefined && editedData.memo === undefined}
                    sx={{ bgcolor: SECTION_COLORS.property.main }}
                  >
                    保存
                  </Button>'''

new6 = '''                  <Button
                    variant="contained"
                    size="small"
                    onClick={handleSaveNotes}
                    disabled={editedData.special_notes === undefined && editedData.memo === undefined}
                    sx={{
                      ...(editedData.special_notes !== undefined || editedData.memo !== undefined ? {
                        backgroundColor: '#d32f2f',
                        '&:hover': { backgroundColor: '#b71c1c' },
                        animation: 'pulseSave 1.5s infinite',
                        '@keyframes pulseSave': {
                          '0%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0.7)' },
                          '70%': { boxShadow: '0 0 0 8px rgba(211, 47, 47, 0)' },
                          '100%': { boxShadow: '0 0 0 0 rgba(211, 47, 47, 0)' },
                        },
                      } : { bgcolor: SECTION_COLORS.property.main }),
                    }}
                  >
                    保存
                  </Button>'''

if old6 in text:
    text = text.replace(old6, new6, 1)
    print('✅ 特記・備忘録の保存ボタン: パルスアニメーション追加完了')
else:
    print('❌ 特記・備忘録の保存ボタン: 対象文字列が見つかりません')

# UTF-8で書き込む（BOMなし）
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('\n✅ ファイル書き込み完了')

# BOMチェック
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    first3 = f.read(3)
if first3 == b'\xef\xbb\xbf':
    print('⚠️ BOM付きUTF-8です')
else:
    print('✅ BOMなしUTF-8です（正常）')
