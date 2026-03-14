# -*- coding: utf-8 -*-
"""
確認ダイアログにタイトル・説明の編集フィールドを追加する
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. stateにtitle/descriptionを追加
old_dialog_state = """  const [calendarConfirmDialog, setCalendarConfirmDialog] = useState<{
    open: boolean;
    viewingDate: string;
    viewingTime: string;
    assignee: string;
    propertyAddress: string;
    googleMapUrl: string;
  }>({
    open: false,
    viewingDate: '',
    viewingTime: '',
    assignee: '',
    propertyAddress: '',
    googleMapUrl: '',
  });"""

new_dialog_state = """  const [calendarConfirmDialog, setCalendarConfirmDialog] = useState<{
    open: boolean;
    viewingDate: string;
    viewingTime: string;
    assignee: string;
    propertyAddress: string;
    googleMapUrl: string;
    title: string;
    description: string;
  }>({
    open: false,
    viewingDate: '',
    viewingTime: '',
    assignee: '',
    propertyAddress: '',
    googleMapUrl: '',
    title: '',
    description: '',
  });"""

text = text.replace(old_dialog_state, new_dialog_state)

# 2. handleCalendarButtonClick でtitle/descriptionを初期値として設定
old_open_dialog = """    // 物件情報を取得
    const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;

    // 確認ダイアログを開く
    setCalendarConfirmDialog({
      open: true,
      viewingDate: buyer.latest_viewing_date || '',
      viewingTime: buyer.viewing_time || '14:00',
      assignee: buyer.follow_up_assignee || '',
      propertyAddress: property?.address || '',
      googleMapUrl: property?.google_map_url || '',
    });"""

new_open_dialog = """    // 物件情報を取得
    const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;

    // タイトルと説明の初期値を生成
    const defaultTitle = `${buyer.viewing_mobile || '内覧'} ${property?.address || ''} ${buyer.name || buyer.buyer_number}`.trim();
    const defaultDescription =
      `物件住所: ${property?.address || 'なし'}\\n` +
      `GoogleMap: ${property?.google_map_url || 'なし'}\\n` +
      `\\n` +
      `お客様名: ${buyer.name || buyer.buyer_number}\\n` +
      `電話番号: ${buyer.phone_number || 'なし'}\\n` +
      `問合時ヒアリング: ${buyer.inquiry_hearing || 'なし'}`;

    // 確認ダイアログを開く
    setCalendarConfirmDialog({
      open: true,
      viewingDate: buyer.latest_viewing_date || '',
      viewingTime: buyer.viewing_time || '14:00',
      assignee: buyer.follow_up_assignee || '',
      propertyAddress: property?.address || '',
      googleMapUrl: property?.google_map_url || '',
      title: defaultTitle,
      description: defaultDescription,
    });"""

text = text.replace(old_open_dialog, new_open_dialog)

# 3. handleCalendarConfirm でtitle/descriptionをAPIに渡す
old_api_call = """      const response = await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: viewingDate.toISOString(),
        endTime: endDate.toISOString(),
        assignedTo: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile,
        propertyAddress: property?.address || '',
        propertyGoogleMapUrl: property?.google_map_url || '',
        inquiryHearing: buyer.inquiry_hearing || '',
        creatorName: buyer.name,
      });"""

new_api_call = """      const response = await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: viewingDate.toISOString(),
        endTime: endDate.toISOString(),
        assignedTo: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile,
        propertyAddress: property?.address || '',
        propertyGoogleMapUrl: property?.google_map_url || '',
        inquiryHearing: buyer.inquiry_hearing || '',
        creatorName: buyer.name,
        customTitle: calendarConfirmDialog.title,
        customDescription: calendarConfirmDialog.description,
      });"""

text = text.replace(old_api_call, new_api_call)

# 4. ダイアログのJSXにTextField追加（Typography表示 → TextField編集可能に変更）
old_dialog_jsx = """      {/* カレンダー登録確認ダイアログ */}
      <Dialog open={calendarConfirmDialog.open} onClose={() => setCalendarConfirmDialog(prev => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>📅 Googleカレンダーに登録しますか？</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">内覧日時</Typography>
              <Typography variant="body1">{calendarConfirmDialog.viewingDate} {calendarConfirmDialog.viewingTime}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">後続担当</Typography>
              <Typography variant="body1">{calendarConfirmDialog.assignee || '（未設定）'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">物件住所</Typography>
              <Typography variant="body1">{calendarConfirmDialog.propertyAddress || '（未設定）'}</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalendarConfirmDialog(prev => ({ ...prev, open: false }))}>キャンセル</Button>
          <Button onClick={handleCalendarConfirm} variant="contained" color="primary">保存してカレンダーに登録</Button>
        </DialogActions>
      </Dialog>"""

new_dialog_jsx = """      {/* カレンダー登録確認ダイアログ */}
      <Dialog open={calendarConfirmDialog.open} onClose={() => setCalendarConfirmDialog(prev => ({ ...prev, open: false }))} maxWidth="sm" fullWidth>
        <DialogTitle>📅 Googleカレンダーに登録</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">内覧日時</Typography>
                <Typography variant="body2">{calendarConfirmDialog.viewingDate} {calendarConfirmDialog.viewingTime}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary">後続担当</Typography>
                <Typography variant="body2">{calendarConfirmDialog.assignee || '（未設定）'}</Typography>
              </Box>
            </Box>
            <TextField
              label="タイトル"
              value={calendarConfirmDialog.title}
              onChange={(e) => setCalendarConfirmDialog(prev => ({ ...prev, title: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="説明"
              value={calendarConfirmDialog.description}
              onChange={(e) => setCalendarConfirmDialog(prev => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={5}
              size="small"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCalendarConfirmDialog(prev => ({ ...prev, open: false }))}>キャンセル</Button>
          <Button onClick={handleCalendarConfirm} variant="contained" color="primary">カレンダーに登録</Button>
        </DialogActions>
      </Dialog>"""

text = text.replace(old_dialog_jsx, new_dialog_jsx)

# 5. TextFieldのimportを追加
old_import = """import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,"""

new_import = """import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,"""

text = text.replace(old_import, new_import, 1)

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
