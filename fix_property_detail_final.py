# PropertyListingDetailPage.tsx の修正スクリプト
# セクション3の内覧情報の後に残っている旧コードを削除し、
# 旧プロジェクトの構成（基本情報をセクション3右半分、セクション4-8）に置き換える

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 削除開始マーカー: セクション3の内覧情報Box終了後の旧コード開始
old_start = '''              </EditableSection>
            </Box>

          {/* 内覧情報 */}
          <EditableSection
            title="内覧情報"'''

# 削除終了マーカー: 旧コードの右カラム（CompactBuyerListForProperty）の終わり
old_end = '''        </Grid>
      </Grid>

      <Snackbar'''

idx_start = text.find(old_start)
idx_end = text.find(old_end)

print(f'old_start found at: {idx_start}')
print(f'old_end found at: {idx_end}')

if idx_start == -1 or idx_end == -1:
    print('ERROR: markers not found')
    exit(1)

# 旧プロジェクトの構成に置き換える新しいコード
new_code = '''              </EditableSection>
            </Box>

            {/* 基本情報 */}
            <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 50%' } }}>
              <EditableSection
                title="基本情報"
                isEditMode={isBasicInfoEditMode}
                onEditToggle={() => setIsBasicInfoEditMode(!isBasicInfoEditMode)}
                onSave={handleSaveBasicInfo}
                onCancel={handleCancelBasicInfo}
              >
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>物件番号</Typography>
                <Typography variant="h6" fontWeight="bold" sx={{ fontSize: '1.25rem' }}>{data.property_number}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body1" color="text.secondary" sx={{ fontSize: '1rem', fontWeight: 'bold' }}>担当</Typography>
                {isBasicInfoEditMode ? (
                  <TextField
                    fullWidth
                    size="small"
                    value={editedData.sales_assignee !== undefined ? editedData.sales_assignee : (data.sales_assignee || \'\')}
                    onChange={(e) => handleFieldChange(\'sales_assignee\', e.target.value)}
                    sx={{ \'& .MuiInputBase-input\': { fontSize: \'1.1rem\' } }}
                  />
                ) : (
                  <Typography variant="h6" sx={{ fontSize: \'1.1rem\' }}>{data.sales_assignee || \'-\'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>種別</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.property_type !== undefined ? editedData.property_type : (data.property_type || \'\')}
                    onChange={(e) => handleFieldChange(\'property_type\', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.property_type || \'-\'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>状況</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.status !== undefined ? editedData.status : (data.status || \'\')}
                    onChange={(e) => handleFieldChange(\'status\', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.status || \'-\'}</Typography>
                )}
              </Grid>
'''

new_code += '''              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>現況</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.current_status !== undefined ? editedData.current_status : (data.current_status || \'\')}
                    onChange={(e) => handleFieldChange(\'current_status\', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.current_status || \'-\'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>配信日（公開）</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small" type="date"
                    value={editedData.distribution_date !== undefined ? editedData.distribution_date : (data.distribution_date || \'\')}
                    onChange={(e) => handleFieldChange(\'distribution_date\', e.target.value)}
                    InputLabelProps={{ shrink: true }} />
                ) : (
                  <Typography variant="body1">{data.distribution_date || \'-\'}</Typography>
                )}
              </Grid>
              <Grid item xs={6}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>売出価格</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small" type="number"
                    value={editedData.listing_price !== undefined ? editedData.listing_price : (data.listing_price || \'\')}
                    onChange={(e) => handleFieldChange(\'listing_price\', e.target.value ? Number(e.target.value) : null)}
                    InputProps={{ startAdornment: <Typography sx={{ mr: 0.5 }}>¥</Typography> }} />
                ) : (
                  <Typography variant="body1">{data.listing_price ? `¥${data.listing_price.toLocaleString()}` : \'-\'}</Typography>
                )}
              </Grid>
              <Grid item xs={12}>
                <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>所在地</Typography>
                {isBasicInfoEditMode ? (
                  <TextField fullWidth size="small"
                    value={editedData.address !== undefined ? editedData.address : (data.address || data.display_address || \'\')}
                    onChange={(e) => handleFieldChange(\'address\', e.target.value)} />
                ) : (
                  <Typography variant="body1">{data.address || data.display_address || \'-\'}</Typography>
                )}
              </Grid>
              {data.management_type && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>管理形態</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.management_type !== undefined ? editedData.management_type : (data.management_type || \'\')}
                      onChange={(e) => handleFieldChange(\'management_type\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.management_type}</Typography>
                  )}
                </Grid>
              )}
              {data.management_company && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>管理会社</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.management_company !== undefined ? editedData.management_company : (data.management_company || \'\')}
                      onChange={(e) => handleFieldChange(\'management_company\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.management_company}</Typography>
                  )}
                </Grid>
              )}
'''

