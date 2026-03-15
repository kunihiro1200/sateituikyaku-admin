#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PropertyListingDetailPage.tsx に旧プロジェクトのUIを適用するスクリプト
変更内容:
1. isCalculatingAreas state 追加
2. handleCopyPublicUrl / handleOpenPublicUrl 関数追加
3. ヘッダー部分を旧プロジェクト版に置き換え（タイトル色、公開URLボタン、売主TEL/メールボタン）
4. 保存ボタンに SECTION_COLORS 色適用
5. メインレイアウト全体を8セクション横並び構成に置き換え
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# -----------------------------------------------------------------------
# 1. isCalculatingAreas state 追加
# -----------------------------------------------------------------------
old = '  const [retrievingStorageUrl, setRetrievingStorageUrl] = useState(false);\n  \n  // Edit mode states for each section'
new = '  const [retrievingStorageUrl, setRetrievingStorageUrl] = useState(false);\n  const [isCalculatingAreas, setIsCalculatingAreas] = useState(false);\n  \n  // Edit mode states for each section'
text = text.replace(old, new, 1)

# -----------------------------------------------------------------------
# 2. handleCopyPublicUrl / handleOpenPublicUrl 関数追加
#    （handleCopyPropertyNumber の直後に追加）
# -----------------------------------------------------------------------
old = '''  // 買主候補リストページを開く
  const handleOpenBuyerCandidates = () => {'''
new = '''  // 公開URLコピー機能
  const handleCopyPublicUrl = async () => {
    if (!data?.property_number) return;
    
    const publicUrl = `https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`;
    
    try {
      await navigator.clipboard.writeText(publicUrl);
      setSnackbar({
        open: true,
        message: '公開URLをコピーしました',
        severity: 'success',
      });
    } catch (error) {
      console.error('Failed to copy public URL:', error);
      setSnackbar({
        open: true,
        message: '公開URLのコピーに失敗しました',
        severity: 'error',
      });
    }
  };

  // 公開URLを新しいタブで開く
  const handleOpenPublicUrl = () => {
    if (!data?.property_number) return;
    
    const publicUrl = `https://property-site-frontend-kappa.vercel.app/public/properties/${data.property_number}`;
    window.open(publicUrl, '_blank', 'noopener,noreferrer');
  };

  // 買主候補リストページを開く
  const handleOpenBuyerCandidates = () => {'''
text = text.replace(old, new, 1)

# -----------------------------------------------------------------------
# 3. ヘッダー部分を旧プロジェクト版に置き換え
#    （タイトル色、公開URLボタン、売主TEL/メールボタン）
# -----------------------------------------------------------------------
old_header = '''          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" fontWeight="bold">
                物件詳細 - {data.property_number}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCopyPropertyNumber}
                title="物件番号をコピー"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
            {/* 公開URL表示 */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                公開URL:
              </Typography>
              <PublicUrlCell
                propertyNumber={data.property_number}
              />
            </Box>
          </Box>
          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                買主から遷移:
              </Typography>
              <Typography variant="body2" fontWeight="medium" color="primary">
                {buyerContext.buyerName || `買主ID: ${buyerContext.buyerId}`}
              </Typography>
            </Box>
          )}'''

new_header = '''          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h5" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                物件詳細 - {data.property_number}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCopyPropertyNumber}
                sx={{ color: SECTION_COLORS.property.main }}
                title="物件番号をコピー"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              {/* 公開URLボタン */}
              <Button
                variant="outlined"
                size="small"
                onClick={handleOpenPublicUrl}
                endIcon={<OpenInNewIcon fontSize="small" />}
                sx={{
                  ml: 1,
                  borderColor: SECTION_COLORS.property.main,
                  color: SECTION_COLORS.property.main,
                  '&:hover': {
                    borderColor: SECTION_COLORS.property.dark,
                    backgroundColor: `${SECTION_COLORS.property.main}08`,
                  },
                }}
              >
                公開URL
              </Button>
              <IconButton
                size="small"
                onClick={handleCopyPublicUrl}
                sx={{ color: SECTION_COLORS.property.main }}
                title="公開URLをコピー"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Box>
            {/* 売主連絡先ボタン */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              {data.seller_contact && (
                <Button
                  variant="outlined"
                  size="small"
                  href={`tel:${data.seller_contact}`}
                  startIcon={<PhoneIcon fontSize="small" />}
                  sx={{
                    borderColor: '#2e7d32',
                    color: '#2e7d32',
                    '&:hover': {
                      borderColor: '#1b5e20',
                      backgroundColor: '#2e7d3208',
                    },
                  }}
                >
                  売主TEL
                </Button>
              )}
              {data.seller_email && (
                <Button
                  variant="outlined"
                  size="small"
                  href={`mailto:${data.seller_email}`}
                  startIcon={<EmailIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1976d2',
                    color: '#1976d2',
                    '&:hover': {
                      borderColor: '#115293',
                      backgroundColor: '#1976d208',
                    },
                  }}
                >
                  売主へメール
                </Button>
              )}
            </Box>
          </Box>
          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                買主から遷移:
              </Typography>
              <Typography variant="body2" fontWeight="medium" sx={{ color: SECTION_COLORS.property.main }}>
                {buyerContext.buyerName || `買主ID: ${buyerContext.buyerId}`}
              </Typography>
            </Box>
          )}'''

