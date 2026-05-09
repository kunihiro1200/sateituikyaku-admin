#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
BuyerEmailCompositionModal.tsxのhandleSendでURLリンク化を行うよう修正
フロントエンドで送信前にURLをHTMLリンクに変換する
"""

with open('frontend/frontend/src/components/BuyerEmailCompositionModal.tsx', 'rb') as f:
    content = f.read()

text = content.decode('utf-8')

# \r\n を \n に正規化して処理
text_normalized = text.replace('\r\n', '\n')

old_code = """  const handleSend = async () => {
    setSending(true);
    setError(null);

    try {
      const emailData: EmailData = {
        buyerId,
        propertyId: propertyIds.length > 0 ? propertyIds[0] : undefined,
        templateId,
        subject,
        body,
        recipientEmail: buyerEmail,
        attachments,
      };

      await onSend(emailData);"""

new_code = """  // URLをHTMLリンクに変換する（<a>タグで囲まれていないURLのみ）
  const linkifyUrls = (inputText: string): string => {
    return inputText.replace(
      /(https?:\\/\\/[^\\s\\u3000\\u3001\\u3002\\uff01\\uff09\\u300d\\u300f\\u3011\\u3015\\u3017\\u3019\\u301b\\u301f\\uff3d\\uff5d\\u300b\\u300f]+)/g,
      (url: string, _group1: string, offset: number, fullText: string) => {
        const before = fullText.slice(0, offset);
        const lastAnchorOpen = before.lastIndexOf('<a ');
        const lastAnchorClose = before.lastIndexOf('</a>');
        if (lastAnchorOpen > lastAnchorClose) {
          return url;
        }
        return `<a href="${url}">${url}</a>`;
      }
    );
  };

  const handleSend = async () => {
    setSending(true);
    setError(null);

    try {
      // 送信前にURLをHTMLリンクに変換し、改行を<br>に変換
      const htmlBody = linkifyUrls(body).replace(/\\n/g, '<br>');

      const emailData: EmailData = {
        buyerId,
        propertyId: propertyIds.length > 0 ? propertyIds[0] : undefined,
        templateId,
        subject,
        body: htmlBody,
        recipientEmail: buyerEmail,
        attachments,
      };

      await onSend(emailData);"""

if old_code in text_normalized:
    text_normalized = text_normalized.replace(old_code, new_code)
    print('✅ 修正箇所が見つかりました。置換します。')
else:
    print('❌ 修正箇所が見つかりませんでした。')
    idx = text_normalized.find('handleSend')
    if idx >= 0:
        print(repr(text_normalized[idx:idx+400]))
    exit(1)

with open('frontend/frontend/src/components/BuyerEmailCompositionModal.tsx', 'wb') as f:
    f.write(text_normalized.encode('utf-8'))

print('✅ BuyerEmailCompositionModal.tsx を修正しました。')

with open('frontend/frontend/src/components/BuyerEmailCompositionModal.tsx', 'rb') as f:
    first_bytes = f.read(3)
print(f'BOMチェック: {repr(first_bytes[:3])}')
