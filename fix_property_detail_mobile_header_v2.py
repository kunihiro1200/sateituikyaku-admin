# -*- coding: utf-8 -*-
"""
物件詳細画面のスマホ版ヘッダー改善（買主詳細画面パターン適用）
"""

with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. ヘッダー部分を買主詳細画面と同じパターンに変更
# 現在のヘッダー部分を探す
old_header = '''      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="h6" fontWeight="bold" sx={{ color: SECTION_COLORS.property.main }}>
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
              </Tooltip>'''

# 新しいヘッダー（買主詳細画面パターン）
new_header = '''      {/* モバイル時: 戻るボタンを画面上部に常時表示 */}
      {isMobile && (
        <Box sx={{ px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
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
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', px: 1, py: 0.5, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: isMobile ? 0.5 : 0, mb: isMobile ? 0 : 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: isMobile ? 0.5 : 2, flexWrap: isMobile ? 'wrap' : 'nowrap' }}>
          {!isMobile && (
          <IconButton onClick={handleBack} size="large">
            <ArrowBackIcon />
          </IconButton>
          )}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography 
                variant={isMobile ? 'body1' : 'h6'} 
                fontWeight="bold" 
                sx={{ 
                  color: SECTION_COLORS.property.main,
                  fontSize: isMobile ? '0.95rem' : undefined 
                }}
              >
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
              </Tooltip>'''

text = text.replace(old_header, new_header)

# 2. アクションボタン部分を探して、スマホ時はcontainedスタイルに変更
# 買付ステータスバッジの後のアクションボタン部分
old_actions = '''        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {/* 公開URLボタン */}
          <Tooltip title="公開URLを新しいタブで開く">
            <Button
              variant="outlined"
              size="small"
              startIcon={<OpenInNewIcon />}
              onClick={handleOpenPublicUrl}
            >
              公開URL
            </Button>
          </Tooltip>

          {/* 公開URLコピーボタン */}
          <Tooltip title="公開URLをコピー">
            <Button
              variant="outlined"
              size="small"
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyPublicUrl}
            >
              URLコピー
            </Button>
          </Tooltip>

          {/* 売主へメール送信ボタン */}
          {data.seller_email && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<EmailIcon />}
              onClick={handleOpenEmailDialog}
            >
              売主へメール
            </Button>
          )}

          {/* 物件テンプレート（非報告）ボタン */}
          {data.seller_email && (
            <>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AssignmentIcon />}
                onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
                endIcon={<ArrowDropDownIcon />}
                disabled={propertyEmailTemplatesLoading || propertyEmailTemplates.length === 0}
              >
                物件テンプレート
              </Button>
              <Menu
                anchorEl={templateMenuAnchor}
                open={Boolean(templateMenuAnchor)}
                onClose={() => setTemplateMenuAnchor(null)}
              >
                {propertyEmailTemplates.map((tmpl) => (
                  <MenuItem key={tmpl.id} onClick={() => handleSelectPropertyEmailTemplate(tmpl.id)}>
                    {tmpl.name}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          {/* 売主へ電話ボタン */}
          {data.seller_contact && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<PhoneIcon />}
              component="a"
              href={`tel:${data.seller_contact}`}
            >
              売主へ電話
            </Button>
          )}

          {/* 売主へSMSボタン */}
          {data.seller_contact && (
            <Button
              variant="outlined"
              size="small"
              startIcon={<SmsIcon />}
              component="a"
              href={`sms:${data.seller_contact}`}
            >
              売主へSMS
            </Button>
          )}

          {/* 買主候補リストボタン */}
          <Button
            variant="outlined"
            size="small"
            startIcon={<PersonIcon />}
            onClick={handleOpenBuyerCandidates}
          >
            買主候補リスト
          </Button>
        </Box>'''

new_actions = '''        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {/* 公開URLボタン - PC時のみ表示 */}
          {!isMobile && (
            <Tooltip title="公開URLを新しいタブで開く">
              <Button
                variant="outlined"
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={handleOpenPublicUrl}
              >
                公開URL
              </Button>
            </Tooltip>
          )}

          {/* 公開URLコピーボタン - PC時のみ表示 */}
          {!isMobile && (
            <Tooltip title="公開URLをコピー">
              <Button
                variant="outlined"
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={handleCopyPublicUrl}
              >
                URLコピー
              </Button>
            </Tooltip>
          )}

          {/* 売主へメール送信ボタン */}
          {data.seller_email && (
            <Button
              variant={isMobile ? 'contained' : 'outlined'}
              size="small"
              startIcon={<EmailIcon />}
              onClick={handleOpenEmailDialog}
            >
              売主へメール
            </Button>
          )}

          {/* 物件テンプレート（非報告）ボタン */}
          {data.seller_email && (
            <>
              <Button
                variant={isMobile ? 'contained' : 'outlined'}
                size="small"
                startIcon={<AssignmentIcon />}
                onClick={(e) => setTemplateMenuAnchor(e.currentTarget)}
                endIcon={<ArrowDropDownIcon />}
                disabled={propertyEmailTemplatesLoading || propertyEmailTemplates.length === 0}
              >
                物件テンプレート
              </Button>
              <Menu
                anchorEl={templateMenuAnchor}
                open={Boolean(templateMenuAnchor)}
                onClose={() => setTemplateMenuAnchor(null)}
              >
                {propertyEmailTemplates.map((tmpl) => (
                  <MenuItem key={tmpl.id} onClick={() => handleSelectPropertyEmailTemplate(tmpl.id)}>
                    {tmpl.name}
                  </MenuItem>
                ))}
              </Menu>
            </>
          )}

          {/* 売主へ電話ボタン */}
          {data.seller_contact && (
            <Button
              variant={isMobile ? 'contained' : 'outlined'}
              color={isMobile ? 'success' : 'primary'}
              size="small"
              startIcon={<PhoneIcon />}
              component="a"
              href={`tel:${data.seller_contact}`}
            >
              売主へ電話
            </Button>
          )}

          {/* 売主へSMSボタン */}
          {data.seller_contact && (
            <Button
              variant={isMobile ? 'contained' : 'outlined'}
              size="small"
              startIcon={<SmsIcon />}
              component="a"
              href={`sms:${data.seller_contact}`}
            >
              売主へSMS
            </Button>
          )}

          {/* 買主候補リストボタン */}
          <Button
            variant={isMobile ? 'contained' : 'outlined'}
            size="small"
            startIcon={<PersonIcon />}
            onClick={handleOpenBuyerCandidates}
          >
            買主候補リスト
          </Button>
        </Box>'''

text = text.replace(old_actions, new_actions)

# UTF-8で書き込み
with open('frontend/frontend/src/pages/PropertyListingDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! PropertyListingDetailPage.tsx のスマホ版ヘッダーを改善しました')
