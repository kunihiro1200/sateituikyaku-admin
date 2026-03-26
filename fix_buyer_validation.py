#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerDetailPage.tsx の validateRequiredFields を checkMissingFields に置き換え、
ValidationWarningDialog 対応の handleNavigate を追加する
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. import に ValidationWarningDialog を追加
old_import = "import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';"
new_import = """import RichTextCommentEditor, { RichTextCommentEditorHandle } from '../components/RichTextCommentEditor';
import { ValidationWarningDialog } from '../components/ValidationWarningDialog';"""
text = text.replace(old_import, new_import, 1)

# 2. validateRequiredFields を checkMissingFields に置き換え（ダイアログ方式）
old_validate = """  // 必須フィールドバリデーション（ページ遷移前チェック）
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
    if (!buyer.distribution_type || !String(buyer.distribution_type).trim()) {
      missing.push('distribution_type');
    }

    // 問合せ元にメールが含まれる場合は inquiry_email_phone も必須
    const inquirySource = buyer.inquiry_source ? String(buyer.inquiry_source) : '';
    if (inquirySource.includes('メール')) {
      if (!buyer.inquiry_email_phone || !String(buyer.inquiry_email_phone).trim()) {
        missing.push('inquiry_email_phone');
      }
      // inquiry_email_phone に値がある場合は three_calls_confirmed も必須
      if (buyer.inquiry_email_phone && String(buyer.inquiry_email_phone).trim()) {
        if (!buyer.three_calls_confirmed || !String(buyer.three_calls_confirmed).trim()) {
          missing.push('three_calls_confirmed');
        }
      }
    }

    if (missing.length > 0) {
      setMissingRequiredFields(new Set(missing));
      const labelMap: Record<string, string> = {
        initial_assignee: '初動担当',
        inquiry_source: '問合せ元',
        latest_status: '★最新状況',
        distribution_type: '配信メール',
        inquiry_email_phone: '【問合メール】電話対応',
        three_calls_confirmed: '3回架電確認済み',
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
  };"""

new_validate = """  // 必須フィールドの表示名マップ
  const REQUIRED_FIELD_LABEL_MAP: Record<string, string> = {
    initial_assignee: '初動担当',
    inquiry_source: '問合せ元',
    latest_status: '★最新状況',
    distribution_type: '配信メール',
    inquiry_email_phone: '【問合メール】電話対応',
    three_calls_confirmed: '3回架電確認済み',
    desired_area: 'エリア（希望条件）',
    budget: '予算（希望条件）',
    desired_property_type: '希望種別（希望条件）',
  };

  // 未入力の必須項目の表示名リストを返す（空配列 = 全て入力済み）
  const checkMissingFields = (): string[] => {
    if (!buyer) return [];

    const missingKeys: string[] = [];

    // 常に必須
    if (!buyer.initial_assignee || !String(buyer.initial_assignee).trim()) {
      missingKeys.push('initial_assignee');
    }
    if (!buyer.inquiry_source || !String(buyer.inquiry_source).trim()) {
      missingKeys.push('inquiry_source');
    }
    if (!buyer.latest_status || !String(buyer.latest_status).trim()) {
      missingKeys.push('latest_status');
    }
    if (!buyer.distribution_type || !String(buyer.distribution_type).trim()) {
      missingKeys.push('distribution_type');
    }

    // 問合せ元にメールが含まれる場合は inquiry_email_phone も必須
    const inquirySource = buyer.inquiry_source ? String(buyer.inquiry_source) : '';
    if (inquirySource.includes('メール')) {
      if (!buyer.inquiry_email_phone || !String(buyer.inquiry_email_phone).trim()) {
        missingKeys.push('inquiry_email_phone');
      }
      // inquiry_email_phone に値がある場合は three_calls_confirmed も必須
      if (buyer.inquiry_email_phone && String(buyer.inquiry_email_phone).trim()) {
        if (!buyer.three_calls_confirmed || !String(buyer.three_calls_confirmed).trim()) {
          missingKeys.push('three_calls_confirmed');
        }
      }
    }

    // 配信メールが「要」の場合は希望条件の3項目も必須
    if (buyer.distribution_type && String(buyer.distribution_type).trim() === '要') {
      if (!buyer.desired_area || !String(buyer.desired_area).trim()) {
        missingKeys.push('desired_area');
      }
      if (!buyer.budget || !String(buyer.budget).trim()) {
        missingKeys.push('budget');
      }
      if (!buyer.desired_property_type || !String(buyer.desired_property_type).trim()) {
        missingKeys.push('desired_property_type');
      }
    }

    // ハイライト用 state を更新
    setMissingRequiredFields(new Set(missingKeys));

    return missingKeys.map(k => REQUIRED_FIELD_LABEL_MAP[k] || k);
  };

  // バリデーション警告ダイアログ用 state
  const [validationDialogOpen, setValidationDialogOpen] = useState(false);
  const [pendingNavigationUrl, setPendingNavigationUrl] = useState<string>('');

  // 遷移前バリデーション共通ハンドラー
  const handleNavigate = (url: string) => {
    const missing = checkMissingFields();
    if (missing.length > 0) {
      setPendingNavigationUrl(url);
      setValidationDialogOpen(true);
    } else {
      navigate(url);
    }
  };"""

