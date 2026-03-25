# -*- coding: utf-8 -*-
"""
修正内容:
1. validateRequiredFields を state 定義の後に移動（snackbar参照エラー修正）
2. normalInitials フォールバック追加（ボタン消える問題の対策）
3. missingRequiredFields state 追加 → 必須フィールドを赤枠でハイライト
4. 初動担当ボタンエリアにも必須ハイライト適用
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. validateRequiredFields を navigate の直後から削除（state定義前にあるため）
old_validate_block = """  // 必須フィールドバリデーション（ページ遷移前チェック）
  const validateRequiredFields = (): boolean => {
    if (!buyer) return false;

    const missing: string[] = [];

    // 常に必須
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim()) {
      missing.push('初動担当');
    }
    if (!buyer.inquiry_source || !String(buyer.inquiry_source).trim()) {
      missing.push('問合せ元');
    }
    if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
      missing.push('★最新状況');
    }

    // 問合せ元にメールが含まれる場合は inquiry_email_phone も必須
    const inquirySource = buyer.inquiry_source ? String(buyer.inquiry_source) : '';
    if (inquirySource.includes('メール')) {
      if (!buyer.inquiry_email_phone || !String(buyer.inquiry_email_phone).trim()) {
        missing.push('【問合メール】電話対応');
      }
    }

    if (missing.length > 0) {
      setSnackbar({
        open: true,
        message: `以下の必須項目を入力してください：${missing.join('、')}`,
        severity: 'warning',
      });
      return false;
    }
    return true;
  };
  const [buyer, setBuyer] = useState<Buyer | null>(null);"""

new_validate_block = """  const [buyer, setBuyer] = useState<Buyer | null>(null);"""

text = text.replace(old_validate_block, new_validate_block)

# 2. snackbar state の後に missingRequiredFields state と validateRequiredFields を追加
old_after_snackbar = """  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // セクション別 DirtyState 管理"""

new_after_snackbar = """  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'warning' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // 必須フィールド未入力ハイライト用
  const [missingRequiredFields, setMissingRequiredFields] = useState<Set<string>>(new Set());

  // 必須フィールドバリデーション（ページ遷移前チェック）
  const validateRequiredFields = (): boolean => {
    if (!buyer) return false;

    const missing: string[] = [];

    // 常に必須
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim()) {
      missing.push('initial_assignee');
    }
    if (!buyer.inquiry_source || !String(buyer.inquiry_source).trim()) {
      missing.push('inquiry_source');
    }
    if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
      missing.push('latest_status');
    }

    // 問合せ元にメールが含まれる場合は inquiry_email_phone も必須
    const inquirySource = buyer.inquiry_source ? String(buyer.inquiry_source) : '';
    if (inquirySource.includes('メール')) {
      if (!buyer.inquiry_email_phone || !String(buyer.inquiry_email_phone).trim()) {
        missing.push('inquiry_email_phone');
      }
    }

    if (missing.length > 0) {
      setMissingRequiredFields(new Set(missing));
      const labelMap: Record<string, string> = {
        initial_assignee: '初動担当',
        inquiry_source: '問合せ元',
        latest_status: '★最新状況',
        inquiry_email_phone: '【問合メール】電話対応',
      };
      const labels = missing.map(k => labelMap[k] || k);
      setSnackbar({
        open: true,
        message: `以下の必須項目を入力してください：${labels.join('、')}`,
        severity: 'warning',
      });
      return false;
    }
    setMissingRequiredFields(new Set());
    return true;
  };

  // セクション別 DirtyState 管理"""

text = text.replace(old_after_snackbar, new_after_snackbar)

# 3. 初動担当ボタンエリアに必須ハイライト追加
old_initial_assignee_box = """                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {normalInitials.map((initial) => {
                              const isSelected = buyer.initial_assignee === initial;"""

new_initial_assignee_box = """                          <Box sx={{
                            display: 'flex', flexWrap: 'wrap', gap: 0.5,
                            border: missingRequiredFields.has('initial_assignee') ? '2px solid #f44336' : 'none',
                            borderRadius: missingRequiredFields.has('initial_assignee') ? 1 : 0,
                            p: missingRequiredFields.has('initial_assignee') ? 0.5 : 0,
                            bgcolor: missingRequiredFields.has('initial_assignee') ? 'rgba(244,67,54,0.05)' : 'transparent',
                          }}>
                            {normalInitials.length === 0 && (
                              <Typography variant="caption" color="text.secondary">読み込み中...</Typography>
                            )}
                            {normalInitials.map((initial) => {
                              const isSelected = buyer.initial_assignee === initial;"""

text = text.replace(old_initial_assignee_box, new_initial_assignee_box)

# 4. 初動担当ラベルに必須マーク追加
old_initial_label = """                            <Typography variant="caption" color="text.secondary">
                              {field.label}
                            </Typography>
                            {/* 「問合せ内容」セクションの保存ボタンは初動担当の右横に配置 */}"""

new_initial_label = """                            <Typography variant="caption" color={missingRequiredFields.has('initial_assignee') ? 'error' : 'text.secondary'} sx={{ fontWeight: missingRequiredFields.has('initial_assignee') ? 'bold' : 'normal' }}>
                              {field.label}{missingRequiredFields.has('initial_assignee') ? ' *' : ''}
                            </Typography>
                            {/* 「問合せ内容」セクションの保存ボタンは初動担当の右横に配置 */}"""

text = text.replace(old_initial_label, new_initial_label)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