text = text.replace(old_header, new_header, 1)

# -----------------------------------------------------------------------
# 4. GmailDistributionButton に isCalculatingAreas prop 追加 & 保存ボタンに色適用
# -----------------------------------------------------------------------
old_buttons = '''          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            size="medium"
            variant="contained"
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? '保存中...' : '保存'}
          </Button>'''

new_buttons = '''          <GmailDistributionButton
            propertyNumber={data.property_number}
            propertyAddress={data.address || data.display_address}
            distributionAreas={editedData.distribution_areas !== undefined ? editedData.distribution_areas : data.distribution_areas}
            size="medium"
            variant="contained"
          />
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={!hasChanges || saving}
            sx={{
              backgroundColor: SECTION_COLORS.property.main,
              '&:hover': {
                backgroundColor: SECTION_COLORS.property.dark,
              },
            }}
          >
            {saving ? '保存中...' : '保存'}
          </Button>'''

text = text.replace(old_buttons, new_buttons, 1)

# -----------------------------------------------------------------------
# 5. メインレイアウト全体を8セクション横並び構成に置き換え
#    （<Grid container spacing={3}> から </Grid>\n\n      <Snackbar まで）
# -----------------------------------------------------------------------
old_main_start = '''      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Left Column - Property Details */}
        <Grid item xs={12} lg={8}>
          {/* 価格情報と特記・備忘録を横並び（33% : 67%） */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            {/* 価格情報 - 33% */}
            <Box sx={{ flex: '0 0 33%', maxWidth: '400px' }}>
              <EditableSection
                title="価格情報"
                isEditMode={isPriceEditMode}
                onEditToggle={() => setIsPriceEditMode(!isPriceEditMode)}
                onSave={handleSavePrice}
                onCancel={handleCancelPrice}
              >
                <PriceSection
                  salesPrice={data.price}
                  listingPrice={data.listing_price}
                  priceReductionHistory={data.price_reduction_history}
                  onFieldChange={handleFieldChange}
                  editedData={editedData}
                  isEditMode={isPriceEditMode}
                />
              </EditableSection>
            </Box>
            
            {/* 特記・備忘録 - 67% */}
            <Box sx={{ flex: '0 0 67%', maxWidth: '800px' }}>
              <Paper sx={{ p: 2, mb: 0, bgcolor: '#fff9e6', height: '100%' }}>
                <Typography variant="h6" gutterBottom fontWeight="bold" color="warning.dark" sx={{ fontSize: '1.25rem' }}>
                  特記・備忘録
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '1rem' }}>特記</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={editedData.special_notes !== undefined ? editedData.special_notes : (data.special_notes || '')}
                    onChange={(e) => handleFieldChange('special_notes', e.target.value)}
                    placeholder="特記事項を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '18px', lineHeight: 1.8 } }}
                  />
                </Box>
                <Box>
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
            </Box>
          </Box>

          {/* よく聞かれる項目セクション */}
          <EditableSection
            title="よく聞かれる項目"
            isEditMode={isFrequentlyAskedEditMode}
            onEditToggle={() => setIsFrequentlyAskedEditMode(!isFrequentlyAskedEditMode)}
            onSave={handleSaveFrequentlyAsked}
            onCancel={handleCancelFrequentlyAsked}
          >
            <FrequentlyAskedSection 
              data={data} 
              editedData={editedData}
              onFieldChange={handleFieldChange}
              isEditMode={isFrequentlyAskedEditMode}
            />
          </EditableSection>'''