text = text.replace(old_validate, new_validate, 1)

# 3. 問合履歴・希望条件・内覧ボタンの遷移を handleNavigate に切り替え
old_nav_buttons = """          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => { if (validateRequiredFields()) navigate(`/buyers/${buyer_number}/inquiry-history`); }}
          >
            問合履歴{inquiryHistoryTable.length}件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => { if (validateRequiredFields()) navigate(`/buyers/${buyer_number}/desired-conditions`); }}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => { if (validateRequiredFields()) navigate(`/buyers/${buyer_number}/viewing-result`); }}
          >
            内覧
          </Button>"""

new_nav_buttons = """          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => handleNavigate(`/buyers/${buyer_number}/inquiry-history`)}
          >
            問合履歴{inquiryHistoryTable.length}件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => handleNavigate(`/buyers/${buyer_number}/desired-conditions`)}
          >
            希望条件
          </Button>
          <Button
            variant="outlined"
            color="success"
            size="small"
            onClick={() => handleNavigate(`/buyers/${buyer_number}/viewing-result`)}
          >
            内覧
          </Button>"""

text = text.replace(old_nav_buttons, new_nav_buttons, 1)

# 4. 戻るボタン（ArrowBackIcon）を handleNavigate に切り替え
old_back_button = """          <IconButton 
            onClick={() => navigate('/buyers')} 
            sx={{ mr: 2 }}
            aria-label="戻る"
          >
            <ArrowBackIcon />
          </IconButton>"""

new_back_button = """          <IconButton 
            onClick={() => handleNavigate('/buyers')} 
            sx={{ mr: 2 }}
            aria-label="戻る"
          >
            <ArrowBackIcon />
          </IconButton>"""

text = text.replace(old_back_button, new_back_button, 1)

# 5. 買主番号検索バーの Enter キーを handleNavigate に切り替え
old_search = """          onKeyDown={(e) => {
            if (e.key === 'Enter' && buyerNumberSearch.trim()) {
              navigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
            }
          }}"""

new_search = """          onKeyDown={(e) => {
            if (e.key === 'Enter' && buyerNumberSearch.trim()) {
              handleNavigate(`/buyers/${toHalfWidth(buyerNumberSearch.trim())}`);
            }
          }}"""

text = text.replace(old_search, new_search, 1)

# 6. ValidationWarningDialog を JSX に追加（Snackbar の直前）
old_snackbar = """      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}"""

new_snackbar = """      {/* バリデーション警告ダイアログ */}
      <ValidationWarningDialog
        open={validationDialogOpen}
        missingFieldLabels={pendingNavigationUrl ? checkMissingFields() : []}
        onProceed={() => {
          setValidationDialogOpen(false);
          navigate(pendingNavigationUrl);
        }}
        onStay={() => setValidationDialogOpen(false)}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}"""

text = text.replace(old_snackbar, new_snackbar, 1)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done! BuyerDetailPage.tsx updated successfully.')