new_code += '''              {data.pet_consultation && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>ペット相談</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.pet_consultation !== undefined ? editedData.pet_consultation : (data.pet_consultation || \'\')}
                      onChange={(e) => handleFieldChange(\'pet_consultation\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.pet_consultation}</Typography>
                  )}
                </Grid>
              )}
              {data.hot_spring && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>温泉</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.hot_spring !== undefined ? editedData.hot_spring : (data.hot_spring || \'\')}
                      onChange={(e) => handleFieldChange(\'hot_spring\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.hot_spring}</Typography>
                  )}
                </Grid>
              )}
              {data.deduction_usage && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>控除利用</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.deduction_usage !== undefined ? editedData.deduction_usage : (data.deduction_usage || \'\')}
                      onChange={(e) => handleFieldChange(\'deduction_usage\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.deduction_usage}</Typography>
                  )}
                </Grid>
              )}
              {data.delivery_method && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>引渡方法</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.delivery_method !== undefined ? editedData.delivery_method : (data.delivery_method || \'\')}
                      onChange={(e) => handleFieldChange(\'delivery_method\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.delivery_method}</Typography>
                  )}
                </Grid>
              )}
              {data.broker && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>仲介業者</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.broker !== undefined ? editedData.broker : (data.broker || \'\')}
                      onChange={(e) => handleFieldChange(\'broker\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.broker}</Typography>
                  )}
                </Grid>
              )}
              {data.judicial_scrivener && (
                <Grid item xs={6}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>司法書士</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.judicial_scrivener !== undefined ? editedData.judicial_scrivener : (data.judicial_scrivener || \'\')}
                      onChange={(e) => handleFieldChange(\'judicial_scrivener\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.judicial_scrivener}</Typography>
                  )}
                </Grid>
              )}
              {data.storage_location && (
                <Grid item xs={12}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>保存場所</Typography>
                  {isBasicInfoEditMode ? (
                    <TextField fullWidth size="small"
                      value={editedData.storage_location !== undefined ? editedData.storage_location : (data.storage_location || \'\')}
                      onChange={(e) => handleFieldChange(\'storage_location\', e.target.value)} />
                  ) : (
                    <Typography variant="body1">{data.storage_location}</Typography>
                  )}
                </Grid>
              )}
                </Grid>
              </EditableSection>
            </Box>
          </Box>
'''

