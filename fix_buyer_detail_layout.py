with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    text = f.read().decode('utf-8')

# ============================================================
# 1. BUYER_FIELD_SECTIONS の順序変更 + inquiry_hearing を先頭に
# ============================================================
old_sections = """const BUYER_FIELD_SECTIONS = [
  {
    title: '基本情報',
    fields: [
      { key: 'buyer_number', label: '買主番号', inlineEditable: true, readOnly: true },
      { key: 'name', label: '氏名・会社名', inlineEditable: true },
      { key: 'phone_number', label: '電話番号', inlineEditable: true },
      { key: 'email', label: 'メールアドレス', inlineEditable: true },
      { key: 'company_name', label: '法人名', inlineEditable: true },
    ],
  },
  {
    title: '問合せ・内覧情報',
    fields: [
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'follow_up_assignee', label: '後続担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'inquiry_confidence', label: '問合時確度', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'email_type', label: 'メール種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'distribution_type', label: '配信種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'owned_home_hearing', label: '持家ヒアリング', inlineEditable: true },
      { key: 'latest_viewing_date', label: '内覧日(最新)', type: 'date', inlineEditable: true },
      // viewing_notes は PropertyInfoCard 内に移動
      { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },
    ],
  },"""

new_sections = """const BUYER_FIELD_SECTIONS = [
  {
    title: '問合せ・内覧情報',
    fields: [
      { key: 'inquiry_hearing', label: '問合時ヒアリング', multiline: true, inlineEditable: true },
      { key: 'initial_assignee', label: '初動担当', inlineEditable: true },
      { key: 'follow_up_assignee', label: '後続担当', inlineEditable: true },
      { key: 'reception_date', label: '受付日', type: 'date', inlineEditable: true },
      { key: 'inquiry_source', label: '問合せ元', inlineEditable: true },
      { key: 'inquiry_confidence', label: '問合時確度', inlineEditable: true },
      { key: 'inquiry_email_phone', label: '【問合メール】電話対応', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'three_calls_confirmed', label: '3回架電確認済み', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'email_type', label: 'メール種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'distribution_type', label: '配信種別', inlineEditable: true, fieldType: 'dropdown' },
      { key: 'owned_home_hearing', label: '持家ヒアリング', inlineEditable: true },
      { key: 'latest_viewing_date', label: '内覧日(最新)', type: 'date', inlineEditable: true },
      // viewing_notes は PropertyInfoCard 内に移動
      { key: 'next_call_date', label: '次電日', type: 'date', inlineEditable: true },
    ],
  },
  {
    title: '基本情報',
    fields: [
      { key: 'buyer_number', label: '買主番号', inlineEditable: true, readOnly: true },
      { key: 'name', label: '氏名・会社名', inlineEditable: true },
      { key: 'phone_number', label: '電話番号', inlineEditable: true },
      { key: 'email', label: 'メールアドレス', inlineEditable: true },
      { key: 'company_name', label: '法人名', inlineEditable: true },
    ],
  },"""

if old_sections in text:
    text = text.replace(old_sections, new_sections)
    print('✅ セクション順序を変更しました（問合せ・内覧情報 → 基本情報）')
    print('✅ inquiry_hearing を先頭に移動しました')
else:
    print('❌ セクション定義が見つかりません')

# ============================================================
# 2. 「問い合わせ履歴テーブルセクション」を削除
# ============================================================
old_inquiry_section = """      {/* 問い合わせ履歴テーブルセクション */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            問い合わせ履歴
          </Typography>
          {/* New Gmail Send Button with Template Selection */}
          {buyer && (
            <BuyerGmailSendButton
              buyerId={buyer_number || ''}
              buyerEmail={buyer.email || ''}
              buyerName={buyer.name || ''}
              inquiryHistory={inquiryHistoryTable}
              selectedPropertyIds={selectedPropertyIds}
              size="medium"
              variant="contained"
            />
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        
        {/* Selection Controls - Keep for backward compatibility */}
        {selectedPropertyIds.size > 0 && (
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <Typography variant="body2" color="primary" fontWeight="bold">
              {selectedPropertyIds.size}件選択中
            </Typography>
            <Button 
              variant="outlined" 
              size="small"
              onClick={handleClearSelection}
            >
              選択をクリア
            </Button>
            <Button
              variant="outlined"
              size="small"
              disabled={selectedPropertyIds.size === 0}
              onClick={handleGmailSend}
              startIcon={<EmailIcon />}
            >
              旧Gmail送信 ({selectedPropertyIds.size}件)
            </Button>
          </Box>
        )}

        {/* Inquiry History Table */}
        {isLoadingHistory ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <InquiryHistoryTable
            inquiryHistory={inquiryHistoryTable}
            selectedPropertyIds={selectedPropertyIds}
            onSelectionChange={handleSelectionChange}
            onBuyerClick={handleBuyerClick}
          />
        )}
      </Paper>

"""

if old_inquiry_section in text:
    text = text.replace(old_inquiry_section, '\n')
    print('✅ 問い合わせ履歴テーブルセクションを削除しました')
else:
    print('❌ 問い合わせ履歴セクションが見つかりません')
    # 部分一致で確認
    idx = text.find('問い合わせ履歴テーブルセクション')
    if idx >= 0:
        print(f'  周辺: {repr(text[idx:idx+100])}')

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('完了')
