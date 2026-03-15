#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx の残り部分を修正するスクリプト
- 内覧情報の重複を削除
- 基本情報を内覧情報の右に配置（セクション3の右半分）
- セクション4-8を追加
- 右カラム（買主リスト）を削除（セクション1に移動済み）
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 内覧情報の重複部分（旧コード）から右カラム末尾まで置き換え
# 旧コードの内覧情報は bgcolor: '#e8f5e9' (緑) で識別できる
old_rest = '''          {/* 内覧情報 */}
          <EditableSection
            title="内覧情報"
            isEditMode={isViewingInfoEditMode}
            onEditToggle={() => setIsViewingInfoEditMode(!isViewingInfoEditMode)}
            onSave={handleSaveViewingInfo}
            onCancel={handleCancelViewingInfo}
          >
            <Grid container spacing={2}>
              {(isViewingInfoEditMode || data.viewing_key) && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>内覧時（鍵等）</Typography>
                  {isViewingInfoEditMode ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editedData.viewing_key !== undefined ? editedData.viewing_key : (data.viewing_key || '')}
                      onChange={(e) => handleFieldChange('viewing_key', e.target.value)}
                    />
                  ) : (
                    <Typography variant="body1">{data.viewing_key}</Typography>
                  )}
                </Grid>
              )}
              {(isViewingInfoEditMode || data.viewing_parking) && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>内覧時駐車場</Typography>
                  {isViewingInfoEditMode ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editedData.viewing_parking !== undefined ? editedData.viewing_parking : (data.viewing_parking || '')}
                      onChange={(e) => handleFieldChange('viewing_parking', e.target.value)}
                    />
                  ) : (
                    <Typography variant="body1">{data.viewing_parking}</Typography>
                  )}
                </Grid>
              )}
              {(isViewingInfoEditMode || data.viewing_notes) && (
                <Grid item xs={12}>
                  <Box sx={{ bgcolor: '#e8f5e9', p: 2, borderRadius: 1, border: '2px solid #2e7d32' }}>
                    <Typography variant="h6" color="primary.dark" fontWeight="bold" gutterBottom sx={{ fontSize: '1.25rem' }}>
                      📝 内覧の時の伝達事項
                    </Typography>
                    {isViewingInfoEditMode ? (
                      <TextField
                        fullWidth
                        multiline
                        rows={4}
                        value={editedData.viewing_notes !== undefined ? editedData.viewing_notes : (data.viewing_notes || '')}
                        onChange={(e) => handleFieldChange('viewing_notes', e.target.value)}
                        sx={{ 
                          bgcolor: 'white',
                          '& .MuiInputBase-input': { fontSize: '1.1rem', lineHeight: 1.8 }
                        }}
                      />
                    ) : (
                      <Typography 
                        variant="body1"
                        sx={{ 
                          fontSize: '1.1rem', 
                          lineHeight: 1.8,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word'
                        }}
                      >
                        {data.viewing_notes}
                      </Typography>
                    )}
                  </Box>
                </Grid>
              )}
              {(isViewingInfoEditMode || data.viewing_available_date) && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>内覧可能日</Typography>
                  {isViewingInfoEditMode ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editedData.viewing_available_date !== undefined ? editedData.viewing_available_date : (data.viewing_available_date || '')}
                      onChange={(e) => handleFieldChange('viewing_available_date', e.target.value)}
                    />
                  ) : (
                    <Typography variant="body1">{data.viewing_available_date}</Typography>
                  )}
                </Grid>
              )}
              {(isViewingInfoEditMode || data.building_viewing) && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>建物内覧</Typography>
                  {isViewingInfoEditMode ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editedData.building_viewing !== undefined ? editedData.building_viewing : (data.building_viewing || '')}
                      onChange={(e) => handleFieldChange('building_viewing', e.target.value)}
                    />
                  ) : (
                    <Typography variant="body1">{data.building_viewing}</Typography>
                  )}
                </Grid>
              )}
            </Grid>
          </EditableSection>

          {/* 基本情報 - 再構成 */}'''

# 基本情報から右カラム末尾まで（旧コード）を新しいセクション4-8に置き換える
# まず old_rest が存在するか確認
if old_rest in text:
    print("Found old_rest marker")
else:
    print("ERROR: old_rest not found")
    # デバッグ: 最初の100文字を確認
    idx = text.find("bgcolor: '#e8f5e9'")
    print(f"bgcolor e8f5e9 at: {idx}")
    idx2 = text.find("基本情報 - 再構成")
    print(f"基本情報 - 再構成 at: {idx2}")

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))