new_code += '''
          {/* 4. 地図・サイトURL + 物件詳細情報 */}
          <Box sx={{ 
            display: \'flex\', 
            flexDirection: { xs: \'column\', md: \'row\' }, 
            gap: 2, 
            mb: 2,
            p: 2,
            bgcolor: \'#f3e5f5\',
            borderRadius: 2,
            border: \'1px solid #ce93d8\'
          }}>
            {/* 地図・サイトURL */}
            <Box sx={{ flex: { xs: \'1 1 100%\', md: \'0 0 50%\' } }}>
              <Paper sx={{ p: 2, height: \'100%\' }}>
                <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                    地図・サイトURL
                  </Typography>
                </Box>
                <EditableUrlField
                  label="地図URL"
                  value={data.google_map_url || null}
                  placeholder="https://maps.google.com/..."
                  urlPattern={GOOGLE_MAP_URL_PATTERN}
                  errorMessage="有効なGoogle Map URLを入力してください"
                  onSave={handleUpdateGoogleMapUrl}
                  helperText="物件の位置を示すGoogle Map URLを入力してください"
                />
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ display: \'flex\', alignItems: \'center\', justifyContent: \'space-between\', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">格納先URL</Typography>
                    <Button variant="outlined" size="small" onClick={handleAutoRetrieveStorageUrl}
                      disabled={retrievingStorageUrl}
                      startIcon={retrievingStorageUrl ? <CircularProgress size={16} /> : null}
                      sx={{ borderColor: SECTION_COLORS.property.main, color: SECTION_COLORS.property.main,
                        \'&:hover\': { borderColor: SECTION_COLORS.property.dark, backgroundColor: `${SECTION_COLORS.property.main}08` } }}>
                      {retrievingStorageUrl ? \'取得中...\' : \'自動取得\'}
                    </Button>
                  </Box>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">現在のURL:</Typography>
                    {data.storage_location ? (
                      <Link href={data.storage_location} target="_blank" rel="noopener noreferrer"
                        sx={{ display: \'flex\', alignItems: \'center\', gap: 0.5, wordBreak: \'break-all\', fontSize: \'0.875rem\' }}>
                        {data.storage_location}
                        <OpenInNewIcon fontSize="small" />
                      </Link>
                    ) : (
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: \'italic\' }}>未設定</Typography>
                    )}
                  </Box>
                  <EditableUrlField label="" value={data.storage_location || null}
                    placeholder="https://drive.google.com/drive/folders/..."
                    urlPattern={GOOGLE_DRIVE_FOLDER_PATTERN}
                    errorMessage="有効なGoogle DriveフォルダURLを入力してください"
                    onSave={handleUpdateStorageLocation}
                    helperText="物件関連ドキュメントが保存されているGoogle DriveフォルダのURLを入力してください" />
                </Box>
              </Paper>
            </Box>
            {/* 物件詳細情報 */}
            <Box sx={{ flex: { xs: \'1 1 100%\', md: \'0 0 50%\' } }}>
              <EditableSection title="物件詳細情報" isEditMode={isPropertyDetailsEditMode}
                onEditToggle={() => setIsPropertyDetailsEditMode(!isPropertyDetailsEditMode)}
                onSave={handleSavePropertyDetails} onCancel={handleCancelPropertyDetails}>
                <PropertyDetailsSection data={data} editedData={editedData}
                  onFieldChange={handleFieldChange} isEditMode={isPropertyDetailsEditMode} />
              </EditableSection>
            </Box>
          </Box>

          {/* 5. 配信エリア番号（全幅） */}
          <Box sx={{ mb: 2, p: 2, bgcolor: \'#e8f5e9\', borderRadius: 2, border: \'1px solid #a5d6a7\' }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
                  配信エリア番号
                </Typography>
              </Box>
              <DistributionAreaField
                propertyNumber={propertyNumber || \'\'}
                googleMapUrl={data.google_map_url}
                value={editedData.distribution_areas !== undefined ? editedData.distribution_areas : (data.distribution_areas || \'\')}
                onChange={(value) => handleFieldChange(\'distribution_areas\', value)}
                onCalculatingChange={setIsCalculatingAreas}
              />
            </Paper>
          </Box>
'''

new_code += '''
          {/* 6. 売主・買主情報 + 手数料情報 */}
          <Box sx={{ display: \'flex\', flexDirection: { xs: \'column\', md: \'row\' }, gap: 2, mb: 2, p: 2,
            bgcolor: \'#fce4ec\', borderRadius: 2, border: \'1px solid #f48fb1\' }}>
            {/* 売主・買主情報 */}
            <Box sx={{ flex: { xs: \'1 1 100%\', md: \'0 0 50%\' } }}>
              <EditableSection title="売主・買主情報" isEditMode={isSellerBuyerEditMode}
                onEditToggle={() => setIsSellerBuyerEditMode(!isSellerBuyerEditMode)}
                onSave={handleSaveSellerBuyer} onCancel={handleCancelSellerBuyer}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>売主</Typography>
                  <Grid container spacing={2}>
                    {(isSellerBuyerEditMode || data.seller_name) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>名前</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_name !== undefined ? editedData.seller_name : (data.seller_name || \'\')}
                            onChange={(e) => handleFieldChange(\'seller_name\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_name}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_address) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>住所</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_address !== undefined ? editedData.seller_address : (data.seller_address || \'\')}
                            onChange={(e) => handleFieldChange(\'seller_address\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_address}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_contact) && (
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>連絡先</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_contact !== undefined ? editedData.seller_contact : (data.seller_contact || \'\')}
                            onChange={(e) => handleFieldChange(\'seller_contact\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_contact}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.seller_email) && (
                      <Grid item xs={6}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>メールアドレス</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.seller_email !== undefined ? editedData.seller_email : (data.seller_email || \'\')}
                            onChange={(e) => handleFieldChange(\'seller_email\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.seller_email}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.sale_reason) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" sx={{ fontWeight: 700, fontSize: \'1rem\', color: \'text.primary\', mb: 0.5 }}>売却理由</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.sale_reason !== undefined ? editedData.sale_reason : (data.sale_reason || \'\')}
                            onChange={(e) => handleFieldChange(\'sale_reason\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.sale_reason}</Typography>)}
                      </Grid>
                    )}
                  </Grid>
                </Box>
                <Box>
                  <Typography variant="subtitle1" fontWeight="bold" gutterBottom>買主</Typography>
                  <Grid container spacing={2}>
                    {(isSellerBuyerEditMode || data.buyer_name) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">名前</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_name !== undefined ? editedData.buyer_name : (data.buyer_name || \'\')}
                            onChange={(e) => handleFieldChange(\'buyer_name\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.buyer_name}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.buyer_address) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">住所</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_address !== undefined ? editedData.buyer_address : (data.buyer_address || \'\')}
                            onChange={(e) => handleFieldChange(\'buyer_address\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.buyer_address}</Typography>)}
                      </Grid>
                    )}
                    {(isSellerBuyerEditMode || data.buyer_contact) && (
                      <Grid item xs={12}>
                        <Typography variant="body2" color="text.secondary" fontWeight="bold">連絡先</Typography>
                        {isSellerBuyerEditMode ? (
                          <TextField fullWidth size="small"
                            value={editedData.buyer_contact !== undefined ? editedData.buyer_contact : (data.buyer_contact || \'\')}
                            onChange={(e) => handleFieldChange(\'buyer_contact\', e.target.value)} />
                        ) : (<Typography variant="body1">{data.buyer_contact}</Typography>)}
                      </Grid>
                    )}
                  </Grid>
                </Box>
              </EditableSection>
            </Box>
            {/* 手数料情報 */}
            <Box sx={{ flex: { xs: \'1 1 100%\', md: \'0 0 50%\' } }}>
              <Paper sx={{ p: 2, height: \'100%\' }}>
                <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>手数料情報</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">手数料（計）</Typography>
                    <Typography variant="body1">{data.total_commission ? `¥${data.total_commission.toLocaleString()}` : \'-\'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">転売差額</Typography>
                    <Typography variant="body1">{data.resale_margin ? `¥${data.resale_margin.toLocaleString()}` : \'-\'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">売主から</Typography>
                    <Typography variant="body1">{data.commission_from_seller ? `¥${data.commission_from_seller.toLocaleString()}` : \'-\'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買主から</Typography>
                    <Typography variant="body1">{data.commission_from_buyer ? `¥${data.commission_from_buyer.toLocaleString()}` : \'-\'}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          </Box>
'''

