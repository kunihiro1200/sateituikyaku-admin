# -*- coding: utf-8 -*-
"""
初回表示時から未入力の必須フィールドをハイライト表示する。
fetchBuyer完了後に必須フィールドチェックを実行してmissingRequiredFieldsをセット。
"""

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# fetchBuyer内でbuyerデータ取得後に必須チェックを追加
old_fetch = """      setBuyer(res.data);
      // ヒアリング項目の初期値をセット（HTML形式で保存されている場合はそのまま）
      setHearingEditValue(res.data.inquiry_hearing || '');
      // 担当への伝言/質問事項の初期値をセット
      setMessageToAssigneeEditValue(res.data.message_to_assignee || '');"""

new_fetch = """      setBuyer(res.data);
      // ヒアリング項目の初期値をセット（HTML形式で保存されている場合はそのまま）
      setHearingEditValue(res.data.inquiry_hearing || '');
      // 担当への伝言/質問事項の初期値をセット
      setMessageToAssigneeEditValue(res.data.message_to_assignee || '');
      // 初回表示時から未入力の必須フィールドをハイライト
      const initialMissing: string[] = [];
      if (!res.data.initial_assignee || !String(res.data.initial_assignee).trim()) {
        initialMissing.push('initial_assignee');
      }
      if (!res.data.inquiry_source || !String(res.data.inquiry_source).trim()) {
        initialMissing.push('inquiry_source');
      }
      if (!res.data.latest_status || !String(res.data.latest_status).trim()) {
        initialMissing.push('latest_status');
      }
      const src = res.data.inquiry_source ? String(res.data.inquiry_source) : '';
      if (src.includes('メール') && (!res.data.inquiry_email_phone || !String(res.data.inquiry_email_phone).trim())) {
        initialMissing.push('inquiry_email_phone');
      }
      if (initialMissing.length > 0) {
        setMissingRequiredFields(new Set(initialMissing));
      }"""

text = text.replace(old_fetch, new_fetch)

with open('frontend/frontend/src/pages/BuyerDetailPage.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
