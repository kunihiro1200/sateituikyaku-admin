# -*- coding: utf-8 -*-
"""
物件詳細画面のスマホ版ヘッダー改善
買主詳細画面と同様のレイアウトに変更
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. useTheme, useMediaQuery のインポートを追加
if 'useTheme' not in text or 'useMediaQuery' not in text:
    # MUI インポート行を探して追加
    import_line = 'import {'
    import_idx = text.find(import_line)
    if import_idx != -1:
        # 既存のインポートに追加
        next_newline = text.find('\n', import_idx)
        existing_imports = text[import_idx:next_newline]
        if 'useTheme' not in existing_imports:
            text = text[:next_newline] + '\nimport { useTheme, useMediaQuery } from \'@mui/material\';' + text[next_newline:]

# 2. isMobile の定義を追加（export default function の直後）
function_start = text.find('export default function PropertyListingDetailPage() {')
if function_start != -1:
    next_line = text.find('\n', function_start)
    # 既に isMobile が定義されていないか確認
    if 'const theme = useTheme();' not in text[function_start:function_start+500]:
        insert_pos = text.find('const { propertyNumber }', function_start)
        if insert_pos != -1:
            text = text[:insert_pos] + '''const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  ''' + text[insert_pos:]

# 3. ヘッダー部分を買主詳細画面と同じパターンに変更
# 現在のヘッダー部分を探す
header_start = text.find('{/* Header */')
if header_start != -1:
    # ヘッダーの終わりを探す（次のコメントまたは大きなBoxの終わり）
    header_end = text.find('{/* サマリー情報セクション */', header_start)
    if header_end == -1:
        header_end = text.find('<EditableSection', header_start)
    
    if header_end != -1:
        # 新しいヘッダーコードを作成
        new_header = '''      {/* Header */}
      {/* モバイル時: 戻るボタンを画面上部に独立して表示 */}
      {isMobile && (
        <Box sx={{ px: 1, py: 0.5, mb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            variant="outlined"
            size="small"
            sx={{ minHeight: 44 }}
          >
            物件リストに戻る
          </Button>
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', mb: 1, flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 0.5 : 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 2, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {!isMobile && (
          <IconButton onClick={handleBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          )}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant={isMobile ? 'body1' : 'h6'} fontWeight="bold" sx={{ color: SECTION_COLORS.property.main, fontSize: isMobile ? '0.95rem' : undefined }}>
                物件詳細 - {data.property_number}
              </Typography>
              <Tooltip title={copiedPropertyNumber ? 'コピーしました' : '物件番号をコピー'}>
                <IconButton
                  size="small"
                  onClick={handleCopyPropertyNumber}
                  sx={{ color: copiedPropertyNumber ? 'success.main' : SECTION_COLORS.property.main }}
                >
                  {copiedPropertyNumber ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              {/* 買付状況バッジ */}
              <PurchaseStatusBadge
                statusText={getPurchaseStatusText(
                  buyers.find(b => hasBuyerPurchaseStatus(b.latest_status))?.latest_status,
                  data.offer_status
                )}
              />
              {/* 公開URLボタン */}
              {!isMobile && (
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
              )}
              {!isMobile && (
              <IconButton
                size="small"
                onClick={handleCopyPublicUrl}
                sx={{ color: SECTION_COLORS.property.main }}
                title="公開URLをコピー"
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
              )}
            </Box>
            {/* 売主連絡先ボタン */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
              {data.seller_contact && (
                <Button
                  variant={isMobile ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => { window.location.href = `tel:${data.seller_contact}`; }}
                  startIcon={<PhoneIcon fontSize="small" />}
                  sx={{
                    borderColor: '#1565c0',
                    color: isMobile ? 'white' : '#1565c0',
                    backgroundColor: isMobile ? '#1565c0' : 'transparent',
                    '&:hover': {
                      borderColor: '#0d47a1',
                      backgroundColor: isMobile ? '#0d47a1' : '#1565c008',
                    },
                    py: isMobile ? 0.5 : undefined,
                  }}
                >
                  {isMobile ? 'TEL' : '売主TEL'}
                </Button>
              )}
              {data.seller_email && (
                <>
                  {/* Email送信ドロップダウンボタン（物件テンプレート） */}
                  <Button
                    variant={isMobile ? 'contained' : 'outlined'}
                    size="small"
                    onClick={(e) => {
                      if (!data.seller_email) return;
                      setTemplateMenuAnchor(e.currentTarget);
                    }}
                    disabled={!data.seller_email || propertyEmailTemplatesLoading || propertyEmailTemplates.length === 0}
                    startIcon={propertyEmailTemplatesLoading ? <CircularProgress size={14} /> : <EmailIcon fontSize="small" />}
                    endIcon={!isMobile && <ArrowDropDownIcon fontSize="small" />}
                    sx={{
                      borderColor: '#1976d2',
                      color: isMobile ? 'white' : '#1976d2',
                      backgroundColor: isMobile ? '#1976d2' : 'transparent',
                      '&:hover': {
                        borderColor: '#115293',
                        backgroundColor: isMobile ? '#115293' : '#1976d208',
                      },
                      py: isMobile ? 0.5 : undefined,
                    }}
                  >
                    {isMobile ? 'EMAIL' : 'Email送信'}
                  </Button>
                  <Menu
                    anchorEl={templateMenuAnchor}
                    open={Boolean(templateMenuAnchor)}
                    onClose={() => setTemplateMenuAnchor(null)}
                  >
                    {propertyEmailTemplates
                      .filter((tmpl) => {
                        // 「一般媒介」を含むテンプレートは atbb_status に「一般媒介」が含まれる場合のみ表示
                        if (tmpl.name.includes('一般媒介')) {
                          return (data.atbb_status || '').includes('一般媒介');
                        }
                        return true;
                      })
                      .map((tmpl) => (
                        <MenuItem key={tmpl.id} onClick={() => handleSelectPropertyEmailTemplate(tmpl.id)}>
                          {tmpl.name}
                        </MenuItem>
                      ))}
                  </Menu>
                </>
              )}
              {data.seller_contact && (
                <Button
                  variant={isMobile ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => { window.location.href = `sms:${data.seller_contact}`; }}
                  startIcon={<SmsIcon fontSize="small" />}
                  sx={{
                    borderColor: '#2e7d32',
                    color: isMobile ? 'white' : '#2e7d32',
                    backgroundColor: isMobile ? '#2e7d32' : 'transparent',
                    '&:hover': {
                      borderColor: '#1b5e20',
                      backgroundColor: isMobile ? '#1b5e20' : '#2e7d3208',
                    },
                    py: isMobile ? 0.5 : undefined,
                  }}
                >
                  SMS
                </Button>
              )}
              {data.sales_assignee && (
                <Button
                  variant={isMobile ? 'contained' : 'outlined'}
                  size="small"
                  onClick={() => setChatPanelOpen(!chatPanelOpen)}
                  sx={{
                    borderColor: '#7b1fa2',
                    color: isMobile ? 'white' : '#7b1fa2',
                    backgroundColor: isMobile ? '#7b1fa2' : 'transparent',
                    '&:hover': {
                      borderColor: '#4a148c',
                      backgroundColor: isMobile ? '#4a148c' : '#7b1fa208',
                    },
                    py: isMobile ? 0.5 : undefined,
                  }}
                >
                  担当へCHAT
                </Button>
              )}
            </Box>
            {chatPanelOpen && data.sales_assignee && (
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <TextField
                  size="small"
                  placeholder="担当へ質問_伝言"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button
                  variant="contained"
                  size="small"
                  disabled={chatSending || !chatMessage.trim()}
                  onClick={handleSendChatToAssignee}
                  sx={{ backgroundColor: '#7b1fa2', '&:hover': { backgroundColor: '#4a148c' } }}
                >
                  {chatSending ? <CircularProgress size={16} sx={{ color: 'white' }} /> : '送信'}
                </Button>
              </Box>
            )}
          </Box>
          {buyerContext?.buyerId && buyerContext?.source === 'buyer-detail' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">
                買主から遷移:
              </Typography>
'''
        
        # ヘッダー部分を置き換え
        text = text[:header_start] + new_header + text[header_end:]

# UTF-8で保存
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('✅ 物件詳細画面のスマホ版ヘッダーを改善しました')
print('   - 戻るボタンを上部に独立して配置')
print('   - タイトルとボタンを小さく表示')
print('   - ボタンをcontainedスタイルに変更（スマホ時）')