new_code += '''
          {/* 7. 買付情報（全幅・条件付き表示） */}
          {(data.offer_date || data.offer_status || data.offer_amount) && (
            <Box sx={{ mb: 2, p: 2, bgcolor: \'#fff3e0\', borderRadius: 2, border: \'1px solid #ffb74d\' }}>
              <Paper sx={{ p: 2 }}>
                <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                  <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>買付情報</Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買付日</Typography>
                    <Typography variant="body1">{data.offer_date || \'-\'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買付</Typography>
                    <Typography variant="body1">{data.offer_status || \'-\'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">金額</Typography>
                    <Typography variant="body1">{data.offer_amount || \'-\'}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">会社名</Typography>
                    <Typography variant="body1">{data.company_name || \'-\'}</Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" fontWeight="bold">買付コメント</Typography>
                    <Typography variant="body1">{data.offer_comment || \'-\'}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </Box>
          )}

          {/* 8. 添付画像・資料（全幅） */}
          <Box sx={{ mb: 2, p: 2, bgcolor: \'#f1f8e9\', borderRadius: 2, border: \'1px solid #aed581\' }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ mb: 2, pb: 1, borderBottom: `2px solid ${SECTION_COLORS.property.main}` }}>
                <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>添付画像・資料</Typography>
              </Box>
              <Grid container spacing={2}>
                {data.image_url && (
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ border: \'1px solid #ddd\', borderRadius: 1, p: 2, textAlign: \'center\' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>画像</Typography>
                      <Button variant="outlined" size="small" href={data.image_url} target="_blank" rel="noopener noreferrer">
                        画像を開く
                      </Button>
                    </Box>
                  </Grid>
                )}
                {data.pdf_url && (
                  <Grid item xs={12} sm={4}>
                    <Box sx={{ border: \'1px solid #ddd\', borderRadius: 1, p: 2, textAlign: \'center\' }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>PDF</Typography>
                      <Button variant="outlined" size="small" href={data.pdf_url} target="_blank" rel="noopener noreferrer">
                        PDFを開く
                      </Button>
                    </Box>
                  </Grid>
                )}
              </Grid>
              {!data.image_url && !data.pdf_url && (
                <Typography variant="body2" color="text.secondary">添付資料がありません</Typography>
              )}
            </Paper>
          </Box>
        </Grid>
      </Grid>

      <Snackbar'''

# 置き換え実行
new_text = text[:idx_start] + new_code + text[idx_end + len(old_end):]

# UTF-8で書き込む
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(new_text.encode('utf-8'))

print('Done! File written successfully.')
print(f'Original length: {len(text)}')
print(f'New length: {len(new_text)}')