# 旧プロジェクトのメインレイアウト（8セクション構成）
new_main = '''      {/* Main Content */}
      <Grid container spacing={3}>
        {/* Full Width Content */}
        <Grid item xs={12}>
          {/* 1. 価格情報 + 買主リスト */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 2, 
            mb: 2,
            p: 2,
            bgcolor: '#f8f9fa',
            borderRadius: 2,
            border: '1px solid #e0e0e0'
          }}>
            {/* 価格情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 33%' } }}>
              <EditableSection
                title="価格情報"
                isEditMode={isPriceEditMode}
                onEditToggle={() => setIsPriceEditMode(!isPriceEditMode)}
                onSave={handleSavePrice}
                onCancel={handleCancelPrice}
              >
                <PriceSection
                  salesPrice={data.price}
                  listingPrice={data.listing_price}
                  priceReductionHistory={data.price_reduction_history}
                  onFieldChange={handleFieldChange}
                  editedData={editedData}
                  isEditMode={isPriceEditMode}
                />
              </EditableSection>
            </Box>
            
            {/* 買主リスト */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 67%' } }}>
              <CompactBuyerListForProperty
                buyers={buyers as any[]}
                propertyNumber={data.property_number}
                loading={buyersLoading}
              />
            </Box>
          </Box>

          {/* 2. よく聞かれる項目 + 特記・備忘録 */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 2, 
            mb: 2,
            p: 2,
            bgcolor: '#fff8e1',
            borderRadius: 2,
            border: '1px solid #ffe082'
          }}>
            {/* よく聞かれる項目 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection
                title="よく聞かれる項目"
                isEditMode={isFrequentlyAskedEditMode}
                onEditToggle={() => setIsFrequentlyAskedEditMode(!isFrequentlyAskedEditMode)}
                onSave={handleSaveFrequentlyAsked}
                onCancel={handleCancelFrequentlyAsked}
              >
                <FrequentlyAskedSection 
                  data={data} 
                  editedData={editedData}
                  onFieldChange={handleFieldChange}
                  isEditMode={isFrequentlyAskedEditMode}
                />
              </EditableSection>
            </Box>
            
            {/* 特記・備忘録 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <Paper sx={{ p: 2, bgcolor: '#fff9e6', height: '100%' }}>
                <Box sx={{ 
                  mb: 2, 
                  pb: 1, 
                  borderBottom: `2px solid ${SECTION_COLORS.property.main}`,
                }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main, fontSize: '1.25rem' }}>
                    特記・備忘録
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight="bold" sx={{ fontSize: '1rem' }}>特記</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    value={editedData.special_notes !== undefined ? editedData.special_notes : (data.special_notes || '')}
                    onChange={(e) => handleFieldChange('special_notes', e.target.value)}
                    placeholder="特記事項を入力してください"
                    sx={{ '& .MuiInputBase-input': { fontSize: '18px', lineHeight: 1.8 } }}
                  />
                </Box>
                <Box>
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
            </Box>
          </Box>

          {/* 3. 内覧情報 + 基本情報 */}
          <Box sx={{ 
            display: 'flex', 
            flexDirection: { xs: 'column', md: 'row' }, 
            gap: 2, 
            mb: 2,
            p: 2,
            bgcolor: '#e3f2fd',
            borderRadius: 2,
            border: '1px solid #90caf9'
          }}>
            {/* 内覧情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
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
                      <Box sx={{ bgcolor: '#e3f2fd', p: 2, borderRadius: 1, border: '2px solid #2196f3' }}>
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
            </Box>'''

# 旧プロジェクトのメインレイアウトの残り部分を確認して置き換え対象を特定
# 現在のファイルの内覧情報以降〜右カラム（買主リスト）の終わりまでを置き換える

# まず現在のファイルで内覧情報セクション以降を探す
if old_main_start in text:
    text = text.replace(old_main_start, new_main, 1)
    print("Step 5a: メインレイアウト前半を置き換えました")
else:
    print("ERROR: Step 5a のターゲットが見つかりません")

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print("Step 1-4 完了: isCalculatingAreas, handleCopyPublicUrl, handleOpenPublicUrl, ヘッダー, 保存ボタン色を適用")
print("Step 5a 完了: メインレイアウト前半（セクション1-3の内覧情報まで）を置き換え")
