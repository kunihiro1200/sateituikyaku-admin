#!/usr/bin/env python3
# GmailDistributionButton.tsx の /api/emails/send-distribution 呼び出しを修正
# from -> senderAddress に変更し、propertyNumber を追加

with open('frontend/frontend/src/components/GmailDistributionButton.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# fromをsenderAddressに変更し、propertyNumberを追加
old = """      // バックエンドAPIを使用してメール送信
      const response = await api.post('/api/emails/send-distribution', {
        recipients: selectedEmails,
        subject: subject,
        body: body,
        from: senderAddress
      });"""

new = """      // バックエンドAPIを使用してメール送信
      const response = await api.post('/api/emails/send-distribution', {
        recipients: selectedEmails,
        subject: subject,
        body: body,
        senderAddress: senderAddress,
        propertyNumber: propertyNumber
      });"""

if old in text:
    text = text.replace(old, new)
    print('✅ GmailDistributionButton.tsx: send-distribution フィールド名を修正しました')
else:
    print('❌ 対象の文字列が見つかりませんでした')
    # デバッグ用に周辺を表示
    idx = text.find('/api/emails/send-distribution')
    if idx >= 0:
        print('周辺コード:')
        print(repr(text[idx-100:idx+300]))

with open('frontend/frontend/src/components/GmailDistributionButton.tsx', 'wb') as f:
    f.write(text.encode('utf-8'))

print('Done!')
