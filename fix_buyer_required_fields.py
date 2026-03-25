# -*- coding: utf-8 -*-
"""
買主詳細画面の変更:
1. メール種別フィールドを削除
2. ページ遷移時の必須バリデーション追加
3. 問合せ元にメールが含まれる場合、inquiry_email_phone も必須
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# 1. メール種別フィールドを削除
old_email_type = """      { key: 'email_type', label: 'メール種別', inlineEditable: true, fieldType: 'dropdown' },
"""
text = text.replace(old_email_type, '')

# 2. ページ遷移ボタンにバリデーション関数を追加
# navigate の後にバリデーション関数を挿入
old_navigate_line = "  const navigate = useNavigate();"
new_navigate_line = """  const navigate = useNavigate();

  // 必須フィールドバリデーション（ページ遷移前チェック）
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
  };"""

text = text.replace(old_navigate_line, new_navigate_line)

# 3. 問合履歴ボタンのonClickにバリデーション追加
old_inquiry_btn = """            onClick={() => navigate(`/buyers/${buyer_number}/inquiry-history`)}"""
new_inquiry_btn = """            onClick={() => { if (validateRequiredFields()) navigate(`/buyers/${buyer_number}/inquiry-history`); }}"""
text = text.replace(old_inquiry_btn, new_inquiry_btn)

# 4. 希望条件ボタンのonClickにバリデーション追加
old_desired_btn = """            onClick={() => navigate(`/buyers/${buyer_number}/desired-conditions`)}"""
new_desired_btn = """            onClick={() => { if (validateRequiredFields()) navigate(`/buyers/${buyer_number}/desired-conditions`); }}"""
text = text.replace(old_desired_btn, new_desired_btn)

# 5. 内覧ボタンのonClickにバリデーション追加
old_viewing_btn = """            onClick={() => navigate(`/buyers/${buyer_number}/viewing-result`)}"""
new_viewing_btn = """            onClick={() => { if (validateRequiredFields()) navigate(`/buyers/${buyer_number}/viewing-result`); }}"""
text = text.replace(old_viewing_btn, new_viewing_btn)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
print('変更内容:')
print('  1. メール種別フィールドを削除')
print('  2. 問合履歴・希望条件・内覧ボタンに必須バリデーション追加')
print('  3. 問合せ元にメールが含まれる場合、【問合メール】電話対応も必須')
