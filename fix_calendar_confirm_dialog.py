# -*- coding: utf-8 -*-
"""
BuyerViewingResultPage.tsx に確認ダイアログを追加する
- カレンダーで開くボタン → 確認ダイアログ表示
- ダイアログ内容：日時、担当者、物件住所
- 保存ボタン → カレンダーに登録
"""

with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. stateにcalendarConfirmDialogを追加
old_state = """  const [isOfferFailedFlag, setIsOfferFailedFlag] = useState(false); // 買付外れましたフラグ"""
new_state = """  const [isOfferFailedFlag, setIsOfferFailedFlag] = useState(false); // 買付外れましたフラグ
  const [calendarConfirmDialog, setCalendarConfirmDialog] = useState<{
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

text = text.replace(old_state, new_state)

# 2. handleCalendarButtonClick を「ダイアログを開くだけ」に変更し、
#    実際の登録処理は handleCalendarConfirm に移動する
old_handler = """  const handleCalendarButtonClick = async () => {
    if (!buyer) return;

    // バリデーション実行
    const validationResult = ValidationService.validateRequiredFields(
      buyer,
      linkedProperties
    );

    // バリデーション失敗時
    if (!validationResult.isValid) {
      const errorMessage = ValidationService.getValidationErrorMessage(
        validationResult.errors
      );
      
      // スナックバーで警告メッセージを表示
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'warning',
      });
      
      return; // カレンダーを開かない
    }

    // バリデーション成功時：バックエンドAPIを呼び出してカレンダーに登録
    try {
      // 内覧日時を取得（様々な形式に対応）
      const rawViewingDate = buyer.latest_viewing_date || '';
      console.log('[Calendar] rawViewingDate:', JSON.stringify(rawViewingDate));
      
      // 数字のみ抽出して年月日を取得（"2026/3/14", "2026-3-14", "2026年3月14日" など全対応）
      const numParts = rawViewingDate.match(/\\d+/g);
      console.log('[Calendar] numParts:', numParts);
      
      if (!numParts || numParts.length < 3) {
        setSnackbar({
          open: true,
          message: `内覧日の形式が不正です（値: "${rawViewingDate}"）`,
          severity: 'error',
        });
        return;
      }
      const year = numParts[0].padStart(4, '0');
      const month = numParts[1].padStart(2, '0');
      const day = numParts[2].padStart(2, '0');
      const viewingDate = new Date(`${year}-${month}-${day}T00:00:00`);
      console.log('[Calendar] viewingDate:', viewingDate, 'isValid:', !isNaN(viewingDate.getTime()));
      if (isNaN(viewingDate.getTime())) {
        setSnackbar({
          open: true,
          message: `内覧日のパースに失敗しました（値: "${rawViewingDate}"）`,
          severity: 'error',
        });
        return;
      }
      const rawViewingTime = buyer.viewing_time || '14:00';
      
      // 時間をパース（"14:30" または "1430" 形式に対応）
      let hours: number, minutes: number;
      if (rawViewingTime.includes(':')) {
        [hours, minutes] = rawViewingTime.split(':').map(Number);
      } else if (/^\\d{3,4}$/.test(rawViewingTime.trim())) {
        // "1430" -> 14時30分, "930" -> 9時30分
        const t = rawViewingTime.trim().padStart(4, '0');
        hours = parseInt(t.substring(0, 2), 10);
        minutes = parseInt(t.substring(2, 4), 10);
      } else {
        hours = 14;
        minutes = 0;
      }
      viewingDate.setHours(hours, minutes, 0, 0);
      
      // 終了時刻（1時間後）
      const endDate = new Date(viewingDate);
      endDate.setHours(viewingDate.getHours() + 1);

      // 紐づいた物件情報を取得（最初の物件を使用）
      const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;

      console.log('[BuyerViewingResultPage] Property info:', {
        hasProperty: !!property,
        address: property?.address,
        googleMapUrl: property?.google_map_url,
        propertyNumber: property?.property_number,
      });

      // バックエンドAPIを呼び出し
      const response = await api.post('/api/buyer-appointments', {
        buyerNumber: buyer.buyer_number,
        startTime: viewingDate.toISOString(),
        endTime: endDate.toISOString(),
        assignedTo: buyer.follow_up_assignee,
        buyerName: buyer.name,
        buyerPhone: buyer.phone_number,
        buyerEmail: buyer.email,
        viewingMobile: buyer.viewing_mobile, // 内覧形態
        propertyAddress: property?.address || '', // 物件住所
        propertyGoogleMapUrl: property?.google_map_url || '', // GoogleMap URL
        inquiryHearing: buyer.inquiry_hearing || '', // 問合時ヒアリング
        creatorName: buyer.name, // 内覧取得者名（買主名を使用）
      });

      console.log('[BuyerViewingResultPage] Calendar event created:', response.data);

      // 成功メッセージを表示
      setSnackbar({
        open: true,
        message: `後続担当（${buyer.follow_up_assignee}）のGoogleカレンダーに内覧予約を登録しました`,
        severity: 'success',
      });
    } catch (error: any) {
      console.error('[BuyerViewingResultPage] Calendar event creation error:', error);
      
      // エラーメッセージを表示
      const errorMessage = error.response?.data?.error?.message || 'カレンダー登録に失敗しました';
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'error',
      });
    }
  };"""

new_handler = """  const handleCalendarButtonClick = () => {
    if (!buyer) return;

    // バリデーション実行
    const validationResult = ValidationService.validateRequiredFields(
      buyer,
      linkedProperties
    );

    // バリデーション失敗時
    if (!validationResult.isValid) {
      const errorMessage = ValidationService.getValidationErrorMessage(
        validationResult.errors
      );
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: 'warning',
      });
      return;
    }

    // 物件情報を取得
    const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;

    // 確認ダイアログを開く
    setCalendarConfirmDialog({
      open: true,
      viewingDate: buyer.latest_viewing_date || '',
      viewingTime: buyer.viewing_time || '14:00',
      assignee: buyer.follow_up_assignee || '',
      propertyAddress: property?.address || '',
      googleMapUrl: property?.google_map_url || '',
    });
  };

  const handleCalendarConfirm = async () => {
    if (!buyer) return;
    setCalendarConfirmDialog(prev => ({ ...prev, open: false }));

    try {
      const rawViewingDate = buyer.latest_viewing_date || '';
      const numParts = rawViewingDate.match(/\\d+/g);
      if (!numParts || numParts.length < 3) {
        setSnackbar({ open: true, message: `内覧日の形式が不正です（値: "${rawViewingDate}"）`, severity: 'error' });
        return;
      }
      const year = numParts[0].padStart(4, '0');
      const month = numParts[1].padStart(2, '0');
      const day = numParts[2].padStart(2, '0');
      const viewingDate = new Date(`${year}-${month}-${day}T00:00:00`);
      if (isNaN(viewingDate.getTime())) {
        setSnackbar({ open: true, message: `内覧日のパースに失敗しました（値: "${rawViewingDate}"）`, severity: 'error' });
        return;
      }
      const rawViewingTime = buyer.viewing_time || '14:00';
      let hours: number, minutes: number;
      if (rawViewingTime.includes(':')) {
        [hours, minutes] = rawViewingTime.split(':').map(Number);
      } else if (/^\\d{3,4}$/.test(rawViewingTime.trim())) {
        const t = rawViewingTime.trim().padStart(4, '0');
        hours = parseInt(t.substring(0, 2), 10);
        minutes = parseInt(t.substring(2, 4), 10);
      } else {
        hours = 14;
        minutes = 0;
      }
      viewingDate.setHours(hours, minutes, 0, 0);
      const endDate = new Date(viewingDate);
      endDate.setHours(viewingDate.getHours() + 1);

      const property = linkedProperties && linkedProperties.length > 0 ? linkedProperties[0] : null;

      const response = await api.post('/api/buyer-appointments', {
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
      });

      console.log('[BuyerViewingResultPage] Calendar event created:', response.data);

      setSnackbar({
        open: true,
        message: `後続担当（${buyer.follow_up_assignee}）のGoogleカレンダーに内覧予約を登録しました`,
        severity: 'success',
      });
    } catch (error: any) {
      console.error('[BuyerViewingResultPage] Calendar event creation error:', error);
      const errorMessage = error.response?.data?.error?.message || 'カレンダー登録に失敗しました';
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    }
  };"""

text = text.replace(old_handler, new_handler)

# 3. SnackbarのすぐBefore（閉じタグ付近）に確認ダイアログのJSXを追加
# Snackbarコンポーネントを探して、その前にDialogを挿入
old_snackbar = """      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}"""

new_snackbar = """      {/* カレンダー登録確認ダイアログ */}
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
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}"""

text = text.replace(old_snackbar, new_snackbar)

# 4. Dialog, DialogTitle, DialogContent, DialogActions のimportを追加
old_import = """import {
  Box,
  Button,"""

new_import = """import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,"""

text = text.replace(old_import, new_import, 1)

# UTF-8で書き込む
with open('frontend/frontend/src/pages/BuyerViewingResultPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
